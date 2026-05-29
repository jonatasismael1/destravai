-- Checkout próprio do Destravaí (Asaas + Supabase).
-- 1) Estrutura centralizada de planos (fonte da verdade do preço fica no servidor).
-- 2) Campos de "lead"/Pix/acesso na tabela subscriptions para o checkout como visitante
--    (o usuário paga primeiro; o acesso é liberado depois, via webhook).
-- 3) RPC para localizar o user_id pelo e-mail (idempotência ao criar a conta).
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.

-- ── 1) Planos ────────────────────────────────────────────────────────────
create table if not exists public.destravai_plans (
  id text primary key,                         -- 'starter', 'pro', 'expert'
  name text not null,
  short_description text not null default '',
  monthly_price numeric(10,2) not null,
  benefits text[] not null default '{}'::text[],
  is_active boolean not null default true,
  highlight boolean not null default false,    -- destaque visual ("Mais popular")
  sort_order integer not null default 0,
  asaas_identifier text,                        -- usado em integrações futuras com o Asaas
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists destravai_plans_touch on public.destravai_plans;
create trigger destravai_plans_touch before update on public.destravai_plans
  for each row execute function public.destravai_touch_updated_at();

-- Seed/atualização dos planos iniciais. ON CONFLICT mantém o registro atualizado
-- sem duplicar (o preço aqui é só o "catálogo"; o servidor revalida sempre).
insert into public.destravai_plans (id, name, short_description, monthly_price, benefits, is_active, highlight, sort_order, asaas_identifier)
values
  ('starter', 'Starter', 'Para começar a postar sem travar.', 29.00,
   array['Ideias e roteiros com IA', 'Teleprompter para gravar', 'Missão do dia'],
   true, false, 1, 'destravai-starter'),
  ('pro', 'Pro', 'Para quem quer constância de verdade.', 49.00,
   array['Tudo do Starter', 'CTAs personalizados', 'Biblioteca de conteúdos', 'Legendas geradas por IA'],
   true, true, 2, 'destravai-pro'),
  ('expert', 'Expert', 'Para escalar sua presença digital.', 69.00,
   array['Tudo do Pro', 'Geração ilimitada de ideias', 'Prioridade nas novidades'],
   true, false, 3, 'destravai-expert')
on conflict (id) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  monthly_price = excluded.monthly_price,
  benefits = excluded.benefits,
  is_active = excluded.is_active,
  highlight = excluded.highlight,
  sort_order = excluded.sort_order,
  asaas_identifier = excluded.asaas_identifier,
  updated_at = now();

-- RLS: leitura pública dos planos ativos (a tela de checkout é acessível sem login).
alter table public.destravai_plans enable row level security;
grant select on public.destravai_plans to anon, authenticated;
drop policy if exists "Anyone can read active plans" on public.destravai_plans;
create policy "Anyone can read active plans" on public.destravai_plans
  for select to anon, authenticated using (is_active = true);

-- ── 2) Ajustes na tabela subscriptions ───────────────────────────────────
-- Checkout como visitante: a linha pode nascer antes de o usuário ter senha.
alter table public.subscriptions alter column user_id drop not null;

alter table public.subscriptions add column if not exists plan_id text;
alter table public.subscriptions add column if not exists customer_name text;
alter table public.subscriptions add column if not exists customer_email text;
alter table public.subscriptions add column if not exists customer_phone text;
alter table public.subscriptions add column if not exists customer_document text;   -- CPF/CNPJ (só dígitos)
alter table public.subscriptions add column if not exists payment_method text;       -- 'PIX' | 'CREDIT_CARD'
alter table public.subscriptions add column if not exists pix_qr_code text;          -- imagem base64 do QR
alter table public.subscriptions add column if not exists pix_copy_paste text;       -- "copia e cola"
alter table public.subscriptions add column if not exists pix_expiration timestamptz;
alter table public.subscriptions add column if not exists access_granted boolean not null default false;
alter table public.subscriptions add column if not exists access_granted_at timestamptz;
alter table public.subscriptions add column if not exists access_email_sent boolean not null default false;

create index if not exists subscriptions_customer_email_idx on public.subscriptions (lower(customer_email));
create index if not exists subscriptions_asaas_payment_idx on public.subscriptions (asaas_payment_id);

-- ── 3) RPC: localizar user_id pelo e-mail (idempotência no checkout) ──────
-- SECURITY DEFINER para conseguir ler auth.users. Só o service role chama isto
-- (revogamos de anon/authenticated). Nunca expõe dados — retorna apenas o uuid.
create or replace function public.destravai_find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.destravai_find_user_id_by_email(text) from public, anon, authenticated;
