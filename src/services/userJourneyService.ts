import { supabase } from '../lib/supabase/client'
import type {
  CalendarItem,
  DailyCheckin,
  JournalEntryRow,
  PersonalIdeaRow,
  PersonalSpaceRow,
  StoredMission,
  StoredProgress,
} from '../lib/supabase/types'
import type { ContentIdea, JournalEntry, Mission, PersonalContext, PersonalIdea, PersonalSpace, Progress } from '../types'
import { getWeekKey } from '../lib/progress'

export interface DayStatePayload {
  checkin: string
  mission: ContentIdea | null
  extras: ContentIdea[]
}

export function toISODateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function missionToRow(userId: string, mission: Mission) {
  return {
    id: mission.id,
    user_id: userId,
    title: mission.title,
    description: mission.description,
    type: mission.type,
    status: mission.status,
    mission_date: mission.date,
    content: mission.content as unknown as Record<string, unknown> | null,
    points: mission.points,
    updated_at: new Date().toISOString(),
  }
}

function rowToMission(row: StoredMission): Mission {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    date: row.mission_date,
    content: row.content as unknown as ContentIdea | null,
    points: row.points,
  }
}

function progressToRow(userId: string, progress: Progress, weekKey = getWeekKey()) {
  return {
    user_id: userId,
    missions_completed: progress.missionsCompleted,
    current_streak: progress.currentStreak,
    weekly_missions: progress.weeklyMissions,
    content_balance: progress.contentBalance,
    last_activity: progress.lastActivity,
    level: progress.level,
    week_key: weekKey,
    updated_at: new Date().toISOString(),
  }
}

function rowToProgress(row: StoredProgress): Progress {
  const balance = row.content_balance ?? {}
  return {
    missionsCompleted: row.missions_completed,
    currentStreak: row.current_streak,
    weeklyMissions: row.weekly_missions,
    contentBalance: {
      authority: balance.authority ?? 0,
      backstage: balance.backstage ?? 0,
      connection: balance.connection ?? 0,
      sale: balance.sale ?? 0,
      interaction: balance.interaction ?? 0,
      humor: balance.humor ?? 0,
    },
    lastActivity: row.last_activity,
    level: row.level,
  }
}

function rowToDayState(row: DailyCheckin): DayStatePayload {
  return {
    checkin: row.checkin_key,
    mission: row.mission as unknown as ContentIdea | null,
    extras: (row.extras ?? []) as unknown as ContentIdea[],
  }
}

function personalCategoryToDb(category: PersonalIdea['category']): PersonalIdeaRow['category'] {
  return category === 'conteúdo' ? 'conteudo' : category
}

function dbCategoryToPersonal(category: PersonalIdeaRow['category']): PersonalIdea['category'] {
  return category === 'conteudo' ? 'conteúdo' : category
}

export async function loadStoredProgress(fallback: Progress): Promise<Progress> {
  const userId = await currentUserId()
  if (!userId) return fallback

  const { data, error } = await supabase
    .from('destravai_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`Erro ao buscar progresso: ${error.message}`)

  const currentWeek = getWeekKey()
  if (!data) {
    await upsertStoredProgress(fallback)
    return fallback
  }

  const progress = rowToProgress(data as StoredProgress)
  if ((data as StoredProgress).week_key !== currentWeek) {
    const reset = { ...progress, weeklyMissions: 0 }
    await upsertStoredProgress(reset)
    return reset
  }

  return progress
}

export async function upsertStoredProgress(progress: Progress): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('destravai_progress')
    .upsert(progressToRow(userId, progress), { onConflict: 'user_id' })

  if (error) throw new Error(`Erro ao salvar progresso: ${error.message}`)
}

export async function loadStoredMissions(): Promise<Mission[]> {
  const userId = await currentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('destravai_missions')
    .select('*')
    .eq('user_id', userId)
    .order('mission_date', { ascending: false })
    .limit(100)

  if (error) throw new Error(`Erro ao buscar missões: ${error.message}`)
  return ((data ?? []) as StoredMission[]).map(rowToMission)
}

export async function upsertStoredMission(mission: Mission): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('destravai_missions')
    .upsert(missionToRow(userId, mission), { onConflict: 'id' })

  if (error) throw new Error(`Erro ao salvar missão: ${error.message}`)
}

export async function updateStoredMission(id: string, updates: Partial<Mission>): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.type !== undefined) payload.type = updates.type
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.date !== undefined) payload.mission_date = updates.date
  if (updates.content !== undefined) payload.content = updates.content
  if (updates.points !== undefined) payload.points = updates.points

  const { error } = await supabase
    .from('destravai_missions')
    .update(payload)
    .eq('id', id)

  if (error) throw new Error(`Erro ao atualizar missão: ${error.message}`)
}

export async function loadDailyCheckin(dayKey = toISODateKey()): Promise<{ row: DailyCheckin | null; state: DayStatePayload | null }> {
  const userId = await currentUserId()
  if (!userId) return { row: null, state: null }

  const { data, error } = await supabase
    .from('destravai_daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('day_key', dayKey)
    .maybeSingle()

  if (error) throw new Error(`Erro ao buscar missão do dia: ${error.message}`)
  const row = data as DailyCheckin | null
  return { row, state: row ? rowToDayState(row) : null }
}

export async function upsertDailyCheckin(
  dayKey: string,
  updates: Partial<DayStatePayload> & { dailyStatus?: DailyCheckin['daily_status'] }
): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const payload: Record<string, unknown> = {
    user_id: userId,
    day_key: dayKey,
    updated_at: new Date().toISOString(),
  }
  if (updates.checkin !== undefined) payload.checkin_key = updates.checkin
  if (updates.mission !== undefined) payload.mission = updates.mission
  if (updates.extras !== undefined) payload.extras = updates.extras
  if (updates.dailyStatus !== undefined) payload.daily_status = updates.dailyStatus

  const { error } = await supabase
    .from('destravai_daily_checkins')
    .upsert(payload, { onConflict: 'user_id,day_key' })

  if (error) throw new Error(`Erro ao salvar missão do dia: ${error.message}`)
}

