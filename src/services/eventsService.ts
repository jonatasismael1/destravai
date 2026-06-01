import { supabase } from '../lib/supabase/client'

// Métrica de execução real: registra o que o usuário fez de fato.
// Tolerante a falhas — nunca quebra o fluxo do app. Se a tabela
// destravai_execution_events ainda não existir, apenas ignora.

export type ExecutionEventType =
  | 'mission_open'
  | 'script_copy'
  | 'teleprompter_open'
  | 'recording_start'
  | 'recording_save'
  | 'posted'
  | 'will_post_later'
  | 'only_recorded'
  | 'planned'
  | 'mission_done'
  | 'returned'

export async function trackEvent(
  eventType: ExecutionEventType,
  refId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('destravai_execution_events').insert({
      user_id: user.id,
      event_type: eventType,
      ref_id: refId ?? null,
      metadata: metadata ?? null,
    })
  } catch {
    // silencioso: telemetria não pode atrapalhar o uso
  }
}

export interface ActivationStatus {
  // Dias distintos (D0/D1/D3/D7) em que o usuário registrou execução desde o 1º evento.
  firstEventAt: string | null
  activeDays: number
  postedCount: number
  recordedCount: number
}

export interface ConsistencyData {
  // Datas únicas (YYYY-MM-DD) em que o usuário produziu conteúdo de verdade.
  // Fonte: mission_done + posted + recording_save events.
  contentDays: string[]
  // Quantos dias únicos de conteúdo o usuário tem (independente de serem consecutivos).
  totalContentDays: number
  // Os primeiros 7 dias únicos de produção de conteúdo, em ordem cronológica.
  first7Days: string[]
  // Número de dias completos dentro dos primeiros 7 (para a barra de progresso).
  daysCompleted: number
  // Data do primeiro conteúdo produzido.
  firstContentAt: string | null
}

// Eventos que indicam produção real de conteúdo (NÃO conta login, geração de ideia,
// abertura de tela, etc.). Apenas ações explícitas de execução do usuário.
const CONTENT_PRODUCTION_EVENTS: ExecutionEventType[] = ['mission_done', 'posted', 'recording_save']

/**
 * Carrega os dados de constância baseados em eventos reais de produção de conteúdo.
 * Retorna os primeiros 7 dias únicos em que o usuário produziu conteúdo.
 */
export async function loadConsistencyData(): Promise<ConsistencyData | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('destravai_execution_events')
      .select('event_type, created_at')
      .eq('user_id', user.id)
      .in('event_type', CONTENT_PRODUCTION_EVENTS)
      .order('created_at', { ascending: true })
      .limit(1000)

    if (error || !data) return null

    // Coleta dias únicos em que houve produção de conteúdo
    const daySet = new Set<string>()
    for (const ev of data) {
      const day = String(ev.created_at).slice(0, 10)
      daySet.add(day)
    }

    const contentDays = Array.from(daySet).sort()
    const first7Days = contentDays.slice(0, 7)
    const daysCompleted = first7Days.length

    return {
      contentDays,
      totalContentDays: contentDays.length,
      first7Days,
      daysCompleted,
      firstContentAt: contentDays[0] ?? null,
    }
  } catch {
    return null
  }
}

export async function loadActivationStatus(): Promise<ActivationStatus | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('destravai_execution_events')
      .select('event_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(500)
    if (error || !data) return null

    const days = new Set<string>()
    let postedCount = 0
    let recordedCount = 0
    for (const ev of data) {
      days.add(String(ev.created_at).slice(0, 10))
      if (ev.event_type === 'posted') postedCount++
      if (ev.event_type === 'recording_save') recordedCount++
    }
    return {
      firstEventAt: data[0]?.created_at ?? null,
      activeDays: days.size,
      postedCount,
      recordedCount,
    }
  } catch {
    return null
  }
}
