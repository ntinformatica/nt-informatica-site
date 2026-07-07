import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { adminStorageKey, initialAdminProducts } from "../adminData";
import { readJson, slugify, writeJson } from "./localStorageHelpers";

function arrayFromText(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function textFromArray(value) {
  if (Array.isArray(value)) return value.join("\n");
  return value || "";
}

function fromSupabase(row, categories = []) {
  const category = categories.find((item) => item.id === row.category_id);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    categoryId: row.category_id,
    category: category?.name || "Sem categoria",
    brand: row.brand || "",
    model: row.model || "",
    price: row.price ?? "",
    promoPrice: row.promo_price ?? "",
    shortDescription: row.short_description || "",
    fullDescription: row.full_description || "",
    images: textFromArray(row.images),
    gallery: textFromArray(row.images),
    variations: "",
    stock: row.stock ?? 0,
    status: row.status || "rascunho",
    featured: Boolean(row.featured),
    sku: row.sku || "",
    warranty: row.warranty || "",
    internalNotes: row.internal_notes || "",
    updatedAt: row.updated_at || row.created_at,
  };
}

function toSupabase(product, categories = []) {
  const category = categories.find((item) => item.id === product.categoryId || item.name === product.category);

  return {
    name: product.name,
    slug: product.slug || slugify(product.name),
    category_id: category?.id || product.categoryId || null,
    brand: product.brand || "",
    model: product.model || "",
    short_description: product.shortDescription || "",
    full_description: product.fullDescription || "",
    price: product.price === "" ? null : Number(product.price),
    promo_price: product.promoPrice === "" ? null : Number(product.promoPrice),
    status: product.status || "rascunho",
    stock: Number(product.stock || 0),
    featured: Boolean(product.featured),
    sku: product.sku || "",
    warranty: product.warranty || "",
    images: arrayFromText(product.images || product.gallery),
    internal_notes: product.internalNotes || "",
    updated_at: new Date().toISOString(),
  };
}

function normalizeLocalProduct(product, categories = []) {
  const category = categories.find((item) => item.id === product.categoryId || item.name === product.category);
  return {
    ...product,
    id: product.id || slugify(product.name),
    slug: product.slug || slugify(product.name),
    categoryId: category?.id || product.categoryId || slugify(product.category || "sem-categoria"),
    category: category?.name || product.category || "Sem categoria",
  };
}

function readLocalProducts(categories = []) {
  return readJson(adminStorageKey, initialAdminProducts).map((product) => normalizeLocalProduct(product, categories));
}

function writeLocalProducts(products) {
  writeJson(adminStorageKey, products);
}

export async function listProducts(categories = []) {
  if (isSupabaseConfigured) {
    try {
      const rows = await supabaseRequest("/products?select=*&order=updated_at.desc");
      return rows.map((row) => fromSupabase(row, categories));
    } catch (error) {
      console.warn("Fallback local de produtos ativado:", error);
      return readLocalProducts(categories);
    }
  }

  return readLocalProducts(categories);
}

export async function createProduct(product, categories = []) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest("/products", {
        method: "POST",
        body: JSON.stringify(toSupabase(product, categories)),
      });
      return fromSupabase(row, categories);
    } catch (error) {
      console.warn("Criando produto no fallback local:", error);
    }
  }

  const products = readLocalProducts(categories);
  const item = normalizeLocalProduct(
    {
      ...product,
      id: product.id || slugify(product.slug || product.name) || `produto-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    },
    categories,
  );
  writeLocalProducts([item, ...products]);
  return item;
}

export async function updateProduct(id, product, categories = []) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest(`/products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(toSupabase(product, categories)),
      });
      return fromSupabase(row, categories);
    } catch (error) {
      console.warn("Atualizando produto no fallback local:", error);
    }
  }

  const products = readLocalProducts(categories);
  const nextProducts = products.map((item) => (
    item.id === id ? normalizeLocalProduct({ ...item, ...product, id, updatedAt: new Date().toISOString() }, categories) : item
  ));
  writeLocalProducts(nextProducts);
  return nextProducts.find((item) => item.id === id);
}

export async function deleteProduct(id, categories = []) {
  if (isSupabaseConfigured) {
    try {
      await supabaseRequest(`/products?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return;
    } catch (error) {
      console.warn("Excluindo produto no fallback local:", error);
    }
  }

  writeLocalProducts(readLocalProducts(categories).filter((item) => item.id !== id));
}

export async function updateProductStatus(id, status, categories = []) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest(`/products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
      return fromSupabase(row, categories);
    } catch (error) {
      console.warn("Atualizando status no fallback local:", error);
    }
  }

  const product = readLocalProducts(categories).find((item) => item.id === id);
  if (!product) return null;
  return updateProduct(id, { ...product, status }, categories);
}

export async function updateProductFeatured(id, featured, categories = []) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest(`/products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ featured, updated_at: new Date().toISOString() }),
      });
      return fromSupabase(row, categories);
    } catch (error) {
      console.warn("Atualizando destaque no fallback local:", error);
    }
  }

  const product = readLocalProducts(categories).find((item) => item.id === id);
  if (!product) return null;
  return updateProduct(id, { ...product, featured }, categories);
}
