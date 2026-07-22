# Revisão final da migração Supabase Auth + RLS

Nenhum SQL remoto foi executado. Não houve commit nem push.

## Arquivos alterados

- `supabase/security-rls.sql`
- `supabase/security-rls-report.md`
- `public/arena/app.js`

## Objetivo da migração

A migração cria uma camada de autorização real baseada em Supabase Auth, com uma tabela `public.admin_users` e a função `public.is_admin()`. O painel Admin continua usando a anon key no frontend, mas as operações administrativas passam a depender de sessão autenticada e de policies RLS que verificam se `auth.uid()` está cadastrado como administrador.

Administrador cadastrado na migração:

- E-mail: `umjogadordanka@gmail.com`
- UUID: `2b7a321d-47c8-4056-b285-7941dd8fd00f`

Nenhuma senha foi colocada em código, SQL ou documentação.

## Estrutura criada para `public.admin_users`

```sql
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
```

A tabela tem RLS habilitado e não recebe GRANT direto para `anon` ou `authenticated`. A função `public.is_admin()` usa `SECURITY DEFINER` e consulta essa tabela com schema qualificado para evitar recursão de RLS.

## Como `public.is_admin()` funciona

`public.is_admin()` retorna `true` apenas quando `auth.uid()` existe em `public.admin_users`. Se não houver sessão, `auth.uid()` é `null` e a função retorna `false`. A função não recebe UUID ou e-mail do cliente como parâmetro.

## Tabelas reais cobertas

As policies foram escritas para os nomes reais informados para o banco:

- `public."notificações_administrativas"`
- `public.arena_credit_movements`
- `public."assinaturas_de_clientes_da_arena"`
- `public."clientes_da_arena"`
- `public."planos_mensais_da_arena"`
- `public."pacotes_da_arena"`
- `public."reservas_de_arena"`
- `public."configurações_da_arena"`
- `public."manutenção_da_estação_da_arena"`
- `public."estações_da_arena"`
- `public."peças_montadas"`
- `public.categorias`
- `public."variações_do_produto"`
- `public.produtos`
- `public."movimentos_de_ações"`

## Colunas validadas localmente

Os arquivos SQL locais ainda possuem parte das tabelas com nomes em inglês, mas confirmam a existência funcional destas colunas usadas nas policies:

- `categorias`: `active`
- `produtos`: `status`
- `variações_do_produto`: `active`, `status`, `product_id`
- `peças_montadas`: `published`, `status`
- `estações_da_arena`: `active`, `availability_status`
- `configurações_da_arena`: policy pública sem filtro de coluna
- `pacotes_da_arena`: `active`
- `planos_mensais_da_arena`: `active`
- `reservas_de_arena`: `station_id`, `reservation_date`, `start_time`, `end_time`, `status`, `session_status`

As tabelas privadas administrativas não usam colunas específicas nas policies, apenas `public.is_admin()`.

## Policies públicas

Leitura pública mantida para:

- `categorias`: somente `active is true`
- `produtos`: produtos que não estejam em `rascunho`, `despublicado`, `inativo`, `desativado`, `draft` ou `unpublished`
- `variações_do_produto`: variações ativas de produtos públicos
- `peças_montadas`: PCs publicados e não desativados/rascunho
- `estações_da_arena`: equipamentos ativos que não estejam em manutenção ou inativos
- `configurações_da_arena`: leitura pública necessária para a Arena
- `pacotes_da_arena`: somente pacotes ativos
- `planos_mensais_da_arena`: somente planos ativos

Não há SELECT público direto para:

- clientes da Arena
- reservas completas
- assinaturas de clientes
- movimentos de crédito
- movimentos de estoque
- notificações administrativas
- manutenção

## Policies administrativas

Todas as tabelas administrativas receberam policies de:

- SELECT administrativo
- INSERT administrativo
- UPDATE administrativo
- DELETE administrativo

Sempre para `authenticated` e sempre com:

