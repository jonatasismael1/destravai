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
  firstMonthPrice?: number
  recurringPrice?: number
  startedAt?: string | null
  refundDeadline?: string | null
  withinGuarantee?: boolean
  canceledAt?: string | null
  currentPeriodEnd?: string | null
  // Quando cancelada fora da garantia: até quando o acesso ainda vale.
  accessUntil?: string | null
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

// ── Checkout público (sem login) ──────────────────────────────────────────
// Usado pela tela de checkout que vem da landing. O preço é sempre revalidado
// no backend; aqui só passamos o que o usuário escolheu.

export interface PublicPlan {
  id: string
  name: string
  tagline: string
  price: number
  firstMonthPrice: number
  recurringPrice: number
  features: string[]
  highlight: boolean
}

export async function fetchPlans(): Promise<PublicPlan[]> {
  const res = await fetch(`${FN}/asaas-plans`)
  if (!res.ok) throw new Error('Erro ao carregar planos')
  const data = await res.json()
  return data.plans as PublicPlan[]
}

export interface CheckoutInput {
  planId?: string
  billingType: 'PIX' | 'CREDIT_CARD'
  name: string
  email: string
  phone: string
  cpfCnpj: string
}

export interface CheckoutResult {
  method: 'pix' | 'card'
  subscriptionId: string | null
  paymentId: string
  pix?: { qrCodeImage: string | null; copyPaste: string | null; expiration: string | null }
  checkoutUrl?: string
}

export async function createPublicCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const res = await fetch(`${FN}/asaas-create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `Erro ${res.status}`)
  }
  return res.json()
}

export interface CheckoutStatus {
  found: boolean
  paid: boolean
  accessGranted?: boolean
  status: string | null
  paymentStatus?: string
  planName?: string
  email?: string | null
}

// Admin: cria um usuário testador com acesso de cortesia (só o admin consegue).
export async function createTester(
  name: string,
  email: string,
  planId = 'destravai_completo',
): Promise<{ ok: boolean; emailSent: boolean }> {
  const res = await fetch(`${FN}/admin-create-tester`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ name, email, planId }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `Erro ${res.status}`)
  }
  return res.json()
}

// Define a senha de uma conta criada no checkout (nasce sem senha). Dois modos:
//  - token: vindo da tela de sucesso pos-pagamento (prova que acabou de comprar).
//  - email: "Criar conta" no login, para cliente pago que ainda nao acessou.
// Retorna o e-mail para o frontend fazer signInWithPassword em seguida.
export async function setInitialPassword(
  input: { token?: string; email?: string; password: string },
): Promise<{ ok: boolean; email: string | null }> {
  const res = await fetch(`${FN}/asaas-set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `Erro ${res.status}`)
  }
  return res.json()
}

export async function getCheckoutStatus(paymentId: string): Promise<CheckoutStatus> {
  const res = await fetch(`${FN}/asaas-checkout-status?paymentId=${encodeURIComponent(paymentId)}`)
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  return res.json()
}

export async function cancelSubscription(): Promise<{
  ok: boolean; refunded: boolean; status: string; message: string; accessUntil?: string | null
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
