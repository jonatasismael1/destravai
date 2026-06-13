-- Teto de tamanho nas mensagens do chat de grupo (achado MÉDIO da auditoria
-- 2026-06-12: content era text sem limite — permitia mensagens gigantes/spam).
--
-- O app já corta em 2000 caracteres no cliente (groupsService.sendGroupMessage),
-- então o teto de 4000 aqui tem folga dupla e NÃO afeta nenhum envio legítimo.
-- NOT VALID: vale só para linhas novas (não falha se existir mensagem antiga
-- maior). Idempotente. RODE NO PROJETO DO APP.

alter table public.destravai_group_messages
  drop constraint if exists destravai_group_messages_content_len;

alter table public.destravai_group_messages
  add constraint destravai_group_messages_content_len
  check (char_length(content) <= 4000) not valid;
