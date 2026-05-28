// POST /.netlify/functions/asaas-create-checkout
// Cria (ou reaproveita) o customer no Asaas, cria a assinatura recorrente,
// gera o link de pagamento hospedado e salva o registro inicial no Supabase.
// Retorna a URL para o frontend redirecionar o usuário.

import { PLANS, json, preflight, supabaseAdmin, getUser, asaas } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
    const user = await getUser(event)
    if (!user) return json(401, { error: 'Não autorizado' })

    const body = JSON.parse(event.body || '{}')
    const plan = PLANS[body.planId]
    if (!plan) return json(400, { error: 'Plano inválido' })

    const cpfCnpj = String(body.cpfCnpj || '').replace(/\D/g, '')
    const name = String(body.name || user.user_metadata?.name || user.email || 'Cliente Destravaí')
    const appUrl = (process.env.APP_URL || 'https://destravai.dbe.digital/').replace(/\/$/, '')

    const admin = supabaseAdmin()

    // Reaproveita customer existente (se o usuário já tentou assinar antes)
    const { data: existing } = await admin
      .from('subscriptions')
      .select('asaas_customer_id')
      .eq('user_id', user.id)
      .not('asaas_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customerId = existing?.asaas_customer_id || null

    if (!customerId) {
      const customer = await asaas('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email: user.email,
          ...(cpfCnpj ? { cpfCnpj } : {}),
          externalReference: user.id,
          notificationDisabled: false,
        }),
      })
      customerId = customer.id
    }

    // Cria a assinatura recorrente mensal.
    // billingType UNDEFINED → o cliente escolhe a forma de pagamento (cartão/pix)
    // na página hospedada do Asaas; não tocamos em dados de cartão.
    const today = new Date().toISOString().slice(0, 10)
    const subscription = await asaas('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED',
        value: plan.price,
        nextDueDate: today,
        cycle: 'MONTHLY',
        description: `${plan.name} — assinatura mensal`,
        externalReference: user.id,
      }),
    })

    // Busca a primeira cobrança da assinatura para obter o link de pagamento.
    const payments = await asaas(`/payments?subscription=${subscription.id}&limit=1`)
    const firstPayment = payments?.data?.[0]
    const checkoutUrl = firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl || null

    if (!checkoutUrl) {
      return json(502, { error: 'Não foi possível gerar o link de pagamento. Tente novamente.' })
    }

    // Salva/atualiza o registro inicial (status pending).
    await admin.from('subscriptions').insert({
      user_id: user.id,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      asaas_payment_id: firstPayment?.id ?? null,
      plan_name: plan.name,
      price: plan.price,
      billing_cycle: 'MONTHLY',
      status: 'pending',
      payment_status: 'pending',
    })

    return json(200, { checkoutUrl, subscriptionId: subscription.id })
  } catch (err) {
    console.error('[asaas-create-checkout]', err?.message, err?.body || '')
    return json(500, { error: err?.message || 'Erro ao criar assinatura' })
  }
}
