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

// Envia uma imagem do dispositivo para o Storage (bucket "avatars"), salva a URL
// pública no perfil e retorna a URL. O caminho começa com o id do usuário, então
// a policy de RLS do Storage garante que cada um só mexe na própria foto.
export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${user.id}/avatar-${Date.now()}.${ext || 'jpg'}`

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (upErr) throw new Error(`Erro ao enviar imagem: ${upErr.message}`)

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = data.publicUrl
  await updateProfile({ avatar_url: url })
  return url
}

export async function markOnboardingComplete(): Promise<void> {
  await updateProfile({ onboarding_completed: true })
}

export async function markEssenceComplete(): Promise<void> {
  await updateProfile({ essence_completed: true })
}
