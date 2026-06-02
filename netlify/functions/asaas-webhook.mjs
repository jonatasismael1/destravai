// POST /.netlify/functions/asaas-webhook
// Recebe eventos do Asaas. Valida o token, é idempotente (não reprocessa o
// mesmo evento) e atualiza o status da assinatura no Supabase.
// URL para cadastrar no painel do Asaas:
//   https://destravai.dbe.digital/.netlify/functions/asaas-webhook

import { COMPLETE_PLAN, json, supabaseAdmin, mapPaymentEvent, GUARANTEE_DAYS, serverLog, asaas, grantAccess } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  // 1) Proteção contra webhook falso: valida o header asaas-access-token.
  const token = event.headers['asaas-access-token'] || event.headers['Asaas-Access-Token']
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expected || token !== expected) {
    console.warn('[asaas-webhook] token inválido ou ausente')
    return json(401, { error: 'Token inválido' })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Payload inválido' })
  }

  const admin = supabaseAdmin()

  const eventId = payload.id || `${payload.event}-${payload.payment?.id || payload.subscription?.id || Date.now()}`
  const eventType = payload.event || 'UNKNOWN'
  const payment = payload.payment || null
  const subscriptionObj = payload.subscription || null
  const asaasSubscriptionId = payment?.subscription || subscriptionObj?.id || null
  const asaasPaymentId = payment?.id || null

  try {
    // 2) Idempotência: registra o evento; se já existe (event_id único), ignora.
    const { error: insertErr } = await admin.from('asaas_webhook_events').insert({
      event_id: eventId,
      event_type: eventType,
      asaas_payment_id: asaasPaymentId,
      asaas_subscription_id: asaasSubscriptionId,
      payload,
    })
    if (insertErr) {
      // Violação de unique = evento repetido → responde 200 e não reprocessa.
      if (insertErr.code === '23505') {
        return json(200, { ok: true, duplicated: true })
      }
      console.error('[asaas-webhook] erro ao registrar evento', insertErr.message)
      // Mesmo assim seguimos tentando processar (não bloqueia).
    }

    // 3) Localiza a assinatura no nosso banco.
    let subRow = null
    if (asaasSubscriptionId) {
      const { data } = await admin.from('subscriptions').select('*')
        .eq('asaas_subscription_id', asaasSubscriptionId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      subRow = data
    }
    // Fallback: por externalReference (user_id) ou customer.
    if (!subRow) {
      const userId = payment?.externalReference || subscriptionObj?.externalReference
      const customerId = payment?.customer || subscriptionObj?.customer
      if (userId) {
        const { data } = await admin.from('subscriptions').select('*')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        subRow = data
      } else if (customerId) {
        const { data } = await admin.from('subscriptions').select('*')
          .eq('asaas_customer_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        subRow = data
      }
    }

    // 4) Aplica a mudança de status.
    // Cortesia é gerenciada pelo admin (sem cobrança). Nunca deixamos um evento do
    // Asaas rebaixar o acesso de um testador — apenas registramos o evento.
    const isCourtesy = subRow?.payment_method === 'COURTESY'
    // 'canceled'/'refunded' são estados definidos por AÇÃO DO USUÁRIO (terminais).
    // Ao cancelar, deletamos a assinatura no Asaas, o que apaga a cobrança futura
    // pendente e dispara PAYMENT_DELETED. Sem este guard, esse evento rebaixaria o
    // status para 'failed' e encurtaria indevidamente o acesso/carência.
    const terminalStatus = !!subRow && ['canceled', 'refunded'].includes(subRow.status)
    const mappedRaw = (!isCourtesy && eventType.startsWith('PAYMENT_')) ? mapPaymentEvent(eventType) : null
    // Em estado terminal (cancelado/reembolsado) só permitimos a transição para
    // 'refunded' (estorno efetivado). Eventos como PAYMENT_DELETED (da recorrência
    // cancelada) NÃO podem rebaixar o status nem encurtar o acesso/carência.
    const mapped = terminalStatus
      ? (mappedRaw && mappedRaw.status === 'refunded' ? mappedRaw : null)
      : mappedRaw
    const updates = { last_webhook_event: eventType, last_webhook_payload: payload }

    // Indica que, ao confirmar o pagamento, precisamos liberar acesso + e-mail.
    let shouldGrantAccess = false

    if (mapped) {
      updates.status = mapped.status
      updates.payment_status = mapped.payment_status
      if (asaasPaymentId) updates.asaas_payment_id = asaasPaymentId

      // Ao confirmar o primeiro pagamento, define started_at e refund_deadline.
      if (mapped.payment_status === 'paid') {
        const startedAt = subRow?.started_at ? new Date(subRow.started_at) : new Date()
        updates.started_at = startedAt.toISOString()
        const deadline = new Date(startedAt)
        deadline.setDate(deadline.getDate() + GUARANTEE_DAYS)
        updates.refund_deadline = deadline.toISOString()

        // "Pago até": cada pagamento confirmado garante +1 mês de acesso a partir
        // de agora. É o que sustenta o acesso até o fim do período já pago quando
        // o usuário cancela fora da garantia.
        const periodEnd = new Date()
        periodEnd.setMonth(periodEnd.getMonth() + 1)
        updates.current_period_end = periodEnd.toISOString()

        if (subRow && !subRow.asaas_subscription_id && subRow.plan_id === COMPLETE_PLAN.id) {
          try {
            const recurring = await createRecurringSubscription(subRow)
            if (recurring?.id) updates.asaas_subscription_id = recurring.id
          } catch (e) {
            console.error('[asaas-webhook] erro ao criar recorrencia no Asaas', e?.message)
            await serverLog('asaas-webhook', 'Erro ao criar recorrencia no Asaas', 'error', subRow.user_id, {
              subscriptionId: subRow.id,
              asaasCustomerId: subRow.asaas_customer_id,
              error: e?.message,
            })
          }
        }

        // Libera o acesso apenas se ainda não foi liberado (idempotente).
        if (subRow && !subRow.access_granted) {
          updates.access_granted = true
          updates.access_granted_at = new Date().toISOString()
          shouldGrantAccess = true
        }
      }
      if (mapped.status === 'refunded') updates.refunded_at = new Date().toISOString()
    } else if (eventType === 'SUBSCRIPTION_DELETED' || eventType === 'SUBSCRIPTION_INACTIVATED') {
      updates.status = 'canceled'
      updates.canceled_at = new Date().toISOString()
    }
    // SUBSCRIPTION_CREATED / SUBSCRIPTION_UPDATED: só guardamos o último evento.

    if (subRow) {
      await admin.from('subscriptions').update(updates).eq('id', subRow.id)

      // Liberação de acesso: cria/atualiza o profile e envia o e-mail de acesso.
      if (shouldGrantAccess && subRow.user_id) {
        await grantAccess(admin, subRow)
      }

      // Marca o evento como processado e vincula o user_id.
      await admin.from('asaas_webhook_events')
        .update({ processed_at: new Date().toISOString(), user_id: subRow.user_id })
        .eq('event_id', eventId)
    } else {
      console.warn('[asaas-webhook] assinatura não encontrada para', { asaasSubscriptionId, asaasPaymentId })
      // ALERTA CRÍTICO: pagamento confirmado mas sem assinatura local = cliente
      // pagou e pode não receber acesso. Registra para reprocessamento manual.
      const level = mapped?.payment_status === 'paid' ? 'error' : 'warn'
      await serverLog('asaas-webhook', 'Evento sem assinatura local', level, null, {
        eventType, asaasSubscriptionId, asaasPaymentId,
        customer: payment?.customer || subscriptionObj?.customer || null,
        externalReference: payment?.externalReference || subscriptionObj?.externalReference || null,
      })
    }

    return json(200, { ok: true })
  } catch (err) {
    console.error('[asaas-webhook]', err?.message)
    await serverLog('asaas-webhook', err?.message || 'Erro', 'error', null, {
      eventId, eventType, asaasSubscriptionId,
    })
    // Responde 200 para o Asaas não reenviar infinitamente em erro nosso não-crítico;
    // o evento fica registrado e pode ser reprocessado manualmente se necessário.
    return json(200, { ok: false, error: err?.message })
  }
}

async function createRecurringSubscription(subRow) {
  return asaas('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: subRow.asaas_customer_id,
      billingType: subRow.payment_method === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
      value: COMPLETE_PLAN.recurringPrice,
      nextDueDate: nextMonthDate(),
      cycle: 'MONTHLY',
      description: `${COMPLETE_PLAN.name} - assinatura mensal`,
      externalReference: subRow.user_id,
    }),
  })
}

function nextMonthDate() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}