export async function deleteDailyCheckin(dayKey = toISODateKey()): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('destravai_daily_checkins')
    .delete()
    .eq('user_id', userId)
    .eq('day_key', dayKey)

  if (error) throw new Error(`Erro ao reiniciar missão do dia: ${error.message}`)
}

export async function loadCalendarItems(startDay: string, endDay: string): Promise<CalendarItem[]> {
  const userId = await currentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('destravai_calendar_items')
    .select('*')
    .eq('user_id', userId)
    .gte('day_key', startDay)
    .lte('day_key', endDay)
    .order('day_key', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Erro ao buscar calendário: ${error.message}`)
  return (data ?? []) as CalendarItem[]
}

export async function addCalendarItem(dayKey: string, idea: ContentIdea): Promise<CalendarItem> {
  const userId = await currentUserId()
  if (!userId) throw new Error('Usuário não autenticado')

  const { data, error } = await supabase
    .from('destravai_calendar_items')
    .upsert({
      user_id: userId,
      day_key: dayKey,
      idea_id: idea.id,
      idea_snapshot: idea as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day_key,idea_id' })
    .select()
    .single()

  if (error) throw new Error(`Erro ao salvar calendário: ${error.message}`)
  return data as CalendarItem
}

export async function updateCalendarItemStatus(
  id: string,
  status: CalendarItem['status'],
): Promise<void> {
  const { error } = await supabase
    .from('destravai_calendar_items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`Erro ao atualizar status: ${error.message}`)
}

export async function removeCalendarItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('destravai_calendar_items')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao remover do calendário: ${error.message}`)
}

export async function loadPersonalSpace(fallback: PersonalSpace): Promise<PersonalSpace> {
  const userId = await currentUserId()
  if (!userId) return fallback

  const [{ data: space, error: spaceError }, { data: journal, error: journalError }, { data: ideas, error: ideasError }] = await Promise.all([
    supabase.from('destravai_personal_space').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('destravai_journal_entries').select('*').eq('user_id', userId).order('entry_date', { ascending: false }).limit(100),
    supabase.from('destravai_personal_ideas').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
  ])

  if (spaceError) throw new Error(`Erro ao buscar espaço pessoal: ${spaceError.message}`)
  if (journalError) throw new Error(`Erro ao buscar diário: ${journalError.message}`)
  if (ideasError) throw new Error(`Erro ao buscar ideias pessoais: ${ideasError.message}`)

  const row = space as PersonalSpaceRow | null
  return {
    context: (row?.context ?? fallback.context) as PersonalContext,
    todayMood: row?.today_mood ?? undefined,
    todayMoodNote: row?.today_mood_note ?? undefined,
    todayMoodDate: row?.today_mood_date ?? undefined,
    journal: ((journal ?? []) as JournalEntryRow[]).map(entry => ({
      id: entry.id,
      content: entry.content,
      mood: entry.mood,
      date: entry.entry_date,
      tags: entry.tags,
    })),
    ideas: ((ideas ?? []) as PersonalIdeaRow[]).map(idea => ({
      id: idea.id,
      content: idea.content,
      category: dbCategoryToPersonal(idea.category),
      createdAt: idea.created_at,
    })),
  }
}

export async function upsertPersonalContext(context: PersonalContext): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('destravai_personal_space')
    .upsert({
      user_id: userId,
      context: context as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) throw new Error(`Erro ao salvar contexto pessoal: ${error.message}`)
}

export async function upsertTodayMood(mood: string, note?: string, dayKey = toISODateKey()): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('destravai_personal_space')
    .upsert({
      user_id: userId,
      today_mood: mood,
      today_mood_note: note ?? null,
      today_mood_date: dayKey,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) throw new Error(`Erro ao salvar humor: ${error.message}`)
}

export async function createJournalEntry(entry: JournalEntry): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('destravai_journal_entries')
    .insert({
      id: entry.id,
      user_id: userId,
      content: entry.content,
      mood: entry.mood,
      entry_date: entry.date,
      tags: entry.tags ?? [],
    })

  if (error) throw new Error(`Erro ao salvar diário: ${error.message}`)
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('destravai_journal_entries')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir diário: ${error.message}`)
}

export async function createPersonalIdea(idea: PersonalIdea): Promise<void> {
  const userId = await currentUserId()
  if (!userId) return

  const { error } = await supabase
    .from('destravai_personal_ideas')
    .insert({
      id: idea.id,
      user_id: userId,
      content: idea.content,
      category: personalCategoryToDb(idea.category),
      created_at: idea.createdAt,
    })

  if (error) throw new Error(`Erro ao salvar ideia pessoal: ${error.message}`)
}

export async function deletePersonalIdea(id: string): Promise<void> {
  const { error } = await supabase
    .from('destravai_personal_ideas')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir ideia pessoal: ${error.message}`)
}
