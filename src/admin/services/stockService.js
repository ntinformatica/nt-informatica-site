import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { adminStorageKey } from "../adminData";
import { readJson, writeJson } from "./localStorageHelpers";

const stockMovementsStorageKey = "nt-admin-stock-movements-v1";

function normalizeType(type) {
  const normalized = String(type || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized === "saida") return "saida";
  if (normalized === "ajuste") return "ajuste";
  return "entrada";
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.trunc(quantity) : 0;
}

function calculateNewStock(previousStock, type, quantity) {
  const current = normalizeQuantity(previousStock);
  const amount = normalizeQuantity(quantity);

  if (type === "entrada") return current + Math.max(amount, 0);
  if (type === "saida") return current - Math.max(amount, 0);
  return Math.max(amount, 0);
}

function totalProductStock(product, variationId, newVariationStock) {
  if (!variationId || !product.variations?.length) return newVariationStock;

  return product.variations.reduce((total, variation) => {
    if (variation.id === variationId) return total + newVariationStock;
    return total + normalizeQuantity(variation.stock);
  }, 0);
}

function normalizeMovement(row) {
  return {
    id: row.id || `mov-${Date.now()}`,
    productId: row.product_id || row.productId,
    variationId: row.variation_id || row.variationId || "",
    type: normalizeType(row.type),
    quantity: normalizeQuantity(row.quantity),
    previousStock: normalizeQuantity(row.previous_stock ?? row.previousStock),
    newStock: normalizeQuantity(row.new_stock ?? row.newStock),
    reason: row.reason || "",
    notes: row.notes || "",
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

function readLocalMovements() {
  return readJson(stockMovementsStorageKey, []).map(normalizeMovement);
}

function writeLocalMovements(movements) {
  writeJson(stockMovementsStorageKey, movements.map(normalizeMovement));
}

export function previewStockMovement(previousStock, type, quantity) {
  const normalizedType = normalizeType(type);
  const current = normalizeQuantity(previousStock);
  const amount = normalizeQuantity(quantity);
  const next = calculateNewStock(current, normalizedType, amount);
  return Math.max(next, 0);
}

export async function listStockMovements(productId) {
  if (!productId) return [];

  if (isSupabaseConfigured) {
    try {
      const rows = await supabaseRequest(`/stock_movements?product_id=eq.${encodeURIComponent(productId)}&select=*&order=created_at.desc`);
      return rows.map(normalizeMovement);
    } catch (error) {
      console.warn("Nao foi possivel carregar historico de estoque:", error);
      return [];
    }
  }

  return readLocalMovements().filter((movement) => movement.productId === productId);
}

export async function createStockMovement({ product, variationId = "", type, quantity, reason, notes }) {
  if (!product?.id) throw new Error("Produto invalido para movimentacao de estoque.");

  const normalizedType = normalizeType(type);
  const amount = normalizeQuantity(quantity);
  if (amount <= 0) {
    throw new Error("Informe uma quantidade valida.");
  }

  const variation = variationId ? product.variations?.find((item) => item.id === variationId) : null;
  if (variationId && !variation) {
    throw new Error("Variacao nao encontrada para movimentar estoque.");
  }

  const previousStock = normalizeQuantity(variation ? variation.stock : product.stock);
  const newStock = calculateNewStock(previousStock, normalizedType, amount);
  if (newStock < 0) {
    throw new Error("Estoque insuficiente.");
  }

  const newProductStock = variation?.id
    ? totalProductStock(product, variation.id, newStock)
    : newStock;
  const movementQuantity = normalizedType === "ajuste" ? newStock - previousStock : amount;

  const payload = {
    product_id: product.id,
    variation_id: variation?.id || null,
    type: normalizedType,
    quantity: movementQuantity,
    previous_stock: previousStock,
    new_stock: newStock,
    reason: reason || "Movimentacao manual no NT Admin",
    notes: notes || "",
  };

  if (isSupabaseConfigured) {
    if (variation?.id) {
      await supabaseRequest(`/product_variations?id=eq.${encodeURIComponent(variation.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: newStock, updated_at: new Date().toISOString() }),
      });
    }

    await supabaseRequest(`/products?id=eq.${encodeURIComponent(product.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ stock: newProductStock, updated_at: new Date().toISOString() }),
    });

    const [movement] = await supabaseRequest("/stock_movements", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return normalizeMovement(movement);
  }

  const products = readJson(adminStorageKey, []);
  const nextProducts = products.map((item) => {
    if (item.id !== product.id) return item;
    if (!variation?.id) return { ...item, stock: newProductStock, updatedAt: new Date().toISOString() };
    return {
      ...item,
      stock: newProductStock,
      variations: (item.variations || []).map((itemVariation) => (
        itemVariation.id === variation.id ? { ...itemVariation, stock: newStock } : itemVariation
      )),
      updatedAt: new Date().toISOString(),
    };
  });
  writeJson(adminStorageKey, nextProducts);

  const movement = normalizeMovement({
    ...payload,
    id: `mov-${Date.now()}`,
    productId: product.id,
    variationId: variation?.id || "",
    createdAt: new Date().toISOString(),
  });
  writeLocalMovements([movement, ...readLocalMovements()]);
  return movement;
}
