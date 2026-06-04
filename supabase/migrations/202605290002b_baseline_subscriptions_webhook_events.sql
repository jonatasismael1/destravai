-- BASELINE DE RECONCILIAÇÃO (drift de migração) ───────────────────────────────
-- As tabelas `subscriptions` e `asaas_webhook_events` foram provisionadas FORA do
-- controle de versão (criadas direto no projeto, sem migração registrada). Por isso
-- o repositório não conseguia recriá-las do zero — risco em recuperação de desastre
-- ou ao subir um ambiente novo. Esta migração captura a ESTRUTURA BASE dessas tabelas
-- exatamente como existem em produção, para o repo voltar a ser fonte da verdade.
--
-- É 100% IDEMPOTENTE: em produção (onde as tabelas já existem) todo `if not exists`
-- vira no-op; num banco novo, cria as tabelas ANTES de 202605290003_checkout_plans
-- (que faz ALTER nelas) e de 202605300007_security_hardening (que adiciona a policy
-- de negação do webhook). Só inclui as colunas BASE — as colunas de checkout, preço
-- promocional e current_period_end continuam vindo das migrações posteriores.
--
-- OBS.: isto alinha os ARQUIVOS do repo. O histórico aplicado no Supabase
-- (tabela supabase_migrations.schema_migrations) usa versões em timestamp e não lista
-- estes arquivos. Para alinhar o histórico de vez, rode uma única vez, com a CLI:
--   supabase db pull        (gera um baseline fiel à produção)   OU
--   supabase migration repair --status applied <versao>

-- ── 1) subscriptions (controle de assinatura/paywall) ─────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- NOT NULL aqui reflete o desenho original; 202605290003_checkout_plans relaxa
  -- isso (checkout como visitante nasce sem user_id até o pagamento confirmar).
  user_id uuid not null references auth.users(id) on delete cascade,
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_id text,
  plan_name text,
  price numeric(10,2),
  billing_cycle text default 'MONTHLY',
  status text not null default 'pending'
    check (status in ('pending','active','past_due','canceled','refunded','failed')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','overdue','refunded','failed')),
  started_at timestamptz,
  refund_deadline timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  last_webhook_event text,
  last_webhook_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx       on public.subscriptions (user_id);
create index if not exists subscriptions_asaas_customer_idx on public.subscriptions (asaas_customer_id);
create index if not exists subscriptions_asaas_sub_idx      on public.subscriptions (asaas_subscription_id);

-- RLS: cada usuário LÊ apenas a própria assinatura. NÃO há policy de
-- INSERT/UPDATE/DELETE de propósito — escrita é exclusiva do service_role
-- (webhook/Edge Functions). É isto que impede burlar o paywall pelo cliente.
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = user_id);

-- ── 2) asaas_webhook_events (idempotência do webhook do Asaas) ────────────────
create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,                 -- chave de idempotência (1 evento = 1 linha)
  event_type text,
  asaas_payment_id text,
  asaas_subscription_id text,
  user_id uuid,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists asaas_webhook_events_payment_idx on public.asaas_webhook_events (asaas_payment_id);
create index if not exists asaas_webhook_events_sub_idx     on public.asaas_webhook_events (asaas_subscription_id);

-- RLS ligado: sem nenhuma policy para o cliente, anon/authenticated ficam
-- bloqueados. A policy de negação EXPLÍCITA é criada em 202605300007_security_hardening.
alter table public.asaas_webhook_events enable row level security;
