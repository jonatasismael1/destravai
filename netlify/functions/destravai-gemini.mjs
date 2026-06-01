// POST /.netlify/functions/destravai-gemini
// Geração de IA no servidor (mesma origem do app). Valida o usuário logado,
// aplica o limite mensal e chama o Gemini — a chave nunca vai ao frontend.
// Substitui a Edge Function do Supabase para não depender do projeto certo
// estar configurado no MCP nem de secret separado.

import { json, preflight, getUser, supabaseAdmin, serverLog } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

// Modelo principal: respeita a variável de ambiente já configurada
// (GEMINI_MODEL = gemini-flash-latest no Netlify/Supabase). O default do código
// é só um fallback caso a env não exista — NÃO substitui a sua configuração.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'
// Usado APENAS como rede de segurança quando o principal falha de forma
// transitória (após o retry). gemini-1.5-flash tem COTA GRATUITA (free tier),
// ao contrário do gemini-2.0-flash, que nesta chave vinha com limite 0 e por
// isso o fallback falhava. Não afeta o fluxo normal, que usa o principal.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-1.5-flash'
const MONTHLY_LIMIT = 1000
// Janela por minuto: 15 gerações/min por usuário — impede bursts automatizados
const PER_MINUTE_LIMIT = 15
const PER_MINUTE_MS = 60 * 1000

// Chama o Gemini uma vez, com TIMEOUT próprio (AbortController). É essencial:
// a função do Netlify é cortada em ~10s (gera 504). Limitamos cada chamada para
// nunca estourar esse teto, mesmo somando principal + fallback.
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
    const baseConfig = {
      temperature: body.temperature ?? 0.9,
      maxOutputTokens: body.maxOutputTokens ?? 8192,
    }
    if (/JSON/i.test(prompt)) baseConfig.responseMimeType = 'application/json'

    // DESLIGA o "pensamento" do modelo principal. O gemini-flash-latest é o
    // 2.5-flash, que pensa por padrão e fica LENTO (10s+ → timeout/504). Com
    // thinkingBudget 0 a resposta vem em ~2-4s, sem perder qualidade prática nos
    // roteiros. O fallback (1.5-flash) não tem esse recurso → recebe baseConfig.
    const primaryConfig = { ...baseConfig, thinkingConfig: { thinkingBudget: 0 } }

    const requested = body.model || DEFAULT_MODEL
    const startTime = Date.now()
    let lastMsg = 'Falha desconhecida na IA'
    let usedModel = requested

    const logSuccess = (model) =>
      admin.from('destravai_ai_generations').insert({
        user_id: user.id, prompt_type: promptType, model, status: 'success',
      }).then(() => {}, () => {})

    // 1) CAMINHO FELIZ: uma única chamada ao modelo principal (sem pensar = rápido).
    //    Timeout de 8,5s — abaixo do corte de ~10s do Netlify.
    let r = await callGemini(requested, prompt, primaryConfig, geminiKey, 8500)
    // Se o modelo recusar thinkingConfig (alias antigo que não suporta), tenta de
    // novo SEM ele — falha rápida, então cabe no tempo.
    if (!r.ok && /thinking|unknown name|invalid|not supported/i.test(r.msg) && (Date.now() - startTime) < 2500) {
      r = await callGemini(requested, prompt, baseConfig, geminiKey, 7000)
    }
    if (r.ok && r.text) { await logSuccess(requested); return json(200, { text: r.text }) }
    lastMsg = r.ok ? 'A IA retornou vazio.' : r.msg

    // 2) FALLBACK só se o principal falhou RÁPIDO (ex.: cota 4xx, ~1s). Se ele
    //    demorou (timeout/lento), NÃO tentamos de novo — senão estoura o tempo
    //    e cai em 504. Mantém a robustez sem arriscar o limite da função.
    const elapsed = Date.now() - startTime
    const failedFast = elapsed < 3000
    const worthFallback = (!r.ok || !r.text) && requested !== FALLBACK_MODEL
    if (failedFast && worthFallback) {
      const r2 = await callGemini(FALLBACK_MODEL, prompt, baseConfig, geminiKey, 6000)
      if (r2.ok && r2.text) { await logSuccess(FALLBACK_MODEL); return json(200, { text: r2.text }) }
      usedModel = FALLBACK_MODEL
      lastMsg = r2.ok ? 'A IA retornou vazio.' : r2.msg
    }

    // Falhou — registra e responde de forma amigável.
    await admin.from('destravai_ai_generations').insert({
      user_id: user.id, prompt_type: promptType, model: usedModel, status: 'error', error_message: lastMsg,
    }).then(() => {}, () => {})
    await serverLog('destravai-gemini', lastMsg, 'error', user.id, { requested, fallback: FALLBACK_MODEL, ms: Date.now() - startTime })

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
