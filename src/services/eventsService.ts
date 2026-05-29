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
