-- Gamificação validada no servidor (achado da auditoria 2026-06-12: ranking e
-- conquistas eram forjáveis por INSERT direto via PostgREST).
--
-- Esta migration é ADITIVA e segura de aplicar a qualquer momento: cria o catálogo
-- de conquistas e duas RPCs validadas. O frontend novo usa as RPCs (com fallback
-- para o insert direto enquanto esta migration não roda). O revoke do insert
-- direto fica na migration 202606120018 — aplicar DEPOIS do deploy do frontend.
-- Idempotente. RODE NO PROJETO DO APP (fddxaozosrlqddthvqhn).

-- 1) Catálogo de conquistas válidas ------------------------------------------
-- Fonte da verdade no banco: a RPC só desbloqueia chaves que existem aqui.
-- Adicionar conquista nova = adicionar no catálogo (insert) E em
-- src/lib/achievements.ts (título/emoji/condição de UI).
create table if not exists public.destravai_achievement_catalog (
  key text primary key
);

alter table public.destravai_achievement_catalog enable row level security;
grant select on public.destravai_achievement_catalog to authenticated;

drop policy if exists "catalog select all" on public.destravai_achievement_catalog;
create policy "catalog select all" on public.destravai_achievement_catalog
  for select to authenticated using (true);

insert into public.destravai_achievement_catalog (key) values
  ('first_mission'), ('streak_3'), ('streak_7'), ('streak_30'),
  ('missions_15'), ('missions_50'), ('all_content_types'),
  ('first_post'), ('posted_10'), ('first_recording')
on conflict (key) do nothing;

-- 2) RPC: registrar evento de execução com validação ---------------------------
-- Valida o tipo de evento (allowlist) e aplica teto diário nos eventos que valem
-- XP no ranking de grupos (posted=25, recording_save=15, mission_done=10). O teto
-- de 30/dia é folgado para uso real e impede inflar o ranking em massa.
create or replace function public.destravai_track_event(
  p_event_type text,
  p_ref_id text default null,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  if p_event_type not in (
    'mission_open', 'script_copy', 'teleprompter_open', 'recording_start',
    'recording_save', 'post_now_clicked', 'shared_attempted', 'posted',
    'will_post_later', 'only_recorded', 'planned', 'mission_done', 'returned'
  ) then
    raise exception 'Tipo de evento inválido: %', p_event_type;
  end if;

  -- metadata é livre, mas com teto de tamanho (evita linhas gigantes).
  if p_metadata is not null and pg_column_size(p_metadata) > 8192 then
    raise exception 'Metadata muito grande';
  end if;

  if p_event_type in ('posted', 'recording_save', 'mission_done') then
    select count(*) into v_count
      from public.destravai_execution_events
      where user_id = v_user
        and event_type = p_event_type
        and created_at >= date_trunc('day', now());
    if v_count >= 30 then
      raise exception 'Limite diário deste tipo de evento atingido';
    end if;
  end if;

  insert into public.destravai_execution_events (user_id, event_type, ref_id, metadata)
    values (v_user, p_event_type, left(p_ref_id, 200), p_metadata);
end;
$func$;

revoke all on function public.destravai_track_event(text, text, jsonb) from public, anon;
grant execute on function public.destravai_track_event(text, text, jsonb) to authenticated;

-- 3) RPC: desbloquear conquista validada pelo catálogo --------------------------
-- Retorna true se desbloqueou AGORA (false se já existia). A unicidade continua
-- garantida pela constraint unique (user_id, achievement_key).
create or replace function public.destravai_unlock_achievement(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  v_user uuid := auth.uid();
  v_inserted boolean := false;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;

  if not exists (select 1 from public.destravai_achievement_catalog where key = p_key) then
    raise exception 'Conquista inválida: %', p_key;
  end if;

  insert into public.destravai_achievements (user_id, achievement_key)
    values (v_user, p_key)
    on conflict (user_id, achievement_key) do nothing;

  v_inserted := found;
  return v_inserted;
end;
$func$;

revoke all on function public.destravai_unlock_achievement(text) from public, anon;
grant execute on function public.destravai_unlock_achievement(text) to authenticated;
