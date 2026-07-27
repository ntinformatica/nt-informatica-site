# Mercado Pago Pix na NT Arena Gamer

Esta etapa prepara a Arena para receber Pix online usando Supabase Edge Functions.

O site publico nao recebe nenhuma chave secreta. O navegador usa apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e a flag publica `VITE_ARENA_PIX_ENABLED`. O `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` ficam somente nos secrets das Edge Functions.

## Fluxo

1. Cliente escolhe data, equipamento, horario e duracao em `/arena`.
2. Se `VITE_ARENA_PIX_ENABLED=true`, aparece o botao `Pagar agora com Pix`.
3. O site cria uma pre-reserva via RPC `create_arena_pre_reservation`.
4. A Edge Function `create-mercado-pago-pix` cria uma order Pix no Mercado Pago.
5. O cliente e levado para `/arena/pagamento/{paymentId}`.
6. A tela mostra QR Code, Pix Copia e Cola, contagem regressiva e consulta status via `get-arena-payment-status`.
7. O webhook `mercado-pago-webhook` valida assinatura e confirma/cancela/expira o pagamento usando as RPCs seguras.
8. A reserva so muda para confirmada quando `confirm_arena_payment` processa o pagamento aprovado.

O botao antigo `Reservar` continua funcionando para o fluxo manual/loja/WhatsApp.

## Variaveis de ambiente da Vercel

Configure no projeto da Vercel:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica
VITE_ARENA_PIX_ENABLED=true
```

Use `false` em `VITE_ARENA_PIX_ENABLED` para esconder o Pix online sem remover codigo.

## Supabase Secrets

Configure no Supabase CLI:

```bash
supabase secrets set SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN="seu_access_token_do_mercado_pago"
supabase secrets set MERCADO_PAGO_WEBHOOK_SECRET="secret_do_webhook_do_mercado_pago"
supabase secrets set MERCADO_PAGO_WEBHOOK_URL="https://xxxxxxxxxxxx.functions.supabase.co/mercado-pago-webhook"
supabase secrets set ARENA_CRON_SECRET="gere_um_token_longo"
supabase secrets set SITE_URL="https://nt-informatica-site.vercel.app"
```

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` nem `MERCADO_PAGO_ACCESS_TOKEN` em `.env` publico, codigo fonte, Vercel frontend ou arquivos versionados.

## Deploy das Edge Functions

```bash
supabase functions deploy create-mercado-pago-pix
supabase functions deploy get-arena-payment-status
supabase functions deploy mercado-pago-webhook
supabase functions deploy expire-arena-pending
```

O arquivo `supabase/config.toml` deixa `mercado-pago-webhook` e `expire-arena-pending` com `verify_jwt = false`, pois o webhook e o agendador externo nao usam sessao de usuario. A seguranca fica por assinatura do Mercado Pago e `ARENA_CRON_SECRET`.

## Webhook do Mercado Pago

URL para cadastrar no painel do Mercado Pago:

```text
https://xxxxxxxxxxxx.functions.supabase.co/mercado-pago-webhook
```

Evento esperado para Orders: `orders`.

O webhook valida:

- header `x-signature`;
- header `x-request-id`;
- `data.id` / `data_id`;
- assinatura HMAC usando `MERCADO_PAGO_WEBHOOK_SECRET`.

## Expiracao de pre-reservas

Para expirar pre-reservas pendentes, chame periodicamente:

```bash
curl -X POST "https://xxxxxxxxxxxx.functions.supabase.co/expire-arena-pending" \
  -H "x-arena-cron-secret: SEU_ARENA_CRON_SECRET"
```

Sugestao inicial: a cada 5 minutos.

## Testes recomendados

1. Deixe `VITE_ARENA_PIX_ENABLED=false` e confirme que o fluxo manual continua igual.
2. Publique as functions e configure secrets.
3. Ative `VITE_ARENA_PIX_ENABLED=true` na Vercel.
4. Abra `/arena` em aba anonima.
5. Gere uma reserva Pix.
6. Confirme que abre `/arena/pagamento/{paymentId}`.
7. Confirme que QR Code ou Pix Copia e Cola aparecem.
8. Confirme que o horario fica bloqueado enquanto a pre-reserva esta pendente.
9. Simule pagamento aprovado no ambiente de teste do Mercado Pago.
10. Confirme que a reserva muda para `confirmado` no NT Admin.
11. Teste expiracao pelo endpoint `expire-arena-pending`.

## Observacoes

- Cartao nao foi implementado nesta etapa.
- O payload da Orders API esta isolado em `supabase/functions/_shared/mercadoPago.ts` para facilitar ajustes finos no sandbox do Mercado Pago.
- Se o Mercado Pago nao devolver QR Code em base64, a tela mantem o Pix Copia e Cola e exibe um fallback visual.
- O frontend publico nao consulta `arena_payments` diretamente; ele usa Edge Function para status e retorna apenas dados minimos.
