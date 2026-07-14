import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(currentDir, "..");
const catalogPath = resolve(rootDir, "public/produtos/app.js");
const outputPath = resolve(rootDir, "supabase/import-public-products.sql");

function extractConstArray(source, constName) {
  const declaration = `const ${constName} =`;
  const start = source.indexOf(declaration);
  if (start === -1) throw new Error(`Nao encontrei ${declaration}`);

  const arrayStart = source.indexOf("[", start);
  if (arrayStart === -1) throw new Error(`Nao encontrei array de ${constName}`);

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(arrayStart, index + 1);
    }
  }

  throw new Error(`Array ${constName} nao foi fechado.`);
}

function evaluateArray(source, constName) {
  const literal = extractConstArray(source, constName);
  return normalizeTextValues(vm.runInNewContext(`(${literal})`, {}, { timeout: 1000 }));
}

function repairMojibake(value) {
  const replacementChar = String.fromCharCode(0xfffd);
  const manualFixes = [
    [new RegExp("mec" + replacementChar + "nicos", "g"), "mec\u00e2nicos"],
    [new RegExp("mec" + replacementChar + "nico", "g"), "mec\u00e2nico"],
    [new RegExp("Mec" + replacementChar + "nico", "g"), "Mec\u00e2nico"],
    [new RegExp("escrit" + replacementChar + "rio", "g"), "escrit\u00f3rio"],
    [new RegExp("conex" + replacementChar + "o", "g"), "conex\u00e3o"],
    [new RegExp("ilumina" + replacementChar + replacementChar + "o", "g"), "ilumina\u00e7\u00e3o"],
    [new RegExp("multim" + replacementChar + "dia", "g"), "multim\u00eddia"],
    [new RegExp("precis" + replacementChar + "o", "g"), "precis\u00e3o"],
    [new RegExp("digita" + replacementChar + replacementChar + "o", "g"), "digita\u00e7\u00e3o"],
    [new RegExp("padr" + replacementChar + "o", "g"), "padr\u00e3o"],
    [new RegExp("op" + replacementChar + replacementChar + "o", "g"), "op\u00e7\u00e3o"],
    [new RegExp("pr" + replacementChar + "tica", "g"), "pr\u00e1tica"],
    [new RegExp("m" + replacementChar + "os", "g"), "m\u00e3os"],
    [new RegExp("Imped" + replacementChar + "ncia", "g"), "Imped\u00e2ncia"],
    [new RegExp(replacementChar + "udio", "g"), "\u00e1udio"],
    [new RegExp(replacementChar + "ngulo", "g"), "\u00c2ngulo"],
    [new RegExp("vis" + replacementChar + "o", "g"), "vis\u00e3o"],
    [new RegExp("178" + replacementChar, "g"), "178\u00b0"],
    [new RegExp("v" + replacementChar + "deo", "g"), "v\u00eddeo"],
    [new RegExp("m" + replacementChar + "vel", "g"), "m\u00f3vel"],
    [new RegExp("met" + replacementChar + "lica", "g"), "met\u00e1lica"],
    [new RegExp("respir" + replacementChar + "vel", "g"), "respir\u00e1vel"],
    [new RegExp("panor" + replacementChar + "mico", "g"), "panor\u00e2mico"],
    [new RegExp(replacementChar + " 10%", "g"), "\u00b1 10%"],
    [new RegExp(replacementChar + " 15%", "g"), "\u00b1 15%"],
    [new RegExp("64 " + replacementChar + " 15%", "g"), "64 \u00b1 15%"],
    [new RegExp("17 " + replacementChar + " 15", "g"), "17 \u00b1 15"],
  ];
  let fixed = value;

  if (new RegExp("[\\u00c3\\u00c2\\u00e2]").test(fixed)) {
    try {
      fixed = Buffer.from(fixed, "latin1").toString("utf8");
    } catch {
      fixed = value;
    }
  }

  for (const [pattern, replacementValue] of manualFixes) {
    fixed = fixed.replace(pattern, replacementValue);
  }

  return fixed;
}

