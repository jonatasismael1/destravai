// Helpers compartilhados pelas Netlify Functions do Asaas.
// IMPORTANTE: este código roda APENAS no servidor (Netlify). As chaves
// (ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, SUPABASE_SERVICE_ROLE_KEY) nunca
// chegam ao frontend.

import { createClient } from '@supabase/supabase-js'

// Oferta unica. A cobranca inicial e avulsa; a recorrencia mensal e criada
// depois que o primeiro pagamento for confirmado pelo webhook do Asaas.
export const COMPLETE_PLAN_ID = 'destravai_completo'
export const COMPLETE_PLAN = {
  id: COMPLETE_PLAN_ID,
  name: 'Destravai Completo',
  firstMonthPrice: 9.9,
  recurringPrice: 49.9,
  price: 9.9,
  tagline: 'R$9,90 no primeiro mes e R$49,90/mes depois. Sem fidelidade.',
  features: [
    'Ideias e roteiros com a Deby AI',
    'Teleprompter para gravar',
    'CTAs personalizados',
    'Legendas geradas pela Deby AI',
    'Biblioteca de conteudos',
    'Calendario editorial',
    'Studio com teleprompter',
  ],
  asaasIdentifier: 'destravai-completo',
}

const LEGACY_PLAN_IDS = new Set(['starter', 'pro', 'expert', 'premium'])

export const GUARANTEE_DAYS = 7

// Admin do produto: único que pode liberar acesso grátis (testadores).
// Pode ser sobrescrito por env (ADMIN_EMAIL) sem mexer no código.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'assessoriadbe@gmail.com').toLowerCase()

export function isAdminUser(user) {
  return !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL
}

// Avalia se UMA linha de assinatura concede acesso: cortesia (testador), ativa e
// paga, ou cancelada mas ainda dentro do período já pago. Fonte ÚNICA da regra —
// reaproveitada por asaas-subscription-status para não divergir.
export function subscriptionRowGrantsAccess(sub) {
  if (!sub) return false
  if (sub.payment_method === 'COURTESY' && sub.access_granted) return true
  if (['active', 'trialing'].includes(sub.status) && sub.payment_status === 'paid') return true
  // Dentro do período JÁ PAGO o acesso não cai na hora — vale para quem cancelou
  // E para quem ficou 'past_due' (cobrança em atraso/retentativa). Sem isto, um
  // 'overdue' marcado pelo Asaas por 1 dia de atraso derrubava o acesso de quem
  // ainda tinha mês pago. Quando o período pago realmente acabar, o acesso cai.
  if (['canceled', 'past_due'].includes(sub.status)
      && sub.current_period_end && new Date(sub.current_period_end) >= new Date()) return true
  return false
}

// Verifica o acesso do usuário e devolve também o TIPO de acesso:
// { allowed, courtesy }. `courtesy=true` quando o acesso vem SOMENTE de
// assinatura(s) de cortesia (testador) — usado para aplicar limites de IA
// mais apertados sem mexer na decisão de quem entra ou não.
// IMPORTANTE: olha as últimas linhas (não só a mais recente). Se um pagante ATIVO
// reabre o checkout, nasce uma linha 'pending' mais nova — ler só a última
// trancaria o pagante fora da IA. Basta UMA linha conceder acesso.
export async function getAccessInfo(admin, user) {
  if (isAdminUser(user)) return { allowed: true, courtesy: false }
  const { data: subs } = await admin
    .from('subscriptions')
    .select('status, payment_status, payment_method, access_granted, current_period_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)
  const granting = (subs ?? []).filter(subscriptionRowGrantsAccess)
  if (granting.length === 0) return { allowed: false, courtesy: false }
  return {
    allowed: true,
    courtesy: granting.every((s) => s.payment_method === 'COURTESY'),
  }
}

// Compat: mantém a assinatura booleana usada em outros pontos.
export async function userHasActiveAccess(admin, user) {
  const { allowed } = await getAccessInfo(admin, user)
  return allowed
}

// CORS: o checkout é público (vem da landing), mas só liberamos a origem do app.
// Como a tela de checkout vive no mesmo domínio (destravai.dbe.digital), isso
// não afeta o uso normal — apenas impede que outros sites disparem requisições.
const APP_ORIGIN = (process.env.APP_URL || 'https://destravai.dbe.digital').replace(/\/$/, '')
const CORS = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function preflight() {
  return { statusCode: 204, headers: CORS, body: '' }
}

// Cliente Supabase com service role (ignora RLS) — só no servidor.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados')
  return createClient(url, key, { auth: { persistSession: false } })
}

// Cliente Supabase "público" (anon) — usado apenas para DISPARAR e-mails nativos
// (resetPasswordForEmail usa o SMTP configurado no projeto Supabase).
function supabaseAnon() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY não configurados')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function getPlans() {
  return [COMPLETE_PLAN]
}

