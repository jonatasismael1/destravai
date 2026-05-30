import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Funcao generica de IA: recebe um prompt, valida o usuario logado, aplica o
// limite mensal de geracoes, chama o Gemini no servidor (chave nunca exposta)
// e devolve o texto. Usada pelo lib/ai.ts do frontend (Home, Criar, Essencia,
// Biblioteca, Meu Espaco).

const DEFAULT_MODEL = 'gemini-flash-latest'
const MONTHLY_LIMIT = 1000 // geracoes bem-sucedidas por usuario por mes

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse('Token ausente', 401)

    // Cliente com o JWT do usuario: o RLS garante que ele so le/grava o proprio uso.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponse('Nao autorizado', 401)

    const body = await req.json().catch(() => ({})) as {
      prompt?: string
      temperature?: number
      maxOutputTokens?: number
      model?: string
      promptType?: string
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) return errorResponse('Parametro prompt obrigatorio', 400)

    // Limite mensal: conta geracoes bem-sucedidas no mes corrente
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const { count, error: countError } = await supabase
      .from('destravai_ai_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'success')
      .gte('created_at', monthStart)

    if (!countError && (count ?? 0) >= MONTHLY_LIMIT) {
      return errorResponse(
        `Voce atingiu o limite de ${MONTHLY_LIMIT} geracoes neste mes. O limite renova no inicio do proximo mes.`,
        429,
      )
    }

    const geminiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')
    if (!geminiKey) return errorResponse('Chave de IA nao configurada no servidor', 500)

    const model = body.model ?? DEFAULT_MODEL
    const promptType = body.promptType ?? 'generic_gemini'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

    // Paridade com a Netlify Function: tokens generosos (evita JSON truncado) e,
    // quando o prompt pede JSON, força a saída a ser JSON válido.
    const generationConfig: Record<string, unknown> = {
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
      const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = errBody?.error?.message ?? `Gemini HTTP ${res.status}`
      supabase.from('destravai_ai_generations').insert({
        user_id: user.id, prompt_type: promptType, model, status: 'error', error_message: msg,
      }).then(() => {}).catch(() => {})
      if (res.status === 429) return errorResponse('Muitas geracoes em pouco tempo. Espere alguns minutos.', 429)
      return errorResponse(msg, res.status)
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) return errorResponse('A IA retornou vazio.', 502)

    // Log de sucesso (await: mantem a contagem do limite precisa)
    await supabase.from('destravai_ai_generations').insert({
      user_id: user.id, prompt_type: promptType, model, status: 'success',
    })

    return jsonResponse({ text })
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
