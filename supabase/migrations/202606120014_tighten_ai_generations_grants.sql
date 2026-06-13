-- Fecha o bypass do limite mensal de IA (achado CRÍTICO da auditoria 2026-06-12).
-- O limite de gerações/mês é calculado CONTANDO linhas de destravai_ai_generations
-- com status='success'. O grant herdado do baseline permitia insert/update/delete
-- pelo cliente — ou seja, o usuário podia DELETAR as próprias linhas via PostgREST
-- e zerar o contador (IA ilimitada). A escrita real é feita SOMENTE pelas functions
-- com service_role (que ignora GRANT/RLS), então revogar não afeta nada do app.
-- Confirmado: nenhum .from('destravai_ai_generations') no código do cliente.
-- Idempotente: revoke de privilégio inexistente é no-op. RODE NO PROJETO DO APP.

revoke insert, update, delete, truncate, references, trigger
  on public.destravai_ai_generations from authenticated;
revoke all on public.destravai_ai_generations from anon;

-- destravai_usage_limits: mesmo caso (cliente só LÊ a própria linha; escrita é do
-- servidor). A RLS já bloqueava escrita (não há policy de insert/update), mas
-- removemos também o GRANT amplo, por defesa em profundidade.
revoke insert, update, delete, truncate, references, trigger
  on public.destravai_usage_limits from authenticated;
revoke all on public.destravai_usage_limits from anon;
