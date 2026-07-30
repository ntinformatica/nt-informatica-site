# store-payment-webhook

Webhook do Mercado Pago para o nucleo financeiro do e-commerce da NT Informatica.

## Responsabilidade

1. Receber notificacoes do Mercado Pago.
2. Validar `x-signature` com `MERCADO_PAGO_WEBHOOK_SECRET`.
3. Consultar a Order oficial em `/v1/orders/{id}` usando `MERCADO_PAGO_ACCESS_TOKEN`.
4. Localizar `store_payments` por `external_reference`, com fallback para IDs Mercado Pago.
5. Registrar `store_payment_events`.
6. Chamar `public.confirm_store_payment(...)` somente quando o status oficial for aprovado.

## Variaveis

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `SITE_URL`, opcional, seguindo o CORS compartilhado do projeto

## Status tratados

- `approved`: chama `confirm_store_payment`, confirma pedido e baixa estoque pela RPC.
- `pending`, `processing`, `in_process`: registra evento e nao baixa estoque.
- `cancelled`, `rejected`, `expired`, `refunded`, `charged_back`: registra evento, atualiza snapshot do pagamento e nao baixa estoque.

Para status finais nao aprovados, o webhook mantem o `PATCH` em `store_payments` apenas para deixar o estado interno coerente com o provedor e facilitar auditoria operacional. Essa atualizacao nao chama `confirm_store_payment`, nao altera pedido para aprovado e nao baixa estoque.

## Como testar no painel Mercado Pago

Configure a URL da Function no painel Mercado Pago Developers:

```text
https://SEU-PROJETO.supabase.co/functions/v1/store-payment-webhook
```

Envie notificacoes de teste pelo painel. A Function deve responder `200` para eventos validos.

## Simulacao local

Para simular localmente com assinatura real, gere os headers `x-signature` e `x-request-id` conforme a documentacao do Mercado Pago usando o mesmo `MERCADO_PAGO_WEBHOOK_SECRET`.

Exemplo estrutural:

```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/store-payment-webhook" \
  -H "Content-Type: application/json" \
  -H "x-request-id: REQUEST_ID_VALIDO" \
  -H "x-signature: ts=TIMESTAMP,v1=ASSINATURA_VALIDA" \
  --data '{
    "type": "payment",
    "data": {
      "id": "ORDER_ID_DO_MERCADO_PAGO"
    }
  }'
```

## Como validar que confirm_store_payment foi chamada

Depois de receber um webhook aprovado:

```sql
select id, status, mercado_pago_payment_id, updated_at
from public.store_payments
where external_reference = 'EXTERNAL_REFERENCE_DO_PAGAMENTO';

select financial_status, operational_status, paid_at
from public.store_orders
where id = 'ORDER_ID_INTERNO';

select *
from public.store_payment_events
where payment_id = 'PAYMENT_ID_INTERNO'
order by created_at desc;

select *
from public.stock_movements
where movement_source = 'payment_function'
  and order_id = 'ORDER_ID_INTERNO'
order by created_at desc;
```

O pedido deve ficar `financial_status = 'approved'`, `operational_status = 'paid'`, as reservas de estoque devem ficar `committed` e os movimentos devem existir uma unica vez por `idempotency_key`.

## Cenarios cobertos

- Pix aprovado.
- Cartao aprovado.
- Pix pendente.
- Cartao pendente.
- Pix expirado.
- Pagamento rejeitado.
- Webhook duplicado.
- `external_reference` inexistente.
- Assinatura invalida.
