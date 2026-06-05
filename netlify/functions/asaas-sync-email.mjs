// POST /.netlify/functions/asaas-sync-email
// Sincroniza o e-mail de ACESSO (Supabase Auth) com os sistemas downstream depois
// que a pessoa troca o e-mail no app e confirma pelo link do Supabase.
//
// O e-mail de Auth do usuario (user.email) e a FONTE DA VERDADE — aqui apenas
// propagamos para onde ele tambem aparece:
//   1. destravai_profiles.email (coluna espelho do perfil)
//   2. Cliente no Asaas (campo email) + subscriptions.customer_email
//
// Idempotente e tolerante a falha: so atua quando ha divergencia e nunca derruba
// o app (o login e os dados ja estao corretos por serem keyados pelo UUID).

import { json, preflight, supabaseAdmin, getUser, asaas } from './_shared.mjs'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' })

  try {
    const user = await getUser(event)
    if (!user) return json(401, { error: 'Não autorizado' })

    const email = String(user.email || '').trim().toLowerCase()
    if (!email) return json(400, { error: 'Usuário sem e-mail' })

    const admin = supabaseAdmin()
    const synced = { profile: false, asaas: false }

    // 1) Perfil: alinha a coluna email ao e-mail de acesso atual.
    try {
      const { data: prof } = await admin
        .from('destravai_profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle()
      if (prof && (prof.email || '').toLowerCase() !== email) {
        await admin
          .from('destravai_profiles')
          .update({ email, updated_at: new Date().toISOString() })
          .eq('id', user.id)
        synced.profile = true
      }
    } catch (e) {
      console.error('[sync-email] perfil', e?.message)
    }

    // 2) Asaas: atualiza o e-mail do cliente (se houver assinatura com customer)
    //    e a coluna espelho. Falha aqui NAO derruba o request.
    try {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('asaas_customer_id, customer_email')
        .eq('user_id', user.id)
        .not('asaas_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sub?.asaas_customer_id && (sub.customer_email || '').toLowerCase() !== email) {
        // Asaas: atualizar cliente existente e POST em /customers/{id}.
        await asaas(`/customers/${sub.asaas_customer_id}`, {
          method: 'POST',
          body: JSON.stringify({ email }),
        })
        await admin.from('subscriptions').update({ customer_email: email }).eq('user_id', user.id)
        synced.asaas = true
      }
    } catch (e) {
      console.error('[sync-email] asaas', e?.message)
    }

    return json(200, { ok: true, synced })
  } catch (err) {
    console.error('[asaas-sync-email]', err?.message, err?.body || '')
    return json(500, { error: err?.message || 'Erro ao sincronizar e-mail' })
  }
}
