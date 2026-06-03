// POST /.netlify/functions/admin-create-tester
// Apenas o admin (ADMIN_EMAIL) pode criar usuarios testadores com acesso gratis.
// Mantem o fluxo atual de testadores, agora sempre no plano destravai_completo.

import { COMPLETE_PLAN, json, preflight, supabaseAdmin, getUser, isAdminUser, getOrCreateAuthUser, sendAccessEmail } from './_shared.mjs'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido' })

  try {
    const caller = await getUser(event)
    if (!caller) return json(401, { error: 'Nao autorizado' })
    if (!isAdminUser(caller)) return json(403, { error: 'Apenas o administrador pode liberar acessos.' })

    const body = JSON.parse(event.body || '{}')
    const email = String(body.email || '').trim().toLowerCase()
    const name = String(body.name || '').trim()
    if (!isValidEmail(email)) return json(400, { error: 'Informe um e-mail valido.' })

    const admin = supabaseAdmin()
    const userId = await getOrCreateAuthUser(email, name)

    try {
      await admin.from('destravai_profiles').upsert({
        id: userId,
        ...(name ? { name } : {}),
        email,
        plan: COMPLETE_PLAN.id,
      }, { onConflict: 'id' })
    } catch (e) {
      console.error('[admin-create-tester] perfil', e?.message)
    }

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
      plan_id: COMPLETE_PLAN.id,
      plan_name: `${COMPLETE_PLAN.name} (cortesia)`,
      price: 0,
      first_month_price: 0,
      recurring_price: 0,
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

    let emailSent = true
    try { await sendAccessEmail(email, name, 'tester') } catch { emailSent = false }

    return json(200, { ok: true, userId, emailSent })
  } catch (err) {
    console.error('[admin-create-tester]', err?.message)
    return json(500, { error: err?.message || 'Erro ao criar testador' })
  }
}
