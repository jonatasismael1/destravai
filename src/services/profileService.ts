import { supabase } from '../lib/supabase/client'
import type { DestravaiProfile } from '../lib/supabase/types'

export async function getCurrentProfile(): Promise<DestravaiProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('destravai_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    // Perfil pode não existir ainda para usuários antigos — cria automaticamente
    if (error.code === 'PGRST116') {
      return createProfile(user.id, user.email ?? '', user.user_metadata?.name ?? '')
    }
    throw new Error(`Erro ao buscar perfil: ${error.message}`)
  }

  return data
}

export async function createProfile(
  userId: string,
  email: string,
  name: string
): Promise<DestravaiProfile> {
  const { data, error } = await supabase
    .from('destravai_profiles')
    .insert({ id: userId, email, name })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar perfil: ${error.message}`)
  return data
}

export async function updateProfile(
  updates: Partial<Omit<DestravaiProfile, 'id' | 'created_at'>>
): Promise<DestravaiProfile> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase
    .from('destravai_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  if (error) throw new Error(`Erro ao atualizar perfil: ${error.message}`)
  return data
}

export async function markOnboardingComplete(): Promise<void> {
  await updateProfile({ onboarding_completed: true })
}

export async function markEssenceComplete(): Promise<void> {
  await updateProfile({ essence_completed: true })
}
