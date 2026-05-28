import { GoogleGenAI } from '@google/genai'

// Serviço centralizado de IA (Google Gemini).
//
// SEGURANÇA: a chave usada aqui (VITE_GEMINI_API_KEY) é injetada no frontend,
// então DEVE ser uma chave restrita por referrer HTTP no Google Cloud Console
// (Credenciais → chave → Restrições de aplicativo → Referenciadores HTTP),
// liberando os domínios: destravai.dbe.digital/*, *.netlify.app/*, localhost.
// Assim a chave exposta no bundle não funciona fora do seu site.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

// Modelo configurável. Default num modelo estável e gratuito; pode trocar via
// VITE_GEMINI_MODEL (ex.: gemini-2.5-flash) sem mexer no código.
const PRIMARY_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string) || 'gemini-2.0-flash'

// Fallbacks caso o modelo configurado não exista para a chave (evita quebrar a IA).
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash']

let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!API_KEY) throw new Error('VITE_GEMINI_API_KEY não configurada.')
  if (!client) client = new GoogleGenAI({ apiKey: API_KEY })
  return client
}

function isModelNotFound(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return msg.includes('not found') || msg.includes('not supported') || msg.includes('404')
}

export interface GenerateOptions {
  temperature?: number
  maxOutputTokens?: number
}

// Gera texto a partir de um prompt. Tenta o modelo configurado e, se ele não
// existir, cai para um modelo conhecido — garantindo que a IA não pare.
export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const ai = getClient()
  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter(m => m !== PRIMARY_MODEL)]

  let lastError: unknown
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
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
      lastError = err
      // Só tenta o próximo modelo se for "modelo inexistente"; outros erros
      // (referrer bloqueado, cota, rede) não adianta repetir.
      if (!isModelNotFound(err)) break
    }
  }

  const msg = lastError instanceof Error ? lastError.message : 'Erro desconhecido na IA'
  if (/referer|referrer|blocked|api key|forbidden|permission/i.test(msg)) {
    throw new Error('A IA não está autorizada para este domínio. Verifique as restrições da chave no Google Cloud.')
  }
  if (/quota|rate|resource_exhausted|429/i.test(msg)) {
    throw new Error('Você fez muitas gerações em pouco tempo. Espere alguns minutos e tente de novo.')
  }
  throw new Error(msg)
}

export function isAIConfigured(): boolean {
  return !!API_KEY
}
