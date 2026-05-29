-- Schema base do Destravai: perfis, essencia, biblioteca, conversas/mensagens de IA,
-- log de geracoes e limites de uso. Complementa 202605290001_user_journey.sql.
-- Idempotente: pode ser rodado mais de uma vez sem efeito colateral.

-- ── Funcao utilitaria: mantem updated_at sempre atual ───────────────────
create or replace function public.destravai_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Perfis (1:1 com auth.users) ─────────────────────────────────────────
create table if not exists public.destravai_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  profession text,
  avatar_url text,
  plan text not null default 'starter',
  onboarding_completed boolean not null default false,
  essence_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Essencia da marca (versionada; uma ativa por usuario) ───────────────
create table if not exists public.destravai_brand_essence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profession text,
  niche text,
  audience text,
  tone_of_voice text,
  content_goals text,
  routine text,
  preferred_formats text[],
  topics text[],
  restrictions text[],
  differentials text,
  services text[],
  frequent_questions text[],
  common_objections text[],
  phrases text[],
  references_text text,
  raw_answers_json jsonb,
  ai_summary text,
  ai_positioning text,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Biblioteca de conteudos ─────────────────────────────────────────────
create table if not exists public.destravai_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  essence_id uuid references public.destravai_brand_essence(id) on delete set null,
  type text not null,
  title text not null,
  content text not null default '',
  category text,
  format text,
  status text not null default 'saved' check (status in ('saved', 'done', 'archived')),
  source text not null default 'ai' check (source in ('ai', 'manual')),
  tags text[] not null default '{}'::text[],
  metadata jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Conversas e mensagens de IA ─────────────────────────────────────────
