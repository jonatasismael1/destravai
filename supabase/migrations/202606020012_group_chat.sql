-- Gamificação — Fase 4: chat interno de grupo.
-- Idempotente e aditiva. RODE NO PROJETO DO APP (fddxaozosrlqddthvqhn).
--
-- Mensagens visíveis só para membros do grupo. A leitura com nome/foto do autor
-- passa por uma RPC SECURITY DEFINER (igual ao ranking), porque a tabela de
-- perfis tem RLS restritiva (cada um só vê o próprio). O envio é um INSERT comum
-- protegido por RLS (precisa ser membro e enviar como si mesmo).

-- 1) Tabela de mensagens --------------------------------------------------------
create table if not exists public.destravai_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.destravai_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists destravai_group_messages_group_idx
  on public.destravai_group_messages (group_id, created_at);

-- 2) RLS ------------------------------------------------------------------------
alter table public.destravai_group_messages enable row level security;
grant select, insert on public.destravai_group_messages to authenticated;

-- Lê mensagens de grupos a que pertence.
drop policy if exists "group messages select member" on public.destravai_group_messages;
create policy "group messages select member" on public.destravai_group_messages
  for select to authenticated
  using (public.destravai_is_group_member(group_id));

-- Envia como si mesmo, sendo membro do grupo.
drop policy if exists "group messages insert member" on public.destravai_group_messages;
create policy "group messages insert member" on public.destravai_group_messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.destravai_is_group_member(group_id));

-- 3) RPC: últimas N mensagens com nome/foto do autor ---------------------------
create or replace function public.destravai_group_messages_list(p_group_id uuid, p_limit int default 100)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  content text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  -- Pega as últimas N (ordem desc) e devolve em ordem cronológica (asc) para a UI.
  select t.id, t.user_id, t.display_name, t.avatar_url, t.content, t.created_at
  from (
    select m.id, m.user_id, coalesce(p.name, 'Membro') as display_name, p.avatar_url,
           m.content, m.created_at
    from public.destravai_group_messages m
    left join public.destravai_profiles p on p.id = m.user_id
    where m.group_id = p_group_id
      and public.destravai_is_group_member(p_group_id)  -- chamador precisa ser membro
    order by m.created_at desc
    limit greatest(1, least(p_limit, 200))
  ) t
  order by t.created_at asc;
$$;

revoke all on function public.destravai_group_messages_list(uuid, int) from public;
revoke execute on function public.destravai_group_messages_list(uuid, int) from anon;
grant execute on function public.destravai_group_messages_list(uuid, int) to authenticated;
