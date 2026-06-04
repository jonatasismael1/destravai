// GET /.netlify/functions/asaas-subscription-status
// Retorna o status atual da assinatura do usuário, se está dentro da garantia
// de 7 dias, a data limite de reembolso e se o acesso está liberado.

import { COMPLETE_PLAN, json, preflight, supabaseAdmin, getUser, subscriptionRowGrantsAccess } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método não permitido' })

  try {
    const user = await getUser(event)
    if (!user) return json(401, { error: 'Não autorizado' })

    const admin = supabaseAdmin()
    const { data: subs } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!subs?.length) {
      return json(200, { hasSubscription: false, hasAccess: false, status: null })
    }

    // Escolhe a linha que CONCEDE acesso (se houver) — não apenas a mais recente.
    // Assim um pagante que reabriu o checkout (criando uma 'pending' mais nova) não
    // perde o acesso da assinatura ativa. Para exibição, cai na mais recente.
    const sub = subs.find(subscriptionRowGrantsAccess) ?? subs[0]

    const now = new Date()
    const deadline = sub.refund_deadline ? new Date(sub.refund_deadline) : null
    const withinGuarantee = !!deadline && now <= deadline && sub.payment_status === 'paid'

    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null
    // Cortesia (testador liberado pelo admin): acesso vale pelo access_granted,
    // independente de status de pagamento — não há cobrança envolvida.
    const isCourtesy = sub.payment_method === 'COURTESY' && sub.access_granted === true
    // Acesso normal: assinatura ativa e paga.
    const activePaid = ['active', 'trialing'].includes(sub.status) && sub.payment_status === 'paid'
    // Carência: cancelou OU ficou em atraso (past_due), mas ainda dentro do período
    // já pago. Espelha subscriptionRowGrantsAccess — não derruba o acesso na hora.
    const inPaidPeriodGrace = ['canceled', 'past_due'].includes(sub.status) && !!periodEnd && now <= periodEnd
    const hasAccess = isCourtesy || activePaid || inPaidPeriodGrace

    return json(200, {
      hasSubscription: true,
      hasAccess,
      status: sub.status,
      paymentStatus: sub.payment_status,
      planName: sub.plan_name || COMPLETE_PLAN.name,
      price: Number(sub.recurring_price ?? sub.price ?? COMPLETE_PLAN.recurringPrice),
      firstMonthPrice: Number(sub.first_month_price ?? COMPLETE_PLAN.firstMonthPrice),
      recurringPrice: Number(sub.recurring_price ?? sub.price ?? COMPLETE_PLAN.recurringPrice),
      startedAt: sub.started_at,
      refundDeadline: sub.refund_deadline,
      withinGuarantee,
      canceledAt: sub.canceled_at,
      currentPeriodEnd: sub.current_period_end ?? null,
      // Até quando o acesso vale quando cancelado/em atraso dentro do período pago.
      accessUntil: inPaidPeriodGrace ? sub.current_period_end : null,
    })
  } catch (err) {
    console.error('[asaas-subscription-status]', err?.message)
    return json(500, { error: err?.message || 'Erro ao consultar assinatura' })
  }
}
