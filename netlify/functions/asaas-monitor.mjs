// Rotina de monitoramento do pagamento (AGENDADA — roda de hora em hora).
// Objetivo: garantir que "pagamento confirmado" SEMPRE vire acesso liberado.
// Faz duas coisas, ambas idempotentes:
//   1) Reprocessa assinaturas PAGAS que, por algum motivo, ficaram sem acesso
//      liberado (access_granted=false) — libera o perfil e (re)envia o e-mail.
//   2) Varre os eventos de pagamento confirmado das últimas 48h que ficaram SEM
//      assinatura vinculada (user_id nulo) e tenta revincular; o que não der,
//      vira ALERTA no log para ação manual.
//
// Agendamento: Netlify Scheduled Functions (config.schedule abaixo).
// IMPORTANTE: funções agendadas do Netlify NÃO são acessíveis por URL pública em
// produção (só rodam pelo cron / "Run now" no painel / CLI no dev). Por isso um
// atacante externo não alcança esta função. O token abaixo é defesa em profundidade
// para disparo manual (dev/CLI) e caso esse comportamento do Netlify mude.

import { supabaseAdmin, serverLog, grantAccess, json } from './_shared.mjs'

export const config = { schedule: '@hourly' }

const PAID_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH']

// Garante que só o agendador da Netlify (ou um disparo manual autenticado) execute
// a rotina — sem isso, qualquer um podia chamar a URL pública e martelar o banco.
// • Invocação agendada: a Netlify envia o corpo com a propriedade `next_run`.
// • Disparo manual: exige `?token=` (ou header `x-monitor-token`) === MONITOR_TOKEN.
function isAuthorized(event) {
  let isScheduled = false
  try { isScheduled = !!JSON.parse(event?.body || '{}').next_run } catch { /* corpo vazio/inválido */ }
  if (isScheduled) return true

  const expected = process.env.MONITOR_TOKEN
  if (!expected) return false // sem token configurado, bloqueia disparo manual externo
  const token = event?.queryStringParameters?.token || event?.headers?.['x-monitor-token']
  return token === expected
}

export const handler = async (event) => {
  if (!isAuthorized(event)) return json(401, { error: 'Nao autorizado' })

  const admin = supabaseAdmin()
  const report = { reprocessed: 0, stillBroken: 0, orphanLinked: 0, orphanAlerts: 0 }

  try {
    // ── 1) Assinaturas pagas sem acesso → reprocessa ───────────────────────────
    const { data: paidNoAccess } = await admin
      .from('subscriptions')
      .select('*')
      .eq('payment_status', 'paid')
      .eq('access_granted', false)
      .limit(200)

    for (const sub of paidNoAccess ?? []) {
      if (!sub.user_id) continue // sem usuário não há o que liberar (cai no passo 2)
      try {
        await grantAccess(admin, sub)
        await admin.from('subscriptions').update({
          access_granted: true,
          access_granted_at: new Date().toISOString(),
        }).eq('id', sub.id)
        report.reprocessed++
        await serverLog('asaas-monitor', 'Acesso reprocessado (estava pago sem acesso)', 'warn', sub.user_id, { subscriptionId: sub.id })
      } catch (e) {
        report.stillBroken++
        await serverLog('asaas-monitor', `Falha ao reprocessar acesso: ${e?.message}`, 'alert', sub.user_id, { subscriptionId: sub.id })
      }
    }

    // ── 2) Eventos pagos sem assinatura vinculada (últimas 48h) ────────────────
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const { data: orphanEvents } = await admin
      .from('asaas_webhook_events')
      .select('event_id, event_type, asaas_payment_id, asaas_subscription_id, payload, created_at, user_id')
      .in('event_type', PAID_EVENTS)
      .is('user_id', null)
      .gte('created_at', since)
      .limit(100)

    for (const ev of orphanEvents ?? []) {
      const linked = await tryLinkOrphanEvent(admin, ev)
      if (linked) {
        report.orphanLinked++
      } else {
        report.orphanAlerts++
        await serverLog('asaas-monitor', 'Pagamento confirmado SEM assinatura local (revisar manualmente)', 'alert', null, {
          eventId: ev.event_id,
          asaasPaymentId: ev.asaas_payment_id,
          asaasSubscriptionId: ev.asaas_subscription_id,
          customer: ev.payload?.payment?.customer || ev.payload?.subscription?.customer || null,
          externalReference: ev.payload?.payment?.externalReference || ev.payload?.subscription?.externalReference || null,
        })
      }
    }

    // Resumo: só registra alerta-resumo se sobrou algo pendente de atenção.
    if (report.stillBroken > 0 || report.orphanAlerts > 0) {
      await serverLog('asaas-monitor',
        `Resumo: ${report.reprocessed} reprocessados, ${report.orphanLinked} eventos revinculados, ${report.stillBroken} ainda quebrados, ${report.orphanAlerts} eventos órfãos`,
        'alert', null, report)
    }

    return json(200, { ok: true, report })
  } catch (err) {
    await serverLog('asaas-monitor', `Falha geral na rotina de monitoramento: ${err?.message}`, 'error', null, null)
    return json(200, { ok: false, error: err?.message })
  }
}

// Tenta revincular um evento de pagamento órfão a uma assinatura que pode ter sido
// criada DEPOIS do evento. Se encontrar e estiver paga, vincula o evento, libera o
// acesso (idempotente) e marca como processado. Retorna true se conseguiu vincular.
async function tryLinkOrphanEvent(admin, ev) {
  const payment = ev.payload?.payment || null
  const subscriptionObj = ev.payload?.subscription || null
  const asaasSubscriptionId = ev.asaas_subscription_id || payment?.subscription || subscriptionObj?.id || null
  const userId = payment?.externalReference || subscriptionObj?.externalReference || null
  const customerId = payment?.customer || subscriptionObj?.customer || null

  let subRow = null
  if (asaasSubscriptionId) {
    const { data } = await admin.from('subscriptions').select('*')
      .eq('asaas_subscription_id', asaasSubscriptionId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    subRow = data
  }
  if (!subRow && userId) {
    const { data } = await admin.from('subscriptions').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    subRow = data
  }
  if (!subRow && customerId) {
    const { data } = await admin.from('subscriptions').select('*')
      .eq('asaas_customer_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    subRow = data
  }
  if (!subRow) return false

  // Libera o acesso se ainda não foi (idempotente).
  if (subRow.user_id && !subRow.access_granted) {
    try {
      await grantAccess(admin, subRow)
      await admin.from('subscriptions').update({
        access_granted: true,
        access_granted_at: new Date().toISOString(),
        payment_status: 'paid',
        status: subRow.status === 'canceled' || subRow.status === 'refunded' ? subRow.status : 'active',
      }).eq('id', subRow.id)
    } catch {
      return false
    }
  }

  // Marca o evento como processado e vincula o user_id.
  await admin.from('asaas_webhook_events')
    .update({ processed_at: new Date().toISOString(), user_id: subRow.user_id })
    .eq('event_id', ev.event_id)

  return true
}
