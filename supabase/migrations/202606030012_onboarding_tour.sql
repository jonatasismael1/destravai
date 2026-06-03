-- ─────────────────────────────────────────────────────────────────────────
-- Onboarding guiado (tour por tela)
-- Adiciona um campo de status do tour no perfil. Não destrutivo: a coluna é
-- criada com default '{}' e os usuários existentes simplesmente passam a ver o
-- tour uma vez. Nada é apagado.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.destravai_profiles
  add column if not exists onboarding_status jsonb not null default '{}'::jsonb;

comment on column public.destravai_profiles.onboarding_status is
  'Progresso do tour guiado por tela. Ex.: { "tour_version": "1.0", "main": true, "criar": false, ... }. Sem coluna própria por tela — tudo vive neste JSON para facilitar evolução.';
