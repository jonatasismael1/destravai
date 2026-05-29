// Suíte simples de testes de RLS do Destravaí.
//
// Como rodar:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/rls-test.mjs
//
// Verifica duas coisas:
//  A) Nível de schema (via Management API): toda tabela destravai_* + subscriptions
//     + asaas_webhook_events tem RLS habilitado e ao menos 1 policy.
//  B) Em runtime (via REST anônimo): um cliente SEM login NÃO consegue ler dados
//     protegidos (a query deve voltar vazia ou ser bloqueada).
//
// Sai com código != 0 se algum teste falhar (serve para CI).

const PROJECT_REF = 'fddxaozosrlqddthvqhn'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const ANON_KEY = 'sb_publishable_4ie-5VsZZC7nNuIv-fd_Qg_QTTbHmwW'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

let failures = 0
const fail = (msg) => { failures++; console.error('  ✗', msg) }
const ok = (msg) => console.log('  ✓', msg)

async function mgmtQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Management API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── A) RLS habilitado + policies por tabela ──────────────────────────────
async function testSchemaRLS() {
  console.log('A) RLS no schema (Management API)')
  if (!ACCESS_TOKEN) {
    console.log('  • SUPABASE_ACCESS_TOKEN ausente — pulando a parte A.')
    return
  }
  const rows = await mgmtQuery(`
    select c.relname as table,
           c.relrowsecurity as rls,
           (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and (c.relname like 'destravai\\_%' or c.relname in ('subscriptions','asaas_webhook_events'))
    order by c.relname;
  `)
  // Tabelas só de backend (service role): RLS ligado SEM policies = deny-all = correto.
  const BACKEND_ONLY = new Set(['asaas_webhook_events'])
  if (!rows.length) fail('Nenhuma tabela encontrada — verifique o projeto/token.')
  for (const r of rows) {
    if (!r.rls) fail(`${r.table}: RLS DESABILITADO`)
    else if (Number(r.policies) === 0 && BACKEND_ONLY.has(r.table)) ok(`${r.table}: RLS on, deny-all (backend-only)`)
    else if (Number(r.policies) === 0) fail(`${r.table}: RLS on, mas SEM policies`)
    else ok(`${r.table}: RLS on, ${r.policies} policies`)
  }
}

// ── B) Anônimo não lê dados protegidos ───────────────────────────────────
async function testAnonBlocked() {
  console.log('B) Acesso anônimo bloqueado (REST)')
  const tables = ['destravai_profiles', 'destravai_library_items', 'subscriptions', 'destravai_execution_events']
  for (const t of tables) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=id&limit=1`, {
      headers: { apikey: ANON_KEY },
    })
    const body = await res.json().catch(() => null)
    // Esperado: 200 com [] (RLS sem sessão não retorna linhas) ou erro de permissão.
    if (Array.isArray(body) && body.length === 0) ok(`${t}: anônimo não vê linhas`)
    else if (!res.ok) ok(`${t}: anônimo bloqueado (HTTP ${res.status})`)
    else fail(`${t}: anônimo retornou ${Array.isArray(body) ? body.length : '?'} linha(s) — RLS frouxo!`)
  }
}

await testSchemaRLS()
await testAnonBlocked()

console.log(failures === 0 ? '\n✅ RLS OK' : `\n❌ ${failures} falha(s) de RLS`)
process.exit(failures === 0 ? 0 : 1)
