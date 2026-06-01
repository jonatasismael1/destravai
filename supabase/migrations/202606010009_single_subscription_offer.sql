-- Oferta unica do Destravai:
-- - primeiro mes promocional: R$29,90
-- - recorrencia mensal apos o primeiro mes: R$49,90
-- - plano interno unico: destravai_completo
--
-- Usuarios antigos sao tratados como destravai_completo para manter acesso.

alter table public.subscriptions add column if not exists first_month_price numeric(10,2);
alter table public.subscriptions add column if not exists recurring_price numeric(10,2);

alter table public.destravai_profiles alter column plan set default 'destravai_completo';

insert into public.destravai_plans (
  id,
  name,
  short_description,
  monthly_price,
  benefits,
  is_active,
  highlight,
  sort_order,
  asaas_identifier
)
values (
  'destravai_completo',
  'Destravai Completo',
  'R$29,90 no primeiro mes e R$49,90/mes depois. Sem fidelidade.',
  49.90,
  array[
    'Ideias e roteiros com IA',
    'Teleprompter para gravar',
    'CTAs personalizados',
    'Legendas geradas por IA',
    'Biblioteca de conteudos',
    'Calendario editorial',
    'Studio com teleprompter'
  ],
  true,
  true,
  1,
  'destravai-completo'
)
on conflict (id) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  monthly_price = excluded.monthly_price,
  benefits = excluded.benefits,
  is_active = true,
  highlight = true,
  sort_order = 1,
  asaas_identifier = excluded.asaas_identifier,
  updated_at = now();

update public.destravai_plans
set is_active = false, highlight = false, updated_at = now()
where id in ('starter', 'pro', 'expert', 'premium');

update public.subscriptions
set
  plan_id = 'destravai_completo',
  plan_name = case
    when coalesce(payment_method, '') = 'COURTESY' then 'Destravai Completo (cortesia)'
    else 'Destravai Completo'
  end,
  first_month_price = coalesce(first_month_price, 29.90),
  recurring_price = coalesce(recurring_price, 49.90),
  price = case
    when coalesce(payment_method, '') = 'COURTESY' then 0
    else coalesce(recurring_price, price, 49.90)
  end,
  updated_at = now()
where plan_id is null
   or plan_id in ('starter', 'pro', 'expert', 'premium')
   or plan_name in ('Starter', 'Pro', 'Expert', 'Destravai Starter', 'Destravai Pro', 'Destravai Expert');

update public.destravai_profiles
set plan = 'destravai_completo', updated_at = now()
where plan is null or plan in ('starter', 'pro', 'expert', 'premium');
