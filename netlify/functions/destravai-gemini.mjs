// POST /.netlify/functions/destravai-gemini
// Geração de IA no servidor (mesma origem do app). Valida o usuário logado,
// aplica o limite mensal e chama o Gemini — a chave nunca vai ao frontend.
// Substitui a Edge Function do Supabase para não depender do projeto certo
// estar configurado no MCP nem de secret separado.

import { json, preflight, getUser, supabaseAdmin, serverLog } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

// ── Provedor de IA ───────────────────────────────────────────────────────────
// Modelo padrão: DEFAULT_AI_MODEL (ex.: 'openrouter/free'). Mantém compat com as
// envs antigas do Gemini. Modelos com '/' (ex.: 'openrouter/free',
// 'meta-llama/llama-3.3-70b') vão pelo OpenRouter; o resto pelo Gemini.
const DEFAULT_MODEL =
  process.env.DEFAULT_AI_MODEL ||
  process.env.GEMINI_MODEL ||
  process.env.VITE_GEMINI_MODEL ||
  'openrouter/free'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const APP_REFERER = (process.env.APP_URL || 'https://destravai.dbe.digital').replace(/\/$/, '')

const MONTHLY_LIMIT = 1000
// Janela por minuto: 15 gerações/min por usuário — impede bursts automatizados
const PER_MINUTE_LIMIT = 15
const PER_MINUTE_MS = 60 * 1000

// Modelo do OpenRouter? (tem provedor no nome, no formato "provedor/modelo")
function isOpenRouterModel(model) {
  return typeof model === 'string' && model.includes('/')
}

// Chama o OpenRouter (API compatível com a da OpenAI: /chat/completions).
// Retorna { ok, text, status, msg }.
async function callOpenRouter(model, prompt, cfg, timeoutMs) {
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
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: cfg.temperature,
        max_tokens: cfg.maxOutputTokens,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      return { ok: false, status: res.status, msg: errBody?.error?.message || `OpenRouter HTTP ${res.status}` }
    }
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? ''
    return { ok: true, text }
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

    const promptType = body.promptType || 'generic_gemini'
    const requested = body.model || DEFAULT_MODEL
    const viaOpenRouter = isOpenRouterModel(requested)

    // Valida a chave do provedor escolhido.
    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY
    if (viaOpenRouter && !OPENROUTER_KEY) return json(500, { error: 'Chave OpenRouter (OPENROUTER_API_KEY) não configurada no servidor' })
    if (!viaOpenRouter && !geminiKey) return json(500, { error: 'Chave de IA não configurada no servidor' })

    // Config de geração. maxOutputTokens generoso (8192) cobre roteiros longos.
    // responseMimeType só faz sentido no Gemini; no OpenRouter a saída JSON é
    // garantida pelo prompt + parser robusto do frontend (extractJSON).
    const generationConfig = {
      temperature: body.temperature ?? 0.9,
      maxOutputTokens: body.maxOutputTokens ?? 8192,
    }
    if (!viaOpenRouter && /JSON/i.test(prompt)) generationConfig.responseMimeType = 'application/json'

    const startTime = Date.now()

    // UMA única chamada ao modelo escolhido. Timeout de 9,5s = aproveita quase
    // todo o teto de 10s da função (plano Free do Netlify).
    const r = viaOpenRouter
      ? await callOpenRouter(requested, prompt, generationConfig, 9500)
      : await callGemini(requested, prompt, generationConfig, geminiKey, 9500)
    if (r.ok && r.text) {
      await admin.from('destravai_ai_generations').insert({
        user_id: user.id, prompt_type: promptType, model: requested, status: 'success',
      }).then(() => {}, () => {})
      return json(200, { text: r.text })
    }
    const lastMsg = r.ok ? 'A IA retornou vazio.' : r.msg

    // Falhou — registra e responde de forma amigável.
    await admin.from('destravai_ai_generations').insert({
      user_id: user.id, prompt_type: promptType, model: requested, status: 'error', error_message: lastMsg,
    }).then(() => {}, () => {})
    await serverLog('destravai-gemini', lastMsg, 'error', user.id, { requested, ms: Date.now() - startTime })

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
