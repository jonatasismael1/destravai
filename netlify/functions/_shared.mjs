// Helpers compartilhados pelas Netlify Functions do Asaas.
// IMPORTANTE: este código roda APENAS no servidor (Netlify). As chaves
// (ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, SUPABASE_SERVICE_ROLE_KEY) nunca
// chegam ao frontend.

import { createClient } from '@supabase/supabase-js'

// ── Planos (fonte da verdade fica no servidor) ──────────────────────────
export const PLANS = {
  starter: { id: 'starter', name: 'Destravaí Starter', price: 29.0 },
  pro:     { id: 'pro',     name: 'Destravaí Pro',     price: 49.0 },
  expert:  { id: 'expert',  name: 'Destravaí Expert',  price: 69.0 },
}

export const GUARANTEE_DAYS = 7

const CORS = {
  'Access-Control-Allow-Origin': '*',
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
// Confira nomes na doc atual do Asaas; cobrimos os principais.
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
