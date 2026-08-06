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
    const images = Array.isArray(value) ? value : [];
    return [...new Set([mainImage, ...images]
      .map((image) => String(image || "").trim())
      .filter((image) => /^https?:\/\//i.test(image)))];
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

  async function supabaseRequest(baseUrl, anonKey, path, options = {}) {
    const { headers: customHeaders = {}, ...requestOptions } = options;
    const response = await fetch(buildUrl(baseUrl, path), {
      ...requestOptions,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        ...customHeaders,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || `Erro Supabase: ${response.status}`);
    }

    return response.json();
  }

  async function supabaseRpc(baseUrl, anonKey, name, args = {}) {
    return supabaseRequest(baseUrl, anonKey, `/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  }

  function availabilityKey(row) {
    if (row.item_type === "variation" && row.variation_id) return `variation:${row.variation_id}`;
    if (row.item_type === "assembled_pc" && row.assembled_pc_id) return `assembled_pc:${row.assembled_pc_id}`;
    if (row.item_type === "product" && row.product_id) return `product:${row.product_id}`;
    return "";
  }

  function availabilityMap(rows) {
    return rows.reduce((map, row) => {
      const key = availabilityKey(row);
      if (key) map.set(key, row);
      return map;
    }, new Map());
  }

  function applyAvailability(row, availability) {
    if (!availability) return row;
    return {
      ...row,
      physical_stock: availability.physical_stock ?? row.stock ?? 0,
      reserved_stock: availability.reserved_stock ?? 0,
      available_stock: availability.available_stock ?? row.stock ?? 0,
      stock: availability.available_stock ?? row.stock ?? 0,
    };
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
      physicalStock: variation.physical_stock ?? variation.stock ?? 0,
      reservedStock: variation.reserved_stock ?? 0,
      availableStock: variation.available_stock ?? variation.stock ?? 0,
      stock: variation.available_stock ?? variation.stock ?? 0,
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
      slug: product.slug || "",
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
      physicalStock: product.physical_stock ?? product.stock ?? 0,
      reservedStock: product.reserved_stock ?? 0,
      availableStock: product.available_stock ?? product.stock ?? 0,
      stock: product.available_stock ?? product.stock ?? 0,
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

    const [categoryRows, productRows, variationRows, inventoryRows] = await Promise.all([
      supabaseRequest(supabaseUrl, anonKey, "/categories?select=*&order=sort_order.asc,name.asc"),
      supabaseRequest(supabaseUrl, anonKey, "/products?select=*&order=featured.desc,updated_at.desc"),
      supabaseRequest(supabaseUrl, anonKey, "/product_variations?select=*&order=created_at.asc"),
      supabaseRpc(supabaseUrl, anonKey, "list_store_inventory_availability").catch((error) => {
        console.warn("Nao foi possivel carregar disponibilidade reservada:", error);
        return [];
      }),
    ]);

    const inventoryByKey = availabilityMap(inventoryRows);
    const productsWithAvailability = productRows.map((product) => applyAvailability(product, inventoryByKey.get(`product:${product.id}`)));
    const variationsWithAvailability = variationRows.map((variation) => applyAvailability(variation, inventoryByKey.get(`variation:${variation.id}`)));
    const publicCategories = categoryRows.filter((category) => category.active !== false);
    const categoriesById = new Map(publicCategories.map((category) => [category.id, category]));
    const variationsByProduct = variationsWithAvailability.reduce((map, variation) => {
      const list = map.get(variation.product_id) || [];
      list.push(variation);
      map.set(variation.product_id, list);
      return map;
    }, new Map());

    const publicProducts = productsWithAvailability
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
