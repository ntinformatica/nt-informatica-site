import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  throw new Error("dist/index.html nao encontrado. Rode o build do Vite antes de criar os fallbacks do admin.");
}

const indexHtml = fs.readFileSync(indexPath, "utf8");

const adminFallbackRoutes = [
  "admin",
  "admin/login",
  "admin/produtos",
  "admin/produtos/novo",
  "admin/produtos/editar",
  "admin/produtos/editar/123",
  "admin/categorias",
  "admin/arena",
  "admin/configuracoes",
  "admin/avaliacoes",
  "admin/conteudo",
];

for (const route of adminFallbackRoutes) {
  const routeDir = path.join(distDir, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, "index.html"), indexHtml, "utf8");
}

console.log(`Admin fallbacks criados: ${adminFallbackRoutes.length}`);
