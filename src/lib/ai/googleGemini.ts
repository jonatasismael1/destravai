import { supabase } from '../supabase/client'

// Serviço centralizado de IA.
//
// SEGURANÇA: a chave da IA NÃO fica no frontend. Toda geração passa por uma
// função no servidor, que valida o usuário logado, aplica o limite e chama o
// provedor (OpenRouter/Gemini). A chave vive só nas variáveis de ambiente.
//
// ROTEAMENTO: usamos a Edge Function do Supabase como PRINCIPAL — ela não tem o
// teto de ~10s da Netlify Function (plano Free), então aguenta a fila dos
// modelos :free do OpenRouter sem dar timeout. Se a Edge Function estiver
// indisponível (5xx/rede), caímos para a Netlify Function como segurança.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const SUPABASE_FN = `${SUPABASE_URL}/functions/v1/destravai-gemini`
const NETLIFY_FN = '/.netlify/functions/destravai-gemini'

export interface GenerateOptions {
  temperature?: number
  maxOutputTokens?: number
  /** Rótulo opcional do tipo de geração, registrado no log de uso. */
  promptType?: string
}

interface FnResult {
  ok: boolean
  status: number
  text?: string
  error?: string
}

async function callFn(
  url: string,
  token: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<FnResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
  return { ok: res.ok, status: res.status, text: json.text, error: json.error }
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')
  const token = session.access_token

  const body = {
    prompt,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    promptType: opts.promptType,
  }

  // 1) PRINCIPAL: Edge Function do Supabase (sem teto de 10s).
  const supa = await callFn(SUPABASE_FN, token, body, { apikey: SUPABASE_ANON }).catch(() => null)
  if (supa?.ok && supa.text) return supa.text
  // Erro do usuário (4xx: limite mensal atingido, cota da IA) → mostra direto;
  // cair para a Netlify não ajudaria (mesma chave/limite).
  if (supa && supa.status >= 400 && supa.status < 500) {
    throw new Error(supa.error ?? `Erro ${supa.status} ao gerar conteúdo.`)
  }

  // 2) FALLBACK: Netlify Function (Edge Function indisponível/sem config — 5xx/rede).
  const net = await callFn(NETLIFY_FN, token, body).catch(() => null)
  if (!net) throw new Error('Não foi possível falar com o servidor da Deby. Verifique sua conexão.')
  if (!net.ok) throw new Error(net.error ?? `Erro ${net.status} ao gerar conteúdo.`)
  if (!net.text) throw new Error('A Deby retornou vazio.')
  return net.text
}

// A IA é sempre configurada no servidor; mantido por compatibilidade.
export function isAIConfigured(): boolean {
  return true
}
