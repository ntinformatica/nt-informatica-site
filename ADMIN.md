# Painel Administrativo Inteligente - Fase 2

Esta fase conecta o painel administrativo a uma camada de dados preparada para Supabase.

Se o Supabase nao estiver configurado, o painel continua funcionando com `localStorage`.

## Como acessar

Com o projeto rodando localmente:

```bash
npm run dev
```

Acesse:

```text
http://127.0.0.1:5173/admin
http://127.0.0.1:5173/admin/login
```

No deploy da Vercel:

```text
https://nt-informatica-site.vercel.app/admin
```

## Rotas

- `/admin/login`
- `/admin`
- `/admin/produtos`
- `/admin/produtos/novo`
- `/admin/produtos/editar/:id`
- `/admin/categorias`
- `/admin/arena`
- `/admin/configuracoes`

## O que ja funciona

- Layout administrativo responsivo.
- Dashboard com resumo de produtos e categorias.
- Produtos: listar, criar, editar, excluir, duplicar, publicar/despublicar e destacar.
- Categorias: listar, criar, editar e excluir.
- Integracao com Supabase via `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Fallback local quando o Supabase nao estiver configurado.
- Modal visual do importador inteligente por link.

## O que ainda e prototipo

- Login nao possui autenticacao real.
- Produtos salvos no painel ainda nao alteram o catalogo publico em `/produtos`.
- Reservas da Arena nao sao sincronizadas online.
- Importador por link ainda nao busca dados automaticamente.
- Nao ha controle de usuarios, permissoes ou auditoria real.

## Como configurar Supabase

1. Acesse `https://supabase.com`.
2. Crie um novo projeto.
3. Abra `SQL Editor`.
4. Cole e execute o conteudo de `supabase/schema.sql`.
5. Abra `Project Settings > API`.
6. Copie:
   - `Project URL`
   - `anon public key`
7. Crie um arquivo `.env.local` na raiz do projeto:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica
```

8. Rode o projeto:

```bash
npm run dev
```

9. Acesse `/admin/produtos` e `/admin/categorias`.

## Variaveis na Vercel

No painel da Vercel:

1. Abra o projeto.
2. Acesse `Settings > Environment Variables`.
3. Cadastre:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Salve para Production, Preview e Development se desejar.
5. Faca um novo deploy.

## SQL necessario

O arquivo esta em:

```text
supabase/schema.sql
```

Ele cria:

- `categories`
- `products`
- `product_variations`

Tambem cria indices, triggers de `updated_at` e categorias iniciais.

## Observacao de seguranca

Nesta fase o painel usa a chave `anon public` para operar as tabelas. Antes de usar em producao com varios usuarios, o ideal e implementar autenticacao real no Supabase, ativar RLS e criar politicas administrativas.

## Deploy na Vercel

O build cria fallbacks fisicos em `dist/admin/` para evitar 404 em acesso direto ao painel.

O `vercel.json` mantem:

- `/produtos` apontando para `/produtos/index.html`
- `/arena` apontando para `/arena/index.html`
- `/admin` e `/admin/:path*` apontando para `/index.html`
