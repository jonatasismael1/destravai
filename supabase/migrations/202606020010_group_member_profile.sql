-- Gamificação — Fase 3: perfil do competidor no ranking de grupos.
-- Idempotente e aditiva. RODE NO PROJETO DO APP (fddxaozosrlqddthvqhn).
--
-- O que muda:
--   1) destravai_group_ranking agora também retorna a FOTO (avatar_url) e os
--      DIAS ATIVOS na semana — para a linha do ranking ficar mais rica.
--   2) Nova RPC destravai_group_member_profile: ao clicar num participante,
--      devolve o "perfil de competidor" — foto, profissão, posição, XP, posts,
--      gravações, missões, ROTEIROS GERADOS, dias ativos, streak atual/recorde,
--      total de dias de conteúdo e desde quando está no grupo.
--      Tudo validado: só responde se o chamador for membro do mesmo grupo.

-- O retorno destas funções MUDOU (novas colunas), então é preciso DROPAR antes
-- de recriar — Postgres não permite trocar o tipo de retorno com create or replace.
drop function if exists public.destravai_group_ranking(uuid, timestamptz);
drop function if exists public.destravai_group_member_profile(uuid, uuid, timestamptz);

-- 1) Ranking enriquecido (foto + dias ativos na semana) ----------------------
create function public.destravai_group_ranking(p_group_id uuid, p_since timestamptz)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  xp bigint,
  posted bigint,
  recorded bigint,
  missions bigint,
  active_days bigint,
  last_event_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    m.user_id,
    coalesce(p.name, 'Membro') as display_name,
    p.avatar_url,
    coalesce(sum(case ev.event_type
      when 'posted' then 25
      when 'recording_save' then 15
      when 'mission_done' then 10
      else 0 end), 0) as xp,
    coalesce(sum((ev.event_type = 'posted')::int), 0) as posted,
    coalesce(sum((ev.event_type = 'recording_save')::int), 0) as recorded,
    coalesce(sum((ev.event_type = 'mission_done')::int), 0) as missions,
    -- dias distintos (fuso BR) em que a pessoa produziu algo nesta semana
    count(distinct (ev.created_at at time zone 'America/Sao_Paulo')::date) as active_days,
    max(ev.created_at) as last_event_at
  from public.destravai_group_members m
  left join public.destravai_profiles p on p.id = m.user_id
  left join public.destravai_execution_events ev
    on ev.user_id = m.user_id and ev.created_at >= p_since
  where m.group_id = p_group_id
    and public.destravai_is_group_member(p_group_id)  -- chamador precisa ser membro
  group by m.user_id, p.name, p.avatar_url
  order by xp desc, last_event_at desc nulls last;
$$;

revoke all on function public.destravai_group_ranking(uuid, timestamptz) from public;
revoke execute on function public.destravai_group_ranking(uuid, timestamptz) from anon;
grant execute on function public.destravai_group_ranking(uuid, timestamptz) to authenticated;

-- 2) Perfil do competidor (clicou no participante) ---------------------------
-- Retorna UMA linha. p_since define o recorte semanal (mesmo do ranking).
-- Segurança: chamador e alvo precisam ser membros do MESMO grupo.
create function public.destravai_group_member_profile(
  p_group_id uuid,
  p_user_id uuid,
  p_since timestamptz
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  profession text,
  member_since timestamptz,
  rank_position int,
  -- semana atual
  week_xp bigint,
  week_posted bigint,
  week_recorded bigint,
  week_missions bigint,
  week_active_days bigint,
  -- histórico (todo o período)
  scripts_generated bigint,
  total_content_days bigint,
  current_streak int,
  best_streak int,
  last_event_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_streak int := 0;
  v_best_streak int := 0;
begin
  -- Guarda de segurança: ambos precisam pertencer ao grupo.
  if not public.destravai_is_group_member(p_group_id) then
    raise exception 'Acesso negado ao grupo';
  end if;
  if not exists (
    select 1 from public.destravai_group_members
    where group_id = p_group_id and user_id = p_user_id
  ) then
    raise exception 'Usuário não pertence ao grupo';
  end if;

  -- Streaks: ilhas de dias consecutivos de produção de conteúdo (fuso BR).
  with content_days as (
    select distinct (created_at at time zone 'America/Sao_Paulo')::date as d
    from public.destravai_execution_events
    where user_id = p_user_id
      and event_type in ('posted', 'recording_save', 'mission_done')
  ),
  islands as (
    -- dias consecutivos compartilham o mesmo "grp" (técnica gaps-and-islands)
    select d, (d - (row_number() over (order by d))::int) as grp
    from content_days
  ),
  island_sizes as (
    select grp, count(*)::int as size, max(d) as last_day
    from islands group by grp
  )
  select
    coalesce(max(size), 0),
    -- streak atual: tamanho da ilha que termina hoje ou ontem (fuso BR); senão 0
    coalesce((
      select size from island_sizes
      where last_day >= (now() at time zone 'America/Sao_Paulo')::date - 1
      order by last_day desc limit 1
    ), 0)
  into v_best_streak, v_current_streak
  from island_sizes;

  return query
  select
    p_user_id,
    coalesce(pr.name, 'Membro'),
    pr.avatar_url,
    pr.profession,
    gm.joined_at,
    -- posição no ranking semanal do grupo
    (select r.pos from (
      select rk.user_id, row_number() over () as pos
      from public.destravai_group_ranking(p_group_id, p_since) rk
    ) r where r.user_id = p_user_id)::int,
    -- semana atual
    coalesce(sum(case ev.event_type
      when 'posted' then 25 when 'recording_save' then 15 when 'mission_done' then 10
      else 0 end) filter (where ev.created_at >= p_since), 0),
    coalesce(sum((ev.event_type = 'posted')::int) filter (where ev.created_at >= p_since), 0),
    coalesce(sum((ev.event_type = 'recording_save')::int) filter (where ev.created_at >= p_since), 0),
    coalesce(sum((ev.event_type = 'mission_done')::int) filter (where ev.created_at >= p_since), 0),
    coalesce(count(distinct (ev.created_at at time zone 'America/Sao_Paulo')::date)
      filter (where ev.created_at >= p_since), 0),
    -- histórico
    (select count(*) from public.destravai_ai_generations g
      where g.user_id = p_user_id and g.status = 'success'),
    coalesce(count(distinct (ev.created_at at time zone 'America/Sao_Paulo')::date)
      filter (where ev.event_type in ('posted','recording_save','mission_done')), 0),
    v_current_streak,
    v_best_streak,
    max(ev.created_at)
  from public.destravai_group_members gm
  left join public.destravai_profiles pr on pr.id = gm.user_id
  left join public.destravai_execution_events ev on ev.user_id = gm.user_id
  where gm.group_id = p_group_id and gm.user_id = p_user_id
  group by p_user_id, pr.name, pr.avatar_url, pr.profession, gm.joined_at;
end;
$$;

revoke all on function public.destravai_group_member_profile(uuid, uuid, timestamptz) from public;
revoke execute on function public.destravai_group_member_profile(uuid, uuid, timestamptz) from anon;
grant execute on function public.destravai_group_member_profile(uuid, uuid, timestamptz) to authenticated;
