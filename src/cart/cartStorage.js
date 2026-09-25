import { calculatePixPriceFromNormal, roundStoreMoney } from "../utils/storePricing.js";
import { supabaseRequest } from "../lib/supabase.js";

export const CART_STORAGE_KEY = "nt-store-cart-v1";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

export function itemKey(item) {
  return [
    item.itemType || item.item_type,
    item.productId || item.product_id || "",
    item.variationId || item.variation_id || "",
    item.assembledPcId || item.assembled_pc_id || "",
  ].join(":");
}

export function readCartItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

export function writeCartItems(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("nt-cart-updated", { detail: { items } }));
}

function mergeCartItems(items) {
  const merged = new Map();
  items.forEach((item) => {
    const key = itemKey(item);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, item);
      return;
    }
    merged.set(key, {
      ...current,
      ...item,
      quantity: Number(current.quantity || 0) + Number(item.quantity || 0),
    });
  });
  return [...merged.values()];
}

export async function resolveLegacyCartItems(items) {
  // Compatibility bridge for carts persisted before variations became independent products.
  const variationIds = [...new Set(items
    .map((item) => String(item.variationId || item.variation_id || "").trim())
    .filter(isUuid))];
  if (!variationIds.length) return items;

  const mappings = await supabaseRequest("/rpc/resolve_legacy_cart_variations", {
    method: "POST",
    body: JSON.stringify({ p_variation_ids: variationIds }),
    forceAnon: true,
  });
  if (!Array.isArray(mappings) || !mappings.length) return items;

  const mappingByVariation = new Map(mappings.map((row) => [row.old_variation_id, row.new_product_id]));
  const productIds = [...new Set(mappings.map((row) => row.new_product_id).filter(isUuid))];
  const idFilter = productIds.join(",");
  const [products, availabilityRows] = await Promise.all([
    supabaseRequest(`/products?id=in.(${idFilter})&select=id,name,slug,sku,price,promo_price,stock,status,main_image,images`, { forceAnon: true }),
    supabaseRequest("/rpc/list_store_inventory_availability", {
      method: "POST",
      body: JSON.stringify({}),
      forceAnon: true,
    }),
  ]);
  const productById = new Map((Array.isArray(products) ? products : []).map((product) => [product.id, product]));
  const availabilityByProduct = new Map((Array.isArray(availabilityRows) ? availabilityRows : [])
    .filter((row) => row.item_type === "product" && productIds.includes(row.product_id))
    .map((row) => [row.product_id, row]));

  return mergeCartItems(items.map((item) => {
    const oldVariationId = String(item.variationId || item.variation_id || "").trim();
    const newProductId = mappingByVariation.get(oldVariationId);
    const product = productById.get(newProductId);
    if (!newProductId || !product) return item;
    const availability = availabilityByProduct.get(newProductId);
    const stock = Number(availability?.available_stock ?? product.stock ?? 0);
    const { variationId: _variationId, variation_id: _variationIdSnake, variationName: _variationName, variation_name: _variationNameSnake, ...itemWithoutVariation } = item;
    return {
      ...itemWithoutVariation,
      itemType: "product",
      productId: newProductId,
      name: product.name || item.name,
      image: product.main_image || product.images?.[0] || item.image || "",
      unitPrice: Number(product.price || 0),
      cashPrice: Number(product.promo_price || 0),
      stock: Number.isFinite(stock) ? stock : 0,
      sku: product.sku || "",
      slug: product.slug || "",
    };
  }));
}

export function moneyValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").replace(/[R$\s]/g, "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cartTotals(items) {
  const subtotal = roundStoreMoney(items.reduce((sum, item) => sum + moneyValue(item.unitPrice) * Number(item.quantity || 0), 0));
  const pixTotal = roundStoreMoney(items.reduce((sum, item) => {
    const cash = moneyValue(item.cashPrice);
    const regular = moneyValue(item.unitPrice);
    const fallbackPix = calculatePixPriceFromNormal(regular) || 0;
    return sum + (cash || fallbackPix) * Number(item.quantity || 0);
  }, 0));
  return {
    subtotal,
    pixDiscount: roundStoreMoney(Math.max(0, subtotal - pixTotal)),
    pixTotal,
    cardTotal: subtotal,
    count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  };
}

export function checkoutItems(items) {
  return items.map((item) => ({
    item_type: item.itemType || item.item_type,
    product_id: String(item.productId || item.product_id || "").trim() || undefined,
    variation_id: String(item.variationId || item.variation_id || "").trim() || undefined,
    assembled_pc_id: String(item.assembledPcId || item.assembled_pc_id || "").trim() || undefined,
    quantity: Number(item.quantity || 1),
  }));
}

export function checkoutItemErrors(items) {
  return checkoutItems(items).reduce((errors, item, index) => {
    const label = `Item ${index + 1}`;
    if (item.item_type === "product") {
      if (!isUuid(item.product_id)) errors.push(`${label}: produto sem UUID valido`);
      if (item.variation_id && !isUuid(item.variation_id)) errors.push(`${label}: variacao sem UUID valido`);
      return errors;
    }
    if (item.item_type === "assembled_pc") {
      if (!isUuid(item.assembled_pc_id)) errors.push(`${label}: computador sem UUID valido`);
      return errors;
    }
    errors.push(`${label}: tipo de item invalido`);
    return errors;
  }, []);
}
