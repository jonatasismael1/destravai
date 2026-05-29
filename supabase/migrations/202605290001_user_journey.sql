-- Persistencia da jornada do usuario: missoes, progresso, calendario e Meu Espaco.
-- Rode este arquivo no Supabase antes de publicar o build que usa estes servicos.

create table if not exists public.destravai_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  type text not null check (type in ('story', 'sequence', 'reel')),
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  mission_date timestamptz not null default now(),
  content jsonb,
  points integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destravai_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  missions_completed integer not null default 0,
  current_streak integer not null default 0,
  weekly_missions integer not null default 0,
  content_balance jsonb not null default '{"authority":0,"backstage":0,"connection":0,"sale":0,"interaction":0,"humor":0}'::jsonb,
  last_activity timestamptz not null default now(),
  level text not null default 'Comecando a aparecer',
  week_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destravai_daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key date not null,
  checkin_key text not null default '',
  mission jsonb,
  extras jsonb not null default '[]'::jsonb,
  daily_status text not null default 'idle' check (daily_status in ('idle', 'attempted', 'generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_key)
);

create table if not exists public.destravai_calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key date not null,
  idea_id text not null,
  idea_snapshot jsonb not null,
  status text not null default 'planned' check (status in ('planned', 'recorded', 'posted', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_key, idea_id)
);

create table if not exists public.destravai_personal_space (
  user_id uuid primary key references auth.users(id) on delete cascade,
  context jsonb not null default '{}'::jsonb,
  today_mood text,
  today_mood_note text,
  today_mood_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destravai_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  mood text not null default '',
  entry_date timestamptz not null default now(),
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.destravai_personal_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'livre' check (category in ('conteudo', 'pessoal', 'livre')),
  created_at timestamptz not null default now()
);

create index if not exists destravai_missions_user_date_idx
  on public.destravai_missions (user_id, mission_date desc);

create index if not exists destravai_daily_checkins_user_day_idx
  on public.destravai_daily_checkins (user_id, day_key desc);

create index if not exists destravai_calendar_items_user_day_idx
  on public.destravai_calendar_items (user_id, day_key);

create index if not exists destravai_journal_entries_user_date_idx
  on public.destravai_journal_entries (user_id, entry_date desc);

create index if not exists destravai_personal_ideas_user_date_idx
  on public.destravai_personal_ideas (user_id, created_at desc);

alter table public.destravai_missions enable row level security;
alter table public.destravai_progress enable row level security;
alter table public.destravai_daily_checkins enable row level security;
alter table public.destravai_calendar_items enable row level security;
alter table public.destravai_personal_space enable row level security;
alter table public.destravai_journal_entries enable row level security;
alter table public.destravai_personal_ideas enable row level security;

grant select, insert, update, delete on public.destravai_missions to authenticated;
grant select, insert, update, delete on public.destravai_progress to authenticated;
grant select, insert, update, delete on public.destravai_daily_checkins to authenticated;
grant select, insert, update, delete on public.destravai_calendar_items to authenticated;
grant select, insert, update, delete on public.destravai_personal_space to authenticated;
grant select, insert, update, delete on public.destravai_journal_entries to authenticated;
grant select, insert, update, delete on public.destravai_personal_ideas to authenticated;

drop policy if exists "Users can select own missions" on public.destravai_missions;
create policy "Users can select own missions" on public.destravai_missions
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own missions" on public.destravai_missions;
create policy "Users can insert own missions" on public.destravai_missions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own missions" on public.destravai_missions;
create policy "Users can update own missions" on public.destravai_missions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own missions" on public.destravai_missions;
create policy "Users can delete own missions" on public.destravai_missions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own progress" on public.destravai_progress;
create policy "Users can select own progress" on public.destravai_progress
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own progress" on public.destravai_progress;
create policy "Users can insert own progress" on public.destravai_progress
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own progress" on public.destravai_progress;
create policy "Users can update own progress" on public.destravai_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can select own daily checkins" on public.destravai_daily_checkins;
create policy "Users can select own daily checkins" on public.destravai_daily_checkins
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own daily checkins" on public.destravai_daily_checkins;
create policy "Users can insert own daily checkins" on public.destravai_daily_checkins
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own daily checkins" on public.destravai_daily_checkins;
create policy "Users can update own daily checkins" on public.destravai_daily_checkins
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own daily checkins" on public.destravai_daily_checkins;
create policy "Users can delete own daily checkins" on public.destravai_daily_checkins
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own calendar items" on public.destravai_calendar_items;
create policy "Users can select own calendar items" on public.destravai_calendar_items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own calendar items" on public.destravai_calendar_items;
create policy "Users can insert own calendar items" on public.destravai_calendar_items
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own calendar items" on public.destravai_calendar_items;
create policy "Users can update own calendar items" on public.destravai_calendar_items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own calendar items" on public.destravai_calendar_items;
create policy "Users can delete own calendar items" on public.destravai_calendar_items
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own personal space" on public.destravai_personal_space;
create policy "Users can select own personal space" on public.destravai_personal_space
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own personal space" on public.destravai_personal_space;
create policy "Users can insert own personal space" on public.destravai_personal_space
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own personal space" on public.destravai_personal_space;
create policy "Users can update own personal space" on public.destravai_personal_space
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can select own journal entries" on public.destravai_journal_entries;
create policy "Users can select own journal entries" on public.destravai_journal_entries
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own journal entries" on public.destravai_journal_entries;
create policy "Users can insert own journal entries" on public.destravai_journal_entries
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete own journal entries" on public.destravai_journal_entries;
create policy "Users can delete own journal entries" on public.destravai_journal_entries
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own personal ideas" on public.destravai_personal_ideas;
create policy "Users can select own personal ideas" on public.destravai_personal_ideas
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own personal ideas" on public.destravai_personal_ideas;
create policy "Users can insert own personal ideas" on public.destravai_personal_ideas
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete own personal ideas" on public.destravai_personal_ideas;
create policy "Users can delete own personal ideas" on public.destravai_personal_ideas
  for delete to authenticated using (auth.uid() = user_id);
