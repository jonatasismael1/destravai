// GET /.netlify/functions/asaas-checkout-status?paymentId=...
// Status público de uma cobrança do checkout (usado pelo polling do Pix, antes
// de o usuário ter login). Retorna apenas o estado do pagamento/acesso — nenhum
// dado sensível. O id do pagamento é opaco e só quem iniciou o checkout o conhece.

import { json, preflight, supabaseAdmin } from './_shared.mjs'
import { checkRateLimit, rateLimitExceeded, getClientIp } from './_rateLimiter.mjs'

// Status é público (polling do Pix antes do login). Limite generoso por IP: o
// polling roda ~15x/min; 60/min cobre uso normal e barra abuso/varredura de IDs.
const STATUS_LIMIT = 60
const STATUS_WINDOW_MS = 60 * 1000

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método não permitido' })

  try {
    const ip = getClientIp(event)
    const rl = await checkRateLimit(`checkout-status:ip:${ip}`, STATUS_LIMIT, STATUS_WINDOW_MS)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt, 'Muitas consultas. Aguarde um momento.')

    const paymentId = event.queryStringParameters?.paymentId
    const subscriptionId = event.queryStringParameters?.subscriptionId
    if (!paymentId && !subscriptionId) {
      return json(400, { error: 'Informe paymentId ou subscriptionId' })
    }

    const admin = supabaseAdmin()
    let query = admin
      .from('subscriptions')
      .select('status, payment_status, access_granted, plan_name, customer_email')
      .order('created_at', { ascending: false })
      .limit(1)

    query = paymentId
      ? query.eq('asaas_payment_id', paymentId)
      : query.eq('asaas_subscription_id', subscriptionId)

    const { data: sub } = await query.maybeSingle()
    if (!sub) return json(200, { found: false, paid: false, status: null })

    const paid = sub.payment_status === 'paid'
    return json(200, {
      found: true,
      paid,
      accessGranted: !!sub.access_granted,
      status: sub.status,
      paymentStatus: sub.payment_status,
      planName: sub.plan_name,
      // Mascara o e-mail (ex.: jo***@gmail.com) só para a tela confirmar o destino.
      email: maskEmail(sub.customer_email),
    })
  } catch (err) {
    console.error('[asaas-checkout-status]', err?.message)
    return json(500, { error: 'Erro ao consultar o pagamento' })
  }
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return null
  const [user, domain] = email.split('@')
  const head = user.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`
}