```sql
using (public.is_admin())
with check (public.is_admin())
```

Usuários autenticados comuns recebem GRANT SQL, mas não passam pelas policies se não estiverem em `public.admin_users`.

## GRANTs e REVOKEs aplicados

`anon`:

- recebe SELECT somente nas tabelas públicas necessárias;
- recebe EXECUTE somente nas RPCs públicas;
- não recebe INSERT, UPDATE ou DELETE em tabelas administrativas.

`authenticated`:

- recebe SELECT nas tabelas públicas necessárias;
- recebe SELECT/INSERT/UPDATE/DELETE nas tabelas administrativas, controlados por RLS;
- recebe EXECUTE nas RPCs públicas e administrativas permitidas.

`service_role`:

- mantém privilégios administrativos.

## RPCs públicas liberadas

- `public.normalize_arena_phone(text)`
- `public.find_arena_customer_plan_by_phone(text)`
- `public.arena_has_active_maintenance(uuid, timestamptz, timestamptz)`
- `public.create_arena_reservation(uuid, text, text, date, time, integer, text, text, uuid)`
- `public.list_public_arena_busy_slots(date)`

## RPC/view segura para disponibilidade pública

`public.list_public_arena_busy_slots(date)` retorna apenas:

- `station_id`
- `reservation_date`
- `start_time`
- `end_time`
- `status`

Ela não retorna nome, telefone, cliente, e-mail, assinatura, observações ou valores pagos.

## RPC segura para plano mensal público

`public.find_arena_customer_plan_by_phone(text)` foi recriada para retornar somente dados seguros:

- `has_plan`
- `has_active_plan`
- `has_balance`
- `expired`
- `plan_name`
- `remaining_minutes`
- `expiration_date`

Ela não retorna nome do cliente, telefone, e-mail, histórico, valor pago, observações internas ou IDs administrativos.

## Frontend alterado

Em `public/arena/app.js`, a busca de plano mensal deixou de fazer SELECT direto em:

- `arena_customer_subscriptions`
- `arena_customers`
- `arena_monthly_plans`

Agora a página pública chama apenas:

```text
/rpc/find_arena_customer_plan_by_phone
```

## RPCs administrativas protegidas

As RPCs administrativas abaixo são concedidas apenas para `authenticated` e são convertidas para `SECURITY INVOKER`, para que GRANT + RLS filtrem o acesso pelo usuário autenticado:

- `activate_arena_subscription`
- `adjust_arena_credits`
- `consume_arena_credits`
- `refund_arena_credits`
- `update_arena_reservation_status`
- `create_arena_block`
- `start_arena_session`
- `pause_arena_session`
- `resume_arena_session`
- `end_arena_session`
- `create_arena_station_maintenance`
- `finish_arena_station_maintenance`
- `cancel_arena_station_maintenance`
- `create_or_find_arena_customer`

## Operações do Admin que devem continuar funcionando

Com login Supabase Auth válido e UUID cadastrado em `public.admin_users`, devem continuar funcionando:

- criar, editar, excluir, publicar/despublicar e destacar produtos;
- criar, editar e excluir categorias;
- movimentar estoque;
- criar, editar e excluir PCs montados;
- gerenciar equipamentos da Arena;
- gerenciar configurações e pacotes;
- criar reserva manual;
- bloquear horário;
- confirmar, cancelar e concluir reservas;
- gerenciar clientes, assinaturas e créditos;
- gerenciar manutenções;
- marcar notificações como lidas/dispensadas.

## Consultas SQL de validação antes da migração

