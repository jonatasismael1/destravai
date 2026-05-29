// Helpers compartilhados pelas Netlify Functions do Asaas.
// IMPORTANTE: este código roda APENAS no servidor (Netlify). As chaves
// (ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, SUPABASE_SERVICE_ROLE_KEY) nunca
// chegam ao frontend.

import { createClient } from '@supabase/supabase-js'

// ── Planos (fallback caso a tabela destravai_plans não responda) ─────────
// A FONTE DA VERDADE é a tabela public.destravai_plans no Supabase.
// Estes valores existem só para o serviço não cair se o banco estiver fora.
const FALLBACK_PLANS = {
  starter: { id: 'starter', name: 'Destravaí Starter', price: 29.0 },
  pro:     { id: 'pro',     name: 'Destravaí Pro',     price: 49.0 },
  expert:  { id: 'expert',  name: 'Destravaí Expert',  price: 69.0 },
}

export const GUARANTEE_DAYS = 7

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

// ── Planos: lê da tabela destravai_plans (com cache curto em memória) ────
let _plansCache = null
let _plansCacheAt = 0
const PLANS_TTL_MS = 60_000

export async function getPlans() {
  if (_plansCache && Date.now() - _plansCacheAt < PLANS_TTL_MS) return _plansCache
  try {
    const admin = supabaseAdmin()
    const { data, error } = await admin
      .from('destravai_plans')
      .select('id, name, monthly_price, asaas_identifier, is_active')
      .eq('is_active', true)
      .order('sort_order')
    if (error || !data?.length) throw error || new Error('sem planos')
    _plansCache = data.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.monthly_price),
      asaasIdentifier: p.asaas_identifier,
    }))
    _plansCacheAt = Date.now()
    return _plansCache
  } catch {
    return Object.values(FALLBACK_PLANS)
  }
}

export async function getPlan(planId) {
  const plans = await getPlans()
  return plans.find((p) => p.id === planId) || null
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

// Chamada à API do Asaas (autenticada com a API key no header access_token).
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
