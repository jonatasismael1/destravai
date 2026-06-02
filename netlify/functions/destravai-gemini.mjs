// POST /.netlify/functions/destravai-gemini
// Geração de IA no servidor (mesma origem do app). Valida o usuário logado,
// aplica o limite mensal e chama o Gemini — a chave nunca vai ao frontend.
// Substitui a Edge Function do Supabase para não depender do projeto certo
// estar configurado no MCP nem de secret separado.

import { json, preflight, getUser, supabaseAdmin, serverLog, userHasActiveAccess, isAdminUser } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

// Gating de assinatura para a IA. Pode ser desligado por env (interruptor de
// emergência) sem deploy: AI_ENFORCE_SUBSCRIPTION=false.
const ENFORCE_AI_ACCESS = (process.env.AI_ENFORCE_SUBSCRIPTION ?? 'true') !== 'false'

// ── Provedor de IA ───────────────────────────────────────────────────────────
// Modelo padrão: DEFAULT_AI_MODEL (ex.: 'openrouter/free'). Mantém compat com as
// envs antigas do Gemini. Modelos com '/' (ex.: 'openrouter/free',
// 'meta-llama/llama-3.3-70b') vão pelo OpenRouter; o resto pelo Gemini.
const LEGACY_DEFAULT_MODEL =
  process.env.DEFAULT_AI_MODEL ||
  process.env.GEMINI_MODEL ||
  process.env.VITE_GEMINI_MODEL ||
  'openrouter/free'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const APP_REFERER = (process.env.APP_URL || 'https://destravai.dbe.digital').replace(/\/$/, '')

// Cadeia de modelos do OpenRouter (fallback NATIVO numa única requisição — sem
// múltiplas chamadas que estourariam o tempo). O OpenRouter aceita NO MÁXIMO 3.
// Ordene do mais RÁPIDO para o mais lento: no plano Free do Netlify (10s) o
// modelo precisa caber nesse tempo, então o 1º deve ser ágil.
const OPENROUTER_MODELS = (process.env.OPENROUTER_MODELS || '')
  .split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3)

const AI_MODEL_PRIMARY = process.env.AI_MODEL_PRIMARY || LEGACY_DEFAULT_MODEL
const AI_PROVIDER_PRIMARY = normalizeProvider(process.env.AI_PROVIDER_PRIMARY) || providerForModel(AI_MODEL_PRIMARY)
const AI_MODEL_FALLBACK = process.env.AI_MODEL_FALLBACK || ''
const AI_PROVIDER_FALLBACK = normalizeProvider(process.env.AI_PROVIDER_FALLBACK) || (AI_MODEL_FALLBACK ? providerForModel(AI_MODEL_FALLBACK) : null)

const MONTHLY_LIMIT = 1000
// Janela por minuto: 15 gerações/min por usuário — impede bursts automatizados
const PER_MINUTE_LIMIT = 15
const PER_MINUTE_MS = 60 * 1000

// Modelo do OpenRouter? (tem provedor no nome, no formato "provedor/modelo")
function isOpenRouterModel(model) {
  return typeof model === 'string' && model.includes('/')
}

function normalizeProvider(provider) {
  const value = String(provider || '').trim().toLowerCase()
  if (value === 'openrouter') return 'openrouter'
  if (value === 'gemini' || value === 'google') return 'gemini'
  return null
}

function providerForModel(model) {
  return isOpenRouterModel(model) ? 'openrouter' : 'gemini'
}