```sql
select to_regclass('public.admin_users') as admin_users;

select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'notificações_administrativas',
    'arena_credit_movements',
    'assinaturas_de_clientes_da_arena',
    'clientes_da_arena',
    'planos_mensais_da_arena',
    'pacotes_da_arena',
    'reservas_de_arena',
    'configurações_da_arena',
    'manutenção_da_estação_da_arena',
    'estações_da_arena',
    'peças_montadas',
    'categorias',
    'variações_do_produto',
    'produtos',
    'movimentos_de_ações'
  )
order by table_name;

select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'categorias',
    'produtos',
    'variações_do_produto',
    'peças_montadas',
    'estações_da_arena',
    'pacotes_da_arena',
    'planos_mensais_da_arena',
    'reservas_de_arena'
  )
  and column_name in (
    'active',
    'status',
    'published',
    'availability_status',
    'product_id',
    'station_id',
    'reservation_date',
    'start_time',
    'end_time',
    'session_status'
  )
order by table_name, column_name;

select routine_schema, routine_name, data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'normalize_arena_phone',
    'find_arena_customer_plan_by_phone',
    'arena_has_active_maintenance',
    'create_arena_reservation',
    'list_public_arena_busy_slots',
    'activate_arena_subscription',
    'adjust_arena_credits',
    'consume_arena_credits',
    'refund_arena_credits',
    'update_arena_reservation_status',
    'create_arena_block',
    'start_arena_session',
    'pause_arena_session',
    'resume_arena_session',
    'end_arena_session',
    'create_arena_station_maintenance',
    'finish_arena_station_maintenance',
    'cancel_arena_station_maintenance',
    'create_or_find_arena_customer'
  )
order by routine_name;
```

## SQL de rollback

