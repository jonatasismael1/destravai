// GET /.netlify/functions/admin-fix-user?token=TOKEN&email=EMAIL&password=SENHA
// Endpoint de correção pontual para admin: corrige assinatura paga sem acesso e
// redefine a senha do usuário. Protegido pelo MONITOR_TOKEN (variável de ambiente
// Netlify, nunca exposta no frontend). Uso único — chamar via curl ou browser.
//
// Exemplo:
//   curl "https://destravai.dbe.digital/.netlify/functions/admin-fix-user?token=SEU_TOKEN&email=EMAIL&password=NOVA_SENHA"

import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin, json, grantAccess, getUser, isAdminUser, COMPLETE_PLAN_ID } from './_shared.mjs'

function safeEqual(a, b) {
  if (!a || !b) return false
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Use GET' })

  // Aceita autenticação via MONITOR_TOKEN (query param) OU JWT do admin (header).
  const monitorToken = event.queryStringParameters?.token
  const expected = process.env.MONITOR_TOKEN
  const tokenOk = expected && safeEqual(monitorToken, expected)

  // Fallback: JWT do usuário admin (assessoriadbe@gmail.com)
  let jwtOk = false
  if (!tokenOk) {
    const caller = await getUser(event).catch(() => null)
    jwtOk = caller ? isAdminUser(caller) : false
  }

  if (!tokenOk && !jwtOk) {
    return json(401, { error: 'Não autorizado' })
  }

  const email = String(event.queryStringParameters?.email || '').trim().toLowerCase()
  const password = String(event.queryStringParameters?.password || '').trim()
  if (!email) return json(400, { error: 'Informe ?email=' })

  try {
    const admin = supabaseAdmin()

    // 1) Localiza o usuário pelo e-mail
    const { data: userId, error: rpcErr } = await admin.rpc('destravai_find_user_id_by_email', { p_email: email })
    if (rpcErr) throw rpcErr
    if (!userId) return json(404, { error: 'Usuário não encontrado para este e-mail.' })

    // 2) Busca todas as assinaturas (para diagnóstico)
    const { data: allSubs } = await admin
      .from('subscriptions')
      .select('id, status, payment_status, access_granted, customer_email, customer_name, customer_phone, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 3) Pega a assinatura paga (prioridade) ou a mais recente
    const paidSub = (allSubs ?? []).find((s) => s.payment_status === 'paid')
    const targetSub = paidSub ?? allSubs?.[0] ?? null

    if (!targetSub) {
      return json(404, { error: 'Nenhuma assinatura encontrada.', userId, allSubs: [] })
    }

    // 4) Corrige a assinatura: garante acesso liberado
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    const { error: fixErr } = await admin.from('subscriptions').update({
      status: 'active',
      payment_status: 'paid',
      access_granted: true,
      access_granted_at: targetSub.access_granted_at || new Date().toISOString(),
      started_at: targetSub.started_at || new Date().toISOString(),
      current_period_end: targetSub.current_period_end || periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', targetSub.id)
    if (fixErr) throw fixErr

    // 5) Garante o perfil em destravai_profiles
    await grantAccess(admin, { ...targetSub, user_id: userId, access_email_sent: true })
    await admin.from('destravai_profiles').upsert({
      id: userId,
      plan: COMPLETE_PLAN_ID,
      name: targetSub.customer_name || null,
      email: targetSub.customer_email || null,
    }, { onConflict: 'id' })

    // 6) Redefine senha (se informada e válida)
    let passwordSet = false
    if (password.length >= 8) {
      const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, { password })
      if (pwdErr) throw pwdErr
      passwordSet = true
    }

    return json(200, {
      ok: true,
      userId,
      email: targetSub.customer_email,
      subscriptionFixed: targetSub.id,
      wasAlreadyPaid: !!paidSub,
      passwordSet,
      allSubscriptions: allSubs,
    })
  } catch (err) {
    console.error('[admin-fix-user]', err?.message)
    return json(500, { error: err?.message || 'Erro interno' })
  }
}
