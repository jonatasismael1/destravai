import { supabase } from '../lib/supabase/client'
import type { BrandEssence } from '../lib/supabase/types'
import type { ProfessionalProfile, ContentPillar, ServiceTopic, ExposureLevel } from '../types'

// Reconstrói o perfil usado pela IA (ProfessionalProfile) a partir da essência
// salva no Supabase. É isso que permite o app funcionar em qualquer dispositivo:
// a essência é a fonte da verdade, não o localStorage.
export function essenceToProfile(essence: BrandEssence, name = ''): ProfessionalProfile {
  const raw = (essence.raw_answers_json ?? {}) as Record<string, unknown>
  const str = (v: unknown, fb = '') => (typeof v === 'string' ? v : fb)
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

  const pillars: ContentPillar[] = (essence.topics ?? []).map((n, i) => ({
    id: crypto.randomUUID(), name: n, description: '', priority: i + 1,
  }))
  const services: ServiceTopic[] = (essence.services ?? []).map((n) => ({
    id: crypto.randomUUID(), name: n, category: essence.profession ?? 'Geral', commercialGoal: 'Venda',
  }))
  const voiceTone = (essence.tone_of_voice ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)

  return {
    professionalName: str(raw.professional_name) || name,
    specialty: essence.profession ?? essence.niche ?? '',
    city: str(raw.city),
    targetAudience: essence.audience ?? '',
    instagram: str(raw.instagram),
    serviceType: essence.routine ?? '',
    currentGoal: essence.content_goals ?? '',
    exposureLevel: (str(raw.exposure_level) || 'short-videos') as ExposureLevel,
    voiceTone,
    pillars,
    services,
    limits: {
      avoidTopics: essence.restrictions ?? [],
      sensitiveMatter: [], noTeamShow: false, noOfficeShow: false, humorRestrictions: '',
    },
    catchphrase: (essence.phrases ?? [])[0] ?? '',
    preferredWords: [],
    avoidedWords: strArr(raw.avoided_words),
    availableMoments: [],
    // Campos antes ignorados — agora alimentam a personalização do conteúdo.
    differentials: essence.differentials ?? '',
    frequentQuestions: essence.frequent_questions ?? [],
    commonObjections: essence.common_objections ?? [],
    positioning: essence.ai_positioning ?? '',
    // Dados pessoais (vivem no raw_answers_json, sem coluna própria / migração).
    pronoun: ((p) => (p === 'ele' || p === 'ela' || p === 'neutro' ? p : undefined))(str(raw.identity_pronoun)),
    personalNotes: str(raw.personal_notes),
    sharePersonal: typeof raw.share_personal === 'boolean' ? raw.share_personal : undefined,
  }
}

export async function getBrandEssence(): Promise<BrandEssence | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('destravai_brand_essence')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Erro ao buscar essência: ${error.message}`)
  return data
}

export async function saveBrandEssence(
  answers: Record<string, unknown>
): Promise<BrandEssence> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  const existing = await getBrandEssence()

  const payload = {
    user_id: user.id,
    profession: String(answers.profession ?? ''),
    niche: String(answers.niche ?? ''),
    audience: String(answers.audience ?? ''),
    tone_of_voice: String(answers.tone_of_voice ?? ''),
    content_goals: String(answers.content_goals ?? ''),
    routine: String(answers.routine ?? ''),
    preferred_formats: (answers.preferred_formats as string[]) ?? [],
    topics: (answers.topics as string[]) ?? [],
    restrictions: (answers.restrictions as string[]) ?? [],
    differentials: String(answers.differentials ?? ''),
    services: (answers.services as string[]) ?? [],
    frequent_questions: (answers.frequent_questions as string[]) ?? [],
    common_objections: (answers.common_objections as string[]) ?? [],
    phrases: (answers.phrases as string[]) ?? [],
    references_text: String(answers.references_text ?? ''),
    raw_answers_json: answers,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await supabase
      .from('destravai_brand_essence')
      .update({ ...payload, version: (existing.version ?? 1) + 1 })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw new Error(`Erro ao atualizar essência: ${error.message}`)
    return data
  }

  const { data, error } = await supabase
    .from('destravai_brand_essence')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(`Erro ao salvar essência: ${error.message}`)
  return data
}

export async function updateEssenceSummary(
  essenceId: string,
  aiSummary: string,
  aiPositioning: string
): Promise<void> {
  const { error } = await supabase
    .from('destravai_brand_essence')
    .update({
      ai_summary: aiSummary,
      ai_positioning: aiPositioning,
      updated_at: new Date().toISOString(),
    })
    .eq('id', essenceId)

  if (error) throw new Error(`Erro ao atualizar resumo da essência: ${error.message}`)
}

export async function hasEssence(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { count } = await supabase
    .from('destravai_brand_essence')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return (count ?? 0) > 0
}
