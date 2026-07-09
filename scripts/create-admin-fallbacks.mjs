import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  throw new Error("dist/index.html nao encontrado. Rode o build do Vite antes de criar os fallbacks do admin.");
}

const indexHtml = fs.readFileSync(indexPath, "utf8");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key]) continue;
    process.env[key] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

function cleanEnvValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/^["']|["']$/g, "").trim();
}

function normalizeSupabaseUrl(value) {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return "";
  return cleaned.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function normalizeAnonKey(value) {
  return cleanEnvValue(value).replace(/\s+/g, "");
}

function isValidSupabaseUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function writeFallback(route) {
  const routeDir = path.join(distDir, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, "index.html"), indexHtml, "utf8");
}

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
  writeFallback(route);
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const supabaseUrl = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeAnonKey(process.env.VITE_SUPABASE_ANON_KEY);
let dynamicEditFallbacks = 0;

if (supabaseUrl && supabaseAnonKey && isValidSupabaseUrl(supabaseUrl)) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/products?select=id,slug`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const products = await response.json();
    for (const product of products) {
      for (const id of [product.id, product.slug].filter(Boolean)) {
        writeFallback(`admin/produtos/editar/${encodeURIComponent(id)}`);
        dynamicEditFallbacks += 1;
      }
    }
  } catch (error) {
    console.warn("Nao foi possivel criar fallbacks dinamicos de edicao do admin:", error.message);
  }
}

console.log(`Admin fallbacks criados: ${adminFallbackRoutes.length + dynamicEditFallbacks}`);
