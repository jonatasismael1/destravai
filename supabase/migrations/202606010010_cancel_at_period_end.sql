-- Cancelamento com acesso até o fim do período pago.
--
-- Regra de negócio:
--   - Cancelou DENTRO de 7 dias (garantia): estorna e bloqueia o acesso na hora.
--   - Cancelou DEPOIS dos 7 dias: interrompe as cobranças futuras, mas o usuário
--     CONTINUA com acesso até o fim do período que já pagou.
--
-- Para isso registramos `current_period_end` (até quando o ciclo pago vale). O
-- webhook atualiza esse campo a cada pagamento confirmado (+1 mês); o cancelamento
-- fora da garantia apenas para as cobranças e preserva esse prazo.
-- Idempotente: pode rodar mais de uma vez.

alter table public.subscriptions
  add column if not exists current_period_end timestamptz;

-- Backfill: para assinaturas já ativas e pagas sem o campo, assume 1 mês a partir
-- do início (ou da criação). É uma estimativa segura para não bloquear quem já paga.
update public.subscriptions
set current_period_end = coalesce(started_at, created_at) + interval '1 month'
where current_period_end is null
  and status = 'active'
  and payment_status = 'paid';
