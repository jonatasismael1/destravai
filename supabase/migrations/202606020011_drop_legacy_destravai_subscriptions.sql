-- Remove a tabela legada/órfã public.destravai_subscriptions.
--
-- Contexto: o app usa public.subscriptions (checkout Asaas). A destravai_subscriptions
-- era de um modelo antigo, está VAZIA (0 linhas) e não é referenciada por nenhum
-- código (apenas aparecia nos types gerados). Removida para reduzir confusão.
-- Idempotente: drop if exists. cascade cobre policies/constraints dependentes.

drop table if exists public.destravai_subscriptions cascade;
