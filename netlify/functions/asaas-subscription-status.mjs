// GET /.netlify/functions/asaas-subscription-status
// Retorna o status atual da assinatura do usuário, se está dentro da garantia
// de 7 dias, a data limite de reembolso e se o acesso está liberado.

import { COMPLETE_PLAN, json, preflight, supabaseAdmin, getUser } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método não permitido' })

  try {
    const user = await getUser(event)
    if (!user) return json(401, { error: 'Não autorizado' })

    const admin = supabaseAdmin()
    const { data: sub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub) {
      return json(200, { hasSubscription: false, hasAccess: false, status: null })
    }

    const now = new Date()
    const deadline = sub.refund_deadline ? new Date(sub.refund_deadline) : null
    const withinGuarantee = !!deadline && now <= deadline && sub.payment_status === 'paid'
    const hasAccess = ['active', 'trialing'].includes(sub.status) && sub.payment_status === 'paid'

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
    })
  } catch (err) {
    console.error('[asaas-subscription-status]', err?.message)
    return json(500, { error: err?.message || 'Erro ao consultar assinatura' })
  }
}
