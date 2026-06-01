# Checkout do Destravai Completo

## Oferta ativa

- Plano interno: `destravai_completo`
- Primeiro mes: R$29,90
- Recorrencia: R$49,90 por mes a partir do segundo ciclo
- Sem fidelidade
- Cancelamento quando quiser

## Fluxo Asaas

O checkout nao depende mais de selecao entre planos. Todo CTA envia o usuario para `/checkout`, que chama `/.netlify/functions/asaas-create-checkout`.

Como o preco do primeiro ciclo e diferente da mensalidade recorrente, o fluxo seguro implementado e:

1. Criar ou reutilizar o usuario no Supabase Auth pelo e-mail informado.
2. Criar ou reutilizar o customer no Asaas.
3. Criar uma cobranca inicial avulsa de R$29,90.
4. Registrar a assinatura local em `subscriptions` com `plan_id = 'destravai_completo'`, `status = 'pending'` e `payment_status = 'pending'`.
5. Quando o webhook receber pagamento aprovado, liberar o acesso e criar a assinatura mensal recorrente de R$49,90 no Asaas com vencimento para o mes seguinte.

Se a criacao da recorrencia falhar depois do pagamento aprovado, o acesso do usuario pago ainda e liberado e o erro e registrado em `server_logs` para correcao operacional.

## Webhook

`asaas-webhook` reconhece eventos de pagamento aprovado, pendente, vencido, cancelado, estornado e eventos de assinatura cancelada/inativada. Pagamento aprovado ativa o acesso; cancelamento, atraso ou estorno removem o acesso conforme o status retornado pelas funcoes de assinatura.

## Usuarios antigos

A migration `202606010009_single_subscription_offer.sql` desativa os planos antigos em `destravai_plans`, migra `subscriptions.plan_id` e `destravai_profiles.plan` para `destravai_completo`, e preserva assinaturas de cortesia criadas pelo admin `assessoriadbe@gmail.com`.
