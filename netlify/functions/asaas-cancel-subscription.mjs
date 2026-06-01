// POST /.netlify/functions/asaas-cancel-subscription
// Cancela a assinatura do usuario. Se estiver dentro do prazo de reembolso
// configurado na assinatura, cancela e solicita estorno; fora dele, interrompe
// cobrancas futuras.

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
    let refunded = false
    let refundFailed = false

    // Até quando o acesso continua valendo (fim do período já pago). Fallback: se
    // não temos current_period_end, estima 1 mês a partir do início.
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end)
      : (sub.started_at ? new Date(new Date(sub.started_at).setMonth(new Date(sub.started_at).getMonth() + 1)) : now)

    if (withinGuarantee && sub.asaas_payment_id) {
      // Dentro do prazo de reembolso e com pagamento confirmado: estorna a cobranca.
      // Como o dinheiro volta, o acesso é encerrado imediatamente (sem carência).
      // Só marca como "reembolsada" se o Asaas confirmar o estorno — assim o status
      // nunca diverge do dinheiro de verdade.
      try {
        await asaas(`/payments/${sub.asaas_payment_id}/refund`, { method: 'POST' })
        refunded = true
        updates.status = 'refunded'
        updates.payment_status = 'refunded'
        updates.refunded_at = now.toISOString()
        updates.current_period_end = now.toISOString() // acesso encerra agora
      } catch (e) {
        console.error('[cancel] erro ao estornar no Asaas', e?.message)
        refundFailed = true
        // Cancela mesmo assim (interrompe cobranças); o estorno é tratado manualmente.
        // Como o reembolso está em andamento, encerra o acesso agora também.
        updates.status = 'canceled'
        updates.current_period_end = now.toISOString()
      }
    } else {
      // Fora do prazo de reembolso: apenas interrompe cobranças futuras. O usuário
      // MANTÉM o acesso até o fim do período que já pagou (current_period_end).
      updates.status = 'canceled'
      updates.current_period_end = periodEnd.toISOString()
    }

    await admin.from('subscriptions').update(updates).eq('id', sub.id)

    // Data legível do fim do acesso, para a mensagem ao usuário.
    const accessUntilLabel = updates.current_period_end && !refunded && !refundFailed
      ? new Date(updates.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null

    return json(200, {
      ok: true,
      refunded,
      withinGuarantee,
      status: updates.status,
      accessUntil: updates.current_period_end ?? null,
      message: refunded
        ? 'Assinatura cancelada e reembolso solicitado. O valor volta pelo mesmo meio de pagamento.'
        : refundFailed
          ? 'Assinatura cancelada. Houve um problema ao solicitar o reembolso automático — nosso suporte vai concluir o estorno.'
          : accessUntilLabel
            ? `Assinatura cancelada. Você não será cobrado novamente e continua com acesso até ${accessUntilLabel}.`
            : 'Assinatura cancelada. Você não será cobrado novamente.',
    })
  } catch (err) {
    console.error('[asaas-cancel-subscription]', err?.message, err?.body || '')
    return json(500, { error: err?.message || 'Erro ao cancelar assinatura' })
  }
}
