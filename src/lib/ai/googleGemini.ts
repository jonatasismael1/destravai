import { supabase } from '../supabase/client'

// Serviço centralizado de IA.
//
// SEGURANÇA: a chave do Gemini NÃO fica mais no frontend. Toda geração passa
// pela Edge Function `destravai-gemini` do Supabase, que valida o usuário
// logado, aplica o limite mensal de uso e chama o Gemini no servidor (a chave
// vive apenas no secret GOOGLE_GENERATIVE_AI_API_KEY do projeto Supabase).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const GEMINI_FN = `${SUPABASE_URL}/functions/v1/destravai-gemini`

export interface GenerateOptions {
  temperature?: number
  maxOutputTokens?: number
  /** Rótulo opcional do tipo de geração, registrado no log de uso. */
  promptType?: string
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  let res: Response
  try {
    res = await fetch(GEMINI_FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        prompt,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        promptType: opts.promptType,
      }),
    })
  } catch {
    throw new Error('Não foi possível falar com o servidor de IA. Verifique sua conexão.')
  }

  const json = await res.json().catch(() => ({})) as { text?: string; error?: string }

  if (!res.ok) {
    throw new Error(json?.error ?? `Erro ${res.status} ao gerar conteúdo.`)
  }

  const text = json?.text ?? ''
  if (!text) throw new Error('A IA retornou vazio.')
  return text
}

// A IA agora é sempre configurada no servidor; mantido por compatibilidade.
export function isAIConfigured(): boolean {
  return true
}
