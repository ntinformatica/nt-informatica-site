export const CART_STORAGE_KEY = "nt-store-cart-v1";

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
    item_type: item.itemType,
    product_id: item.productId || undefined,
    variation_id: item.variationId || undefined,
    assembled_pc_id: item.assembledPcId || undefined,
    quantity: Number(item.quantity || 1),
  }));
}
