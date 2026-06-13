import { supabase } from '../lib/supabase/client'
import type { Progress } from '../types'
import { evaluateUnlocked, getAchievementDef, type AchievementContext } from '../lib/achievements'

// ── Serviço de conquistas ─────────────────────────────────────────────────────
// Lê o estado atual (progresso + eventos), descobre quais conquistas estão
// desbloqueadas e grava as NOVAS. Tolerante a falhas: nunca lança para a UI.

export interface UnlockedAchievement {
  key: string
  title: string
  description: string
  emoji: string
  unlockedAt: string
}

/** Lê as conquistas já desbloqueadas do usuário (com seus metadados do catálogo). */
export async function loadAchievements(): Promise<UnlockedAchievement[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('destravai_achievements')
      .select('achievement_key, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    if (error || !data) return []

    return data
      .map(row => {
        const def = getAchievementDef(row.achievement_key)
        if (!def) return null
        return {
          key: def.key,
          title: def.title,
          description: def.description,
          emoji: def.emoji,
          unlockedAt: row.unlocked_at,
        }
      })
      .filter((a): a is UnlockedAchievement => a !== null)
  } catch {
    return []
  }
}

/**
 * Lê o best_streak persistido e, se o streak atual for maior, atualiza-o.
 * Devolve o melhor streak considerado (já atualizado). Nunca lança.
 */
async function syncBestStreak(userId: string, currentStreak: number): Promise<number> {
  try {
    const { data } = await supabase
      .from('destravai_progress')
      .select('best_streak')
      .eq('user_id', userId)
      .maybeSingle()

    const stored = (data?.best_streak as number | undefined) ?? 0
    if (currentStreak > stored) {
      await supabase
        .from('destravai_progress')
        .update({ best_streak: currentStreak })
        .eq('user_id', userId)
      return currentStreak
    }
    return stored
  } catch {
    return currentStreak
  }
}

/**
 * Verifica conquistas a partir do progresso atual e grava as novas.
 * Retorna apenas as conquistas RECÉM-desbloqueadas (para celebrar na UI).
 */
export async function checkAndUnlockAchievements(progress: Progress): Promise<UnlockedAchievement[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Conta eventos de execução relevantes (postou, gravou).
    const { data: events } = await supabase
      .from('destravai_execution_events')
      .select('event_type')
      .eq('user_id', user.id)
      .limit(1000)

    const postedCount = (events ?? []).filter(e => e.event_type === 'posted').length
    const recordedCount = (events ?? []).filter(e => e.event_type === 'recording_save').length

    const bestStreak = await syncBestStreak(user.id, progress.currentStreak)

    const ctx: AchievementContext = { progress, postedCount, recordedCount, bestStreak }
    const unlockedKeys = evaluateUnlocked(ctx)
    if (unlockedKeys.length === 0) return []

    // Descobre quais JÁ existem para inserir só as novas.
    const { data: existing } = await supabase
      .from('destravai_achievements')
      .select('achievement_key')
      .eq('user_id', user.id)

    const existingKeys = new Set((existing ?? []).map(r => r.achievement_key))
    const newKeys = unlockedKeys.filter(k => !existingKeys.has(k))
    if (newKeys.length === 0) return []

    // Caminho principal: RPC validada pelo catálogo no servidor (migration
    // 202606120015). A constraint unique continua garantindo 1x por conquista.
    let rpcMissing = false
    for (const key of newKeys) {
      const { error } = await supabase.rpc('destravai_unlock_achievement', { p_key: key })
      if (error) {
        if (error.code === 'PGRST202' || /destravai_unlock_achievement/.test(error.message || '')) {
          rpcMissing = true
          break
        }
        return []
      }
    }

    // Fallback: enquanto a migration da RPC não foi aplicada no banco,
    // usa o upsert direto antigo (ignoreDuplicates evita corrida).
    if (rpcMissing) {
      const rows = newKeys.map(key => ({ user_id: user.id, achievement_key: key }))
      const { error } = await supabase
        .from('destravai_achievements')
        .upsert(rows, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true })
      if (error) return []
    }

    return newKeys
      .map(key => {
        const def = getAchievementDef(key)
        if (!def) return null
        return {
          key: def.key,
          title: def.title,
          description: def.description,
          emoji: def.emoji,
          unlockedAt: new Date().toISOString(),
        }
      })
      .filter((a): a is UnlockedAchievement => a !== null)
  } catch {
    return []
  }
}
