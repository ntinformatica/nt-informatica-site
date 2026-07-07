# Painel Administrativo Inteligente - Fase 1

Esta fase cria somente a interface inicial do painel administrativo em `/admin`.

Nao ha integracao com Supabase, backend real ou publicacao automatica no catalogo publico.

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

## Rotas criadas

- `/admin/login`
- `/admin`
- `/admin/produtos`
- `/admin/produtos/novo`
- `/admin/produtos/editar/:id`
- `/admin/categorias`
- `/admin/arena`
- `/admin/configuracoes`

Tambem existem telas reservadas para:

- `/admin/avaliacoes`
- `/admin/conteudo`

## O que ja funciona

- Layout administrativo responsivo com sidebar, topo, cards, tabelas e formularios.
- Dashboard com resumo de produtos, destaques, esgotados, categorias, reservas e ultimas alteracoes.
- Lista de produtos com busca, filtro por categoria e filtro por status.
- Acoes visuais/locais: editar, excluir, duplicar, publicar e despublicar.
- Formulario de novo produto e edicao com os principais campos comerciais.
- Dados mockados salvos em `localStorage`, apenas no navegador do administrador.
- Modal visual do importador inteligente por link.

## O que ainda e prototipo

- Login nao possui autenticacao real.
- Produtos salvos no painel nao alteram o catalogo publico em `/produtos`.
- Reservas da Arena nao sao sincronizadas online.
- Importador por link ainda nao busca dados automaticamente.
- Nao ha controle de usuarios, permissoes ou auditoria real.

## Proximos passos para Supabase

1. Criar projeto Supabase.
2. Criar tabelas para produtos, categorias, variacoes, imagens, reservas, usuarios e logs.
3. Configurar autenticação do Supabase para `/admin/login`.
4. Trocar `localStorage` por consultas ao Supabase.
5. Criar regras RLS para proteger dados administrativos.
6. Definir fluxo de rascunho, revisao e publicacao no catalogo.

## Proximos passos para importador por link

1. Criar uma funcao segura para receber a URL.
2. Buscar nome, descricao, imagens, especificacoes, preco e variacoes.
3. Normalizar os dados para o formato interno da NT.
4. Criar rascunho editavel no painel.
5. Permitir revisao manual antes de publicar.

## Observacao importante

O painel da Fase 1 foi criado para acelerar ajustes futuros, mas o fluxo atual do site publico continua intacto:

- Home
- `/produtos`
- `/arena`
- Deploy Vercel
