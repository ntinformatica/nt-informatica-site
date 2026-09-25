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

  function normalizeImagePath(value) {
    const image = String(value || "").trim();
    if (!image) return "";
    if (/^https?:\/\//i.test(image)) return image;
    if (/^\/produtos\/assets\//i.test(image)) return image;
    if (/^assets\//i.test(image)) return `/produtos/${image}`;
    return "";
  }

  function normalizeImages(value, mainImage = "") {
    const images = Array.isArray(value) ? value : [];
    return [...new Set([mainImage, ...images]
      .map(normalizeImagePath)
      .filter(Boolean))];
  }

  function publicStatus(status) {
    const normalized = String(status || "rascunho").toLowerCase();
    return !["rascunho", "despublicado", "inativo", "draft", "unpublished"].includes(normalized);
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

  function mapProduct(product, categoriesById) {
    const category = productCategoryName(product, categoriesById);
    const images = normalizeImages(product.images, product.main_image);

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

    const [categoryRows, productRows, inventoryRows] = await Promise.all([
      supabaseRequest(supabaseUrl, anonKey, "/categories?select=*&order=sort_order.asc,name.asc"),
      supabaseRequest(supabaseUrl, anonKey, "/products?select=*&order=featured.desc,updated_at.desc"),
      supabaseRpc(supabaseUrl, anonKey, "list_store_inventory_availability").catch((error) => {
        console.warn("Nao foi possivel carregar disponibilidade reservada:", error);
        return [];
      }),
    ]);

    const inventoryByKey = availabilityMap(inventoryRows);
    const productsWithAvailability = productRows.map((product) => applyAvailability(product, inventoryByKey.get(`product:${product.id}`)));
    const publicCategories = categoryRows.filter((category) => category.active !== false);
    const categoriesById = new Map(publicCategories.map((category) => [category.id, category]));

    const publicProducts = productsWithAvailability
      .filter((product) => publicStatus(product.status))
      .map((product) => mapProduct(product, categoriesById));

    return {
      categories: publicCategories.map(categoryTuple),
      products: publicProducts,
    };
  }

  window.NT_PUBLIC_CATALOG = {
    loadSupabaseCatalog,
  };
}());
