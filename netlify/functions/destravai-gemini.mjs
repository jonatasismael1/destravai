// POST /.netlify/functions/destravai-gemini
// Geração de IA no servidor (mesma origem do app). Valida o usuário logado,
// aplica o limite mensal e chama o Gemini — a chave nunca vai ao frontend.
// Substitui a Edge Function do Supabase para não depender do projeto certo
// estar configurado no MCP nem de secret separado.

import { json, preflight, getUser, supabaseAdmin, serverLog } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

// Modelo principal: respeita a variável de ambiente já configurada
// (GEMINI_MODEL/VITE_GEMINI_MODEL = gemini-flash-latest no Netlify). É o único
// modelo disponível nesta chave — os "fallbacks" que testamos (1.5-flash,
// 2.0-flash) não existem/têm cota 0 nela, então NÃO usamos fallback: uma única
// chamada ao principal, como sempre funcionou.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'
const MONTHLY_LIMIT = 1000
// Janela por minuto: 15 gerações/min por usuário — impede bursts automatizados
const PER_MINUTE_LIMIT = 15
const PER_MINUTE_MS = 60 * 1000

// Chama o Gemini uma vez, com TIMEOUT próprio (AbortController). É essencial:
// a função do Netlify (plano Free) é cortada em ~10s e gera 504. Abortamos um
// pouco antes (9,5s) para devolver uma mensagem clara em vez do 504 cru.
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

    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY
    if (!geminiKey) return json(500, { error: 'Chave de IA não configurada no servidor' })

    const promptType = body.promptType || 'generic_gemini'

    // Se o prompt pede JSON, força o Gemini a responder JSON válido — isso elimina
    // o erro "JSON_NOT_FOUND" quando o modelo às vezes devolve texto/markdown.
    // maxOutputTokens generoso (8192) cobre roteiros longos com folga.
    // O modelo PENSA normalmente (como sempre funcionou) — não mexemos no thinking.
    const generationConfig = {
      temperature: body.temperature ?? 0.9,
      maxOutputTokens: body.maxOutputTokens ?? 8192,
    }
    if (/JSON/i.test(prompt)) generationConfig.responseMimeType = 'application/json'

    const requested = body.model || DEFAULT_MODEL
    const startTime = Date.now()

    // UMA única chamada ao modelo principal (exatamente como funcionava com o
    // gemini-flash-latest). Sem fallback: os modelos alternativos não existem
    // nesta chave e só atrapalhavam. Timeout de 9,5s = aproveita quase todo o
    // teto de 10s da função (plano Free do Netlify), dando tempo de o modelo
    // pensar e responder. Os 9 sucessos de hoje mostram que cabe nesse tempo.
    const r = await callGemini(requested, prompt, generationConfig, geminiKey, 9500)
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
