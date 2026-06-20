// POST /.netlify/functions/asaas-create-checkout
// Checkout publico do Destravai para oferta unica (somente cartao de credito):
//   1. Cria/reaproveita a conta no Supabase Auth pelo e-mail.
//   2. Cria/reaproveita o customer no Asaas.
//   3. Cria uma cobranca inicial avulsa de R$9,90 (oferta de lancamento).
//   4. O webhook, ao confirmar essa cobranca, cria a assinatura mensal de R$49,90.
//
// Esse fluxo evita depender de preco variavel em uma unica assinatura/link do Asaas.
// O acesso so e liberado pelo webhook quando o primeiro pagamento e confirmado.
// O pagamento e exclusivamente por cartao de credito, pois a recorrencia automatica
// depende do cartao (ver Termos de Uso, clausula de assinatura e cobranca).

import { COMPLETE_PLAN, json, preflight, supabaseAdmin, getOrCreateAuthUser, getAccessInfo, asaas, serverLog, signSetupToken, subscriptionRowGrantsAccess } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

const CHECKOUT_LIMIT = 10
const CHECKOUT_WINDOW_MS = 60 * 60 * 1000

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Mascara dados pessoais (e-mail, CPF/CNPJ, telefone) antes de gravar em log.
// O corpo de erro do Asaas pode ecoar o que o cliente enviou; não queremos PII
// crua na tabela de logs.
function maskPII(text) {
  return String(text || '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')   // e-mails
    .replace(/\d{6,}/g, (m) => `[${m.length} dígitos]`) // CPF/CNPJ/telefone/sequências longas
}

