// POST /.netlify/functions/destravai-gemini
// Geração de IA no servidor (mesma origem do app). Valida o usuário logado,
// aplica o limite mensal e chama o Gemini — a chave nunca vai ao frontend.
// Substitui a Edge Function do Supabase para não depender do projeto certo
// estar configurado no MCP nem de secret separado.

import { json, preflight, getUser, supabaseAdmin } from './_shared.mjs'

const DEFAULT_MODEL = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'
const MONTHLY_LIMIT = 1000

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
    const user = await getUser(event)
    if (!user) return json(401, { error: 'Sessão expirada. Faça login novamente.' })

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

    const model = body.model || DEFAULT_MODEL
    const promptType = body.promptType || 'generic_gemini'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

    // Se o prompt pede JSON, força o Gemini a responder JSON válido — isso elimina
    // o erro "JSON_NOT_FOUND" quando o modelo às vezes devolve texto/markdown.
    // maxOutputTokens generoso: o gemini-flash-latest gasta parte do orçamento
    // "pensando", então 2048 truncava o JSON em roteiros maiores (causava o
    // erro JSON_NOT_FOUND no app). 8192 cobre roteiros longos com folga.
    const generationConfig = {
      temperature: body.temperature ?? 0.9,
      maxOutputTokens: body.maxOutputTokens ?? 8192,
    }
    if (/JSON/i.test(prompt)) generationConfig.responseMimeType = 'application/json'

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const msg = errBody?.error?.message || `Gemini HTTP ${res.status}`
      admin.from('destravai_ai_generations').insert({
        user_id: user.id, prompt_type: promptType, model, status: 'error', error_message: msg,
      }).then(() => {}, () => {})
      if (res.status === 429) return json(429, { error: 'Muitas gerações em pouco tempo. Espere alguns minutos.' })
      return json(res.status, { error: msg })
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) return json(502, { error: 'A IA retornou vazio.' })

    await admin.from('destravai_ai_generations').insert({
      user_id: user.id, prompt_type: promptType, model, status: 'success',
    })

    return json(200, { text })
  } catch (err) {
    console.error('[destravai-gemini]', err?.message)
    return json(500, { error: err?.message || 'Erro interno' })
  }
}
