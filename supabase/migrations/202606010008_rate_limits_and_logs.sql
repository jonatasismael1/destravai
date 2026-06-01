-- Migration: Rate Limits + Error Logs
-- Criada em: 2026-06-01
-- IMPORTANTE: dollar-quotes usam tags nomeadas ($func$, $cleanup$) para evitar
-- conflito com o $$ interno de comandos dinâmicos.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela de rate limits (janelas de tempo por chave)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.destravai_rate_limits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  window_end   timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end
  ON public.destravai_rate_limits (window_end);

-- Sem RLS pública — acessada apenas pelo service_role (server-side).
ALTER TABLE public.destravai_rate_limits ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC para incrementar atomicamente o contador da janela corrente.
--    Retorna o valor APÓS o incremento (1 na primeira chamada da janela).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.destravai_rate_limit_increment(
  p_key          text,
  p_window_start timestamptz,
  p_window_end   timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.destravai_rate_limits (key, window_start, window_end, count)
  VALUES (p_key, p_window_start, p_window_end, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET count = destravai_rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Limpeza oportunista: remove janelas vencidas há mais de 1 hora
  DELETE FROM public.destravai_rate_limits
  WHERE window_end < NOW() - INTERVAL '1 hour';

  RETURN v_count;
END;
$func$;

REVOKE ALL ON FUNCTION public.destravai_rate_limit_increment(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabela de logs de erros (diagnóstico e observabilidade)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.destravai_error_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  source      text        NOT NULL,
  level       text        NOT NULL DEFAULT 'error'
    CHECK (level IN ('error', 'warn', 'info')),
  message     text        NOT NULL,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
  ON public.destravai_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source
  ON public.destravai_error_logs (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user
  ON public.destravai_error_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.destravai_error_logs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC para registrar log de erro (server-side via service_role)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.destravai_log_error(
  p_source  text,
  p_message text,
  p_level   text    DEFAULT 'error',
  p_user_id uuid    DEFAULT NULL,
  p_details jsonb   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  INSERT INTO public.destravai_error_logs (user_id, source, level, message, details)
  VALUES (p_user_id, p_source, p_level, p_message, p_details);
EXCEPTION WHEN OTHERS THEN
  -- Log não pode quebrar o fluxo principal
  NULL;
END;
$func$;

REVOKE ALL ON FUNCTION public.destravai_log_error(text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Limpeza automática dos logs antigos (30 dias) via pg_cron, se disponível.
-- ─────────────────────────────────────────────────────────────────────────────
DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-error-logs',
      '0 3 * * *',  -- Todo dia às 3h
      'DELETE FROM public.destravai_error_logs WHERE created_at < NOW() - INTERVAL ''30 days'''
    );
  END IF;
END
$cleanup$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Policies explícitas de negação para anon/authenticated.
--    As tabelas acima só devem ser acessadas pelo service_role (server-side).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deny_all_rate_limits" ON public.destravai_rate_limits;
CREATE POLICY "deny_all_rate_limits"
  ON public.destravai_rate_limits
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_error_logs" ON public.destravai_error_logs;
CREATE POLICY "deny_all_error_logs"
  ON public.destravai_error_logs
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