```sql
begin;

revoke execute on function public.is_admin() from authenticated, service_role;
drop function if exists public.is_admin();

drop policy if exists categories_public_select_active on public.categorias;
drop policy if exists categories_admin_select on public.categorias;
drop policy if exists categories_admin_insert on public.categorias;
drop policy if exists categories_admin_update on public.categorias;
drop policy if exists categories_admin_delete on public.categorias;

drop policy if exists products_public_select_published on public.produtos;
drop policy if exists products_admin_select on public.produtos;
drop policy if exists products_admin_insert on public.produtos;
drop policy if exists products_admin_update on public.produtos;
drop policy if exists products_admin_delete on public.produtos;

drop policy if exists product_variations_public_select_active on public."variações_do_produto";
drop policy if exists product_variations_admin_select on public."variações_do_produto";
drop policy if exists product_variations_admin_insert on public."variações_do_produto";
drop policy if exists product_variations_admin_update on public."variações_do_produto";
drop policy if exists product_variations_admin_delete on public."variações_do_produto";

drop policy if exists assembled_pcs_public_select_published on public."peças_montadas";
drop policy if exists assembled_pcs_admin_select on public."peças_montadas";
drop policy if exists assembled_pcs_admin_insert on public."peças_montadas";
drop policy if exists assembled_pcs_admin_update on public."peças_montadas";
drop policy if exists assembled_pcs_admin_delete on public."peças_montadas";

drop policy if exists arena_stations_public_select_available on public."estações_da_arena";
drop policy if exists arena_stations_admin_select on public."estações_da_arena";
drop policy if exists arena_stations_admin_insert on public."estações_da_arena";
drop policy if exists arena_stations_admin_update on public."estações_da_arena";
drop policy if exists arena_stations_admin_delete on public."estações_da_arena";

drop policy if exists arena_settings_public_select on public."configurações_da_arena";
drop policy if exists arena_settings_admin_select on public."configurações_da_arena";
drop policy if exists arena_settings_admin_insert on public."configurações_da_arena";
drop policy if exists arena_settings_admin_update on public."configurações_da_arena";
drop policy if exists arena_settings_admin_delete on public."configurações_da_arena";

drop policy if exists arena_packages_public_select_active on public."pacotes_da_arena";
drop policy if exists arena_packages_admin_select on public."pacotes_da_arena";
drop policy if exists arena_packages_admin_insert on public."pacotes_da_arena";
drop policy if exists arena_packages_admin_update on public."pacotes_da_arena";
drop policy if exists arena_packages_admin_delete on public."pacotes_da_arena";

drop policy if exists arena_monthly_plans_public_select_active on public."planos_mensais_da_arena";
drop policy if exists arena_monthly_plans_admin_select on public."planos_mensais_da_arena";
drop policy if exists arena_monthly_plans_admin_insert on public."planos_mensais_da_arena";
drop policy if exists arena_monthly_plans_admin_update on public."planos_mensais_da_arena";
drop policy if exists arena_monthly_plans_admin_delete on public."planos_mensais_da_arena";

drop policy if exists stock_movements_admin_select on public."movimentos_de_ações";
drop policy if exists stock_movements_admin_insert on public."movimentos_de_ações";
drop policy if exists stock_movements_admin_update on public."movimentos_de_ações";
drop policy if exists stock_movements_admin_delete on public."movimentos_de_ações";

drop policy if exists arena_customers_admin_select on public."clientes_da_arena";
drop policy if exists arena_customers_admin_insert on public."clientes_da_arena";
drop policy if exists arena_customers_admin_update on public."clientes_da_arena";
drop policy if exists arena_customers_admin_delete on public."clientes_da_arena";

drop policy if exists arena_subscriptions_admin_select on public."assinaturas_de_clientes_da_arena";
drop policy if exists arena_subscriptions_admin_insert on public."assinaturas_de_clientes_da_arena";
drop policy if exists arena_subscriptions_admin_update on public."assinaturas_de_clientes_da_arena";
drop policy if exists arena_subscriptions_admin_delete on public."assinaturas_de_clientes_da_arena";

drop policy if exists arena_credit_movements_admin_select on public.arena_credit_movements;
drop policy if exists arena_credit_movements_admin_insert on public.arena_credit_movements;
drop policy if exists arena_credit_movements_admin_update on public.arena_credit_movements;
drop policy if exists arena_credit_movements_admin_delete on public.arena_credit_movements;

drop policy if exists arena_reservations_admin_select on public."reservas_de_arena";
drop policy if exists arena_reservations_admin_insert on public."reservas_de_arena";
drop policy if exists arena_reservations_admin_update on public."reservas_de_arena";
drop policy if exists arena_reservations_admin_delete on public."reservas_de_arena";

drop policy if exists arena_maintenance_admin_select on public."manutenção_da_estação_da_arena";
drop policy if exists arena_maintenance_admin_insert on public."manutenção_da_estação_da_arena";
drop policy if exists arena_maintenance_admin_update on public."manutenção_da_estação_da_arena";
drop policy if exists arena_maintenance_admin_delete on public."manutenção_da_estação_da_arena";

drop policy if exists admin_notifications_admin_select on public."notificações_administrativas";
drop policy if exists admin_notifications_admin_insert on public."notificações_administrativas";
drop policy if exists admin_notifications_admin_update on public."notificações_administrativas";
drop policy if exists admin_notifications_admin_delete on public."notificações_administrativas";

drop table if exists public.admin_users;

commit;
```

## Pendências e riscos restantes

1. Os arquivos SQL locais ainda possuem nomes antigos em inglês para algumas tabelas, enquanto o banco real usa nomes em português. A migração foi feita com os nomes reais informados, mas a validação definitiva deve ser feita no Supabase SQL Editor com as consultas acima.
2. Se alguma função RPC administrativa no banco real tiver assinatura diferente da registrada localmente, o `alter function if exists`/`grant execute` correspondente não afetará essa sobrecarga. A consulta de validação de rotinas deve ser executada antes da migração.
3. A autenticação visual do Admin já valida UUID no frontend, mas a autorização real passa a ser `public.is_admin()` após aplicar a migração.
4. No painel Supabase, recomenda-se desativar `Authentication -> Allow new users to sign up`.
5. Após aplicar RLS, testar primeiro login admin, listagem de produtos, edição simples e uma reserva da Arena antes de operar a loja normalmente.