function buildProviderAttempts(requestedModel) {
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

function openRouterModelsFor(model) {
  if (OPENROUTER_MODELS.length && model === AI_MODEL_PRIMARY) return OPENROUTER_MODELS
  return [model]
}

// Chama o OpenRouter (API compatível com a da OpenAI: /chat/completions).
// `models` é um array (cadeia de fallback). `wantsJson` força saída JSON válida
// (response_format) — resolve o "JSON not found" e o roteiro cortado.
// Retorna { ok, text, status, msg, model }.
async function callOpenRouter(models, prompt, cfg, wantsJson, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        // Recomendados pelo OpenRouter (ranking/limites por app).
        'HTTP-Referer': APP_REFERER,
        'X-Title': 'Destravai',
      },
      body: JSON.stringify({
        models,                       // cadeia de fallback (até 3) numa só chamada
        messages: [{ role: 'user', content: prompt }],
        temperature: cfg.temperature,
        max_tokens: cfg.maxOutputTokens,
        ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      return { ok: false, status: res.status, msg: errBody?.error?.message || `OpenRouter HTTP ${res.status}` }
    }
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? ''
    return { ok: true, text, model: data?.model || models[0] }
  } catch (e) {
    return { ok: false, status: 0, msg: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'falha de rede') }
  } finally {
    clearTimeout(timer)
  }
}

