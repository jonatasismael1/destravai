/**
 * Script de correção pontual: Glaydson Emmanuel
 *
 * O que faz:
 *  1. Busca todas as subscriptions de "Glaydson" (por nome ou telefone)
 *  2. Encontra a que tem payment_status='paid'
 *  3. Marca acesso como liberado (access_granted=true, status=active)
 *  4. Cria/atualiza o perfil em destravai_profiles
 *  5. Define a senha como "glaydson123"
 *  6. Marca as outras linhas pendentes/duplicadas como 'failed'
 *  7. Imprime o e-mail do usuário
 *
 * Uso (rodar localmente com as credenciais de produção):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbG... \
 *   node scripts/fix-glaydson.mjs
 *
 * Variável opcional — busca por telefone caso não ache pelo nome:
 *   GLAYDSON_PHONE=11999999999 (somente dígitos)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌  Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.\n')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const NEW_PASSWORD = 'glaydson123'

async function main() {
  console.log('\n🔍  Buscando assinaturas do Glaydson Emmanuel...\n')

  // ── 1) Busca por nome ─────────────────────────────────────────────────────
  let { data: subs, error } = await admin
    .from('subscriptions')
    .select('*')
    .ilike('customer_name', '%glaydson%')
    .order('created_at', { ascending: true })

  if (error) throw error

  // ── 1b) Fallback: busca por telefone se disponível ────────────────────────
  if (!subs?.length && process.env.GLAYDSON_PHONE) {
    const phone = process.env.GLAYDSON_PHONE.replace(/\D/g, '')
    console.log(`  Não achei pelo nome. Tentando pelo telefone ${phone}...`)
    ;({ data: subs, error } = await admin
      .from('subscriptions')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: true }))
    if (error) throw error
  }

  if (!subs?.length) {
    console.error('❌  Nenhuma assinatura encontrada para "Glaydson". Verifique o nome no banco.\n')
    process.exit(1)
  }

  console.log(`  Encontradas ${subs.length} linha(s):\n`)
  for (const s of subs) {
    const mark = s.payment_status === 'paid' ? '✅ PAGO' : `   ${s.payment_status?.toUpperCase()}`
    console.log(
      `  ${mark}  id=${s.id.slice(0, 8)}…  email=${s.customer_email}  ` +
      `status=${s.status}  access_granted=${s.access_granted}  created=${s.created_at?.slice(0, 16)}`,
    )
  }

  // ── 2) Identifica a assinatura paga ───────────────────────────────────────
  const paidSub = subs.find((s) => s.payment_status === 'paid')
  if (!paidSub) {
    console.error('\n❌  Nenhuma assinatura com payment_status="paid" encontrada.')
    console.error('    Verifique no Asaas se o pagamento foi realmente confirmado.\n')
    process.exit(1)
  }

  console.log(`\n📌  Assinatura paga: ${paidSub.id}`)
  console.log(`    E-mail: ${paidSub.customer_email}`)
  console.log(`    Nome  : ${paidSub.customer_name}`)
  console.log(`    Fone  : ${paidSub.customer_phone || '—'}`)
  console.log(`    user_id: ${paidSub.user_id}`)

  if (!paidSub.user_id) {
    console.error('\n❌  A assinatura paga não tem user_id. Não é possível liberar acesso.\n')
    process.exit(1)
  }

  // ── 3) Corrige a assinatura paga ──────────────────────────────────────────
  console.log('\n🔧  Corrigindo a assinatura paga...')
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const { error: fixErr } = await admin
    .from('subscriptions')
    .update({
      status: 'active',
      payment_status: 'paid',
      access_granted: true,
      access_granted_at: paidSub.access_granted_at || new Date().toISOString(),
      started_at: paidSub.started_at || new Date().toISOString(),
      current_period_end: paidSub.current_period_end || periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', paidSub.id)

  if (fixErr) throw fixErr
  console.log('  ✓ Assinatura marcada como active/paid/access_granted=true')

  // ── 4) Cria/atualiza o perfil ─────────────────────────────────────────────
  console.log('\n🔧  Atualizando destravai_profiles...')
  const { error: profileErr } = await admin
    .from('destravai_profiles')
    .upsert(
      {
        id: paidSub.user_id,
        plan: 'destravai_completo',
        name: paidSub.customer_name || null,
        email: paidSub.customer_email || null,
      },
      { onConflict: 'id' },
    )

  if (profileErr) {
    console.warn('  ⚠️  Não foi possível atualizar o perfil:', profileErr.message)
  } else {
    console.log('  ✓ Perfil atualizado com plano destravai_completo')
  }

  // ── 5) Define a senha ─────────────────────────────────────────────────────
  console.log('\n🔑  Definindo senha do usuário...')
  const { error: pwdErr } = await admin.auth.admin.updateUserById(paidSub.user_id, {
    password: NEW_PASSWORD,
  })

  if (pwdErr) throw pwdErr
  console.log(`  ✓ Senha definida: ${NEW_PASSWORD}`)

  // ── 6) Marca linhas duplicadas como failed ────────────────────────────────
  const duplicates = subs.filter(
    (s) => s.id !== paidSub.id && ['pending', 'failed'].includes(s.status) && !s.access_granted,
  )
  if (duplicates.length) {
    console.log(`\n🗑️   Marcando ${duplicates.length} linha(s) duplicada(s) como failed...`)
    for (const dup of duplicates) {
      const { error: dupErr } = await admin
        .from('subscriptions')
        .update({ status: 'failed', payment_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', dup.id)
      if (dupErr) {
        console.warn(`  ⚠️  Falha ao marcar ${dup.id}: ${dupErr.message}`)
      } else {
        console.log(`  ✓ ${dup.id.slice(0, 8)}… → failed`)
      }
    }
  }

  // ── Resultado final ───────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅  Correção concluída!')
  console.log(`    E-mail : ${paidSub.customer_email}`)
  console.log(`    Senha  : ${NEW_PASSWORD}`)
  console.log('    (Glaydson pode fazer login e trocar a senha depois)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch((err) => {
  console.error('\n❌  Erro fatal:', err.message)
  process.exit(1)
})
