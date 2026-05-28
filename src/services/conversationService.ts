import { supabase } from '../lib/supabase/client'
import type { AiConversation, AiMessage } from '../lib/supabase/types'

export async function getConversations(): Promise<AiConversation[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('destravai_ai_conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(`Erro ao buscar conversas: ${error.message}`)
  return data ?? []
}

export async function createConversation(
  title: string,
  contextType: string
): Promise<AiConversation> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase
    .from('destravai_ai_conversations')
    .insert({ user_id: user.id, title, context_type: contextType })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar conversa: ${error.message}`)
  return data
}

export async function getConversationMessages(
  conversationId: string
): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from('destravai_ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Erro ao buscar mensagens: ${error.message}`)
  return data ?? []
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
): Promise<AiMessage> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase
    .from('destravai_ai_messages')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      role,
      content,
      metadata: metadata ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao salvar mensagem: ${error.message}`)
  return data
}

export async function touchConversation(conversationId: string): Promise<void> {
  await supabase
    .from('destravai_ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
}
