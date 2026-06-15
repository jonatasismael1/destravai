/*
 * Helper de analytics do app (cliente). Os provedores (Clarity + GA4) sao
 * carregados por /analytics.js no index.html; aqui so DISPARAMOS os eventos do
 * funil a partir do React, sem o app quebrar se algum provedor nao tiver subido.
 *
 * Eventos do funil (lado do app):
 *   checkout_iniciado   -> abriu a tela de checkout
 *   checkout_preenchido -> preencheu e enviou o formulario (antes de ir ao Asaas)
 *   compra_aprovada     -> caiu na tela de sucesso confirmada (marcador p/ Clarity;
 *                          a contagem oficial vem do webhook via GA4)
 *   compra_recusada     -> caiu na tela de erro de pagamento
 */

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void
    gtag?: (...args: unknown[]) => void
    __GA4_ENABLED?: boolean
  }
}

type EventParams = Record<string, string | number | boolean>

// Manda o evento para Clarity e GA4. Cada try isola o provedor: telemetria nunca
// pode derrubar a experiencia do usuario.
export function track(nome: string, params: EventParams = {}): void {
  try { window.clarity?.('event', nome) } catch { /* ignore */ }
  try { if (window.__GA4_ENABLED) window.gtag?.('event', nome, params) } catch { /* ignore */ }
}

// So Clarity (usado quando o GA4 ja recebe o mesmo evento pelo servidor/webhook,
// para nao contar a conversao duas vezes no GA4).
export function trackClarity(nome: string): void {
  try { window.clarity?.('event', nome) } catch { /* ignore */ }
}
