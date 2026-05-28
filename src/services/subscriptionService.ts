import { supabase } from '../lib/supabase/client'

// Chama as Netlify Functions do Asaas. As chaves ficam no servidor;
// aqui mandamos apenas o JWT do usuário para autenticar.

const FN = '/.netlify/functions'

export interface SubscriptionStatus {
  hasSubscription: boolean
  hasAccess: boolean
  status: string | null
  paymentStatus?: string
  planName?: string
  price?: number
  startedAt?: string | null
  refundDeadline?: string | null
  withinGuarantee?: boolean
  canceledAt?: string | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sessão expirada. Faça login novamente.')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const res = await fetch(`${FN}/asaas-subscription-status`, { headers: await authHeaders() })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `Erro ${res.status}`)
  }
  return res.json()
}

export async function createCheckout(
  planId: 'starter' | 'pro' | 'expert',
  cpfCnpj: string,
  name: string,
): Promise<{ checkoutUrl: string; subscriptionId: string }> {
  const res = await fetch(`${FN}/asaas-create-checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ planId, cpfCnpj, name }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `Erro ${res.status}`)
  }
  return res.json()
}

export async function cancelSubscription(): Promise<{
  ok: boolean; refunded: boolean; status: string; message: string
}> {
  const res = await fetch(`${FN}/asaas-cancel-subscription`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `Erro ${res.status}`)
  }
  return res.json()
}
