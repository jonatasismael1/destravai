-- ⚠️ APLICAR POR ÚLTIMO, DEPOIS QUE O FRONTEND NOVO ESTIVER NO AR ⚠️
--
-- Fecha o INSERT direto do cliente em eventos de execução e conquistas (achado
-- da auditoria 2026-06-12: ranking/conquistas forjáveis via PostgREST). A partir
-- daqui, a escrita passa SÓ pelas RPCs validadas da migration 202606120015
-- (destravai_track_event / destravai_unlock_achievement).
--
-- Ordem segura:
--   1. Aplicar a 202606120015 (cria as RPCs — aditiva, sem risco).
--   2. Deploy do frontend que usa as RPCs (com fallback) — já neste commit.
--   3. Aplicar ESTA migration.
-- Se um bundle antigo (PWA em cache) ainda tentar o insert direto, o erro é
-- engolido pelos services (telemetria é fail-silent) — nada quebra na UI; o
-- evento só não é registrado até o usuário recarregar e pegar o bundle novo.
--
-- A leitura (select) continua liberada — telas de constância/conquistas leem
-- direto. Idempotente. RODE NO PROJETO DO APP.

revoke insert on public.destravai_execution_events from authenticated;
revoke insert on public.destravai_achievements from authenticated;

-- As policies de INSERT ficam sem efeito sem o GRANT, mas removê-las documenta
-- a intenção (escrita só via RPC security definer).
drop policy if exists "Users insert own events" on public.destravai_execution_events;
drop policy if exists "Users insert own achievements" on public.destravai_achievements;
