import { isSupabaseConfigured, supabaseRequest } from "../lib/supabase";
import { readJson, writeJson } from "../admin/services/localStorageHelpers";

export const contentTypes = [
  ["youtube_nt", "YouTube NT"],
  ["youtube_gaming", "YouTube Gaming"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["link_externo", "Link externo"],
];

export const defaultSiteContentCards = [
  {
    slotKey: "maintenance_latest",
    title: "Últimos vídeos de manutenção",
    description: "",
    targetUrl: "",
    imageUrl: "",
    buttonLabel: "Assistir",
    contentType: "youtube_nt",
    active: true,
    sortOrder: 1,
  },
  {
    slotKey: "gaming_live",
    title: "Lives da NT Gaming",
    description: "",
    targetUrl: "",
    imageUrl: "",
    buttonLabel: "Assistir",
    contentType: "youtube_gaming",
    active: true,
    sortOrder: 2,
  },
  {
    slotKey: "store_backstage",
    title: "Bastidores da loja",
    description: "",
    targetUrl: "",
    imageUrl: "",
    buttonLabel: "Assistir",
    contentType: "instagram",
    active: true,
    sortOrder: 3,
  },
  {
    slotKey: "pc_tests",
    title: "Testes de PCs e games",
    description: "",
    targetUrl: "",
    imageUrl: "",
    buttonLabel: "Assistir",
    contentType: "youtube_gaming",
    active: true,
    sortOrder: 4,
  },
];

const storageKey = "nt-site-content-cards-v1";

function normalizeCard(card = {}, index = 0) {
  const fallback = defaultSiteContentCards[index] || defaultSiteContentCards[0];
  return {
    id: card.id || card.slot_key || card.slotKey || fallback.slotKey,
    slotKey: card.slot_key || card.slotKey || fallback.slotKey,
    title: card.title || fallback.title,
    description: card.description || "",
    targetUrl: card.target_url || card.targetUrl || "",
    imageUrl: card.image_url || card.imageUrl || "",
    buttonLabel: card.button_label || card.buttonLabel || "Assistir",
    contentType: card.content_type || card.contentType || fallback.contentType,
    active: card.active !== false,
    sortOrder: Number(card.sort_order ?? card.sortOrder ?? fallback.sortOrder ?? index + 1),
    createdAt: card.created_at || card.createdAt || "",
    updatedAt: card.updated_at || card.updatedAt || "",
  };
}

function toSupabase(card) {
  return {
    slot_key: card.slotKey,
    title: card.title || "",
    description: card.description || "",
    target_url: card.targetUrl || "",
    image_url: card.imageUrl || "",
    button_label: card.buttonLabel || "Assistir",
    content_type: card.contentType || "link_externo",
    active: card.active !== false,
    sort_order: Number(card.sortOrder || 0),
    updated_at: new Date().toISOString(),
  };
}

function mergeWithDefaults(cards = []) {
  const bySlot = new Map(cards.map((card, index) => [card.slotKey, normalizeCard(card, index)]));
  return defaultSiteContentCards
    .map((fallback, index) => normalizeCard({ ...fallback, ...(bySlot.get(fallback.slotKey) || {}) }, index))
    .sort((first, second) => first.sortOrder - second.sortOrder);
}

function readLocalCards() {
  return mergeWithDefaults(readJson(storageKey, defaultSiteContentCards));
}

function writeLocalCards(cards) {
  writeJson(storageKey, mergeWithDefaults(cards));
}

export async function listSiteContentCards({ publicOnly = false } = {}) {
  if (isSupabaseConfigured) {
    try {
      const activeFilter = publicOnly ? "&active=eq.true" : "";
      const rows = await supabaseRequest(`/site_content_cards?select=*&order=sort_order.asc,title.asc${activeFilter}`, {
        forceAnon: publicOnly,
      });
      return mergeWithDefaults(rows.map(normalizeCard)).filter((card) => !publicOnly || card.active);
    } catch (error) {
      console.warn("Fallback local dos cards de conteúdo ativado:", error);
    }
  }

  const cards = readLocalCards();
  return publicOnly ? cards.filter((card) => card.active) : cards;
}

export async function saveSiteContentCard(card) {
  const normalized = normalizeCard(card);

  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest("/site_content_cards?on_conflict=slot_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(toSupabase(normalized)),
      });
      return normalizeCard(row);
    } catch (error) {
      console.warn("Salvando card de conteúdo no fallback local:", error);
    }
  }

  const cards = readLocalCards();
  const next = cards.map((item) => (
    item.slotKey === normalized.slotKey ? normalizeCard({ ...item, ...normalized }) : item
  ));
  if (!next.some((item) => item.slotKey === normalized.slotKey)) next.push(normalized);
  writeLocalCards(next);
  return normalized;
}
