import { isSupabaseConfigured, supabaseFunction } from "../../lib/supabase";
import { slugify } from "./localStorageHelpers";

function arrayFromText(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split("\n").map((item) => item.trim()).filter(Boolean);
}

function textFromArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).join("\n") : "";
}

async function importItems(items, onStatus) {
  const validItems = items.filter((item) => item.source);
  if (!validItems.length) return { mapping: new Map(), imported: 0, analyzed: 0 };
  if (!isSupabaseConfigured) throw new Error("Supabase nao configurado para importar imagens.");

  onStatus?.({ tone: "loading", message: "Importando imagens para o Storage da NT..." });
  const mapping = new Map();
  let imported = 0;

  try {
    for (let index = 0; index < validItems.length; index += 30) {
      const chunk = validItems.slice(index, index + 30);
      const response = await supabaseFunction("catalog-image-import", {
        method: "POST",
        body: JSON.stringify({
          items: chunk.map((item) => ({
            key: item.key,
            source: item.source,
            entity_type: item.entityType,
            entity_key: item.entityKey,
          })),
        }),
      });
      for (const result of response?.results || []) {
        mapping.set(result.key, result.url);
        if (result.imported) imported += 1;
      }
    }
  } catch (error) {
    const firstFailure = error?.details?.errors?.[0];
    const detail = firstFailure?.error ? ` (${firstFailure.error})` : "";
    onStatus?.({ tone: "error", message: `Falha ao importar imagem${detail}. O cadastro atual nao foi sobrescrito.` });
    throw new Error(`Nao foi possivel importar todas as imagens para o Storage da NT${detail}.`);
  }

  onStatus?.({
    tone: "success",
    message: imported
      ? `${imported === 1 ? "Imagem importada" : "Imagens importadas"} e ${imported === 1 ? "salva" : "salvas"} na NT.`
      : "As imagens ja estavam hospedadas no Storage da NT.",
  });
  return { mapping, imported, analyzed: validItems.length };
}

export async function prepareProductImagesForStorage(product, onStatus) {
  const mainImage = String(product.mainImage || "").trim();
  const gallery = arrayFromText(product.gallery !== undefined ? product.gallery : product.images);
  const entityKey = product.id || product.slug || slugify(product.name) || "new-product";
  const items = [];

  if (mainImage) items.push({ key: "product-main", source: mainImage, entityType: "product", entityKey });
  gallery.forEach((source, index) => items.push({ key: `product-gallery-${index}`, source, entityType: "product", entityKey }));
  const result = await importItems(items, onStatus);
  const mappedMain = result.mapping.get("product-main") || mainImage;
  const mappedGallery = gallery.map((source, index) => result.mapping.get(`product-gallery-${index}`) || source);
  return {
    value: {
      ...product,
      mainImage: mappedMain,
      gallery: textFromArray(mappedGallery),
      images: textFromArray([mappedMain, ...mappedGallery].filter(Boolean)),
    },
    importedCount: result.imported,
  };
}

export async function preparePcImagesForStorage(pc, onStatus) {
  const mainImage = String(pc.mainImage || "").trim();
  const gallery = arrayFromText(pc.gallery !== undefined ? pc.gallery : pc.images);
  const entityKey = pc.id || pc.slug || slugify(pc.name) || "new-pc";
  const items = [];

  if (mainImage) items.push({ key: "pc-main", source: mainImage, entityType: "assembled-pc", entityKey });
  gallery.forEach((source, index) => items.push({ key: `pc-gallery-${index}`, source, entityType: "assembled-pc", entityKey }));

  const result = await importItems(items, onStatus);
  const mappedMain = result.mapping.get("pc-main") || mainImage;
  const mappedGallery = gallery.map((source, index) => result.mapping.get(`pc-gallery-${index}`) || source);
  return {
    value: {
      ...pc,
      mainImage: mappedMain,
      gallery: textFromArray(mappedGallery),
      images: textFromArray([mappedMain, ...mappedGallery].filter(Boolean)),
    },
    importedCount: result.imported,
  };
}
