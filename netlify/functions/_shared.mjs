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
  firstMonthPrice: 29.9,
  recurringPrice: 49.9,
  price: 29.9,
  tagline: 'R$29,90 no primeiro mes e R$49,90/mes depois. Sem fidelidade.',
  features: [
    'Ideias e roteiros com IA',
    'Teleprompter para gravar',
    'CTAs personalizados',
    'Legendas geradas por IA',
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

// Dispara o e-mail nativo do Supabase com link para o usuário DEFINIR a senha.
// Usa resetPasswordForEmail (recovery): funciona tanto para conta nova quanto
// existente. O texto/assunto são configurados no template do painel Supabase.
// redirectTo precisa estar na lista de Redirect URLs permitidas do projeto.
export async function sendAccessEmail(email) {
  const appUrl = (process.env.APP_URL || 'https://destravai.dbe.digital').replace(/\/$/, '')
  const anon = supabaseAnon()
  const { error } = await anon.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/definir-senha`,
  })
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
