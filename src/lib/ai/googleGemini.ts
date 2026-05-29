import { supabase } from '../supabase/client'

// Serviço centralizado de IA.
//
// SEGURANÇA: a chave do Gemini NÃO fica no frontend. Toda geração passa pela
// Netlify Function `destravai-gemini` (mesma origem do app), que valida o
// usuário logado, aplica o limite mensal e chama o Gemini no servidor. A chave
// vive apenas nas variáveis de ambiente do Netlify.

const GEMINI_FN = '/.netlify/functions/destravai-gemini'

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
