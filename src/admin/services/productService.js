import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { adminStorageKey, initialAdminProducts } from "../adminData";
import { readJson, slugify, writeJson } from "./localStorageHelpers";

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

function moneyOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeVariation(variation = {}, index = 0) {
  return {
    id: variation.id || `variation-${Date.now()}-${index}`,
    name: variation.name || "",
    color: variation.color || variation.value || "",
    price: variation.price ?? "",
    promoPrice: variation.promoPrice ?? "",
    stock: Number(variation.stock || 0),
    sku: variation.sku || "",
    image: variation.image || "",
    active: variation.active !== false,
  };
}

function parseVariations(value) {
  if (Array.isArray(value)) return value.map(normalizeVariation);
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((item, index) => normalizeVariation({ name: item.trim(), color: item.trim() }, index))
    .filter((item) => item.name || item.color);
}

function fromSupabase(row, categories = [], variations = []) {
  const category = categories.find((item) => item.id === row.category_id);
  const images = Array.isArray(row.images) ? row.images : [];
  const mainImage = row.main_image || images[0] || "";

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
    mainImage,
    images: textFromArray(images),
    gallery: textFromArray(images.filter((image) => image !== mainImage)),
    variations: variations.map((variation) => normalizeVariation({
      id: variation.id,
      name: variation.name,
      color: variation.color || variation.value,
      price: variation.price ?? "",
      promoPrice: variation.promo_price ?? "",
      stock: variation.stock ?? 0,
      sku: variation.sku || "",
      image: variation.image || variation.images?.[0] || "",
      active: variation.active !== false && variation.status !== "inativo",
    })),
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
  const images = [...new Set([product.mainImage, ...arrayFromText(product.images), ...arrayFromText(product.gallery)].filter(Boolean))];

  return {
    name: product.name,
    slug: product.slug || slugify(product.name),
    category_id: category?.id || product.categoryId || null,
    brand: product.brand || "",
    model: product.model || "",
    short_description: product.shortDescription || "",
    full_description: product.fullDescription || "",
    price: moneyOrNull(product.price),
    promo_price: moneyOrNull(product.promoPrice),
    status: product.status || "rascunho",
    stock: Number(product.stock || 0),
    featured: Boolean(product.featured),
    sku: product.sku || "",
    warranty: product.warranty || "",
    main_image: product.mainImage || images[0] || "",
    images,
    internal_notes: product.internalNotes || "",
    updated_at: new Date().toISOString(),
  };
}

function toSupabaseVariation(variation, productId) {
  const normalized = normalizeVariation(variation);
  return {
    product_id: productId,
    name: normalized.name || normalized.color || "Variação",
    value: normalized.color || normalized.name || "",
    color: normalized.color || "",
    price: moneyOrNull(normalized.price),
    promo_price: moneyOrNull(normalized.promoPrice),
    stock: Number(normalized.stock || 0),
    sku: normalized.sku || "",
    image: normalized.image || "",
    images: normalized.image ? [normalized.image] : [],
    active: normalized.active !== false,
    status: normalized.active === false ? "inativo" : "ativo",
    updated_at: new Date().toISOString(),
  };
}

function normalizeLocalProduct(product, categories = []) {
  const category = categories.find((item) => item.id === product.categoryId || item.name === product.category);
  const images = [...new Set([product.mainImage, ...arrayFromText(product.images), ...arrayFromText(product.gallery)].filter(Boolean))];

  return {
    ...product,
    id: product.id || slugify(product.name),
    slug: product.slug || slugify(product.name),
    categoryId: category?.id || product.categoryId || slugify(product.category || "sem-categoria"),
    category: category?.name || product.category || "Sem categoria",
    price: product.price ?? "",
    promoPrice: product.promoPrice ?? "",
    mainImage: product.mainImage || images[0] || "",
    images: textFromArray(images),
    gallery: textFromArray(images.slice(1)),
    variations: parseVariations(product.variations),
    stock: Number(product.stock || 0),
    featured: Boolean(product.featured),
    status: product.status || "rascunho",
  };
}

function readLocalProducts(categories = []) {
  return readJson(adminStorageKey, initialAdminProducts).map((product) => normalizeLocalProduct(product, categories));
}

function writeLocalProducts(products, categories = []) {
  writeJson(adminStorageKey, products.map((product) => normalizeLocalProduct(product, categories)));
}

async function saveVariations(productId, variations) {
  await supabaseRequest(`/product_variations?product_id=eq.${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });

  const payload = parseVariations(variations).map((variation) => toSupabaseVariation(variation, productId));
  if (!payload.length) return [];

  return supabaseRequest("/product_variations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listProducts(categories = []) {
  if (!isSupabaseConfigured) {
    return readLocalProducts(categories);
  }

  let rows = [];
  try {
    rows = await supabaseRequest("/products?select=*&order=updated_at.desc");
  } catch (error) {
    console.error("Erro ao carregar produtos do Supabase:", error);
    throw new Error("Nao foi possivel carregar os produtos do Supabase.");
  }

  let variationRows = [];
  try {
    variationRows = await supabaseRequest("/product_variations?select=*&order=created_at.asc");
  } catch (error) {
    console.warn("Nao foi possivel carregar variacoes do Supabase. Produtos serao exibidos sem variacoes:", error);
  }

  return rows.map((row) => fromSupabase(
    row,
    categories,
    variationRows.filter((variation) => variation.product_id === row.id),
  ));
}

export async function createProduct(product, categories = []) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest("/products", {
        method: "POST",
        body: JSON.stringify(toSupabase(product, categories)),
      });
      const variations = await saveVariations(row.id, product.variations);
      return fromSupabase(row, categories, variations);
    } catch (error) {
      console.error("Erro ao criar produto no Supabase:", error);
      throw new Error("Nao foi possivel criar o produto no Supabase.");
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
  writeLocalProducts([item, ...products], categories);
  return item;
}

export async function updateProduct(id, product, categories = []) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest(`/products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(toSupabase(product, categories)),
      });
      const variations = await saveVariations(id, product.variations);
      return fromSupabase(row, categories, variations);
    } catch (error) {
      console.error("Erro ao atualizar produto no Supabase:", error);
      throw new Error("Nao foi possivel atualizar o produto no Supabase.");
    }
  }

  const nextProducts = readLocalProducts(categories).map((item) => (
    item.id === id ? normalizeLocalProduct({ ...item, ...product, id, updatedAt: new Date().toISOString() }, categories) : item
  ));
  writeLocalProducts(nextProducts, categories);
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
      console.error("Erro ao excluir produto no Supabase:", error);
      throw new Error("Nao foi possivel excluir o produto no Supabase.");
    }
  }

  writeLocalProducts(readLocalProducts(categories).filter((item) => item.id !== id), categories);
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
      console.error("Erro ao atualizar status no Supabase:", error);
      throw new Error("Nao foi possivel atualizar o status no Supabase.");
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
      console.error("Erro ao atualizar destaque no Supabase:", error);
      throw new Error("Nao foi possivel atualizar o destaque no Supabase.");
    }
  }

  const product = readLocalProducts(categories).find((item) => item.id === id);
  if (!product) return null;
  return updateProduct(id, { ...product, featured }, categories);
}
