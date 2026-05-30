-- Gamificação — Fase 2: grupos de amigos + ranking de constância.
-- Idempotente e aditiva. RODE NO PROJETO DO APP (fddxaozosrlqddthvqhn).
--
-- Segurança: políticas de grupo são propensas a RECURSÃO. Para evitar isso,
-- a checagem de associação usa uma função SECURITY DEFINER que lê a tabela de
-- membros SEM acionar RLS. O ranking (que precisa ler eventos de outros
-- membros) também é exposto via RPC SECURITY DEFINER que valida o chamador.

-- 1) Tabelas -----------------------------------------------------------------
create table if not exists public.destravai_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.destravai_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.destravai_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',     -- 'owner' | 'member'
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists destravai_group_members_group_idx
  on public.destravai_group_members (group_id);
create index if not exists destravai_group_members_user_idx
  on public.destravai_group_members (user_id);

-- 2) Função anti-recursão: o chamador é membro do grupo? ----------------------
create or replace function public.destravai_is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.destravai_group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

revoke all on function public.destravai_is_group_member(uuid) from public;
grant execute on function public.destravai_is_group_member(uuid) to authenticated;

-- 3) RLS ---------------------------------------------------------------------
alter table public.destravai_groups enable row level security;
alter table public.destravai_group_members enable row level security;
grant select, insert, update, delete on public.destravai_groups to authenticated;
grant select, insert, delete on public.destravai_group_members to authenticated;

-- Grupos: vê quem é dono OU membro. Cria quem será dono. Edita/exclui o dono.
drop policy if exists "groups select member" on public.destravai_groups;
create policy "groups select member" on public.destravai_groups
  for select to authenticated
  using (owner_id = auth.uid() or public.destravai_is_group_member(id));

drop policy if exists "groups insert owner" on public.destravai_groups;
create policy "groups insert owner" on public.destravai_groups
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "groups update owner" on public.destravai_groups;
create policy "groups update owner" on public.destravai_groups
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "groups delete owner" on public.destravai_groups;
create policy "groups delete owner" on public.destravai_groups
  for delete to authenticated using (owner_id = auth.uid());

-- Membros: vê os membros de grupos a que pertence; entra a si mesmo; sai (deleta a si mesmo).
drop policy if exists "members select same group" on public.destravai_group_members;
create policy "members select same group" on public.destravai_group_members
  for select to authenticated
  using (user_id = auth.uid() or public.destravai_is_group_member(group_id));

drop policy if exists "members insert self" on public.destravai_group_members;
create policy "members insert self" on public.destravai_group_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "members delete self" on public.destravai_group_members;
create policy "members delete self" on public.destravai_group_members
  for delete to authenticated using (user_id = auth.uid());

-- 4) Entrar em grupo por código (cria a linha de membro com validação) --------
create or replace function public.destravai_join_group_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.destravai_groups
    where invite_code = upper(trim(p_code));
  if v_group_id is null then
    raise exception 'Código de grupo inválido';
  end if;

  insert into public.destravai_group_members (group_id, user_id, role)
    values (v_group_id, auth.uid(), 'member')
    on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

revoke all on function public.destravai_join_group_by_code(text) from public;
grant execute on function public.destravai_join_group_by_code(text) to authenticated;

-- 5) Ranking semanal do grupo (lê eventos de todos os membros com segurança) --
-- XP: postou=25, gravou=15, missão concluída=10. Só responde se o chamador for
-- membro do grupo. Retorna também a última atividade (para o feed "apareceu hoje").
create or replace function public.destravai_group_ranking(p_group_id uuid, p_since timestamptz)
returns table (
  user_id uuid,
  display_name text,
  xp bigint,
  posted bigint,
  recorded bigint,
  missions bigint,
  last_event_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    m.user_id,
    coalesce(p.name, 'Membro') as display_name,
    coalesce(sum(case ev.event_type
      when 'posted' then 25
      when 'recording_save' then 15
      when 'mission_done' then 10
      else 0 end), 0) as xp,
    coalesce(sum((ev.event_type = 'posted')::int), 0) as posted,
    coalesce(sum((ev.event_type = 'recording_save')::int), 0) as recorded,
    coalesce(sum((ev.event_type = 'mission_done')::int), 0) as missions,
    max(ev.created_at) as last_event_at
  from public.destravai_group_members m
  left join public.destravai_profiles p on p.id = m.user_id
  left join public.destravai_execution_events ev
    on ev.user_id = m.user_id and ev.created_at >= p_since
  where m.group_id = p_group_id
    and public.destravai_is_group_member(p_group_id)  -- chamador precisa ser membro
  group by m.user_id, p.name
  order by xp desc, last_event_at desc nulls last;
$$;

revoke all on function public.destravai_group_ranking(uuid, timestamptz) from public;
grant execute on function public.destravai_group_ranking(uuid, timestamptz) to authenticated;

-- 6) Segurança: visitante não logado (anon) não chama nada disto ---------------
revoke execute on function public.destravai_is_group_member(uuid) from anon;
revoke execute on function public.destravai_join_group_by_code(text) from anon;
revoke execute on function public.destravai_group_ranking(uuid, timestamptz) from anon;
