import { GoogleGenAI } from '@google/genai'

// Serviço centralizado de IA (Google Gemini).
//
// SEGURANÇA: a chave usada aqui (VITE_GEMINI_API_KEY) é injetada no frontend,
// então DEVE ser uma chave restrita por referrer HTTP no Google Cloud Console
// (Credenciais → chave → Restrições de aplicativo → Referenciadores HTTP),
// liberando os domínios: destravai.dbe.digital/*, *.netlify.app/*, localhost.
// Assim a chave exposta no bundle não funciona fora do seu site.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

const GEMINI_MODEL = 'gemini-flash-latest'

let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!API_KEY) throw new Error('VITE_GEMINI_API_KEY não configurada.')
  if (!client) client = new GoogleGenAI({ apiKey: API_KEY })
  return client
}

export interface GenerateOptions {
  temperature?: number
  maxOutputTokens?: number
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const ai = getClient()
  try {
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: opts.temperature ?? 0.9,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
      },
    })
    const text = res.text ?? ''
    if (!text) throw new Error('A IA retornou vazio.')
    return text
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido na IA'
    if (/referer|referrer|blocked|api key|forbidden|permission/i.test(msg)) {
      throw new Error('A IA não está autorizada para este domínio. Verifique as restrições da chave no Google Cloud.')
    }
    if (/quota|rate|resource_exhausted|429/i.test(msg)) {
      throw new Error('A IA retornou limite temporário ou cota indisponível. Isso pode acontecer por limite da chave/API, não necessariamente porque você tentou muitas vezes. Espere alguns minutos e tente novamente.')
    }
    throw new Error(msg)
  }
}

export function isAIConfigured(): boolean {
  return !!API_KEY
}
