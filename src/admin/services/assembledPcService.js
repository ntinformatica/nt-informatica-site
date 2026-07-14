import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { readJson, slugify, writeJson } from "./localStorageHelpers";

const pcStorageKey = "nt-admin-assembled-pcs-v1";

function arrayFromText(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function textFromArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  return value || "";
}

function normalizeTextArray(value) {
  return arrayFromText(value);
}

function moneyOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim().replace(/[R$\s]/g, "");
  if (!raw) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot !== -1) {
    const [integerPart, decimalPart = ""] = raw.split(".");
    normalized = decimalPart.length === 3 && integerPart.length <= 3 ? raw.replace(/\./g, "") : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyForInput(value) {
  const parsed = moneyOrNull(value);
  if (parsed === null) return "";
  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fromSupabase(row) {
  const images = Array.isArray(row.images) ? row.images : [];
  const mainImage = row.main_image || images[0] || "";

  return {
    id: row.id,
    name: row.name || "",
    slug: row.slug || "",
    category: row.category || "",
    pcType: row.pc_type || "gamer_entrada",
    internalCode: row.internal_code || "",
    status: row.status || (row.published ? "publicado" : "rascunho"),
    shortDescription: row.short_description || "",
    fullDescription: row.full_description || "",
    processor: row.processor || "",
    processorCooler: row.processor_cooler || "",
    motherboard: row.motherboard || "",
    memory: row.memory || "",
    storage: row.storage || "",
    hardDrive: row.hard_drive || "",
    graphicsCard: row.graphics_card || "",
    powerSupply: row.power_supply || "",
    caseModel: row.case_model || "",
    cooling: row.cooling || "",
    fans: row.fans || "",
    operatingSystem: row.operating_system || "",
    windowsVersion: row.windows_version || "",
    wifi: Boolean(row.wifi),
    bluetooth: Boolean(row.bluetooth),
    rgb: Boolean(row.rgb),
    officeIncluded: Boolean(row.office_included),
    windowsIncluded: Boolean(row.windows_included),
    price: moneyForInput(row.price),
    promoPrice: moneyForInput(row.promo_price),
    stock: Number(row.stock || 0),
    warranty: row.warranty || "",
    warrantyMonths: Number(row.warranty_months || 3),
    targetUses: textFromArray(row.target_uses),
    recommendedGames: textFromArray(row.recommended_games),
    qualityChecks: textFromArray(row.quality_checks),
    mainImage,
    images: textFromArray(images),
    gallery: textFromArray(images.filter((image) => image !== mainImage)),
    featured: Boolean(row.featured),
    published: Boolean(row.published),
    internalNotes: row.internal_notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at,
    publishedAt: row.published_at || "",
  };
}

function normalizeLocalPc(pc = {}) {
  const images = [...new Set([pc.mainImage, ...arrayFromText(pc.images), ...arrayFromText(pc.gallery)].filter(Boolean))];

  return {
    ...pc,
    id: pc.id || slugify(pc.slug || pc.name) || `pc-${Date.now()}`,
    slug: pc.slug || slugify(pc.name),
    category: pc.category || "",
    pcType: pc.pcType || "gamer_entrada",
    internalCode: pc.internalCode || "",
    status: pc.status || (pc.published ? "publicado" : "rascunho"),
    price: pc.price ?? "",
    promoPrice: pc.promoPrice ?? "",
    stock: Number(pc.stock || 0),
    warrantyMonths: Number(pc.warrantyMonths || 3),
    mainImage: pc.mainImage || images[0] || "",
    images: textFromArray(images),
    gallery: textFromArray(images.slice(1)),
    featured: Boolean(pc.featured),
    published: Boolean(pc.published),
  };
}

function toSupabase(pc) {
  const images = [...new Set([pc.mainImage, ...arrayFromText(pc.images), ...arrayFromText(pc.gallery)].filter(Boolean))];
  const stock = Number(pc.stock || 0);
  const published = Boolean(pc.published);
  const status = pc.status || (published ? (stock > 0 ? "publicado" : "esgotado") : "rascunho");

  return {
    name: pc.name || "",
    slug: pc.slug || slugify(pc.name),
    category: pc.category || "",
    pc_type: pc.pcType || "gamer_entrada",
    internal_code: pc.internalCode || "",
    status,
    short_description: pc.shortDescription || "",
    full_description: pc.fullDescription || "",
    processor: pc.processor || "",
    processor_cooler: pc.processorCooler || "",
    motherboard: pc.motherboard || "",
    memory: pc.memory || "",
    storage: pc.storage || "",
    hard_drive: pc.hardDrive || "",
    graphics_card: pc.graphicsCard || "",
    power_supply: pc.powerSupply || "",
    case_model: pc.caseModel || "",
    cooling: pc.cooling || "",
    fans: pc.fans || "",
    operating_system: pc.operatingSystem || "",
    windows_version: pc.windowsVersion || "",
    wifi: Boolean(pc.wifi),
    bluetooth: Boolean(pc.bluetooth),
    rgb: Boolean(pc.rgb),
    office_included: Boolean(pc.officeIncluded),
    windows_included: Boolean(pc.windowsIncluded),
    price: moneyOrNull(pc.price),
    promo_price: moneyOrNull(pc.promoPrice),
    stock,
    warranty: pc.warranty || "",
    warranty_months: Number(pc.warrantyMonths || 3),
    target_uses: normalizeTextArray(pc.targetUses),
    recommended_games: normalizeTextArray(pc.recommendedGames),
    quality_checks: normalizeTextArray(pc.qualityChecks),
    main_image: pc.mainImage || images[0] || "",
    images,
    featured: Boolean(pc.featured),
    published,
    published_at: published ? (pc.publishedAt || new Date().toISOString()) : null,
    internal_notes: pc.internalNotes || "",
    updated_at: new Date().toISOString(),
  };
}

function readLocalPcs() {
  return readJson(pcStorageKey, []).map(normalizeLocalPc);
}

function writeLocalPcs(pcs) {
  writeJson(pcStorageKey, pcs.map(normalizeLocalPc));
}

export const pcCategories = [
  "Office",
  "Estudos",
  "Gamer de entrada",
  "Gamer intermediário",
  "Gamer avançado",
  "Streaming",
  "Edição",
  "High-End",
];

export const pcTypeOptions = [
  ["office", "Office"],
  ["estudos", "Estudos"],
  ["gamer_entrada", "Gamer de entrada"],
  ["gamer_intermediario", "Gamer intermediário"],
  ["gamer_avancado", "Gamer avançado"],
  ["streaming", "Streaming"],
  ["edicao", "Edição"],
  ["high_end", "High-End"],
];

export function pcTypeLabel(value) {
  return pcTypeOptions.find(([key]) => key === value)?.[1] || "Gamer de entrada";
}

export async function listAssembledPcs() {
  if (!isSupabaseConfigured) return readLocalPcs();

  try {
    const rows = await supabaseRequest("/assembled_pcs?select=*&order=updated_at.desc");
    return rows.map(fromSupabase);
  } catch (error) {
    console.warn("Nao foi possivel carregar PCs montados do Supabase:", error);
    return [];
  }
}

export async function listPublicAssembledPcs() {
  if (!isSupabaseConfigured) return [];

  try {
    const rows = await supabaseRequest("/assembled_pcs?published=eq.true&status=neq.desativado&select=*&order=featured.desc,updated_at.desc");
    return rows.map(fromSupabase);
  } catch (error) {
    console.warn("Nao foi possivel carregar PCs publicos do Supabase:", error);
    return [];
  }
}

export async function createAssembledPc(pc) {
  if (isSupabaseConfigured) {
    const [row] = await supabaseRequest("/assembled_pcs", {
      method: "POST",
      body: JSON.stringify(toSupabase(pc)),
    });
    return fromSupabase(row);
  }

  const pcs = readLocalPcs();
  const item = normalizeLocalPc({ ...pc, id: pc.id || slugify(pc.slug || pc.name) || `pc-${Date.now()}` });
  writeLocalPcs([item, ...pcs]);
  return item;
}

export async function updateAssembledPc(id, pc) {
  if (isSupabaseConfigured) {
    const [row] = await supabaseRequest(`/assembled_pcs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(toSupabase(pc)),
    });
    return fromSupabase(row);
  }

  const nextPcs = readLocalPcs().map((item) => (
    item.id === id ? normalizeLocalPc({ ...item, ...pc, id }) : item
  ));
  writeLocalPcs(nextPcs);
  return nextPcs.find((item) => item.id === id);
}

export async function deleteAssembledPc(id) {
  if (isSupabaseConfigured) {
    await supabaseRequest(`/assembled_pcs?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return;
  }

  writeLocalPcs(readLocalPcs().filter((item) => item.id !== id));
}

export async function updateAssembledPcPublished(id, published) {
  if (isSupabaseConfigured) {
    const [row] = await supabaseRequest(`/assembled_pcs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        published,
        status: published ? "publicado" : "rascunho",
        published_at: published ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    });
    return fromSupabase(row);
  }

  const pc = readLocalPcs().find((item) => item.id === id);
  if (!pc) return null;
  return updateAssembledPc(id, { ...pc, published });
}

export async function updateAssembledPcFeatured(id, featured) {
  if (isSupabaseConfigured) {
    const [row] = await supabaseRequest(`/assembled_pcs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ featured, updated_at: new Date().toISOString() }),
    });
    return fromSupabase(row);
  }

  const pc = readLocalPcs().find((item) => item.id === id);
  if (!pc) return null;
  return updateAssembledPc(id, { ...pc, featured });
}
