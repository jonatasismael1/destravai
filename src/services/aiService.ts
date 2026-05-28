import { supabase } from '../lib/supabase/client'
import type { LibraryItem, BrandEssence } from '../lib/supabase/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

interface EdgeFunctionError {
  error?: string
  message?: string
}

async function callEdgeFunction<T>(
  functionName: string,
  payload: Record<string, unknown>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const json = await response.json() as T | EdgeFunctionError

  if (!response.ok) {
    const errJson = json as EdgeFunctionError
    const msg = errJson?.error ?? errJson?.message ?? `Erro ${response.status}`
    throw new Error(msg)
  }

  return json as T
}

// ────────────────────────────────────────────
// 1. Salvar essência e gerar resumo com IA
// ────────────────────────────────────────────

export interface EssenceSummaryResult {
  essenceId: string
  aiSummary: string
  aiPositioning: string
}

export async function saveEssenceAndGenerateSummary(
  answers: Record<string, unknown>
): Promise<EssenceSummaryResult> {
  return callEdgeFunction<EssenceSummaryResult>(
    'destravai-save-essence',
    { answers }
  )
}

// ────────────────────────────────────────────
// 2. Gerar biblioteca inicial com IA
// ────────────────────────────────────────────

export interface GenerateLibraryResult {
  items: LibraryItem[]
  alreadyExisted: boolean
}

export async function generateInitialLibrary(): Promise<GenerateLibraryResult> {
  return callEdgeFunction<GenerateLibraryResult>(
    'destravai-generate-library',
    {}
  )
}

// ────────────────────────────────────────────
// 3. Gerar conteúdo sob demanda
// ────────────────────────────────────────────

export type ContentGenerationType =
  | 'story_sequence'
  | 'reels_script'
  | 'caption'
  | 'carousel_idea'
  | 'static_post'
  | 'hook'
  | 'cta'
  | 'daily_prompt'

export interface GenerateContentResult {
  item: LibraryItem
}

export async function generateContent(
  type: ContentGenerationType,
  context?: Record<string, unknown>
): Promise<GenerateContentResult> {
  return callEdgeFunction<GenerateContentResult>(
    'destravai-generate-content',
    { type, context }
  )
}

// ────────────────────────────────────────────
// 4. Conversa com IA
// ────────────────────────────────────────────

export interface ChatResult {
  conversationId: string
  reply: string
  messageId: string
}

export async function chatWithAI(
  message: string,
  conversationId?: string,
  contextType?: string
): Promise<ChatResult> {
  return callEdgeFunction<ChatResult>(
    'destravai-chat',
    { message, conversationId, contextType }
  )
}

// ────────────────────────────────────────────
// Registro de geração (feito pelas Edge Functions, mas exportamos o tipo)
// ────────────────────────────────────────────

export async function logGeneration(params: {
  promptType: string
  inputData?: Record<string, unknown>
  outputData?: Record<string, unknown>
  model?: string
  tokensUsed?: number
  status?: 'success' | 'error'
  errorMessage?: string
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('destravai_ai_generations').insert({
    user_id: user.id,
    prompt_type: params.promptType,
    input_data: params.inputData ?? null,
    output_data: params.outputData ?? null,
    model: params.model ?? null,
    tokens_used: params.tokensUsed ?? null,
    status: params.status ?? 'success',
    error_message: params.errorMessage ?? null,
  })
}

// ────────────────────────────────────────────
// Chamada Gemini direta (fallback para funções que ainda usam frontend)
// Mantida durante a migração — REMOVER após mover tudo para Edge Functions
// ────────────────────────────────────────────

export async function callGeminiDirect(
  prompt: string,
  essence: BrandEssence | null
): Promise<string> {
  // Essa função é apenas um bridge temporário.
  // As chamadas reais de IA devem ir para Edge Functions.
  // Durante o período de migração, o frontend ainda pode chamar Gemini
  // enquanto as Edge Functions não estão todas prontas.
  void essence

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Chave da IA não configurada.')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err?.error?.message ?? `Erro ${response.status}`)
  }

  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}
