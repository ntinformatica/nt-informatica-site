import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(currentDir, "../vite.config.js");
const source = readFileSync(configPath, "utf8");
const fixed = source.replace(/base:\s*["']\.\/["']/, 'base: "/"');

if (fixed !== source) {
  writeFileSync(configPath, fixed);
  console.log('vite.config.js corrigido para base: "/"');
}
