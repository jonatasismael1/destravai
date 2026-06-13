import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Funcao generica de IA: recebe um prompt, valida o usuario logado, aplica o
// limite mensal de geracoes, chama o provedor de IA no servidor (chave nunca
// exposta) e devolve o texto. Suporta OpenRouter (modelo com '/') e Gemini.
// Esta e' a funcao PRINCIPAL do app: roda na Edge Function do Supabase, que NAO
// tem o teto de ~10s da Netlify Free, entao aguenta a fila dos modelos :free.

const LEGACY_DEFAULT_MODEL =
  Deno.env.get('DEFAULT_AI_MODEL') || Deno.env.get('GEMINI_MODEL') || 'openrouter/free'
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY')
const OPENROUTER_URL = (Deno.env.get('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const APP_REFERER = (Deno.env.get('APP_URL') || 'https://destravai.dbe.digital').replace(/\/$/, '')
// Cadeia de fallback do OpenRouter (máx 3). Ordene do mais rápido p/ o mais lento.
const OPENROUTER_MODELS = (Deno.env.get('OPENROUTER_MODELS') || '')
  .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3)
const AI_MODEL_PRIMARY = Deno.env.get('AI_MODEL_PRIMARY') || LEGACY_DEFAULT_MODEL
const AI_PROVIDER_PRIMARY = normalizeProvider(Deno.env.get('AI_PROVIDER_PRIMARY')) || providerForModel(AI_MODEL_PRIMARY)
const AI_MODEL_FALLBACK = Deno.env.get('AI_MODEL_FALLBACK') || ''
const AI_PROVIDER_FALLBACK = normalizeProvider(Deno.env.get('AI_PROVIDER_FALLBACK')) || (AI_MODEL_FALLBACK ? providerForModel(AI_MODEL_FALLBACK) : null)
const MONTHLY_LIMIT = 1000 // geracoes bem-sucedidas por usuario por mes
const COURTESY_MONTHLY_LIMIT = 200 // teto menor para acesso de cortesia (testador)
// Janela por minuto: 15 geracoes/min por usuario — impede bursts automatizados
const PER_MINUTE_LIMIT = 15
const COURTESY_PER_MINUTE_LIMIT = 5 // cortesia tem teto menor tambem por minuto
const PER_MINUTE_MS = 60 * 1000
// Timeout por tentativa de provedor: a Edge nao tem o teto de ~10s da Netlify
// Free, entao 30s e' seguro e generoso sem deixar a requisicao pendurada.
const AI_TIMEOUT_MS = 30000

const isOpenRouterModel = (m: string) => typeof m === 'string' && m.includes('/')

type AiProvider = 'openrouter' | 'gemini'

function normalizeProvider(provider: string | null | undefined): AiProvider | null {
  const value = String(provider || '').trim().toLowerCase()
  if (value === 'openrouter') return 'openrouter'
  if (value === 'gemini' || value === 'google') return 'gemini'
  return null
}

function providerForModel(model: string): AiProvider {
  return isOpenRouterModel(model) ? 'openrouter' : 'gemini'
}

function buildProviderAttempts(requestedModel?: string): Array<{ provider: AiProvider; model: string }> {
  const primaryModel = requestedModel || AI_MODEL_PRIMARY
  const primaryProvider = requestedModel ? providerForModel(primaryModel) : AI_PROVIDER_PRIMARY
  const attempts = [{ provider: primaryProvider, model: primaryModel }]

  if (AI_PROVIDER_FALLBACK && AI_MODEL_FALLBACK) {
    const fallback = { provider: AI_PROVIDER_FALLBACK, model: AI_MODEL_FALLBACK }
    const alreadyIncluded = attempts.some((attempt) => (
      attempt.provider === fallback.provider && attempt.model === fallback.model
    ))
    if (!alreadyIncluded) attempts.push(fallback)
  }

  return attempts
}

function openRouterModelsFor(model: string): string[] {
  if (OPENROUTER_MODELS.length && model === AI_MODEL_PRIMARY) return OPENROUTER_MODELS
  return [model]
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse('Token ausente', 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    // Cliente com o JWT do usuario: usado SO para validar quem e' o usuario.
    const authClient = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return errorResponse('Nao autorizado', 401)

    // Cliente com service role: usado para contagem/logs (ignora RLS, igual a
    // Netlify Function). Evita falhas de permissao ao gravar o uso.
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    const body = await req.json().catch(() => ({})) as {
      prompt?: string
      temperature?: number
      maxOutputTokens?: number
      model?: string
      promptType?: string
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) return errorResponse('Parametro prompt obrigatorio', 400)

    // Gating de assinatura: só quem tem acesso (assinatura ativa, cortesia ou admin)
    // usa a IA. FAIL-CLOSED: se a consulta de assinatura FALHAR (bug/instabilidade),
    // o usuário comum é BLOQUEADO — não liberamos IA paga por erro nosso. Exceção:
    // admin segue (fail-open só para ele) e a falha vira um alerta no log.
    // Desligavel por env: AI_ENFORCE_SUBSCRIPTION=false.
    const enforceAccess = (Deno.env.get('AI_ENFORCE_SUBSCRIPTION') ?? 'true') !== 'false'
    // Acesso vem so de cortesia (testador)? Usa limites menores; nao muda quem
    // entra ou nao — apenas marca a origem do acesso a partir da MESMA consulta.
    let isCourtesy = false
    if (enforceAccess) {
      const adminEmail = (Deno.env.get('ADMIN_EMAIL') || 'assessoriadbe@gmail.com').toLowerCase()
      const isAdmin = (user.email ?? '').toLowerCase() === adminEmail
      let allowed = false
      let checkFailed = false
      try {
        if (isAdmin) {
          allowed = true
        } else {
          const { data: sub, error: subErr } = await supabase
            .from('subscriptions')
            .select('status, payment_status, payment_method, access_granted, current_period_end')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (subErr) throw subErr
          if (sub) {
            if (sub.payment_method === 'COURTESY' && sub.access_granted) { allowed = true; isCourtesy = true }
            else if (['active', 'trialing'].includes(sub.status) && sub.payment_status === 'paid') allowed = true
            else if (sub.status === 'canceled' && sub.current_period_end && new Date(sub.current_period_end) >= new Date()) allowed = true
          }
        }
      } catch (err) {
        // Falha na consulta: bloqueia usuário comum; admin passa. Registra alerta.
        checkFailed = true
        allowed = isAdmin
        try {
          await supabase.rpc('destravai_log_error', {
            p_source: 'edge:gemini:access-check',
            p_message: `Falha ao consultar assinatura (fail-closed${allowed ? ', liberado p/ admin' : ', bloqueado'}): ${err instanceof Error ? err.message : String(err)}`.slice(0, 2000),
            p_level: 'alert',
            p_user_id: user.id,
            p_details: null,
          })
        } catch { /* log nunca derruba o serviço */ }
      }
      if (!allowed) {
        return errorResponse(
          checkFailed
            ? 'Não foi possível confirmar sua assinatura agora. Tente novamente em instantes.'
            : 'Sua assinatura não está ativa. Reative para continuar usando a IA.',
          402,
        )
      }
    }

    // Rate limit por minuto (anti-burst): mesmo contador da Netlify, via RPC
    // destravai_rate_limit_increment com o client service role (EXECUTE e'
    // revogado de anon/authenticated). FAIL-OPEN: se o contador falhar, NAO
    // bloqueia — nao derrubamos a IA por instabilidade do contador.
    const perMinuteLimit = isCourtesy ? COURTESY_PER_MINUTE_LIMIT : PER_MINUTE_LIMIT
    try {
      const nowMs = Date.now()
      const windowStart = Math.floor(nowMs / PER_MINUTE_MS) * PER_MINUTE_MS
      const { data: rlCount, error: rlError } = await supabase.rpc('destravai_rate_limit_increment', {
        p_key: `gemini:user:${user.id}`,
        p_window_start: new Date(windowStart).toISOString(),
        p_window_end: new Date(windowStart + PER_MINUTE_MS).toISOString(),
      })
      if (rlError) {
        console.warn('[edge:gemini] rate limit RPC falhou (fail-open):', rlError.message)
      } else if ((rlCount ?? 1) > perMinuteLimit) {
        return errorResponse('Muitas gerações em pouco tempo. Aguarde 1 minuto e tente novamente.', 429)
      }
    } catch (err) {
      console.warn('[edge:gemini] rate limit indisponivel (fail-open):', err instanceof Error ? err.message : String(err))
    }

    // Limite mensal: conta geracoes bem-sucedidas no mes corrente
    const monthlyLimit = isCourtesy ? COURTESY_MONTHLY_LIMIT : MONTHLY_LIMIT
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const { count, error: countError } = await supabase
      .from('destravai_ai_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'success')
      .gte('created_at', monthStart)

    if (!countError && (count ?? 0) >= monthlyLimit) {
      return errorResponse(
        `Voce atingiu o limite de ${monthlyLimit} geracoes neste mes. O limite renova no inicio do proximo mes.`,
        429,
      )
    }

    const requestedModel = body.model ? String(body.model).trim() : undefined
    const attempts = buildProviderAttempts(requestedModel)
    const promptType = body.promptType ?? 'generic_ai'
    const wantsJson = /JSON/i.test(prompt)

    const geminiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')
    if (attempts.some((attempt) => attempt.provider === 'openrouter') && !OPENROUTER_KEY) return errorResponse('Chave OpenRouter nao configurada no servidor', 500)
    if (attempts.some((attempt) => attempt.provider === 'gemini') && !geminiKey) return errorResponse('Chave Gemini nao configurada no servidor', 500)

    const temperature = body.temperature ?? 0.9
    const maxOutputTokens = body.maxOutputTokens ?? 8192

    let usedModel = attempts[0]?.model || AI_MODEL_PRIMARY
    let lastMsg = 'A IA retornou vazio.'
    let lastStatus = 502

    for (const attempt of attempts) {
      // Timeout por tentativa: aborta a chamada travada e segue para o proximo
      // modelo da cadeia (mesmo comportamento da Netlify Function).
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
      let res: Response
      try {
        if (attempt.provider === 'openrouter') {
          res = await fetch(`${OPENROUTER_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENROUTER_KEY}`,
              'HTTP-Referer': APP_REFERER,
              'X-Title': 'Destravai',
            },
            body: JSON.stringify({
              models: openRouterModelsFor(attempt.model),
              messages: [{ role: 'user', content: prompt }],
              temperature,
              max_tokens: maxOutputTokens,
              ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
            }),
            signal: controller.signal,
          })
        } else {
          const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens }
          if (wantsJson) generationConfig.responseMimeType = 'application/json'
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
            signal: controller.signal,
          })
        }
      } catch (e) {
        // Abort vira 'timeout'; falha de rede tambem e' falha so desta tentativa.
        lastStatus = 504
        lastMsg = e instanceof Error && e.name === 'AbortError'
          ? 'timeout'
          : (e instanceof Error ? e.message : 'falha de rede')
        usedModel = attempt.model
        continue
      } finally {
        clearTimeout(timer)
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } }
        lastStatus = res.status
        lastMsg = errBody?.error?.message ?? `IA HTTP ${res.status}`
        usedModel = attempt.model
        continue
      }

      const data = await res.json() as {
        model?: string
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        choices?: Array<{ message?: { content?: string } }>
        usage?: { total_tokens?: number }
        usageMetadata?: { totalTokenCount?: number }
      }
      usedModel = attempt.provider === 'openrouter' && data?.model ? data.model : attempt.model
      const text = attempt.provider === 'openrouter'
        ? (data?.choices?.[0]?.message?.content ?? '')
        : (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
      if (!text) {
        lastStatus = 502
        lastMsg = 'A IA retornou vazio.'
        continue
      }

      // Tokens consumidos: cada provedor informa num campo proprio; se o
      // provedor nao mandar, fica null (nao inventamos valor).
      const tokensUsed = attempt.provider === 'openrouter'
        ? (data?.usage?.total_tokens ?? null)
        : (data?.usageMetadata?.totalTokenCount ?? null)

    // Log de sucesso — tolerante: nunca pode quebrar a resposta da IA.
      try {
        await supabase.from('destravai_ai_generations').insert({
          user_id: user.id, prompt_type: promptType, model: usedModel, status: 'success', tokens_used: tokensUsed,
        })
      } catch { /* ignora: a geracao ja deu certo */ }

      return jsonResponse({ text })
    }

    supabase.from('destravai_ai_generations').insert({
      user_id: user.id, prompt_type: promptType, model: usedModel, status: 'error', error_message: lastMsg,
    }).then(() => {}).catch(() => {})
    if (lastStatus === 429) return errorResponse('Muitas geracoes em pouco tempo. Espere um minuto.', 429)
    return errorResponse(lastMsg, lastStatus)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return errorResponse(msg, 500)
  }
})

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