function normalizeTextValues(value) {
  if (typeof value === "string") return repairMojibake(value);
  if (Array.isArray(value)) return value.map(normalizeTextValues);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeTextValues(entry)]),
    );
  }
  return value;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numberFromCurrency(value) {
  if (!value) return null;
  const match = String(value).match(/[\d.,]+/);
  if (!match) return null;
  const normalized = match[0].replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  const parsed = numberFromCurrency(value);
  return parsed === null ? "null" : parsed.toFixed(2);
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlArray(values = []) {
  const cleanValues = values.filter(Boolean);
  if (!cleanValues.length) return "'{}'::text[]";
  return `array[${cleanValues.map(sqlString).join(", ")}]::text[]`;
}

function fullDescription(product) {
  const blocks = [product.description].filter(Boolean);
  if (Array.isArray(product.specs) && product.specs.length) {
    blocks.push(`Especificações:\n${product.specs.map((spec) => `- ${spec}`).join("\n")}`);
  }
  return blocks.join("\n\n");
}

function productPrice(product) {
  return product.installmentText || product.price;
}

function categoryIcon(path) {
  if (!path) return "";
  return path.replace("../category-assets/", "/category-assets/");
}

const source = readFileSync(catalogPath, "utf8");
const categories = evaluateArray(source, "categories");
const products = evaluateArray(source, "products");

const categoryRows = categories.map(([name, description, icon], index) => ({
  name,
  slug: slugify(name),
  description,
  icon: categoryIcon(icon),
  sortOrder: index + 1,
}));

const importedAt = new Date().toISOString();
const lines = [
  "-- Importacao gerada automaticamente a partir de public/produtos/app.js",
  `-- Gerado em ${importedAt}`,
  "-- Seguro para executar mais de uma vez: categorias e produtos usam slug; variacoes usam verificacao por produto + nome/cor/sku.",
  "",
  "begin;",
  "",
  "insert into public.categories (name, slug, description, icon, sort_order, active)",
  "values",
  categoryRows
    .map((category) => `  (${sqlString(category.name)}, ${sqlString(category.slug)}, ${sqlString(category.description)}, ${sqlString(category.icon)}, ${category.sortOrder}, true)`)
    .join(",\n"),
  "on conflict (slug) do update set",
  "  name = excluded.name,",
  "  description = excluded.description,",
  "  icon = excluded.icon,",
  "  sort_order = excluded.sort_order,",
  "  active = excluded.active;",
  "",
];

for (const product of products) {
  const slug = slugify(product.id || product.name);
  const categorySlug = slugify(product.category);
  const images = Array.isArray(product.images) ? product.images : [];

  lines.push(
    `-- Produto: ${product.name}`,
    "insert into public.products (",
    "  name, slug, category_id, brand, model, short_description, full_description,",
    "  price, promo_price, status, stock, featured, sku, warranty, main_image, images, internal_notes",
    ")",
    "values (",
    [
      `  ${sqlString(product.name)}`,
      `  ${sqlString(slug)}`,
      `  (select id from public.categories where slug = ${sqlString(categorySlug)} limit 1)`,
      `  ${sqlString(product.brand || product.symbol || "")}`,
      `  ${sqlString(product.model || "")}`,
      `  ${sqlString(product.summary || "")}`,
      `  ${sqlString(fullDescription(product))}`,
      `  ${sqlNumber(productPrice(product))}`,
      `  ${sqlNumber(product.cashPrice)}`,
      `  ${sqlString(product.status || "disponível")}`,
      `  ${Number(product.stock || 0)}`,
      `  ${sqlBoolean(Boolean(product.featured))}`,
      `  ${sqlString(product.sku || product.id || slug)}`,
      `  ${sqlString(product.warranty || "Consultar garantia na loja")}`,
      `  ${sqlString(product.mainImage || images[0] || "")}`,
      `  ${sqlArray(images)}`,
      `  ${sqlString("Importado do catalogo publico em public/produtos/app.js")}`,
    ].join(",\n"),
    ")",
    "on conflict (slug) do update set",
    "  name = excluded.name,",
    "  category_id = excluded.category_id,",
    "  brand = excluded.brand,",
    "  model = excluded.model,",
    "  short_description = excluded.short_description,",
    "  full_description = excluded.full_description,",
    "  price = excluded.price,",
    "  promo_price = excluded.promo_price,",
    "  status = excluded.status,",
    "  stock = excluded.stock,",
    "  featured = excluded.featured,",
    "  sku = excluded.sku,",
    "  warranty = excluded.warranty,",
    "  main_image = excluded.main_image,",
    "  images = excluded.images,",
    "  internal_notes = excluded.internal_notes;",
    "",
  );

  if (Array.isArray(product.variants) && product.variants.length) {
    for (const variant of product.variants) {
      const variantImages = Array.isArray(variant.images) ? variant.images : images;
      const variantSku = variant.sku || `${product.id || slug}-${slugify(variant.name || variant.color || "variacao")}`;
      lines.push(
        "insert into public.product_variations (",
        "  product_id, name, value, color, price, promo_price, stock, sku, image, images, active, status",
        ")",
        "select",
        `  p.id, ${sqlString(variant.name || variant.color || "Variação")}, ${sqlString(variant.value || variant.name || variant.color || "")},`,
        `  ${sqlString(variant.color || variant.name || "")}, ${sqlNumber(productPrice(variant))}, ${sqlNumber(variant.cashPrice)},`,
        `  ${Number(variant.stock || 0)}, ${sqlString(variantSku)}, ${sqlString(variant.mainImage || variantImages[0] || "")},`,
        `  ${sqlArray(variantImages)}, ${sqlBoolean(variant.active !== false)}, ${sqlString(variant.active === false ? "inativo" : "ativo")}`,
        `from public.products p where p.slug = ${sqlString(slug)}`,
        "and not exists (",
        "  select 1 from public.product_variations existing",
        "  where existing.product_id = p.id",
        `    and coalesce(existing.sku, '') = ${sqlString(variantSku)}`,
        `    and coalesce(existing.name, '') = ${sqlString(variant.name || variant.color || "Variação")}`,
        `    and coalesce(existing.color, '') = ${sqlString(variant.color || variant.name || "")}`,
        ");",
        "",
      );
    }
  }
}

lines.push("commit;", "");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Categorias exportadas: ${categories.length}`);
console.log(`Produtos exportados: ${products.length}`);
console.log(`Arquivo gerado: ${outputPath}`);
