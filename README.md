# NT Informatica, Celulares e Games

Site institucional e vitrine de produtos da NT Informatica, Celulares e Games.

## Tecnologia

Este projeto usa:

- React
- Vite
- Tailwind CSS
- Lucide React
- Paginas estaticas em `public/produtos` e `public/arena`

O build final e gerado na pasta `dist`.

## Instalar dependencias

Com npm:

```bash
npm install
```

Se preferir usar pnpm, o projeto tambem possui `pnpm-lock.yaml`:

```bash
pnpm install
```

## Rodar localmente

```bash
npm run dev
```

Depois acesse o endereco exibido no terminal, normalmente:

```text
http://127.0.0.1:5173/
```

## Gerar build de producao

```bash
npm run build
```

O site pronto para publicar fica em:

```text
dist/
```

## Visualizar o build

```bash
npm run preview
```

## Estrutura principal

```text
src/
  App.jsx
  admin/
  data/siteData.js
  components/
public/
  arena/
  produtos/
  category-assets/
dist/
  gerado pelo build
```

## Onde editar informacoes da loja

- Dados gerais, WhatsApp, links, servicos e categorias: `src/data/siteData.js`
- Produtos da vitrine: `public/produtos/app.js`
- Agenda da Arena Gamer: `public/arena/app.js`
- Pagina da Arena Gamer: `public/arena/index.html`
- Painel administrativo visual: `src/admin/`

## Painel administrativo

A Fase 1 do painel fica disponivel em:

```text
/admin
/admin/login
```

O painel usa dados mockados e `localStorage` apenas para prototipo. Ele ainda nao altera o catalogo publico e nao possui Supabase/backend real.

Leia mais em `ADMIN.md`.

## Publicar na Vercel

1. Envie esta pasta para um repositorio no GitHub.
2. Acesse `https://vercel.com`.
3. Clique em `Add New Project`.
4. Importe o repositorio.
5. Confira as configuracoes:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
6. Clique em `Deploy`.
7. Depois, em `Settings > Domains`, adicione o dominio proprio.

O arquivo `vercel.json` ja deixa essas configuracoes prontas.

## Publicar na Netlify

1. Envie esta pasta para um repositorio no GitHub.
2. Acesse `https://netlify.com`.
3. Clique em `Add new site > Import an existing project`.
4. Importe o repositorio.
5. Confira as configuracoes:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Clique em `Deploy site`.
7. Depois, em `Domain management`, adicione o dominio proprio.

O arquivo `netlify.toml` ja deixa essas configuracoes prontas.

## Publicar no GitHub Pages

Este projeto esta configurado com `base: "./"` no Vite, entao o build tambem funciona em subpastas do GitHub Pages.

Passo a passo:

1. Rode:

```bash
npm run build
```

2. Publique o conteudo da pasta `dist` no GitHub Pages.
3. Se usar GitHub Actions, configure o workflow para gerar o build e publicar `dist`.
4. O arquivo `public/.nojekyll` evita problemas com arquivos iniciados por ponto.

## Variaveis de ambiente

Hoje o projeto nao exige variaveis de ambiente.

Existe um arquivo `.env.example` apenas para documentar isso e deixar preparado para integracoes futuras.

## Observacoes de deploy

- A pagina principal e React/Vite.
- A vitrine de produtos em `/produtos/index.html` e estatica.
- A agenda da Arena em `/arena/index.html` e estatica.
- O projeto nao usa backend nem banco de dados no momento.
- As reservas da Arena ainda ficam salvas no navegador/localStorage, nao em banco online.
