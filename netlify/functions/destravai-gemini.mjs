// POST /.netlify/functions/destravai-gemini
// Geração de IA no servidor (mesma origem do app). Valida o usuário logado,
// aplica o limite mensal e chama o Gemini — a chave nunca vai ao frontend.
// Substitui a Edge Function do Supabase para não depender do projeto certo
// estar configurado no MCP nem de secret separado.

import { json, preflight, getUser, supabaseAdmin, serverLog } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

// Modelo primário ESTÁVEL (GA). Antes usávamos 'gemini-flash-latest', um alias
// instável que vinha retornando "Internal error encountered" e "high demand".
const DEFAULT_MODEL = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'
// Se o primário falhar de forma transitória, caímos para um modelo alternativo
// (outra infra do Google) — reduz muito a chance de o usuário ver erro.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-1.5-flash'
const MONTHLY_LIMIT = 1000
// Janela por minuto: 15 gerações/min por usuário — impede bursts automatizados
const PER_MINUTE_LIMIT = 15
const PER_MINUTE_MS = 60 * 1000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Erros transitórios do Gemini que valem retry/fallback (não são culpa do prompt).
function isTransient(status, msg) {
  if (status === 429 || status === 500 || status === 503) return true
  const m = String(msg || '').toLowerCase()
  return m.includes('high demand') || m.includes('internal error') ||
         m.includes('overloaded') || m.includes('unavailable') || m.includes('try again')
}

// Chama o Gemini uma vez. Retorna { ok, text, status, msg }.
async function callGemini(model, prompt, generationConfig, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    return { ok: false, status: res.status, msg: errBody?.error?.message || `Gemini HTTP ${res.status}` }
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return { ok: true, text }
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
    const generationConfig = {
      temperature: body.temperature ?? 0.9,
      maxOutputTokens: body.maxOutputTokens ?? 8192,
    }
    if (/JSON/i.test(prompt)) generationConfig.responseMimeType = 'application/json'

    // Ordem de tentativa: modelo pedido/primário e, se falhar de forma transitória,
    // o modelo de fallback. Cada modelo tem até 2 tentativas com backoff curto.
    const requested = body.model || DEFAULT_MODEL
    const models = [...new Set([requested, FALLBACK_MODEL])]
    let lastMsg = 'Falha desconhecida na IA'
    let usedModel = requested

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let r
        try {
          r = await callGemini(model, prompt, generationConfig, geminiKey)
        } catch (e) {
          r = { ok: false, status: 0, msg: e?.message || 'Falha de rede com a IA' }
        }

        if (r.ok && r.text) {
          // Sucesso — registra (aguardado, para o log não se perder no serverless).
          usedModel = model
          await admin.from('destravai_ai_generations').insert({
            user_id: user.id, prompt_type: promptType, model, status: 'success',
          }).then(() => {}, () => {})
          return json(200, { text: r.text })
        }

        lastMsg = r.ok ? 'A IA retornou vazio.' : r.msg
        const transient = !r.ok && isTransient(r.status, r.msg)
        // Resposta vazia ou erro transitório → tenta de novo (e depois o fallback).
        if ((transient || (r.ok && !r.text)) && attempt === 0) {
          await sleep(400)
          continue
        }
        break // erro não-transitório ou tentativas esgotadas → próximo modelo
      }
    }

    // Todos os modelos/tentativas falharam — registra e responde de forma amigável.
    await admin.from('destravai_ai_generations').insert({
      user_id: user.id, prompt_type: promptType, model: usedModel, status: 'error', error_message: lastMsg,
    }).then(() => {}, () => {})
    await serverLog('destravai-gemini', lastMsg, 'error', user.id, { models })
    return json(503, {
      error: 'A IA está sobrecarregada no momento. Aguarde alguns segundos e tente novamente.',
    })
  } catch (err) {
    console.error('[destravai-gemini]', err?.message)
    const userId = (await getUser(event).catch(() => null))?.id ?? null
    await serverLog('destravai-gemini', err?.message || 'Erro interno', 'error', userId, { stack: err?.stack?.slice(0, 500) })
    return json(500, { error: err?.message || 'Erro interno' })
  }
}
