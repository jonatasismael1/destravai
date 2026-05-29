-- Eventos de execução: métrica real de uso (abriu teleprompter, gravou, postou,
-- planejou, voltou). Vira a base da régua de ativação e do "modo postei".
-- Idempotente. RODE NO PROJETO DO APP (fddxaozosrlqddthvqhn).

create table if not exists public.destravai_execution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,        -- teleprompter_open, recording_start, recording_save, posted, planned, returned...
  ref_id text,                     -- id da ideia/missão relacionada (opcional)
  metadata jsonb,                  -- formato, duração, etc.
  created_at timestamptz not null default now()
);

create index if not exists destravai_execution_events_user_idx
  on public.destravai_execution_events (user_id, created_at desc);
create index if not exists destravai_execution_events_type_idx
  on public.destravai_execution_events (user_id, event_type, created_at desc);

alter table public.destravai_execution_events enable row level security;
grant select, insert on public.destravai_execution_events to authenticated;

drop policy if exists "Users select own events" on public.destravai_execution_events;
create policy "Users select own events" on public.destravai_execution_events
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own events" on public.destravai_execution_events;
create policy "Users insert own events" on public.destravai_execution_events
  for insert to authenticated with check (auth.uid() = user_id);
