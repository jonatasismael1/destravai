// Notificações locais (sem backend/WhatsApp por enquanto).
// Dispara lembrete diário e os marcos da régua de ativação (D1/D3/D7) quando o
// app é aberto. É a versão viável sem servidor de push; quando houver Web Push,
// a mesma régua pode ser disparada do servidor.

const ENABLED_KEY = 'destravai-notif-enabled'
const LAST_DAILY_KEY = 'destravai-notif-daily'
const MILESTONES_KEY = 'destravai-notif-milestones'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationsEnabled(): boolean {
  return notificationsSupported()
    && Notification.permission === 'granted'
    && localStorage.getItem(ENABLED_KEY) === 'true'
}

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  let perm = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission()
  const granted = perm === 'granted'
  localStorage.setItem(ENABLED_KEY, granted ? 'true' : 'false')
  return granted
}

export function disableNotifications(): void {
  localStorage.setItem(ENABLED_KEY, 'false')
}

async function show(title: string, body: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'destravai' })
    } else {
      new Notification(title, { body, icon: '/icon-192.png' })
    }
  } catch { /* silencioso */ }
}

const MILESTONES = [
  { d: 1, msg: '1 dia ativo! Bora manter o ritmo. 🔥' },
  { d: 3, msg: '3 dias de constância! Você está aparecendo. 👏' },
  { d: 7, msg: '7 dias! Sua presença já virou hábito. 🚀' },
]

// Chamado ao abrir o app. Dispara, no máximo: 1 lembrete diário + os marcos novos.
export async function runActivationNudges(opts: { hasPendingMission: boolean; activeDays: number }): Promise<void> {
  if (!notificationsEnabled()) return

  const today = new Date().toISOString().slice(0, 10)
  if (opts.hasPendingMission && localStorage.getItem(LAST_DAILY_KEY) !== today) {
    await show('Sua missão de hoje está pronta 🎯', 'Abra o Destravaí e grave 1 conteúdo rapidinho.')
    localStorage.setItem(LAST_DAILY_KEY, today)
  }

  let shown: number[] = []
  try { shown = JSON.parse(localStorage.getItem(MILESTONES_KEY) || '[]') } catch { shown = [] }
  for (const m of MILESTONES) {
    if (opts.activeDays >= m.d && !shown.includes(m.d)) {
      await show('Destravaí — constância', m.msg)
      shown.push(m.d)
    }
  }
  localStorage.setItem(MILESTONES_KEY, JSON.stringify(shown))
}
