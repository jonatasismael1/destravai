// POST /.netlify/functions/asaas-create-checkout
// Checkout PRÓPRIO do Destravaí (público — vem da landing, sem login).
// Fluxo "paga primeiro, acesso depois":
//   1. Valida o plano e RECALCULA o preço no servidor (nunca confia no front).
//   2. Cria/reaproveita a conta no Supabase Auth pelo e-mail (sem senha ainda).
//   3. Cria/reaproveita o customer no Asaas.
//   4. Cria a assinatura mensal no Asaas com a forma de pagamento escolhida.
//   5. Pix  → gera e retorna QR Code + copia e cola (exibidos dentro do app).
//      Cartão → retorna a URL do Asaas para o cliente preencher o cartão.
//   6. Salva o registro inicial (status pending) no Supabase.
// O acesso só é liberado pelo webhook quando o pagamento é confirmado.

import { getPlan, json, preflight, supabaseAdmin, getOrCreateAuthUser, asaas } from './_shared.mjs'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
    const body = JSON.parse(event.body || '{}')

    // ── Validação de entrada ──────────────────────────────────────────────
    const plan = await getPlan(body.planId)
    if (!plan) return json(400, { error: 'Plano inválido' })

    const billingType = body.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX'
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const phone = String(body.phone || '').replace(/\D/g, '')
    const cpfCnpj = String(body.cpfCnpj || '').replace(/\D/g, '')

    if (!name) return json(400, { error: 'Informe seu nome completo.' })
    if (!isValidEmail(email)) return json(400, { error: 'Informe um e-mail válido.' })
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return json(400, { error: 'Informe um CPF ou CNPJ válido.' })
    }

    const admin = supabaseAdmin()

    // ── 1) Garante a conta no Supabase (idempotente por e-mail) ───────────
    const userId = await getOrCreateAuthUser(email, name)

    // ── 2) Reaproveita customer do Asaas, se já houver ────────────────────
    const { data: existing } = await admin
      .from('subscriptions')
      .select('asaas_customer_id')
      .eq('user_id', userId)
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
          email,
          cpfCnpj,
          ...(phone ? { mobilePhone: phone } : {}),
          externalReference: userId,
          notificationDisabled: false,
        }),
      })
      customerId = customer.id
    }

    // ── 3) Cria a assinatura mensal no Asaas (preço validado no servidor) ──
    const today = new Date().toISOString().slice(0, 10)
    const subscription = await asaas('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType,                 // 'PIX' ou 'CREDIT_CARD'
        value: plan.price,           // SEMPRE o preço do servidor
        nextDueDate: today,
        cycle: 'MONTHLY',
        description: `${plan.name} — assinatura mensal`,
        externalReference: userId,
      }),
    })

    // Primeira cobrança da assinatura.
    const payments = await asaas(`/payments?subscription=${subscription.id}&limit=1`)
    const firstPayment = payments?.data?.[0]
    if (!firstPayment?.id) {
      return json(502, { error: 'Não foi possível gerar a cobrança. Tente novamente.' })
    }

    // ── 4) Monta a resposta conforme a forma de pagamento ─────────────────
    let pix = null
    let checkoutUrl = null

    if (billingType === 'PIX') {
      // QR Code + copia e cola para exibir dentro do app.
      const qr = await asaas(`/payments/${firstPayment.id}/pixQrCode`)
      pix = {
        qrCodeImage: qr?.encodedImage || null,   // base64 (sem prefixo data:)
        copyPaste: qr?.payload || null,
        expiration: qr?.expirationDate || null,
      }
      if (!pix.copyPaste) {
        return json(502, { error: 'Não foi possível gerar o Pix. Tente novamente.' })
      }
    } else {
      // Cartão: o cliente preenche os dados na página segura do Asaas.
      checkoutUrl = firstPayment.invoiceUrl || firstPayment.bankSlipUrl || null
      if (!checkoutUrl) {
        return json(502, { error: 'Não foi possível gerar o pagamento por cartão. Tente novamente.' })
      }
    }

    // ── 5) Salva o registro (pending) ─────────────────────────────────────
    // Reaproveita uma assinatura pendente do mesmo usuário (evita acumular
    // várias linhas pendentes a cada tentativa). Só cria nova se não houver.
    const subRecord = {
      user_id: userId,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      asaas_payment_id: firstPayment.id,
      plan_id: plan.id,
      plan_name: plan.name,
      price: plan.price,
      billing_cycle: 'MONTHLY',
      payment_method: billingType,
      status: 'pending',
      payment_status: 'pending',
      customer_name: name,
      customer_email: email,
      customer_phone: phone || null,
      customer_document: cpfCnpj,
      pix_qr_code: pix?.qrCodeImage ?? null,
      pix_copy_paste: pix?.copyPaste ?? null,
      pix_expiration: pix?.expiration ?? null,
    }

    const { data: pendingRow } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pendingRow?.id) {
      await admin.from('subscriptions')
        .update({ ...subRecord, updated_at: new Date().toISOString() })
        .eq('id', pendingRow.id)
    } else {
      await admin.from('subscriptions').insert(subRecord)
    }

    return json(200, {
      method: billingType === 'PIX' ? 'pix' : 'card',
      subscriptionId: subscription.id,
      paymentId: firstPayment.id,
      ...(pix ? { pix } : {}),
      ...(checkoutUrl ? { checkoutUrl } : {}),
    })
  } catch (err) {
    console.error('[asaas-create-checkout]', err?.message, err?.body || '')
    return json(500, { error: err?.message || 'Erro ao iniciar o pagamento' })
  }
}