export async function getPlan(planId) {
  const normalized = String(planId || COMPLETE_PLAN_ID).trim()
  if (!normalized || normalized === COMPLETE_PLAN_ID || LEGACY_PLAN_IDS.has(normalized)) {
    return COMPLETE_PLAN
  }
  return null
}

// Valida o JWT do usuário (header Authorization: Bearer <token>) e retorna o user.
export async function getUser(event) {
  const auth = event.headers.authorization || event.headers.Authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const admin = supabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

// Localiza um usuário pelo e-mail ou cria um novo (sem senha utilizável).
// Idempotente: se o e-mail já existe, reaproveita a conta — o acesso real só é
// liberado quando o pagamento é confirmado, e a senha é definida pelo próprio
// usuário via link enviado por e-mail. Retorna o uuid do usuário.
export async function getOrCreateAuthUser(email, name) {
  const admin = supabaseAdmin()
  const clean = String(email || '').trim().toLowerCase()
  if (!clean) throw new Error('E-mail obrigatório')

  // 1) Já existe? (RPC SECURITY DEFINER lê auth.users)
  const { data: foundId } = await admin.rpc('destravai_find_user_id_by_email', { p_email: clean })
  if (foundId) return foundId

  // 2) Cria. email_confirm: true para o usuário poder receber o link de senha.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: clean,
    email_confirm: true,
    user_metadata: { name: name || '' },
  })
  if (created?.user?.id) return created.user.id

  // 3) Corrida: alguém criou no meio do caminho — tenta achar de novo.
  if (error) {
    const { data: retryId } = await admin.rpc('destravai_find_user_id_by_email', { p_email: clean })
    if (retryId) return retryId
    throw error
  }
  throw new Error('Não foi possível criar o usuário')
}

// Envia um e-mail transacional via Resend (HTTP, sem dependência nova).
// Usa RESEND_API_KEY e RESEND_FROM do ambiente. Lança em caso de falha — quem
// chama decide se faz fallback.
async function sendResendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada')
  const from = process.env.RESEND_FROM || 'Destravaí <nao-responda@destravai.dbe.digital>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  }
}

// HTML do e-mail de boas-vindas / DEFINIR senha. `kind` muda o tom entre quem
// comprou ('purchase') e quem foi convidado como testador ('tester') — para não
// falar em "compra" para um testador, por exemplo.
function buildDefinePasswordEmail(name, link, appUrl, kind = 'purchase') {
  const hi = name ? `Olá, ${name}!` : 'Olá!'
  const host = appUrl.replace(/^https?:\/\//, '')
  const intro = kind === 'tester'
    ? 'Que bom ter você aqui! Liberamos um <strong style="color:#F5F5F7">acesso de cortesia</strong> ao Destravaí para você testar à vontade. 💜'
    : 'Que bom ter você aqui! Seu acesso ao <strong style="color:#F5F5F7">Destravaí</strong> está liberado. 🎉'
  const closing = kind === 'tester'
    ? 'Se você não esperava este convite, pode ignorar este e-mail.'
    : 'Se não foi você que assinou, pode ignorar este e-mail.'
  return `<!doctype html><html><body style="margin:0;background:#0B0B0D;font-family:Arial,Helvetica,sans-serif;color:#F5F5F7">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:18px;font-weight:bold;letter-spacing:-0.3px;margin-bottom:26px;color:#9B8CFF">Destravaí</div>
    <h1 style="font-size:22px;margin:0 0 12px">${hi}</h1>
    <p style="font-size:15px;line-height:1.65;color:#B7B7BD;margin:0 0 8px">${intro}</p>
    <p style="font-size:15px;line-height:1.65;color:#B7B7BD;margin:0 0 22px">
      Falta só um passo para começar: <strong style="color:#F5F5F7">criar a sua senha</strong>.
    </p>
    <a href="${link}" style="display:inline-block;background:#6D5DF6;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 30px;border-radius:12px">
      Criar minha senha
    </a>
    <p style="font-size:14px;line-height:1.65;color:#B7B7BD;margin:24px 0 0">
      Assim que entrar, preencha a sua <strong style="color:#F5F5F7">Essência</strong> — é com ela que o app começa a sugerir o que postar, do seu jeito.
    </p>
    <p style="font-size:13px;line-height:1.65;color:#777780;margin:16px 0 0">
      Acesse sempre por <a href="${appUrl}" style="color:#9B8CFF">${host}</a> com o seu e-mail e a senha que você criar. Qualquer dúvida, é só responder este e-mail. 💜
    </p>
    <p style="font-size:12px;color:#55555f;margin:22px 0 0">${closing}</p>
  </div></body></html>`
}

// Dispara o e-mail de acesso (link para DEFINIR a senha após a compra).
// Caminho principal: e-mail próprio via Resend, com copy de "boas-vindas / defina
// sua senha" e o endereço de acesso — separado do "redefinir senha" (que continua
// sendo o e-mail nativo do Supabase, disparado só no fluxo "esqueci a senha").
// Fallback: se o Resend não estiver configurado/falhar, usa o e-mail nativo do
// Supabase, garantindo que o comprador SEMPRE receba como entrar.
export async function sendAccessEmail(email, name = '', kind = 'purchase') {
  const appUrl = (process.env.APP_URL || 'https://destravai.dbe.digital').replace(/\/$/, '')
  const redirectTo = `${appUrl}/definir-senha`
  const subject = kind === 'tester'
    ? 'Seu convite para testar o Destravaí 💜'
    : 'Seu acesso ao Destravaí está pronto 💜'

  if (process.env.RESEND_API_KEY) {
    try {
      const admin = supabaseAdmin()
      // generateLink só GERA o link (não envia e-mail) — nós enviamos via Resend.
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery', email, options: { redirectTo },
      })
      if (error) throw error
      const link = data?.properties?.action_link
      if (!link) throw new Error('generateLink não retornou action_link')
      await sendResendEmail({
        to: email,
        subject,
        html: buildDefinePasswordEmail(name, link, appUrl, kind),
      })
      return
    } catch (e) {
      console.error('[sendAccessEmail] Resend falhou, usando e-mail nativo do Supabase:', e?.message)
    }
  }

  // Fallback: e-mail nativo (template "Reset Password" do Supabase).
  const anon = supabaseAnon()
  const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