create table if not exists public.destravai_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  context_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destravai_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.destravai_ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ── Log de geracoes de IA (tambem usado para o limite mensal) ───────────
create table if not exists public.destravai_ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_type text not null,
  input_data jsonb,
  output_data jsonb,
  model text,
  tokens_used integer,
  status text not null default 'success' check (status in ('success', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

-- ── Limites de uso por periodo ──────────────────────────────────────────
create table if not exists public.destravai_usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  ai_generations_count integer not null default 0,
  library_generations_count integer not null default 0,
  scripts_count integer not null default 0,
  stories_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

-- ── Indices ─────────────────────────────────────────────────────────────
create index if not exists destravai_brand_essence_user_active_idx
  on public.destravai_brand_essence (user_id, is_active, created_at desc);
create index if not exists destravai_library_items_user_created_idx
  on public.destravai_library_items (user_id, created_at desc);
create index if not exists destravai_ai_conversations_user_updated_idx
  on public.destravai_ai_conversations (user_id, updated_at desc);
create index if not exists destravai_ai_messages_conversation_idx
  on public.destravai_ai_messages (conversation_id, created_at);
-- Critico para a contagem do limite mensal:
create index if not exists destravai_ai_generations_user_created_idx
  on public.destravai_ai_generations (user_id, created_at desc);

-- ── Triggers de updated_at ──────────────────────────────────────────────
drop trigger if exists destravai_profiles_touch on public.destravai_profiles;
create trigger destravai_profiles_touch before update on public.destravai_profiles
  for each row execute function public.destravai_touch_updated_at();
drop trigger if exists destravai_brand_essence_touch on public.destravai_brand_essence;
create trigger destravai_brand_essence_touch before update on public.destravai_brand_essence
  for each row execute function public.destravai_touch_updated_at();
drop trigger if exists destravai_library_items_touch on public.destravai_library_items;
create trigger destravai_library_items_touch before update on public.destravai_library_items
  for each row execute function public.destravai_touch_updated_at();
drop trigger if exists destravai_ai_conversations_touch on public.destravai_ai_conversations;
create trigger destravai_ai_conversations_touch before update on public.destravai_ai_conversations
  for each row execute function public.destravai_touch_updated_at();
drop trigger if exists destravai_usage_limits_touch on public.destravai_usage_limits;
create trigger destravai_usage_limits_touch before update on public.destravai_usage_limits
  for each row execute function public.destravai_touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.destravai_profiles enable row level security;
alter table public.destravai_brand_essence enable row level security;
alter table public.destravai_library_items enable row level security;
alter table public.destravai_ai_conversations enable row level security;
alter table public.destravai_ai_messages enable row level security;
alter table public.destravai_ai_generations enable row level security;
alter table public.destravai_usage_limits enable row level security;

grant select, insert, update, delete on public.destravai_profiles to authenticated;
grant select, insert, update, delete on public.destravai_brand_essence to authenticated;
grant select, insert, update, delete on public.destravai_library_items to authenticated;
grant select, insert, update, delete on public.destravai_ai_conversations to authenticated;
grant select, insert, update, delete on public.destravai_ai_messages to authenticated;
grant select, insert, update, delete on public.destravai_ai_generations to authenticated;
grant select, insert, update, delete on public.destravai_usage_limits to authenticated;

-- profiles (dono = id)
drop policy if exists "Users select own profile" on public.destravai_profiles;
create policy "Users select own profile" on public.destravai_profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "Users insert own profile" on public.destravai_profiles;
create policy "Users insert own profile" on public.destravai_profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.destravai_profiles;
create policy "Users update own profile" on public.destravai_profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- brand_essence (dono = user_id)
drop policy if exists "Users select own essence" on public.destravai_brand_essence;
create policy "Users select own essence" on public.destravai_brand_essence
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own essence" on public.destravai_brand_essence;
create policy "Users insert own essence" on public.destravai_brand_essence
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own essence" on public.destravai_brand_essence;
create policy "Users update own essence" on public.destravai_brand_essence
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own essence" on public.destravai_brand_essence;
create policy "Users delete own essence" on public.destravai_brand_essence
  for delete to authenticated using (auth.uid() = user_id);

-- library_items
drop policy if exists "Users select own library" on public.destravai_library_items;
create policy "Users select own library" on public.destravai_library_items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own library" on public.destravai_library_items;
create policy "Users insert own library" on public.destravai_library_items
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own library" on public.destravai_library_items;
create policy "Users update own library" on public.destravai_library_items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own library" on public.destravai_library_items;
create policy "Users delete own library" on public.destravai_library_items
  for delete to authenticated using (auth.uid() = user_id);

-- ai_conversations
drop policy if exists "Users select own conversations" on public.destravai_ai_conversations;
create policy "Users select own conversations" on public.destravai_ai_conversations
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own conversations" on public.destravai_ai_conversations;
create policy "Users insert own conversations" on public.destravai_ai_conversations
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own conversations" on public.destravai_ai_conversations;
create policy "Users update own conversations" on public.destravai_ai_conversations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own conversations" on public.destravai_ai_conversations;
create policy "Users delete own conversations" on public.destravai_ai_conversations
  for delete to authenticated using (auth.uid() = user_id);

-- ai_messages
drop policy if exists "Users select own messages" on public.destravai_ai_messages;
create policy "Users select own messages" on public.destravai_ai_messages
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own messages" on public.destravai_ai_messages;
create policy "Users insert own messages" on public.destravai_ai_messages
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users delete own messages" on public.destravai_ai_messages;
create policy "Users delete own messages" on public.destravai_ai_messages
  for delete to authenticated using (auth.uid() = user_id);

-- ai_generations (frontend pode logar e ler o proprio uso)
drop policy if exists "Users select own generations" on public.destravai_ai_generations;
create policy "Users select own generations" on public.destravai_ai_generations
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own generations" on public.destravai_ai_generations;
create policy "Users insert own generations" on public.destravai_ai_generations
  for insert to authenticated with check (auth.uid() = user_id);

-- usage_limits (leitura propria; escrita feita pelo servidor via service role)
drop policy if exists "Users select own usage" on public.destravai_usage_limits;
create policy "Users select own usage" on public.destravai_usage_limits
  for select to authenticated using (auth.uid() = user_id);
