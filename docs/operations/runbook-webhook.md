# Runbook — Webhook do Asaas e liberação de acesso

Como diagnosticar e resolver problemas de pagamento que não viraram acesso.

## Fluxo normal
1. Cliente paga (Pix/cartão) no checkout.
2. Asaas chama `POST /.netlify/functions/asaas-webhook` (valida `ASAAS_WEBHOOK_TOKEN`).
3. No pagamento confirmado, o webhook:
   - marca a assinatura como `active` / `paid`, define `current_period_end` (+1 mês);
   - cria a recorrência mensal no Asaas (R$49,90);
   - libera o acesso (`access_granted`) e envia o e-mail para criar a senha.

## Onde olhar quando algo falha
- **Tabela `subscriptions`**: estado da assinatura do usuário (status, payment_status,
  access_granted, asaas_payment_id, asaas_subscription_id, current_period_end).
- **Tabela `destravai_error_logs`**: erros/alertas do servidor. Filtre por
  `source = 'asaas-webhook'`. Há um alerta específico quando um pagamento é
  confirmado mas **não existe assinatura local** (caso crítico) e quando a
  recorrência falha ao ser criada.
- **Tabela `asaas_webhook_events`**: todos os eventos recebidos (idempotência).
  `processed_at` nulo = evento não processado.

### Queries úteis (SQL no Supabase)
```sql
-- Pagamentos confirmados sem assinatura local / erros do webhook (últimos 7 dias)
select created_at, level, message, details
from public.destravai_error_logs
where source = 'asaas-webhook' and created_at > now() - interval '7 days'
order by created_at desc;

-- Eventos recebidos do Asaas (mais recentes)
select created_at, event_type, asaas_payment_id, asaas_subscription_id, processed_at
from public.asaas_webhook_events order by created_at desc limit 20;

-- Assinatura de um cliente pelo e-mail
select status, payment_status, access_granted, current_period_end, asaas_payment_id
from public.subscriptions where lower(customer_email) = lower('email@cliente.com')
order by created_at desc;
```

## Cenários e ações

### Cliente pagou mas não recebeu acesso
1. Confirme no painel do Asaas que o pagamento está **RECEIVED/CONFIRMED**.
2. Veja `asaas_webhook_events`: o evento chegou? `processed_at` preenchido?
   - **Não chegou** → confira no Asaas se a URL do webhook e o token estão certos;
     reenvie o evento pelo painel do Asaas.
   - **Chegou mas a assinatura está `pending`** → veja `destravai_error_logs`.
3. **Reprocessar manualmente** (libera acesso sem novo pagamento), via SQL:
```sql
-- Use o asaas_payment_id real do pagamento confirmado
update public.subscriptions
set status='active', payment_status='paid', access_granted=true,
    access_granted_at=now(),
    started_at = coalesce(started_at, now()),
    refund_deadline = coalesce(refund_deadline, now() + interval '7 days'),
    current_period_end = coalesce(current_period_end, now() + interval '1 month'),
    updated_at = now()
where asaas_payment_id = 'pay_xxxxxxxx';
```
   Depois, o cliente entra pelo link do e-mail (ou peça para usar "Esqueci a senha"
   em `/login`). Se a recorrência não foi criada, crie a assinatura no painel do Asaas.

### Reembolso (cancelamento dentro de 7 dias)
- O app tenta estornar automaticamente. O Asaas pode exigir **autorização da ação
  crítica** (e-mail/SMS ao dono) — autorize no painel para concluir o estorno.
- Se o saldo disponível for menor que o valor (a taxa de Pix é retida), o estorno
  total falha; estorne o disponível ou adicione saldo.

### Acesso de cortesia (testadores)
- Criado pelo admin em Configurações → cria assinatura `COURTESY` com acesso.
- Cortesia **não** é rebaixada por eventos do Asaas (guard no webhook).

## Variáveis relacionadas
`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BASE_URL`, `APP_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. Ver [`env-vars.md`](env-vars.md).
