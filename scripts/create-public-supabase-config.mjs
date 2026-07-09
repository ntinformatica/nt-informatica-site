import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
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
  return String(value)
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function normalizeSupabaseUrl(value) {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return "";
  return cleaned.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function normalizeAnonKey(value) {
  return cleanEnvValue(value).replace(/\s+/g, "");
}

const configPath = resolve("public/produtos/supabase-config.js");
loadEnvFile(resolve(".env"));
loadEnvFile(resolve(".env.local"));

const config = {
  url: normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL),
  anonKey: normalizeAnonKey(process.env.VITE_SUPABASE_ANON_KEY),
};

mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(
  configPath,
  `window.NT_SUPABASE_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
);

console.log(config.url && config.anonKey
  ? "Config publica do Supabase criada para /produtos."
  : "Config publica do Supabase criada vazia; /produtos usara fallback local.");
