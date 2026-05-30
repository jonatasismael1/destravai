export type ContentCategory = 'authority' | 'backstage' | 'connection' | 'sale' | 'interaction' | 'humor'

export function inferCategory(objective: string): ContentCategory {
  const o = objective.toLowerCase()
  // Venda — termos comerciais de qualquer nicho
  if (o.includes('vend') || o.includes('consulta') || o.includes('procedimento') || o.includes('agend') ||
      o.includes('objeç') || o.includes('serviço') || o.includes('produto') || o.includes('comprar') ||
      o.includes('contrat') || o.includes('orçamento') || o.includes('cliente') || o.includes('promoç')) return 'sale'
  // Bastidor
  if (o.includes('bastidor') || o.includes('rotina') || o.includes('dia a dia') || o.includes('look') ||
      o.includes('processo') || o.includes('making')) return 'backstage'
  // Interação
  if (o.includes('interaç') || o.includes('enquete') || o.includes('caixinha') || o.includes('pergunta') ||
      o.includes('reativ') || o.includes('coment') || o.includes('responder')) return 'interaction'
  // Humor
  if (o.includes('humor') || o.includes('leve') || o.includes('engraç') || o.includes('divertid')) return 'humor'
  // Conexão
  if (o.includes('aproxim') || o.includes('conexão') || o.includes('conectar') || o.includes('pessoal') ||
      o.includes('humaniz') || o.includes('história') || o.includes('propósito') || o.includes('valores')) return 'connection'
  return 'authority'
}

export function calculateStreak(lastActivity: string, currentStreak: number): number {
  const last = new Date(lastActivity)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (last.toDateString() === today.toDateString()) return currentStreak
  if (last.toDateString() === yesterday.toDateString()) return currentStreak + 1
  return 1
}

export const MAX_STREAK_SHIELDS = 2

export interface StreakResult {
  streak: number
  shields: number
  usedShield: boolean   // consumiu um escudo para não zerar
  awardedShield: boolean // ganhou um escudo neste marco
}

// Versão do cálculo de streak com "escudo": se a pessoa pulou EXATAMENTE 1 dia e
// tem escudo, o escudo é consumido e o streak continua em vez de zerar. A cada
// múltiplo de 7 dias seguidos, ganha 1 escudo (até MAX_STREAK_SHIELDS).
export function calculateStreakWithShield(
  lastActivity: string,
  currentStreak: number,
  shields: number,
): StreakResult {
  const last = new Date(lastActivity)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const dayBefore = new Date(today); dayBefore.setDate(today.getDate() - 2)

  // Já contou hoje: nada muda.
  if (last.toDateString() === today.toDateString()) {
    return { streak: currentStreak, shields, usedShield: false, awardedShield: false }
  }

  let streak: number
  let usedShield = false
  if (last.toDateString() === yesterday.toDateString()) {
    streak = currentStreak + 1
  } else if (last.toDateString() === dayBefore.toDateString() && shields > 0) {
    // Pulou 1 dia, mas o escudo cobre — mantém a sequência.
    streak = currentStreak + 1
    usedShield = true
  } else {
    streak = 1
  }

  let nextShields = shields - (usedShield ? 1 : 0)
  let awardedShield = false
  if (streak > currentStreak && streak % 7 === 0 && nextShields < MAX_STREAK_SHIELDS) {
    nextShields += 1
    awardedShield = true
  }

  return { streak, shields: nextShields, usedShield, awardedShield }
}

export function calculateLevel(completed: number): string {
  if (completed >= 50) return 'Referência em movimento'
  if (completed >= 30) return 'Perfil ativo'
  if (completed >= 15) return 'Presença consistente'
  if (completed >= 5) return 'Criando ritmo'
  return 'Começando a aparecer'
}

export function getWeekKey(): string {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const week = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${now.getFullYear()}-W${week}`
}

export function todayKey(): string {
  return new Date().toDateString()
}
