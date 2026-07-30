# store-create-checkout

Edge Function da Fase 1 do e-commerce da NT Informatica para criar o pedido via RPC `create_store_order_from_cart` e iniciar o pagamento no Mercado Pago.

## Variaveis

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `SITE_URL`, opcional, seguindo o CORS compartilhado do projeto

## Testes locais sugeridos

Nao execute chamadas reais ao Mercado Pago sem autorizacao.

### OPTIONS

```bash
curl -i -X OPTIONS "http://127.0.0.1:54321/functions/v1/store-create-checkout"
```

### Metodo invalido

```bash
curl -i -X GET "http://127.0.0.1:54321/functions/v1/store-create-checkout"
```

### Body invalido

```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/store-create-checkout" \
  -H "Content-Type: application/json" \
  --data "{"
```

### Pix valido

```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/store-create-checkout" \
  -H "Content-Type: application/json" \
  --data '{
    "customer": {
      "customer_name": "Cliente Teste",
      "customer_phone": "(47) 99999-9999",
      "customer_phone_normalized": "47999999999",
      "customer_email": "cliente@example.com",
      "customer_document": "00000000000"
    },
    "items": [
      {
        "item_type": "product",
        "product_id": "00000000-0000-4000-8000-000000000001",
        "quantity": 1
      }
    ],
    "payment_method": "pix",
    "installments": 1,
    "idempotency_key": "store-local-pix-001"
  }'
```

### Cartao valido

```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/store-create-checkout" \
  -H "Content-Type: application/json" \
  --data '{
    "customer": {
      "customer_name": "Cliente Teste",
      "customer_phone": "(47) 99999-9999",
      "customer_phone_normalized": "47999999999",
      "customer_email": "cliente@example.com",
      "customer_document": "00000000000"
    },
    "items": [
      {
        "item_type": "assembled_pc",
        "assembled_pc_id": "00000000-0000-4000-8000-000000000002",
        "quantity": 1
      }
    ],
    "payment_method": "card",
    "installments": 3,
    "idempotency_key": "store-local-card-001",
    "card": {
      "token": "TOKEN_GERADO_PELO_SDK_DO_MERCADO_PAGO",
      "payment_method_id": "visa",
      "issuer_id": "24"
    }
  }'
```

### Cenarios cobertos pela validacao

- carrinho vazio;
- `idempotency_key` ausente;
- retry com mesma `idempotency_key`;
- falha temporaria do Mercado Pago;
- produto sem estoque retornado pela RPC;
- cartao sem documento;
- token de cartao ausente;
- tentativa de enviar preco adulterado, ignorada pela Function e recalculada pela RPC;
- resposta sem `customer_document`, `raw_response`, `metadata`, token de cartao, access token ou headers internos.
