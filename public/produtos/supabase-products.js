(function () {
  function cleanEnvValue(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim().replace(/^["']|["']$/g, "").trim();
  }

  function normalizeSupabaseUrl(value) {
    const cleaned = cleanEnvValue(value);
    if (!cleaned) return "";
    return cleaned.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  }

  function normalizeAnonKey(value) {
    return cleanEnvValue(value).replace(/\s+/g, "");
  }

  function isValidSupabaseUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
    } catch {
      return false;
    }
  }

  function formatCurrency(value) {
    if (value === "" || value === null || value === undefined) return "";
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
    }).format(parsed);
  }

  function normalizeImages(value, mainImage = "") {
    const images = Array.isArray(value) ? value.filter(Boolean) : [];
    return [...new Set([mainImage, ...images].filter(Boolean))];
  }

  function publicStatus(status) {
    const normalized = String(status || "rascunho").toLowerCase();
    return !["rascunho", "despublicado", "inativo", "draft", "unpublished"].includes(normalized);
  }

  function swatchFromText(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized.includes("branco") || normalized.includes("white")) return "#f8fafc";
    if (normalized.includes("preto") || normalized.includes("black")) return "#111827";
    if (normalized.includes("vermelho") || normalized.includes("red")) return "#dc2626";
    if (normalized.includes("verde") || normalized.includes("green")) return "#22c55e";
    if (normalized.includes("azul") || normalized.includes("blue")) return "#2563eb";
    if (normalized.includes("rosa") || normalized.includes("rose") || normalized.includes("pink")) return "#fb7185";
    return "#38bdf8";
  }

  function buildUrl(baseUrl, path) {
    return `${baseUrl}/rest/v1${path}`;
  }

  async function supabaseRequest(baseUrl, anonKey, path) {
    const response = await fetch(buildUrl(baseUrl, path), {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || `Erro Supabase: ${response.status}`);
    }

    return response.json();
  }

  function categoryTuple(category) {
    return [
      category.name,
      category.description || "Produtos selecionados pela NT Informática.",
      category.icon && /^https?:|^\//.test(category.icon) ? category.icon : "../category-assets/acessorios.svg",
      category.id,
    ];
  }

  function productCategoryName(product, categoriesById) {
    return categoriesById.get(product.category_id)?.name || product.category || "Sem categoria";
  }

  function mapVariation(variation) {
    const name = variation.name || variation.color || variation.value || "Variação";
    const images = normalizeImages(variation.images, variation.image);
    return {
      id: variation.id,
      name,
      color: variation.color || variation.value || name,
      swatch: variation.swatch || swatchFromText(name),
      price: formatCurrency(variation.price),
      cashPrice: formatCurrency(variation.promo_price),
      cashLabel: "à vista com 15% OFF",
      installmentText: variation.price ? `${formatCurrency(variation.price)} em 10x sem juros` : "Consulte condições",
      images,
      stock: variation.stock ?? 0,
      status: variation.status || (variation.active === false ? "inativo" : "ativo"),
    };
  }

  function mapProduct(product, categoriesById, variationsByProduct) {
    const category = productCategoryName(product, categoriesById);
    const images = normalizeImages(product.images, product.main_image);
    const variations = (variationsByProduct.get(product.id) || [])
      .filter((variation) => variation.active !== false && publicStatus(variation.status || "ativo"))
      .map(mapVariation);

    return {
      id: product.slug || product.id,
      supabaseId: product.id,
      name: product.name,
      category,
      price: formatCurrency(product.price) || "Consulte",
      cashPrice: formatCurrency(product.promo_price),
      cashLabel: "à vista com 15% OFF",
      installmentText: product.price ? `${formatCurrency(product.price)} em 10x sem juros` : "Consulte condições",
      summary: product.short_description || product.full_description || "Produto selecionado pela NT Informática.",
      description: product.full_description || product.short_description || "Produto selecionado pela NT Informática.",
      symbol: product.brand || "NT",
      images,
      specs: [product.brand, product.model, product.warranty].filter(Boolean),
      variants: variations,
      stock: product.stock ?? 0,
      status: product.status || "",
      featured: Boolean(product.featured),
      whatsappMessage: `Olá, NT Informática. Tenho interesse em ${product.name}.`,
    };
  }

  async function loadSupabaseCatalog() {
    const config = window.NT_SUPABASE_CONFIG || {};
    const supabaseUrl = normalizeSupabaseUrl(config.url);
    const anonKey = normalizeAnonKey(config.anonKey);

    if (!supabaseUrl || !anonKey || !isValidSupabaseUrl(supabaseUrl)) {
      throw new Error("Supabase publico nao configurado.");
    }

    const [categoryRows, productRows, variationRows] = await Promise.all([
      supabaseRequest(supabaseUrl, anonKey, "/categories?select=*&order=sort_order.asc,name.asc"),
      supabaseRequest(supabaseUrl, anonKey, "/products?select=*&order=featured.desc,updated_at.desc"),
      supabaseRequest(supabaseUrl, anonKey, "/product_variations?select=*&order=created_at.asc"),
    ]);

    const publicCategories = categoryRows.filter((category) => category.active !== false);
    const categoriesById = new Map(publicCategories.map((category) => [category.id, category]));
    const variationsByProduct = variationRows.reduce((map, variation) => {
      const list = map.get(variation.product_id) || [];
      list.push(variation);
      map.set(variation.product_id, list);
      return map;
    }, new Map());

    const publicProducts = productRows
      .filter((product) => publicStatus(product.status))
      .map((product) => mapProduct(product, categoriesById, variationsByProduct));

    return {
      categories: publicCategories.map(categoryTuple),
      products: publicProducts,
    };
  }

  window.NT_PUBLIC_CATALOG = {
    loadSupabaseCatalog,
  };
}());
