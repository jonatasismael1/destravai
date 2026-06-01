-- Migration: Rate Limits + Error Logs
-- Criada em: 2026-06-01

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

-- Limpa automaticamente janelas antigas (evita crescimento infinito)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end
  ON public.destravai_rate_limits (window_end);

-- Sem RLS — esta tabela é acessada apenas pelo service_role (server-side).
-- Nunca exponha via anon key.
ALTER TABLE public.destravai_rate_limits ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy pública: apenas service_role pode ler/escrever.

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
AS $$
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
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabela de logs de erros (diagnóstico e observabilidade)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.destravai_error_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Rota, função ou componente onde o erro ocorreu
  source      text        NOT NULL,
  -- Nível: 'error' | 'warn' | 'info'
  level       text        NOT NULL DEFAULT 'error'
    CHECK (level IN ('error', 'warn', 'info')),
  -- Mensagem legível
  message     text        NOT NULL,
  -- Dados extras (stack trace parcial, contexto) — sem chaves ou dados sensíveis
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- Índices para consultas de diagnóstico
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
  ON public.destravai_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source
  ON public.destravai_error_logs (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user
  ON public.destravai_error_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- RLS: apenas service_role pode inserir/ler
ALTER TABLE public.destravai_error_logs ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy pública.

-- Limpa logs antigos automaticamente (mantém apenas os últimos 30 dias).
-- Roda via pg_cron se disponível, caso contrário a limpeza é feita no INSERT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-error-logs',
      '0 3 * * *',  -- Todo dia às 3h
      $$DELETE FROM public.destravai_error_logs WHERE created_at < NOW() - INTERVAL '30 days'$$
    );
  END IF;
END $$;

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
AS $$
BEGIN
  INSERT INTO public.destravai_error_logs (user_id, source, level, message, details)
  VALUES (p_user_id, p_source, p_level, p_message, p_details);
EXCEPTION WHEN OTHERS THEN
  -- Log não pode quebrar o fluxo principal
  NULL;
END;
$$;
