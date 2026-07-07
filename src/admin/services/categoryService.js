import { isSupabaseConfigured, supabaseRequest } from "../../lib/supabase";
import { adminCategories } from "../adminData";
import { readJson, slugify, writeJson } from "./localStorageHelpers";

const categoryStorageKey = "nt-admin-categories-v1";

const initialCategories = adminCategories.map((name, index) => ({
  id: slugify(name),
  name,
  slug: slugify(name),
  description: "",
  sortOrder: index + 1,
  active: true,
}));

function fromSupabase(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    sortOrder: row.sort_order || 0,
    active: row.active !== false,
  };
}

function toSupabase(category) {
  return {
    name: category.name,
    slug: category.slug || slugify(category.name),
    description: category.description || "",
    sort_order: Number(category.sortOrder || 0),
    active: category.active !== false,
  };
}

function readLocalCategories() {
  return readJson(categoryStorageKey, initialCategories);
}

function writeLocalCategories(categories) {
  writeJson(categoryStorageKey, categories);
}

export async function listCategories() {
  if (isSupabaseConfigured) {
    try {
      const rows = await supabaseRequest("/categories?select=*&order=sort_order.asc,name.asc");
      return rows.map(fromSupabase);
    } catch (error) {
      console.warn("Fallback local de categorias ativado:", error);
      return readLocalCategories();
    }
  }

  return readLocalCategories();
}

export async function createCategory(category) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest("/categories", {
        method: "POST",
        body: JSON.stringify(toSupabase(category)),
      });
      return fromSupabase(row);
    } catch (error) {
      console.warn("Criando categoria no fallback local:", error);
    }
  }

  const categories = readLocalCategories();
  const item = {
    id: category.id || slugify(category.name),
    name: category.name,
    slug: category.slug || slugify(category.name),
    description: category.description || "",
    sortOrder: Number(category.sortOrder || categories.length + 1),
    active: category.active !== false,
  };
  writeLocalCategories([item, ...categories]);
  return item;
}

export async function updateCategory(id, category) {
  if (isSupabaseConfigured) {
    try {
      const [row] = await supabaseRequest(`/categories?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(toSupabase(category)),
      });
      return fromSupabase(row);
    } catch (error) {
      console.warn("Atualizando categoria no fallback local:", error);
    }
  }

  const categories = readLocalCategories();
  const nextCategories = categories.map((item) => (item.id === id ? { ...item, ...category, id } : item));
  writeLocalCategories(nextCategories);
  return nextCategories.find((item) => item.id === id);
}

export async function deleteCategory(id) {
  if (isSupabaseConfigured) {
    try {
      await supabaseRequest(`/categories?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return;
    } catch (error) {
      console.warn("Excluindo categoria no fallback local:", error);
    }
  }

  writeLocalCategories(readLocalCategories().filter((item) => item.id !== id));
}
