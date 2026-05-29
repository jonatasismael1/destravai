// POST /.netlify/functions/admin-create-tester
// Apenas o admin (ADMIN_EMAIL) pode criar usuários testadores com acesso grátis.
// Cria/reaproveita a conta no Supabase, grava uma assinatura de cortesia ativa
// (o paywall libera por status active + paid) e envia o e-mail para definir senha.

import { json, preflight, supabaseAdmin, getUser, isAdminUser, getOrCreateAuthUser, sendAccessEmail, getPlan } from './_shared.mjs'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
    const caller = await getUser(event)
    if (!caller) return json(401, { error: 'Não autorizado' })
    if (!isAdminUser(caller)) return json(403, { error: 'Apenas o administrador pode liberar acessos.' })

    const body = JSON.parse(event.body || '{}')
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim()
    if (!isValidEmail(email)) return json(400, { error: 'Informe um e-mail válido.' })

    const plan = (await getPlan(body.planId)) || { id: 'pro', name: 'Destravaí Pro' }
    const admin = supabaseAdmin()

    // 1) Garante a conta no Supabase Auth (idempotente por e-mail).
    const userId = await getOrCreateAuthUser(email, name)

    // 2) Cria/atualiza o perfil. (O query builder do supabase-js não tem .catch,
    // por isso usamos try/catch.)
    try {
      await admin.from('destravai_profiles').upsert({
        id: userId,
        ...(name ? { name } : {}),
        email,
        plan: plan.id,
      }, { onConflict: 'id' })
    } catch (e) {
      console.error('[admin-create-tester] perfil', e?.message)
    }

    // 3) Assinatura de cortesia ativa (acesso liberado sem pagamento).
    const { data: existing } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const courtesy = {
      user_id: userId,
      plan_id: plan.id,
      plan_name: `${plan.name} (cortesia)`,
      price: 0,
      billing_cycle: 'MONTHLY',
      payment_method: 'COURTESY',
      status: 'active',
      payment_status: 'paid',
      access_granted: true,
      access_granted_at: new Date().toISOString(),
      customer_email: email,
      customer_name: name || null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      await admin.from('subscriptions').update(courtesy).eq('id', existing.id)
    } else {
      await admin.from('subscriptions').insert(courtesy)
    }

    // 4) Envia o e-mail para o testador definir a senha.
    let emailSent = true
    try { await sendAccessEmail(email) } catch { emailSent = false }

    return json(200, { ok: true, userId, emailSent })
  } catch (err) {
    console.error('[admin-create-tester]', err?.message)
    return json(500, { error: err?.message || 'Erro ao criar testador' })
  }
}