// ── Logger server-side ───────────────────────────────────────────────────────
// Registra erros/avisos na tabela destravai_error_logs (via service role).
// Não lança exceção — logging nunca deve derrubar o fluxo principal.
export async function serverLog(source, message, level = 'error', userId = null, details = null) {
  try {
    const admin = supabaseAdmin()
    await admin.rpc('destravai_log_error', {
      p_source: source,
      p_message: String(message).slice(0, 2000),
      p_level: level,
      p_user_id: userId,
      p_details: details,
    })
  } catch {
    // Silencioso: se o log falhar, não quebre o serviço
  }
}

// Libera o acesso após pagamento confirmado: garante o perfil no Supabase e
// dispara o e-mail nativo com o link para definir a senha. Idempotente — pode ser
// chamado pelo webhook (na hora) e pela rotina de monitoramento (reprocesso).
// NÃO marca access_granted aqui (quem chama decide isso), apenas efetua os efeitos.
export async function grantAccess(admin, subRow) {
  // 1) Cria/atualiza o destravai_profiles (não há trigger automático para ele).
  try {
    const profilePatch = { id: subRow.user_id, plan: COMPLETE_PLAN_ID }
    if (subRow.customer_name) profilePatch.name = subRow.customer_name
    if (subRow.customer_email) profilePatch.email = subRow.customer_email
    await admin.from('destravai_profiles').upsert(profilePatch, { onConflict: 'id' })
  } catch (e) {
    console.error('[grantAccess] erro ao salvar profile', e?.message)
  }

  // 2) Envia o e-mail de acesso (link para definir a senha) uma única vez.
  if (subRow.customer_email && !subRow.access_email_sent) {
    try {
      await sendAccessEmail(subRow.customer_email, subRow.customer_name || '')
      await admin.from('subscriptions').update({ access_email_sent: true }).eq('id', subRow.id)
    } catch (e) {
      console.error('[grantAccess] erro ao enviar e-mail de acesso', e?.message)
      // Não bloqueia: o acesso já está liberado; o e-mail pode ser reenviado depois.
    }
  }
}

// ── Chamada à API do Asaas (autenticada com a API key no header access_token).
export async function asaas(path, options = {}) {
  const baseUrl = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3'
  const apiKey = process.env.ASAAS_API_KEY
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada')

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(options.headers || {}),
    },
  })

  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || data?.message || `Asaas HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

// Mapeia eventos do Asaas → status internos.
export function mapPaymentEvent(eventType) {
  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_RECEIVED_IN_CASH':
      return { status: 'active', payment_status: 'paid' }
    case 'PAYMENT_OVERDUE':
      return { status: 'past_due', payment_status: 'overdue' }
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_PARTIALLY_REFUNDED':
    case 'PAYMENT_REFUND_REQUESTED':
      return { status: 'refunded', payment_status: 'refunded' }
    case 'PAYMENT_DELETED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':
      return { status: 'failed', payment_status: 'failed' }
    default:
      return null
  }
}