// Tenta cancelar uma cobrança pendente no Asaas antes de criar a nova.
// Silencioso: erros (ex: cobrança já paga/inexistente) são ignorados para
// não bloquear o novo checkout — o importante é não gerar dívida duplicada.
async function tryDeleteAsaasPayment(paymentId) {
  if (!paymentId) return
  try {
    await asaas(`/payments/${paymentId}`, { method: 'DELETE' })
  } catch (e) {
    console.warn('[asaas-create-checkout] não foi possível cancelar cobrança antiga:', paymentId, e?.message)
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido' })

  try {
    const ip = getClientIp(event)
    const rl = await checkRateLimit(`checkout:ip:${ip}`, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS)
    if (!rl.allowed) {
      return rateLimitExceeded(rl.resetAt, 'Muitas tentativas de pagamento. Aguarde um momento antes de tentar novamente.')
    }

    const body = JSON.parse(event.body || '{}')
    // Oferta de lancamento: pagamento exclusivamente por cartao de credito, pois a
    // recorrencia mensal automatica depende do cartao. Pix/boleto nao sao aceitos.
    const billingType = 'CREDIT_CARD'
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const phone = String(body.phone || '').replace(/\D/g, '')
    const cpfCnpj = String(body.cpfCnpj || '').replace(/\D/g, '')

    if (!name) return json(400, { error: 'Informe seu nome completo.' })
    if (!isValidEmail(email)) return json(400, { error: 'Informe um e-mail valido.' })
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return json(400, { error: 'Informe um CPF ou CNPJ valido.' })
    }

    const admin = supabaseAdmin()

    // ── Bloqueia por telefone ─────────────────────────────────────────────────
    // Se o celular já está cadastrado com acesso ativo, rejeita antes mesmo de
    // criar/buscar a conta — a pessoa pode ter usado outro e-mail antes.
    if (phone) {
      const { data: phoneSubs } = await admin
        .from('subscriptions')
        .select('status, payment_status, payment_method, access_granted, current_period_end')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(20)
      if ((phoneSubs ?? []).some(subscriptionRowGrantsAccess)) {
        return json(409, {
          error: 'Este celular já tem acesso ativo. Faça login com o e-mail cadastrado.',
          alreadyActive: true,
        })
      }
    }

    // ── Cria/reaproveita usuário por e-mail ───────────────────────────────────
    const userId = await getOrCreateAuthUser(email, name)

    // ── Bloqueia por e-mail ───────────────────────────────────────────────────
    // Verifica acesso antes de qualquer chamada ao Asaas. Evita cobranças
    // duplicadas quando o usuário já pagou e volta ao checkout por engano.
    const { allowed: alreadyHasAccess } = await getAccessInfo(admin, { id: userId, email })
    if (alreadyHasAccess) {
      return json(409, {
        error: 'Você já tem uma assinatura ativa! Faça login com seu e-mail e senha.',
        alreadyActive: true,
      })
    }

    // ── Cria/reaproveita customer no Asaas ────────────────────────────────────
    const { data: existingCust } = await admin
      .from('subscriptions')
      .select('asaas_customer_id')
      .eq('user_id', userId)
      .not('asaas_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customerId = existingCust?.asaas_customer_id || null
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

    // URL de retorno: quando o pagamento é por CARTÃO, o cliente é levado à página
    // do Asaas e, após pagar, volta para a tela de sucesso do app. Para Pix o QR é
    // exibido dentro do app (o callback não atrapalha).
    const appUrl = (process.env.APP_URL || 'https://destravai.dbe.digital').replace(/\/$/, '')

    // Token de definicao de senha: a pessoa volta do pagamento para a tela de
    // sucesso JA podendo criar a senha, sem depender do e-mail. Curta duracao e
    // assinado no servidor (ver signSetupToken). O e-mail continua como backup.
    const setupToken = signSetupToken(userId, email)
    const successUrl = `${appUrl}/pagamento/sucesso?s=${encodeURIComponent(setupToken)}`

    const today = new Date().toISOString().slice(0, 10)
    const firstPayment = await asaas('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value: COMPLETE_PLAN.firstMonthPrice,
        dueDate: today,
        description: `${COMPLETE_PLAN.name} - 1o mes (oferta de lancamento)`,
        externalReference: userId,
        callback: {
          successUrl,
          autoRedirect: true,
        },
      }),
    })

    if (!firstPayment?.id) {
      return json(502, { error: 'Nao foi possivel gerar a cobranca. Tente novamente.' })
    }

    // Cartao: o cliente paga no ambiente seguro do Asaas (invoiceUrl) e o cartao
    // fica tokenizado para a recorrencia mensal criada pelo webhook.
    const checkoutUrl = firstPayment.invoiceUrl || firstPayment.bankSlipUrl || null
    if (!checkoutUrl) {
      return json(502, { error: 'Nao foi possivel gerar o pagamento por cartao. Tente novamente.' })
    }

    const subRecord = {
      user_id: userId,
      asaas_customer_id: customerId,
      asaas_subscription_id: null,
      asaas_payment_id: firstPayment.id,
      plan_id: COMPLETE_PLAN.id,
      plan_name: COMPLETE_PLAN.name,
      price: COMPLETE_PLAN.recurringPrice,
      first_month_price: COMPLETE_PLAN.firstMonthPrice,
      recurring_price: COMPLETE_PLAN.recurringPrice,
      billing_cycle: 'MONTHLY',
      payment_method: billingType,
      status: 'pending',
      payment_status: 'pending',
      customer_name: name,
      customer_email: email,
      customer_phone: phone || null,
      customer_document: cpfCnpj,
      pix_qr_code: null,
      pix_copy_paste: null,
      pix_expiration: null,
    }

    // ── Reutiliza assinatura pendente/falha existente ─────────────────────────
    // Busca a linha mais recente sem acesso ativo (pending ou failed pela recusa
    // de cartão). Cancela a cobrança antiga no Asaas antes de criar a nova, para
    // não deixar cobranças duplicadas abertas na conta do cliente.
    const { data: reuseRow } = await admin
      .from('subscriptions')
      .select('id, asaas_payment_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'failed'])
      .eq('access_granted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reuseRow?.id) {
      // Cancela a cobrança anterior no Asaas (silencioso se já inexistente/paga)
      await tryDeleteAsaasPayment(reuseRow.asaas_payment_id)
      await admin.from('subscriptions')
        .update({ ...subRecord, updated_at: new Date().toISOString() })
        .eq('id', reuseRow.id)
    } else {
      await admin.from('subscriptions').insert(subRecord)
    }

    return json(200, {
      method: 'card',
      subscriptionId: null,
      paymentId: firstPayment.id,
      firstMonthPrice: COMPLETE_PLAN.firstMonthPrice,
      recurringPrice: COMPLETE_PLAN.recurringPrice,
      checkoutUrl,
    })
  } catch (err) {
    console.error('[asaas-create-checkout]', err?.message, err?.body || '')
    await serverLog('asaas-create-checkout', maskPII(err?.message || 'Erro'), 'error', null, {
      asaasBody: err?.body ? maskPII(JSON.stringify(err.body)).slice(0, 500) : null,
    })
    // Erro de domínio não configurado no Asaas: não expõe detalhe técnico ao usuário.
    const msg = /dom[íi]nio/i.test(err?.message || '')
      ? 'Pagamento temporariamente indisponível. Tente novamente em instantes.'
      : err?.message || 'Erro ao iniciar o pagamento'
    return json(500, { error: msg })
  }
}