// Chama o Gemini (mantido para compatibilidade caso o modelo seja do Google).
// TIMEOUT próprio: a função do Netlify (Free) é cortada em ~10s e gera 504.
// Retorna { ok, text, status, msg }.
async function callGemini(model, prompt, generationConfig, key, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      return { ok: false, status: res.status, msg: errBody?.error?.message || `Gemini HTTP ${res.status}` }
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return { ok: true, text }
  } catch (e) {
    return { ok: false, status: 0, msg: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'falha de rede') }
  } finally {
    clearTimeout(timer)
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
    const user = await getUser(event)
    if (!user) return json(401, { error: 'Sessão expirada. Faça login novamente.' })

    // Rate limit por usuário: 15 gerações/minuto (anti-burst)
    const rlMinute = await checkRateLimit(`gemini:user:${user.id}`, PER_MINUTE_LIMIT, PER_MINUTE_MS)
    if (!rlMinute.allowed) {
      return rateLimitExceeded(rlMinute.resetAt, 'Muitas gerações em pouco tempo. Aguarde 1 minuto e tente novamente.')
    }

    const body = JSON.parse(event.body || '{}')
    const prompt = String(body.prompt || '').trim()
    if (!prompt) return json(400, { error: 'Parâmetro prompt obrigatório' })

    const admin = supabaseAdmin()

    // Gating de assinatura: só quem tem acesso (assinatura ativa, cortesia ou admin)
    // usa a IA. FAIL-CLOSED: se a consulta de assinatura FALHAR (bug/instabilidade),
    // o usuário comum é BLOQUEADO — não liberamos IA paga por erro nosso. Exceção:
    // admin segue (fail-open só para ele, para o dono nunca se trancar fora) e a
    // falha vira um alerta no log para investigação.
    if (ENFORCE_AI_ACCESS) {
      let allowed = false
      let checkFailed = false
      try {
        allowed = await userHasActiveAccess(admin, user)
      } catch (err) {
        checkFailed = true
        allowed = isAdminUser(user) // só o admin passa quando a checagem quebra
        await serverLog(
          'gemini:access-check',
          `Falha ao consultar assinatura (fail-closed${allowed ? ', liberado p/ admin' : ', bloqueado'}): ${err?.message || err}`,
          'alert',
          user.id,
        )
      }
      if (!allowed) {
        return json(402, {
          error: checkFailed
            ? 'Não foi possível confirmar sua assinatura agora. Tente novamente em instantes.'
            : 'Sua assinatura não está ativa. Reative para continuar usando a IA.',
        })
      }
    }

    // Limite mensal por usuário (gerações bem-sucedidas no mês corrente).
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const { count } = await admin
      .from('destravai_ai_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'success')
      .gte('created_at', monthStart)

    if ((count ?? 0) >= MONTHLY_LIMIT) {
      return json(429, { error: `Você atingiu o limite de ${MONTHLY_LIMIT} gerações neste mês. O limite renova no início do próximo mês.` })
    }

    const promptType = body.promptType || 'generic_ai'
    const requested = body.model ? String(body.model).trim() : ''
    const attempts = buildProviderAttempts(requested)
    // Cadeia OpenRouter (se configurada) tem prioridade; senão, usa o modelo pedido.
    const wantsJson = /JSON/i.test(prompt)

    // Valida a chave do provedor escolhido.
    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY
    if (attempts.some((attempt) => attempt.provider === 'openrouter') && !OPENROUTER_KEY) return json(500, { error: 'Chave OpenRouter (OPENROUTER_API_KEY) nao configurada no servidor' })
    if (attempts.some((attempt) => attempt.provider === 'gemini') && !geminiKey) return json(500, { error: 'Chave Gemini (GOOGLE_GENERATIVE_AI_API_KEY) nao configurada no servidor' })

    // maxOutputTokens generoso (8192) cobre roteiros longos.
    const generationConfig = {
      temperature: body.temperature ?? 0.9,
      maxOutputTokens: body.maxOutputTokens ?? 8192,
    }
    const startTime = Date.now()

    // UMA única requisição. No OpenRouter, a cadeia (até 3 modelos) faz o fallback
    // do lado dele — sem múltiplos round-trips que estourariam o tempo. O
    // response_format garante JSON válido e completo (fim do "JSON not found"
    // e do roteiro cortado). Timeout 9,5s ~ teto de 10s do Netlify Free.
    let lastMsg = 'A IA retornou vazio.'
    let lastModel = attempts[0]?.model || AI_MODEL_PRIMARY

    for (const attempt of attempts) {
      const r = attempt.provider === 'openrouter'
        ? await callOpenRouter(openRouterModelsFor(attempt.model), prompt, generationConfig, wantsJson, 9500)
        : await callGemini(
          attempt.model,
          prompt,
          { ...generationConfig, ...(wantsJson ? { responseMimeType: 'application/json' } : {}) },
          geminiKey,
          9500,
        )

      lastModel = r.model || attempt.model
      if (r.ok && r.text) {
        await admin.from('destravai_ai_generations').insert({
          user_id: user.id, prompt_type: promptType, model: lastModel, status: 'success',
        }).then(() => {}, () => {})
        return json(200, { text: r.text })
      }
      lastMsg = r.ok ? 'A IA retornou vazio.' : r.msg
    }

    // Falhou - registra e responde de forma amigavel.
    await admin.from('destravai_ai_generations').insert({
      user_id: user.id, prompt_type: promptType, model: lastModel, status: 'error', error_message: lastMsg,
    }).then(() => {}, () => {})
    await serverLog('destravai-gemini', lastMsg, 'error', user.id, { attempts, ms: Date.now() - startTime })

    // Mensagem conforme o tipo de falha:
    // - cota (free tier do Google): orienta a aguardar
    // - timeout: o modelo demorou demais (não adianta retry imediato)
    // - resto: instabilidade momentânea
    const isQuota = /quota|billing|exceeded|resource_exhausted/i.test(lastMsg)
    const isTimeout = /timeout/i.test(lastMsg)
    return json(isQuota ? 429 : 504, {
      error: isQuota
        ? 'Muitas gerações em sequência agora. Aguarde cerca de 1 minuto e tente novamente.'
        : isTimeout
          ? 'A IA demorou mais que o esperado. Tente novamente — costuma funcionar na 2ª vez.'
          : 'A IA está instável no momento. Aguarde alguns segundos e tente novamente.',
    })
  } catch (err) {
    console.error('[destravai-gemini]', err?.message)
    const userId = (await getUser(event).catch(() => null))?.id ?? null
    await serverLog('destravai-gemini', err?.message || 'Erro interno', 'error', userId, { stack: err?.stack?.slice(0, 500) })
    return json(500, { error: err?.message || 'Erro interno' })
  }
}
