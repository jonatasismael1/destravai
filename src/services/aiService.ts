import { supabase } from '../lib/supabase/client'
import type { LibraryItem } from '../lib/supabase/types'

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

