-- Endurecimento de GRANTs (defesa em profundidade).
-- Estas tabelas NUNCA são acessadas direto pelo cliente — toda leitura/escrita
-- passa pelas Netlify Functions com service_role (que ignora GRANT e RLS). A RLS
-- já bloqueava anon/authenticated; aqui removemos também os GRANTs amplos herdados
-- do padrão do Supabase. Confirmado: não há nenhuma query do cliente (.from(...))
-- a estas tabelas. Idempotente: revoke de privilégio inexistente é no-op.

-- subscriptions: o cliente no máximo LÊ a própria linha (policy subscriptions_select_own).
-- Escrita é exclusiva do webhook (service_role). anon não precisa de nada.
revoke all on public.subscriptions from anon;
revoke insert, update, delete, truncate, references, trigger on public.subscriptions from authenticated;

-- Tabelas internas: cliente não toca em nada (idempotência de webhook, logs, rate limit).
revoke all on public.asaas_webhook_events from anon, authenticated;
revoke all on public.destravai_error_logs  from anon, authenticated;
revoke all on public.destravai_rate_limits from anon, authenticated;
