import type { Progress } from '../types'

// ── Catálogo de conquistas (lógica pura, sem I/O) ─────────────────────────────
// Cada conquista é avaliada a partir do progresso/contadores que já existem.
// Adicionar uma nova conquista = adicionar um item nesta lista. Nada quebra.

export interface AchievementDef {
  key: string
  title: string
  description: string
  emoji: string
  /** Recebe o snapshot atual e diz se está desbloqueada. */
  isUnlocked: (ctx: AchievementContext) => boolean
}

export interface AchievementContext {
  progress: Progress
  postedCount: number
  recordedCount: number
  /** Maior streak já atingido (vem de destravai_progress.best_streak). */
  bestStreak: number
}

// Quantos tipos de conteúdo diferentes a pessoa já executou (do contentBalance).
function distinctContentTypes(progress: Progress): number {
  return Object.values(progress.contentBalance).filter(v => v > 0).length
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_mission',
    title: 'Primeiro passo',
    description: 'Concluiu a primeira missão.',
    emoji: '🌱',
    isUnlocked: ({ progress }) => progress.missionsCompleted >= 1,
  },
  {
    key: 'streak_3',
    title: 'Esquentando',
    description: '3 dias seguidos aparecendo.',
    emoji: '🔥',
    isUnlocked: ({ progress, bestStreak }) => progress.currentStreak >= 3 || bestStreak >= 3,
  },
  {
    key: 'streak_7',
    title: 'Virou hábito',
    description: '7 dias seguidos de constância.',
    emoji: '🚀',
    isUnlocked: ({ progress, bestStreak }) => progress.currentStreak >= 7 || bestStreak >= 7,
  },
  {
    key: 'streak_30',
    title: 'Imparável',
    description: '30 dias seguidos! Você é referência em constância.',
    emoji: '👑',
    isUnlocked: ({ progress, bestStreak }) => progress.currentStreak >= 30 || bestStreak >= 30,
  },
  {
    key: 'missions_15',
    title: 'Ritmo de criador',
    description: '15 missões concluídas.',
    emoji: '⚡',
    isUnlocked: ({ progress }) => progress.missionsCompleted >= 15,
  },
  {
    key: 'missions_50',
    title: 'Máquina de conteúdo',
    description: '50 missões concluídas.',
    emoji: '🏆',
    isUnlocked: ({ progress }) => progress.missionsCompleted >= 50,
  },
  {
    key: 'all_content_types',
    title: 'Versátil',
    description: 'Já criou conteúdo nos 6 tipos diferentes.',
    emoji: '🎨',
    isUnlocked: ({ progress }) => distinctContentTypes(progress) >= 6,
  },
  {
    key: 'first_post',
    title: 'Apareceu de verdade',
    description: 'Marcou o primeiro conteúdo como postado.',
    emoji: '📣',
    isUnlocked: ({ postedCount }) => postedCount >= 1,
  },
  {
    key: 'posted_10',
    title: 'Presença firme',
    description: '10 conteúdos postados.',
    emoji: '✨',
    isUnlocked: ({ postedCount }) => postedCount >= 10,
  },
  {
    key: 'first_recording',
    title: 'Luz, câmera, ação',
    description: 'Gravou o primeiro vídeo no teleprompter.',
    emoji: '🎬',
    isUnlocked: ({ recordedCount }) => recordedCount >= 1,
  },
]

/** Avalia o catálogo e devolve as chaves que estão desbloqueadas AGORA. */
export function evaluateUnlocked(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter(a => {
    try { return a.isUnlocked(ctx) } catch { return false }
  }).map(a => a.key)
}

export function getAchievementDef(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find(a => a.key === key)
}
