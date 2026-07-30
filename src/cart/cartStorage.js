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
  const subtotal = items.reduce((sum, item) => sum + moneyValue(item.unitPrice) * Number(item.quantity || 0), 0);
  const pixTotal = items.reduce((sum, item) => {
    const cash = moneyValue(item.cashPrice);
    const regular = moneyValue(item.unitPrice);
    return sum + (cash || regular * 0.85) * Number(item.quantity || 0);
  }, 0);
  return {
    subtotal,
    pixDiscount: Math.max(0, subtotal - pixTotal),
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
