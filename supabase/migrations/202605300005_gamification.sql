-- Gamificação — Fase 1: conquistas (badges) + recorde/escudo de streak.
-- Idempotente. Aditiva: não altera nada existente. RODE NO PROJETO DO APP
-- (fddxaozosrlqddthvqhn).

-- 1) Conquistas desbloqueadas por usuário ------------------------------------
create table if not exists public.destravai_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,     -- ex.: 'streak_7', 'all_content_types', 'first_post'
  unlocked_at timestamptz not null default now(),
  metadata jsonb,
  unique (user_id, achievement_key)  -- cada conquista só desbloqueia 1x
);

create index if not exists destravai_achievements_user_idx
  on public.destravai_achievements (user_id, unlocked_at desc);

alter table public.destravai_achievements enable row level security;
grant select, insert on public.destravai_achievements to authenticated;

drop policy if exists "Users select own achievements" on public.destravai_achievements;
create policy "Users select own achievements" on public.destravai_achievements
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users insert own achievements" on public.destravai_achievements;
create policy "Users insert own achievements" on public.destravai_achievements
  for insert to authenticated with check (auth.uid() = user_id);

-- 2) Recorde de streak + escudos (colunas opcionais em destravai_progress) ----
-- Adicionadas com IF NOT EXISTS para não afetar dados nem o app atual.
alter table public.destravai_progress
  add column if not exists best_streak integer not null default 0;

alter table public.destravai_progress
  add column if not exists streak_shields integer not null default 0;
