// POST /.netlify/functions/asaas-cancel-subscription
// Cancela a assinatura do usuário. Dentro dos 7 dias de garantia: cancela e
// estorna. Fora dos 7 dias: cancela a renovação futura (sem estorno).

import { json, preflight, supabaseAdmin, getUser, asaas } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
    const user = await getUser(event)
    if (!user) return json(401, { error: 'Não autorizado' })

    const admin = supabaseAdmin()

    // Assinatura mais recente que ainda está ativa/pendente/atrasada.
    const { data: sub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub) return json(404, { error: 'Nenhuma assinatura ativa encontrada' })

    const now = new Date()
    const deadline = sub.refund_deadline ? new Date(sub.refund_deadline) : null
    const withinGuarantee = !!deadline && now <= deadline && sub.payment_status === 'paid'

    // Cancela a assinatura no Asaas (interrompe cobranças futuras).
    if (sub.asaas_subscription_id) {
      await asaas(`/subscriptions/${sub.asaas_subscription_id}`, { method: 'DELETE' }).catch((e) => {
        console.error('[cancel] erro ao cancelar no Asaas', e?.message)
      })
    }

    const updates = { canceled_at: now.toISOString() }

    if (withinGuarantee && sub.asaas_payment_id) {
      // Dentro da garantia: solicita estorno da cobrança paga.
      await asaas(`/payments/${sub.asaas_payment_id}/refund`, { method: 'POST' }).catch((e) => {
        console.error('[cancel] erro ao estornar no Asaas', e?.message)
      })
      updates.status = 'refunded'
      updates.payment_status = 'refunded'
      updates.refunded_at = now.toISOString()
    } else {
      // Fora da garantia: apenas cancela. MVP bloqueia o acesso imediatamente
      // (não mantém até o fim do ciclo, para simplificar).
      updates.status = 'canceled'
    }

    await admin.from('subscriptions').update(updates).eq('id', sub.id)

    return json(200, {
      ok: true,
      refunded: withinGuarantee,
      status: updates.status,
      message: withinGuarantee
        ? 'Assinatura cancelada e reembolso solicitado.'
        : 'Assinatura cancelada. Você não será cobrado novamente.',
    })
  } catch (err) {
    console.error('[asaas-cancel-subscription]', err?.message, err?.body || '')
    return json(500, { error: err?.message || 'Erro ao cancelar assinatura' })
  }
}
