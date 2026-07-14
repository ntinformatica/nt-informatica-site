import {
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Gamepad2,
  Home,
  Import,
  Layers3,
  LogOut,
  Menu,
  MessageSquareText,
  Monitor,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { businessName } from "../data/siteData";
import {
  deleteStorageFile,
  isSupabaseConfigured,
  storagePathFromPublicUrl,
  supabaseDiagnostics,
  uploadStorageFile,
} from "../lib/supabase";
import { adminRecentChanges, adminSessionKey, adminStatuses } from "./adminData";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./services/categoryService";
import { slugify } from "./services/localStorageHelpers";
import {
  createArenaBlock,
  createArenaReservation,
  deleteArenaReservation,
  deleteArenaStation,
  listArenaData,
  saveArenaStation,
  updateArenaReservationStatus,
  updateArenaSettings,
} from "./services/arenaService";
import {
  createAssembledPc,
  deleteAssembledPc,
  listAssembledPcs,
  pcCategories,
  updateAssembledPc,
  updateAssembledPcFeatured,
  updateAssembledPcPublished,
} from "./services/assembledPcService";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  updateProductFeatured,
  updateProductStatus,
} from "./services/productService";
import { createStockMovement, listStockMovements, previewStockMovement } from "./services/stockService";

const menuItems = [
  ["Dashboard", "/admin", Home],
  ["Produtos", "/admin/produtos", Boxes],
  ["PCs Montados", "/admin/pcs", Monitor],
  ["Categorias", "/admin/categorias", Layers3],
  ["Assistente Codex", "/admin/assistente-codex", FilePlus2],
  ["Arena Gamer", "/admin/arena", Gamepad2],
  ["Avaliações", "/admin/avaliacoes", MessageSquareText],
  ["Conteúdo", "/admin/conteudo", ClipboardList],
  ["Configurações", "/admin/configuracoes", Settings],
];

const emptyProduct = {
  name: "",
  slug: "",
  categoryId: "",
  category: "",
  brand: "",
  model: "",
  price: "",
  promoPrice: "",
  shortDescription: "",
  fullDescription: "",
  mainImage: "",
  images: "",
  gallery: "",
  variations: [],
  stock: 0,
  status: "rascunho",
  featured: false,
  sku: "",
  warranty: "",
  internalNotes: "",
};

const emptyVariation = {
  name: "",
  color: "",
  price: "",
  promoPrice: "",
  stock: 0,
  sku: "",
  image: "",
  active: true,
};

const emptyPc = {
  name: "",
  slug: "",
  category: "Gamer de entrada",
  shortDescription: "",
  fullDescription: "",
  processor: "",
  motherboard: "",
  memory: "",
  storage: "",
  graphicsCard: "",
  powerSupply: "",
  caseModel: "",
  cooling: "",
  operatingSystem: "",
  price: "",
  promoPrice: "",
  stock: 0,
  warranty: "",
  mainImage: "",
  images: "",
  gallery: "",
  featured: false,
  published: false,
  internalNotes: "",
};

const pcImageBucket = "assembled-pcs";
const maxPcImageSize = 8 * 1024 * 1024;
const allowedPcImageTypes = ["image/jpeg", "image/png", "image/webp"];

function textToList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value) {
  return [...new Set((value || []).filter(Boolean))].join("\n");
}

function extensionFromFile(file) {
  const fallback = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : fallback;
}

function uniqueImagePath(folder, file) {
  const safeFolder = slugify(folder || `pc-${Date.now()}`) || `pc-${Date.now()}`;
  const randomPart = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${safeFolder}/${Date.now()}-${randomPart}.${extensionFromFile(file)}`;
}

function validatePcImage(file) {
  if (!allowedPcImageTypes.includes(file.type)) return "Formato de arquivo não permitido.";
  if (file.size > maxPcImageSize) return "Arquivo acima do limite de 8 MB.";
  return "";
}

const emptyCodexAssistantForm = {
  mainLink: "",
  notes: "",
};

const emptyCodexAssistantVariation = {
  name: "",
  link: "",
  price: "",
  promoPrice: "",
  stock: 0,
  warranty: "",
};

function parseMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value)
    .trim()
    .replace(/[R$\s]/g, "");
  if (!raw) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot !== -1) {
    const [integerPart, decimalPart = ""] = raw.split(".");
    normalized = decimalPart.length === 3 && integerPart.length <= 3
      ? raw.replace(/\./g, "")
      : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  const parsed = parseMoney(value);
  if (parsed === null) return "Consulte";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function calculateCashPrice(value) {
  const parsed = parseMoney(value);
  return parsed === null ? "" : (parsed * 0.85).toFixed(2);
}

function routeInfo(pathname) {
  const cleanPath = pathname.replace(/\/$/, "") || "/admin";
  if (cleanPath === "/admin/login") return { page: "login" };
  if (cleanPath === "/admin/pcs/novo") return { page: "pcForm", mode: "new" };
  if (cleanPath.startsWith("/admin/pcs/editar/")) {
    return { page: "pcForm", mode: "edit", id: decodeURIComponent(cleanPath.replace("/admin/pcs/editar/", "")) };
  }
  if (cleanPath === "/admin/pcs") return { page: "pcs" };
  if (cleanPath === "/admin/produtos/novo") return { page: "productForm", mode: "new" };
  if (cleanPath.startsWith("/admin/produtos/editar/")) {
    return { page: "productForm", mode: "edit", id: decodeURIComponent(cleanPath.replace("/admin/produtos/editar/", "")) };
  }
  if (cleanPath === "/admin/produtos") return { page: "products" };
  if (cleanPath === "/admin/categorias") return { page: "categories" };
  if (cleanPath === "/admin/assistente-codex") return { page: "codexAssistant" };
  if (cleanPath === "/admin/arena") return { page: "arena" };
  if (cleanPath === "/admin/configuracoes") return { page: "settings" };
  if (cleanPath === "/admin/avaliacoes") return { page: "placeholder", title: "Avaliações" };
  if (cleanPath === "/admin/conteudo") return { page: "placeholder", title: "Conteúdo" };
  return { page: "dashboard" };
}

function normalizeProductForm(product, categories) {
  const firstCategory = categories[0];
  const category = categories.find((item) => item.id === product?.categoryId || item.name === product?.category);
  return {
    ...emptyProduct,
    ...product,
    categoryId: category?.id || product?.categoryId || firstCategory?.id || "",
    category: category?.name || product?.category || firstCategory?.name || "",
    variations: Array.isArray(product?.variations) ? product.variations : [],
  };
}

function normalizePcForm(pc) {
  return {
    ...emptyPc,
    ...pc,
    category: pc?.category || emptyPc.category,
  };
}

function AdminButton({ children, icon: Icon, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-nt-blue text-white hover:bg-nt-cyan",
    secondary: "border border-slate-700 bg-white/5 text-slate-100 hover:border-nt-cyan",
    danger: "border border-red-400/40 bg-red-500/10 text-red-100 hover:bg-red-500/20",
    ghost: "text-slate-300 hover:bg-white/8 hover:text-white",
  };

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    >
      {Icon ? <Icon size={17} /> : null}
      {children}
    </button>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("admin@ntinformatica.local");

  function handleSubmit(event) {
    event.preventDefault();
    localStorage.setItem(adminSessionKey, JSON.stringify({ email, startedAt: new Date().toISOString() }));
    window.location.href = "/admin";
  }

  return (
    <main className="min-h-screen bg-nt-ink px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <form onSubmit={handleSubmit} className="glass w-full rounded-lg p-7 shadow-card">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-nt-cyan">Painel NT</p>
          <h1 className="mt-3 text-3xl font-black">Entrar no administrativo</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Painel preparado para Supabase, com fallback local quando as variáveis não estiverem configuradas.
          </p>
          <TextField label="E-mail" value={email} onChange={setEmail} className="mt-6" />
          <TextField label="Senha" value="prototipo" onChange={() => {}} type="password" readOnly />
          <AdminButton type="submit" className="mt-6 w-full" icon={CheckCircle2}>Acessar painel</AdminButton>
          <a href="/" className="mt-4 block text-center text-sm font-semibold text-slate-400 hover:text-white">Voltar ao site</a>
        </form>
      </section>
    </main>
  );
}

function AdminShell({ children, title, subtitle, mobileOpen, setMobileOpen, mode, notice }) {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/admin";

  function logout() {
    localStorage.removeItem(adminSessionKey);
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-white/10 bg-[#0b111d] p-4 transition lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <a href="/admin" className="leading-tight">
            <strong className="block text-lg">NT Admin</strong>
            <span className="text-xs font-semibold text-nt-cyan">{businessName}</span>
          </a>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X /></button>
        </div>
        <div className={`mt-5 rounded-md border px-3 py-2 text-xs font-bold ${mode === "Supabase" ? "border-lime-300/30 bg-lime-300/10 text-lime-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
          Modo: {mode}
        </div>
        <nav className="mt-6 grid gap-1">
          {menuItems.map(([label, href, Icon]) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <a key={href} href={href} className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition ${active ? "bg-nt-cyan/12 text-nt-cyan" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
                <Icon size={18} />
                {label}
              </a>
            );
          })}
          <button onClick={logout} className="mt-5 flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-bold text-slate-300 hover:bg-white/5 hover:text-white">
            <LogOut size={18} />
            Sair
          </button>
        </nav>
      </aside>
      {mobileOpen ? <button className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação" /> : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b12]/88 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-nt-cyan">Painel administrativo</p>
              <h1 className="text-xl font-black sm:text-2xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <a href="/" className="hidden rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-nt-cyan sm:inline-flex">
                Ver site
              </a>
              <button className="grid h-11 w-11 place-items-center rounded-md border border-slate-700 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
                <Menu />
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {notice ? <div className="mb-5 rounded-md border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">{notice}</div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = "cyan" }) {
  const tones = {
    cyan: "text-nt-cyan bg-nt-cyan/10",
    green: "text-lime-300 bg-lime-300/10",
    amber: "text-amber-300 bg-amber-300/10",
    red: "text-red-300 bg-red-300/10",
  };

  return (
    <div className="glass rounded-lg p-5 shadow-card">
      <div className={`mb-5 grid h-11 w-11 place-items-center rounded-md ${tones[tone]}`}>
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Dashboard({ products, categories, pcs }) {
  const totals = {
    products: products.length,
    featured: products.filter((item) => item.featured).length,
    soldOut: products.filter((item) => item.status === "esgotado").length,
    categories: categories.length,
    pcs: pcs.length,
    pcsPublished: pcs.filter((item) => item.published).length,
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="Total de produtos" value={totals.products} icon={Boxes} />
        <SummaryCard label="Produtos em destaque" value={totals.featured} icon={Star} tone="green" />
        <SummaryCard label="Produtos esgotados" value={totals.soldOut} icon={X} tone="red" />
        <SummaryCard label="Categorias cadastradas" value={totals.categories} icon={Layers3} />
        <SummaryCard label="PCs montados" value={totals.pcs} icon={Monitor} tone="amber" />
        <SummaryCard label="PCs publicados" value={totals.pcsPublished} icon={CheckCircle2} tone="green" />
        <SummaryCard label="Últimas alterações" value={adminRecentChanges.length} icon={BarChart3} />
      </div>
      <section className="glass rounded-lg p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">Produtos recentes</h2>
          <a href="/admin/produtos" className="text-sm font-bold text-nt-cyan hover:text-white">Ver todos</a>
        </div>
        <div className="mt-5 grid gap-3">
          {products.slice(0, 5).map((product) => (
            <div key={product.id} className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">{product.name}</p>
                <p className="text-sm text-slate-400">{product.category} · {product.status}</p>
              </div>
              <span className="text-sm font-black text-nt-cyan">{formatCurrency(product.promoPrice || product.price)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ImportModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4">
      <div className="glass w-full max-w-xl rounded-lg p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-nt-cyan">Importador inteligente</p>
            <h2 className="mt-2 text-2xl font-black">Importar produto por link</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar modal"><X /></button>
        </div>
        <label className="mt-6 block text-sm font-bold text-slate-200">
          URL do produto
          <input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" placeholder="Cole o link da Kabum, Pichau, Mercado Livre..." />
        </label>
        <div className="mt-5 rounded-md border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          Nesta primeira fase, a importação automática ainda não está ativa. Esta função será integrada depois.
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <AdminButton variant="secondary" onClick={onClose}>Cancelar</AdminButton>
          <AdminButton icon={UploadCloud} onClick={onClose}>Gerar rascunho</AdminButton>
        </div>
      </div>
    </div>
  );
}

function StockMovementModal({ product, open, onClose, onMove }) {
  const [form, setForm] = useState({
    variationId: "",
    type: "entrada",
    quantity: 1,
    reason: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        variationId: "",
        type: "entrada",
        quantity: 1,
        reason: "",
        notes: "",
      });
    }
  }, [open, product?.id]);

  if (!open || !product) return null;

  const selectedVariation = form.variationId
    ? product.variations?.find((variation) => variation.id === form.variationId)
    : null;
  const currentStock = Number(selectedVariation ? selectedVariation.stock : product.stock) || 0;
  const previewStock = previewStockMovement(currentStock, form.type, form.quantity);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const success = await onMove(product, form);
    if (success) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#0b111d] p-6 text-white shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-nt-cyan">Controle de estoque</p>
            <h2 className="mt-2 text-2xl font-black">{product.name}</h2>
            <p className="mt-1 text-sm text-slate-400">Estoque atual: <strong className="text-white">{currentStock}</strong></p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SelectField
            label="Item"
            value={form.variationId}
            onChange={(value) => updateField("variationId", value)}
            options={[
              ["", "Produto principal"],
              ...(product.variations || []).map((variation) => [variation.id, `${variation.name || variation.color || "Variacao"} - estoque ${variation.stock ?? 0}`]),
            ]}
          />
          <SelectField
            label="Tipo"
            value={form.type}
            onChange={(value) => updateField("type", value)}
            options={[
              ["entrada", "Entrada"],
              ["saida", "Saida"],
              ["ajuste", "Ajuste"],
            ]}
          />
          <TextField
            label={form.type === "ajuste" ? "Novo estoque" : "Quantidade"}
            type="number"
            value={form.quantity}
            onChange={(value) => updateField("quantity", Number(value))}
            min="1"
            step="1"
          />
          <div className="rounded-md border border-slate-700 bg-slate-950 p-4 text-sm">
            <p className="font-bold text-slate-200">Previa da movimentacao</p>
            <p className="mt-2 text-slate-400">Antes: <strong className="text-white">{currentStock}</strong></p>
            <p className="mt-1 text-slate-400">Depois: <strong className="text-lime-200">{previewStock}</strong></p>
          </div>
          <TextField label="Motivo" value={form.reason} onChange={(value) => updateField("reason", value)} placeholder="Compra, venda, correcao, inventario..." />
          <TextField label="Observacoes" value={form.notes} onChange={(value) => updateField("notes", value)} placeholder="Detalhes internos opcionais" />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <AdminButton type="button" variant="secondary" onClick={onClose}>Cancelar</AdminButton>
          <AdminButton type="submit" icon={ClipboardList}>Salvar movimentacao</AdminButton>
        </div>
      </form>
    </div>
  );
}

function StockHistory({ movements }) {
  if (!movements?.length) {
    return (
      <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
        Nenhuma movimentação de estoque registrada para este produto.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="hidden grid-cols-[0.45fr_0.45fr_0.6fr_0.6fr_1fr] border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 lg:grid">
        <span>Tipo</span>
        <span>Qtd.</span>
        <span>Antes</span>
        <span>Depois</span>
        <span>Motivo</span>
      </div>
      <div className="divide-y divide-white/10">
        {movements.map((movement) => (
          <article key={movement.id} className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[0.45fr_0.45fr_0.6fr_0.6fr_1fr]">
            <span className="font-bold capitalize text-slate-100">{movement.type}</span>
            <span>{movement.quantity}</span>
            <span>{movement.previousStock}</span>
            <span className="font-bold text-lime-200">{movement.newStock}</span>
            <span className="text-slate-300">
              {movement.reason || "Sem motivo informado"}
              <small className="mt-1 block text-slate-500">{new Date(movement.createdAt).toLocaleString("pt-BR")}</small>
              {movement.notes ? <small className="mt-1 block text-slate-400">{movement.notes}</small> : null}
            </span>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProductsPage({ products, categories, onDelete, onDuplicate, onStatus, onFeatured, onStockMove }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [featured, setFeatured] = useState("Todos");
  const [importOpen, setImportOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "Todas" || product.categoryId === category || product.category === category;
    const matchStatus = status === "Todos" || (status === "publicado" ? product.status !== "rascunho" : product.status === "rascunho");
    const matchFeatured = featured === "Todos" || (featured === "Destaque" ? product.featured : !product.featured);
    return matchSearch && matchCategory && matchStatus && matchFeatured;
  }), [products, search, category, status, featured]);

  return (
    <>
      <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4 xl:grid-cols-[1.2fr_0.75fr_0.65fr_0.65fr_auto_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-500" size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome" className="w-full rounded-md border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none focus:border-nt-cyan" />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option value="Todas">Todas categorias</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option>Todos</option>
          <option value="publicado">Publicado</option>
          <option value="rascunho">Despublicado</option>
        </select>
        <select value={featured} onChange={(event) => setFeatured(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option>Todos</option>
          <option>Destaque</option>
          <option>Sem destaque</option>
        </select>
        <AdminButton icon={Import} variant="secondary" onClick={() => setImportOpen(true)} className="xl:min-w-56">Importar produto por link</AdminButton>
        <a href="/admin/produtos/novo" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-nt-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-nt-cyan">
          <Plus size={17} />
          Novo Produto
        </a>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#0b111d] shadow-card">
        <div className="hidden grid-cols-[1.25fr_0.55fr_0.55fr_0.45fr_0.55fr_1.35fr] border-b border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 lg:grid">
          <span>Produto</span>
          <span>Categoria</span>
          <span>Status</span>
          <span>Estoque</span>
          <span>Preço</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-white/10">
          {filteredProducts.map((product) => (
            <article key={product.id} className="grid gap-4 p-5 lg:grid-cols-[1.25fr_0.55fr_0.55fr_0.45fr_0.55fr_1.35fr] lg:items-center">
              <div>
                <p className="font-black">{product.name}</p>
                <p className="mt-1 text-sm text-slate-400">{product.brand} {product.model} · SKU {product.sku || "sem código"}</p>
                {product.featured ? <span className="mt-2 inline-flex rounded-full bg-lime-300/10 px-3 py-1 text-xs font-bold text-lime-200">Destaque</span> : null}
              </div>
              <p className="text-sm text-slate-300">{product.category}</p>
              <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">{product.status}</span>
              <p className="font-bold">{product.stock ?? 0}</p>
              <p className="font-black text-nt-cyan">{formatCurrency(product.promoPrice || product.price)}</p>
              <div className="flex flex-wrap gap-2">
                <a href={`/admin/produtos/editar/${product.id}`} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:border-nt-cyan">
                  <Pencil size={15} /> Editar
                </a>
                <AdminButton variant="secondary" onClick={() => onDuplicate(product)}>Duplicar</AdminButton>
                <AdminButton variant="secondary" onClick={() => onStatus(product, product.status === "rascunho" ? "disponível" : "rascunho")}>
                  {product.status === "rascunho" ? "Publicar" : "Despublicar"}
                </AdminButton>
                <AdminButton variant="secondary" onClick={() => onFeatured(product, !product.featured)}>
                  {product.featured ? "Remover destaque" : "Destacar"}
                </AdminButton>
                <AdminButton variant="secondary" onClick={() => setStockProduct(product)} icon={ClipboardList}>Movimentar estoque</AdminButton>
                <AdminButton variant="danger" onClick={() => onDelete(product.id)} icon={Trash2}>Excluir</AdminButton>
              </div>
            </article>
          ))}
          {!filteredProducts.length ? (
            <div className="p-8 text-center">
              <p className="text-lg font-black">Nenhum produto cadastrado ainda.</p>
              <p className="mt-2 text-sm text-slate-400">Crie o primeiro produto ou ajuste os filtros atuais.</p>
              <a href="/admin/produtos/novo" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-nt-blue px-4 py-2 text-sm font-bold text-white hover:bg-nt-cyan">
                Cadastrar primeiro produto
              </a>
            </div>
          ) : null}
        </div>
      </section>
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <StockMovementModal product={stockProduct} open={Boolean(stockProduct)} onClose={() => setStockProduct(null)} onMove={onStockMove} />
    </>
  );
}

function ProductFormPage({ mode, productId, products, categories, onSave, onStockMove, error }) {
  const existingProduct = products.find((product) => product.id === productId);
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() => normalizeProductForm(isEdit ? existingProduct : emptyProduct, categories));
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockMovements, setStockMovements] = useState([]);
  const installmentBase = form.price || form.promoPrice;
  const cashPrice = calculateCashPrice(form.price);

  useEffect(() => {
    setForm(normalizeProductForm(isEdit ? existingProduct : emptyProduct, categories));
  }, [productId, products, categories, isEdit]);

  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      if (!isEdit || !existingProduct?.id) {
        setStockMovements([]);
        return;
      }
      const movements = await listStockMovements(existingProduct.id);
      if (mounted) setStockMovements(movements);
    }

    loadHistory();
    return () => {
      mounted = false;
    };
  }, [isEdit, existingProduct?.id]);

  async function handleStockMove(product, movement) {
    const success = await onStockMove(product, movement);
    if (success) {
      const movements = await listStockMovements(product.id);
      setStockMovements(movements);
    }
    return success;
  }

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !isEdit) next.slug = slugify(value);
      if (field === "categoryId") {
        const category = categories.find((item) => item.id === value);
        next.category = category?.name || "";
      }
      return next;
    });
  }

  function updateVariation(index, field, value) {
    setForm((current) => ({
      ...current,
      variations: current.variations.map((variation, itemIndex) => (
        itemIndex === index ? { ...variation, [field]: value } : variation
      )),
    }));
  }

  function addVariation() {
    setForm((current) => ({ ...current, variations: [...current.variations, { ...emptyVariation }] }));
  }

  function removeVariation(index) {
    setForm((current) => ({ ...current, variations: current.variations.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const saved = await onSave(isEdit ? existingProduct.id : null, form);
    if (saved) window.location.href = "/admin/produtos";
  }

  if (isEdit && !existingProduct) {
    return (
      <div className="glass rounded-lg p-6">
        <h2 className="text-2xl font-black">Produto não encontrado</h2>
        <a href="/admin/produtos" className="mt-4 inline-flex text-sm font-bold text-nt-cyan">Voltar para produtos</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {error ? <div className="rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 lg:grid-cols-2">
        <TextField label="Nome do produto" value={form.name} onChange={(value) => updateField("name", value)} required />
        <TextField label="Slug automático" value={form.slug} onChange={(value) => updateField("slug", slugify(value))} required />
        <SelectField label="Categoria" value={form.categoryId} onChange={(value) => updateField("categoryId", value)} options={categories.map((item) => [item.id, item.name])} />
        <TextField label="Marca" value={form.brand} onChange={(value) => updateField("brand", value)} />
        <TextField label="Modelo" value={form.model} onChange={(value) => updateField("model", value)} />
        <TextField label="SKU" value={form.sku} onChange={(value) => updateField("sku", value)} />
        <TextField label="Preço em 10x sem juros" value={form.price} onChange={(value) => updateField("price", value)} placeholder="Ex.: 500" />
        <TextField label="Preço promocional" value={form.promoPrice} onChange={(value) => updateField("promoPrice", value)} placeholder="Ex.: 425" />
        <TextField label="Estoque" type="number" value={form.stock} onChange={(value) => updateField("stock", Number(value))} min="0" step="1" />
        <SelectField label="Status do produto" value={form.status} onChange={(value) => updateField("status", value)} options={adminStatuses.map((item) => [item, item])} />
        <TextField label="Garantia" value={form.warranty} onChange={(value) => updateField("warranty", value)} />
        <div className="rounded-md border border-slate-700 bg-slate-950 p-4 text-sm">
          <p className="font-bold text-slate-200">Cálculo automático</p>
          <p className="mt-2 text-slate-400">10x sem juros: <strong className="text-white">{formatCurrency(installmentBase)}</strong></p>
          <p className="mt-1 text-slate-400">À vista com 15% off: <strong className="text-lime-200">{formatCurrency(cashPrice || form.promoPrice)}</strong></p>
        </div>
        <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={form.status !== "rascunho"} onChange={(event) => updateField("status", event.target.checked ? "disponível" : "rascunho")} />
          Produto publicado
        </label>
        <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={form.featured} onChange={(event) => updateField("featured", event.target.checked)} />
          Produto em destaque
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5">
        <TextareaField label="Descrição curta" value={form.shortDescription} onChange={(value) => updateField("shortDescription", value)} rows={3} />
        <TextareaField label="Descrição completa" value={form.fullDescription} onChange={(value) => updateField("fullDescription", value)} rows={6} />
        <TextField label="Imagem principal" value={form.mainImage} onChange={(value) => updateField("mainImage", value)} placeholder="URL da imagem principal" />
        <TextareaField label="Galeria de imagens por URL" value={form.gallery || form.images} onChange={(value) => updateField("gallery", value)} placeholder="Uma URL por linha" />
        <TextareaField label="Observações internas" value={form.internalNotes} onChange={(value) => updateField("internalNotes", value)} />
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Variações do produto</h2>
            <p className="mt-1 text-sm text-slate-400">Use para cores, versões e preços diferentes dentro do mesmo produto.</p>
          </div>
          <AdminButton type="button" variant="secondary" icon={Plus} onClick={addVariation}>Adicionar variação</AdminButton>
        </div>
        <div className="mt-5 grid gap-4">
          {form.variations.map((variation, index) => (
            <div key={`${variation.sku || variation.name}-${index}`} className="rounded-lg border border-white/10 bg-slate-950 p-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <TextField label="Nome da variação" value={variation.name} onChange={(value) => updateVariation(index, "name", value)} />
                <TextField label="Cor" value={variation.color} onChange={(value) => updateVariation(index, "color", value)} />
                <TextField label="SKU da variação" value={variation.sku} onChange={(value) => updateVariation(index, "sku", value)} />
                <TextField label="Preço" value={variation.price} onChange={(value) => updateVariation(index, "price", value)} />
                <TextField label="Preço promocional" value={variation.promoPrice} onChange={(value) => updateVariation(index, "promoPrice", value)} />
                <TextField label="Estoque" type="number" value={variation.stock} onChange={(value) => updateVariation(index, "stock", Number(value))} min="0" step="1" />
                <TextField label="Imagem da variação" value={variation.image} onChange={(value) => updateVariation(index, "image", value)} />
                <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200">
                  <input type="checkbox" checked={variation.active !== false} onChange={(event) => updateVariation(index, "active", event.target.checked)} />
                  Status ativo
                </label>
                <div className="flex items-end">
                  <AdminButton type="button" variant="danger" icon={Trash2} onClick={() => removeVariation(index)}>Remover</AdminButton>
                </div>
              </div>
            </div>
          ))}
          {!form.variations.length ? <p className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">Nenhuma variação cadastrada para este produto.</p> : null}
        </div>
      </section>

      {isEdit ? (
        <section className="rounded-lg border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Histórico de estoque</h2>
              <p className="mt-1 text-sm text-slate-400">Movimente estoque com motivo para manter a auditoria do produto.</p>
            </div>
            <AdminButton type="button" variant="secondary" icon={ClipboardList} onClick={() => setStockModalOpen(true)}>Movimentar estoque</AdminButton>
          </div>
          <div className="mt-5">
            <StockHistory movements={stockMovements} />
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <a href="/admin/produtos" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-nt-cyan">Cancelar</a>
        <AdminButton type="submit" icon={FilePlus2}>{isEdit ? "Salvar alterações" : "Criar produto"}</AdminButton>
      </div>
      <StockMovementModal product={existingProduct} open={stockModalOpen} onClose={() => setStockModalOpen(false)} onMove={handleStockMove} />
    </form>
  );
}

function PcsPage({ pcs, onDelete, onDuplicate, onPublished, onFeatured }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [published, setPublished] = useState("Todos");
  const [featured, setFeatured] = useState("Todos");

  const filteredPcs = useMemo(() => pcs.filter((pc) => {
    const matchSearch = pc.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "Todas" || pc.category === category;
    const matchPublished = published === "Todos" || (published === "Publicado" ? pc.published : !pc.published);
    const matchFeatured = featured === "Todos" || (featured === "Destaque" ? pc.featured : !pc.featured);
    return matchSearch && matchCategory && matchPublished && matchFeatured;
  }), [pcs, search, category, published, featured]);

  return (
    <>
      <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4 xl:grid-cols-[1.2fr_0.75fr_0.65fr_0.65fr_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-500" size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar PC por nome" className="w-full rounded-md border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none focus:border-nt-cyan" />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option>Todas</option>
          {pcCategories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={published} onChange={(event) => setPublished(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option>Todos</option>
          <option>Publicado</option>
          <option>Despublicado</option>
        </select>
        <select value={featured} onChange={(event) => setFeatured(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option>Todos</option>
          <option>Destaque</option>
          <option>Sem destaque</option>
        </select>
        <a href="/admin/pcs/novo" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-nt-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-nt-cyan">
          <Plus size={17} />
          Novo PC
        </a>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#0b111d] shadow-card">
        <div className="hidden grid-cols-[1.2fr_0.7fr_0.55fr_0.45fr_0.55fr_1.35fr] border-b border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 lg:grid">
          <span>Computador</span>
          <span>Categoria</span>
          <span>Status</span>
          <span>Estoque</span>
          <span>Preço</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-white/10">
          {filteredPcs.map((pc) => (
            <article key={pc.id} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.7fr_0.55fr_0.45fr_0.55fr_1.35fr] lg:items-center">
              <div>
                <p className="font-black">{pc.name}</p>
                <p className="mt-1 text-sm text-slate-400">{pc.processor || "Processador não informado"} · {pc.graphicsCard || "Vídeo não informado"}</p>
                {pc.featured ? <span className="mt-2 inline-flex rounded-full bg-lime-300/10 px-3 py-1 text-xs font-bold text-lime-200">Destaque</span> : null}
              </div>
              <p className="text-sm text-slate-300">{pc.category}</p>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${pc.published ? "border-lime-300/30 bg-lime-300/10 text-lime-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
                {pc.published ? "Publicado" : "Despublicado"}
              </span>
              <p className="font-bold">{pc.stock ?? 0}</p>
              <p className="font-black text-nt-cyan">{formatCurrency(pc.promoPrice || pc.price)}</p>
              <div className="flex flex-wrap gap-2">
                <a href={`/admin/pcs/editar/${pc.id}`} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:border-nt-cyan">
                  <Pencil size={15} /> Editar
                </a>
                <AdminButton variant="secondary" onClick={() => onDuplicate(pc)}>Duplicar</AdminButton>
                <AdminButton variant="secondary" onClick={() => onPublished(pc, !pc.published)}>
                  {pc.published ? "Despublicar" : "Publicar"}
                </AdminButton>
                <AdminButton variant="secondary" onClick={() => onFeatured(pc, !pc.featured)}>
                  {pc.featured ? "Remover destaque" : "Destacar"}
                </AdminButton>
                <AdminButton variant="danger" onClick={() => onDelete(pc.id)} icon={Trash2}>Excluir</AdminButton>
              </div>
            </article>
          ))}
          {!filteredPcs.length ? (
            <div className="p-8 text-center">
              <p className="text-lg font-black">Nenhum PC montado cadastrado ainda.</p>
              <p className="mt-2 text-sm text-slate-400">Cadastre computadores reais da loja para aparecerem na Home e em /computadores.</p>
              <a href="/admin/pcs/novo" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-nt-blue px-4 py-2 text-sm font-bold text-white hover:bg-nt-cyan">
                Cadastrar primeiro PC
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function PcFormPage({ mode, pcId, pcs, onSave, error }) {
  const existingPc = pcs.find((pc) => pc.id === pcId);
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() => normalizePcForm(isEdit ? existingPc : emptyPc));
  const installmentBase = form.price || form.promoPrice;
  const cashPrice = calculateCashPrice(form.price);

  useEffect(() => {
    setForm(normalizePcForm(isEdit ? existingPc : emptyPc));
  }, [pcId, pcs, isEdit, existingPc]);

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !isEdit) next.slug = slugify(value);
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const saved = await onSave(isEdit ? existingPc.id : null, form);
    if (saved) window.location.href = "/admin/pcs";
  }

  if (isEdit && !existingPc) {
    return (
      <div className="glass rounded-lg p-6">
        <h2 className="text-2xl font-black">PC não encontrado</h2>
        <a href="/admin/pcs" className="mt-4 inline-flex text-sm font-bold text-nt-cyan">Voltar para PCs</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {error ? <div className="rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 lg:grid-cols-2">
        <TextField label="Nome comercial do PC" value={form.name} onChange={(value) => updateField("name", value)} required />
        <TextField label="Slug automático" value={form.slug} onChange={(value) => updateField("slug", slugify(value))} required />
        <SelectField label="Categoria" value={form.category} onChange={(value) => updateField("category", value)} options={pcCategories.map((item) => [item, item])} />
        <TextField label="Preço em 10x sem juros" value={form.price} onChange={(value) => updateField("price", value)} placeholder="Ex.: 2500" />
        <TextField label="Preço promocional" value={form.promoPrice} onChange={(value) => updateField("promoPrice", value)} placeholder="Ex.: 2125" />
        <TextField label="Estoque" type="number" value={form.stock} onChange={(value) => updateField("stock", Number(value))} min="0" step="1" />
        <TextField label="Garantia" value={form.warranty} onChange={(value) => updateField("warranty", value)} />
        <div className="rounded-md border border-slate-700 bg-slate-950 p-4 text-sm">
          <p className="font-bold text-slate-200">Cálculo automático</p>
          <p className="mt-2 text-slate-400">10x sem juros: <strong className="text-white">{formatCurrency(installmentBase)}</strong></p>
          <p className="mt-1 text-slate-400">À vista com 15% off: <strong className="text-lime-200">{formatCurrency(cashPrice || form.promoPrice)}</strong></p>
        </div>
        <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={form.published} onChange={(event) => updateField("published", event.target.checked)} />
          PC publicado
        </label>
        <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={form.featured} onChange={(event) => updateField("featured", event.target.checked)} />
          Destacar na Home
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 lg:grid-cols-2">
        <TextField label="Processador" value={form.processor} onChange={(value) => updateField("processor", value)} />
        <TextField label="Placa-mãe" value={form.motherboard} onChange={(value) => updateField("motherboard", value)} />
        <TextField label="Memória RAM" value={form.memory} onChange={(value) => updateField("memory", value)} />
        <TextField label="Armazenamento" value={form.storage} onChange={(value) => updateField("storage", value)} />
        <TextField label="Placa de vídeo" value={form.graphicsCard} onChange={(value) => updateField("graphicsCard", value)} />
        <TextField label="Fonte" value={form.powerSupply} onChange={(value) => updateField("powerSupply", value)} />
        <TextField label="Gabinete" value={form.caseModel} onChange={(value) => updateField("caseModel", value)} />
        <TextField label="Refrigeração" value={form.cooling} onChange={(value) => updateField("cooling", value)} />
        <TextField label="Sistema operacional" value={form.operatingSystem} onChange={(value) => updateField("operatingSystem", value)} />
      </section>

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5">
        <TextareaField label="Descrição curta" value={form.shortDescription} onChange={(value) => updateField("shortDescription", value)} rows={3} />
        <TextareaField label="Descrição completa" value={form.fullDescription} onChange={(value) => updateField("fullDescription", value)} rows={6} />
        <TextareaField label="Observações internas" value={form.internalNotes} onChange={(value) => updateField("internalNotes", value)} />
      </section>

      <PcImageUploader form={form} updateField={updateField} />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <a href="/admin/pcs" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-nt-cyan">Cancelar</a>
        <AdminButton type="submit" icon={FilePlus2}>{isEdit ? "Salvar alterações" : "Criar PC"}</AdminButton>
      </div>
    </form>
  );
}

function PcImageUploader({ form, updateField }) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const gallery = useMemo(() => {
    const list = [...new Set([form.mainImage, ...textToList(form.gallery || form.images)].filter(Boolean))];
    return list;
  }, [form.mainImage, form.gallery, form.images]);

  function applyImages(nextImages, mainImage = nextImages[0] || "") {
    const cleanImages = [...new Set(nextImages.filter(Boolean))];
    updateField("mainImage", mainImage || cleanImages[0] || "");
    updateField("gallery", listToText(cleanImages.filter((image) => image !== (mainImage || cleanImages[0]))));
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (!isSupabaseConfigured) {
      setMessage("Supabase Storage não configurado.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setMessage("");

    try {
      const uploadedUrls = [];
      const folder = form.slug || form.name || `pc-${Date.now()}`;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const validationError = validatePcImage(file);
        if (validationError) {
          setMessage(validationError);
          continue;
        }

        const result = await uploadStorageFile(
          pcImageBucket,
          uniqueImagePath(folder, file),
          file,
          (itemProgress) => setProgress(Math.round(((index + itemProgress / 100) / files.length) * 100)),
        );
        uploadedUrls.push(result.publicUrl);
      }

      if (uploadedUrls.length) {
        const nextImages = [...gallery, ...uploadedUrls];
        applyImages(nextImages, form.mainImage || uploadedUrls[0]);
        setMessage(uploadedUrls.length === 1 ? "Imagem enviada com sucesso." : "Imagens enviadas com sucesso.");
      }
    } catch (uploadError) {
      console.error(uploadError);
      setMessage(uploadError.message || "Falha no envio da imagem.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function removeImage(image) {
    const nextImages = gallery.filter((item) => item !== image);
    applyImages(nextImages, form.mainImage === image ? nextImages[0] : form.mainImage);

    const storagePath = storagePathFromPublicUrl(pcImageBucket, image);
    if (!storagePath) {
      setMessage("Imagem removida do cadastro.");
      return;
    }

    try {
      await deleteStorageFile(pcImageBucket, storagePath);
      setMessage("Imagem removida do cadastro e do Storage.");
    } catch (removeError) {
      console.warn(removeError);
      setMessage("Imagem removida do cadastro, mas não foi possível excluir do Storage.");
    }
  }

  function moveImage(image, direction) {
    const index = gallery.indexOf(image);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= gallery.length) return;

    const nextImages = [...gallery];
    [nextImages[index], nextImages[targetIndex]] = [nextImages[targetIndex], nextImages[index]];
    applyImages(nextImages, form.mainImage);
  }

  function setAsMain(image) {
    const nextImages = [image, ...gallery.filter((item) => item !== image)];
    applyImages(nextImages, image);
    setMessage("Imagem definida como principal.");
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    uploadFiles(event.dataTransfer.files);
  }

  function updateExternalGallery(value) {
    updateField("gallery", value);
    if (!form.mainImage && textToList(value)[0]) updateField("mainImage", textToList(value)[0]);
  }

  return (
    <section className="grid gap-5 rounded-lg border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-xl font-black text-white">Imagem principal</h2>
        <p className="mt-1 text-sm text-slate-400">Envie fotos reais do computador montado. Formatos: JPG, PNG ou WebP até 8 MB.</p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border border-dashed p-5 transition ${dragging ? "border-nt-cyan bg-nt-cyan/10" : "border-slate-700 bg-slate-950"}`}
      >
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
            {form.mainImage ? (
              <img src={form.mainImage} alt="Imagem principal do PC" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center p-6 text-center text-sm text-slate-400">
                Nenhuma imagem principal selecionada.
              </div>
            )}
          </div>
          <div>
            <p className="text-sm leading-6 text-slate-300">Arraste uma imagem aqui ou selecione no computador. O upload é enviado automaticamente para o bucket <strong>assembled-pcs</strong>.</p>
            <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md bg-nt-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-nt-cyan">
              Selecionar imagem
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => uploadFiles(event.target.files)} />
            </label>
            {uploading ? (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-nt-cyan transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs font-bold text-nt-cyan">{progress}% enviado</p>
              </div>
            ) : null}
            {message ? <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm text-slate-200">{message}</p> : null}
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Galeria do PC</h2>
            <p className="mt-1 text-sm text-slate-400">Adicione várias fotos, defina a principal e ajuste a ordem.</p>
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-nt-cyan">
            Selecionar várias imagens
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => uploadFiles(event.target.files)} />
          </label>
        </div>

        {gallery.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {gallery.map((image, index) => (
              <article key={image} className="rounded-lg border border-white/10 bg-slate-950 p-3">
                <img src={image} alt="" className="aspect-square w-full rounded-md object-cover" />
                {image === form.mainImage ? <p className="mt-3 rounded-full bg-lime-300/10 px-3 py-1 text-center text-xs font-bold text-lime-200">Principal</p> : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <AdminButton type="button" variant="secondary" className="px-2 text-xs" onClick={() => setAsMain(image)}>Principal</AdminButton>
                  <AdminButton type="button" variant="danger" className="px-2 text-xs" onClick={() => removeImage(image)}>Remover</AdminButton>
                  <AdminButton type="button" variant="secondary" className="px-2 text-xs" disabled={index === 0} onClick={() => moveImage(image, -1)}>Subir</AdminButton>
                  <AdminButton type="button" variant="secondary" className="px-2 text-xs" disabled={index === gallery.length - 1} onClick={() => moveImage(image, 1)}>Descer</AdminButton>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">Nenhuma imagem na galeria.</p>
        )}
      </div>

      <details open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} className="rounded-lg border border-slate-700 bg-slate-950 p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-200">Opções avançadas: usar URL externa</summary>
        <div className="mt-4 grid gap-4">
          <TextField label="URL externa da imagem principal" value={form.mainImage} onChange={(value) => updateField("mainImage", value)} placeholder="https://..." />
          <TextareaField label="URLs externas da galeria" value={form.gallery || form.images} onChange={updateExternalGallery} placeholder="Uma URL por linha" />
        </div>
      </details>
    </section>
  );
}

function hasVariationData(variation) {
  return Boolean(
    variation.name
    || variation.link
    || variation.price
    || variation.promoPrice
    || Number(variation.stock || 0)
    || variation.warranty,
  );
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateCodexAssistantLinks(form, variations) {
  const errors = [];
  const links = [];

  if (!form.mainLink.trim()) {
    errors.push("Informe o link principal do produto.");
  } else if (!isValidHttpUrl(form.mainLink.trim())) {
    errors.push("O link principal deve começar com http:// ou https://.");
  } else {
    links.push(["Link principal", form.mainLink.trim()]);
  }

  variations.forEach((variation, index) => {
    if (!hasVariationData(variation)) return;

    if (!variation.link.trim()) {
      errors.push(`A variação ${index + 1} tem dados preenchidos, mas está sem link.`);
      return;
    }

    if (!isValidHttpUrl(variation.link.trim())) {
      errors.push(`O link da variação ${index + 1} deve começar com http:// ou https://.`);
      return;
    }

    links.push([`Variação ${index + 1}`, variation.link.trim()]);
  });

  const seen = new Map();
  for (const [label, link] of links) {
    const normalized = link.replace(/\/+$/, "").toLowerCase();
    if (seen.has(normalized)) {
      errors.push(`Link duplicado encontrado em ${seen.get(normalized)} e ${label}.`);
    } else {
      seen.set(normalized, label);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    success: errors.length === 0
      ? `Links validados com sucesso. ${links.length} link(s) pronto(s) para o prompt.`
      : "",
  };
}

function buildCodexAssistantPrompt(form, variations) {
  const validVariations = variations.filter(hasVariationData);
  const variationLines = validVariations
    .map((variation, index) => `
Variacao ${index + 1}:
- Nome da variacao informado pela loja: ${variation.name || "Nao informado"}
- Link da variacao: ${variation.link || "Nao informado"}
- Preco de venda: ${variation.price || "Nao informado"}
- Preco promocional opcional: ${variation.promoPrice || "Nao informado"}
- Estoque: ${variation.stock ?? 0}
- Garantia opcional: ${variation.warranty || "Nao informado"}`)
    .join("\n");

  return `Acesse os links abaixo e gere um SQL seguro de importacao para o Supabase da NT Informatica.

IMPORTANTE:
- Nao altere arquivos do projeto.
- Nao execute SQL.
- Nao faca git push.
- Apenas devolva o SQL completo pronto para colar no Supabase SQL Editor.

Tabelas permitidas:
- categories
- products
- product_variations

Links e dados fornecidos pela loja:
- Link principal do produto: ${form.mainLink || "Nao informado"}
- Observacoes opcionais: ${form.notes || "Sem observacoes."}

Variacoes informadas:
${variationLines || "Sem variacoes informadas. Use o link principal como fonte unica."}

Tarefas para o Codex:
1. Acessar o link principal e os links de variacoes informados.
2. Extrair automaticamente dos links:
   - nome do produto;
   - marca;
   - modelo;
   - categoria mais adequada;
   - descricao curta;
   - descricao completa;
   - especificacoes tecnicas;
   - imagem principal;
   - galeria completa de imagens;
   - imagens especificas de cada variacao;
   - cores;
   - capacidade, quando existir;
   - caracteristicas relevantes.
3. Preencher no SQL:
   - products.main_image com a melhor imagem principal encontrada;
   - products.images com a galeria completa de imagens;
   - product_variations.image com a imagem correspondente de cada variacao;
   - descriptions, slug, categoria, preco, estoque, garantia e demais campos disponiveis.
4. Se algum link nao permitir extrair imagens automaticamente, informe isso claramente em comentario SQL e sugira preenchimento manual das imagens no SQL.
5. Gerar SQL seguro usando apenas categories, products e product_variations.
6. Nao duplicar produtos por slug.
7. Nao duplicar categorias por slug.
8. Nao duplicar variacoes pela combinacao produto + SKU + nome + cor.
9. Atualizar produto existente quando necessario.
10. Criar o produto como disponivel.
11. Usar upsert/on conflict quando fizer sentido.
12. O SQL precisa ser seguro para executar mais de uma vez.

Resultado esperado:
- Retorne apenas o SQL completo.
- Nao inclua explicacoes fora do SQL.`;
}

function CodexAssistantPage() {
  const [form, setForm] = useState(emptyCodexAssistantForm);
  const [variations, setVariations] = useState([{ ...emptyCodexAssistantVariation }]);
  const [prompt, setPrompt] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [validation, setValidation] = useState({ valid: false, errors: [], success: "" });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setValidation({ valid: false, errors: [], success: "" });
  }

  function updateVariation(index, field, value) {
    setVariations((current) => current.map((variation, itemIndex) => (
      itemIndex === index ? { ...variation, [field]: value } : variation
    )));
    setValidation({ valid: false, errors: [], success: "" });
  }

  function addVariation() {
    setVariations((current) => [...current, { ...emptyCodexAssistantVariation }]);
  }

  function removeVariation(index) {
    setVariations((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  }

  function validateLinks() {
    const result = validateCodexAssistantLinks(form, variations);
    setValidation(result);
    return result.valid;
  }

  function generatePrompt() {
    if (!validateLinks()) return;
    setCopyStatus("");
    setPrompt(buildCodexAssistantPrompt(form, variations));
  }

  async function copyPrompt() {
    if (!prompt && !validateLinks()) return;
    const text = prompt || buildCodexAssistantPrompt(form, variations);
    setPrompt(text);

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Prompt copiado.");
    } catch {
      setCopyStatus("Nao foi possivel copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="glass rounded-lg p-5 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-nt-cyan">Cadastro assistido</p>
            <h2 className="mt-2 text-2xl font-black">Assistente Codex</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Informe apenas os links do fornecedor, preços e estoque. O Codex utilizará esses links para extrair automaticamente nome, marca, modelo, descrições, especificações, imagens e variações.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <AdminButton variant="secondary" icon={CheckCircle2} onClick={validateLinks}>Validar links</AdminButton>
            <AdminButton icon={FilePlus2} onClick={generatePrompt}>Gerar prompt para Codex</AdminButton>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-5 md:grid-cols-8">
        {["Fornecedor", "Links", "Assistente Codex", "Prompt", "Codex extrai dados e imagens", "SQL", "Supabase", "NT Admin + Site Publico"].map((step, index) => (
          <div key={step} className="rounded-md border border-white/10 bg-slate-950 p-3 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-nt-cyan">{index + 1}</p>
            <p className="mt-2 text-sm font-black text-white">{step}</p>
            {index < 7 ? <p className="mt-2 text-lg text-slate-500">↓</p> : null}
          </div>
        ))}
      </section>

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5">
        <TextField label="Link principal do produto" value={form.mainLink} onChange={(value) => updateField("mainLink", value)} required placeholder="https://..." />
        <TextareaField label="Observações" value={form.notes} onChange={(value) => updateField("notes", value)} placeholder="Ex.: priorizar imagens reais, produto com duas cores, garantia da loja..." />
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Variacoes</h2>
            <p className="mt-1 text-sm text-slate-400">Informe nome, link, preço, estoque e garantia quando houver variação.</p>
          </div>
          <AdminButton type="button" variant="secondary" icon={Plus} onClick={addVariation}>Adicionar variação</AdminButton>
        </div>
        <div className="mt-5 grid gap-4">
          {variations.map((variation, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-slate-950 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-black">Variação {index + 1}</h3>
                <AdminButton type="button" variant="danger" icon={Trash2} onClick={() => removeVariation(index)}>Remover</AdminButton>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <TextField label="Nome da variação" value={variation.name} onChange={(value) => updateVariation(index, "name", value)} placeholder="Preto, Branco, Vermelho..." />
                <TextField label="Link da variação" value={variation.link} onChange={(value) => updateVariation(index, "link", value)} placeholder="https://..." />
                <TextField label="Preço de venda" value={variation.price} onChange={(value) => updateVariation(index, "price", value)} />
                <TextField label="Preço promocional opcional" value={variation.promoPrice} onChange={(value) => updateVariation(index, "promoPrice", value)} />
                <TextField label="Estoque" type="number" value={variation.stock} onChange={(value) => updateVariation(index, "stock", Number(value))} />
                <TextField label="Garantia opcional" value={variation.warranty} onChange={(value) => updateVariation(index, "warranty", value)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {(validation.errors.length || validation.success) ? (
        <section className={`rounded-lg border p-5 ${validation.valid ? "border-lime-300/30 bg-lime-300/10 text-lime-100" : "border-red-400/40 bg-red-500/10 text-red-100"}`}>
          <h2 className="text-lg font-black">{validation.valid ? "Links validados" : "Corrija os links"}</h2>
          {validation.success ? <p className="mt-2 text-sm">{validation.success}</p> : null}
          {validation.errors.length ? (
            <ul className="mt-3 grid gap-2 text-sm">
              {validation.errors.map((error) => <li key={error}>- {error}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Prompt gerado</h2>
            <p className="mt-1 text-sm text-slate-400">Copie e cole este texto em uma conversa do Codex para gerar somente o SQL.</p>
          </div>
          <AdminButton type="button" variant="secondary" icon={ClipboardList} onClick={copyPrompt}>Copiar prompt</AdminButton>
        </div>
        {copyStatus ? <div className="rounded-md border border-lime-300/30 bg-lime-300/10 p-3 text-sm text-lime-100">{copyStatus}</div> : null}
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={18}
          placeholder="Clique em Gerar prompt para Codex."
          className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-white outline-none focus:border-nt-cyan"
        />
      </section>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", className = "", ...props }) {
  return (
    <label className={`block text-sm font-bold text-slate-200 ${className}`}>
      {label}
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"
        {...props}
      />
    </label>
  );
}

function TextareaField({ label, value, onChange, rows = 4, ...props }) {
  return (
    <label className="block text-sm font-bold text-slate-200">
      {label}
      <textarea
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"
        {...props}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block text-sm font-bold text-slate-200">
      {label}
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function CategoriesPage({ categories, products, onCreate, onUpdate, onDelete, error }) {
  const [form, setForm] = useState({ name: "", slug: "", description: "", icon: "", sortOrder: categories.length + 1, active: true });
  const [editingId, setEditingId] = useState(null);

  function editCategory(category) {
    setEditingId(category.id);
    setForm(category);
  }

  async function submit(event) {
    event.preventDefault();
    if (editingId) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    setEditingId(null);
    setForm({ name: "", slug: "", description: "", icon: "", sortOrder: categories.length + 1, active: true });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={submit} className="glass rounded-lg p-5 shadow-card">
        <h2 className="text-xl font-black">{editingId ? "Editar categoria" : "Nova categoria"}</h2>
        {error ? <div className="mt-4 rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
        <div className="mt-5 grid gap-4">
          <TextField label="Nome" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value, slug: current.slug || slugify(value) }))} required />
          <TextField label="Slug" value={form.slug} onChange={(value) => setForm((current) => ({ ...current, slug: slugify(value) }))} required />
          <TextField label="Ordem" type="number" value={form.sortOrder} onChange={(value) => setForm((current) => ({ ...current, sortOrder: Number(value) }))} />
          <TextareaField label="Descrição curta" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
          <TextField label="Ícone opcional" value={form.icon} onChange={(value) => setForm((current) => ({ ...current, icon: value }))} placeholder="Ex.: monitor, keyboard ou URL" />
          <label className="flex items-center gap-3 text-sm font-bold text-slate-200">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
            Categoria ativa
          </label>
          <AdminButton type="submit" icon={FilePlus2}>{editingId ? "Salvar categoria" : "Criar categoria"}</AdminButton>
        </div>
      </form>
      <section className="grid gap-4">
        {categories.map((category) => {
          const total = products.filter((product) => product.categoryId === category.id || product.category === category.name).length;
          return (
            <article key={category.id} className="glass rounded-lg p-5 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xl font-black">{category.icon ? `${category.icon} ` : ""}{category.name}</p>
                  <p className="mt-2 text-sm text-slate-400">{total} produto(s) · slug: {category.slug} · ordem {category.sortOrder}</p>
                  <p className={`mt-2 text-xs font-bold ${category.active ? "text-lime-200" : "text-amber-200"}`}>{category.active ? "Ativa" : "Inativa"}</p>
                  {category.description ? <p className="mt-3 text-sm text-slate-300">{category.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminButton variant="secondary" onClick={() => editCategory(category)} icon={Pencil}>Editar</AdminButton>
                  <AdminButton variant="danger" onClick={() => onDelete(category.id)} icon={Trash2}>Excluir</AdminButton>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function reservationWhatsappHref(reservation) {
  const text = [
    `Olá, ${reservation.customerName}.`,
    `Sobre sua reserva na NT Arena Gamer:`,
    `Equipamento: ${reservation.stationName || "Arena Gamer"}.`,
    `Data: ${reservation.reservationDate}.`,
    `Horário: ${reservation.startTime} até ${reservation.endTime}.`,
    `Status: ${reservation.status}.`,
  ].join("\n");
  return `https://wa.me/5547999309344?text=${encodeURIComponent(text)}`;
}

function ArenaStationForm({ stations, onSave, onDelete }) {
  const [form, setForm] = useState({ id: "", name: "", type: "pc", description: "", active: true, sortOrder: stations.length + 1 });

  function submit(event) {
    event.preventDefault();
    onSave(form);
    setForm({ id: "", name: "", type: "pc", description: "", active: true, sortOrder: stations.length + 1 });
  }

  return (
    <section className="glass rounded-lg p-5 shadow-card">
      <h3 className="text-lg font-black">Equipamentos</h3>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <TextField label="Nome" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
        <SelectField label="Tipo" value={form.type} onChange={(value) => setForm((current) => ({ ...current, type: value }))} options={[["pc", "PC"], ["ps5", "PlayStation 5"]]} />
        <TextField label="Ordem" type="number" value={form.sortOrder} onChange={(value) => setForm((current) => ({ ...current, sortOrder: Number(value) }))} />
        <TextareaField label="Descrição" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} rows={2} />
        <label className="flex items-center gap-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
          Equipamento ativo
        </label>
        <AdminButton type="submit" icon={FilePlus2}>{form.id ? "Salvar equipamento" : "Cadastrar equipamento"}</AdminButton>
      </form>

      <div className="mt-5 grid gap-3">
        {stations.length ? stations.map((station) => (
          <article key={station.id} className="rounded-md border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>{station.name}</strong>
                <p className="text-xs text-slate-400">{station.type.toUpperCase()} · ordem {station.sortOrder} · {station.active ? "ativo" : "inativo"}</p>
              </div>
              <div className="flex gap-2">
                <AdminButton type="button" variant="secondary" onClick={() => setForm(station)} icon={Pencil}>Editar</AdminButton>
                <AdminButton type="button" variant="danger" onClick={() => onDelete(station.id)} icon={Trash2}>Excluir</AdminButton>
              </div>
            </div>
          </article>
        )) : <p className="text-sm text-slate-400">Nenhum equipamento cadastrado.</p>}
      </div>
    </section>
  );
}

function ArenaSettingsForm({ settings, onSave }) {
  const [form, setForm] = useState(settings);
  const days = [
    [0, "Dom"],
    [1, "Seg"],
    [2, "Ter"],
    [3, "Qua"],
    [4, "Qui"],
    [5, "Sex"],
    [6, "Sáb"],
  ];

  useEffect(() => setForm(settings), [settings]);

  function toggleDay(day) {
    setForm((current) => {
      const activeDays = current.activeDays.includes(day)
        ? current.activeDays.filter((item) => item !== day)
        : [...current.activeDays, day].sort();
      return { ...current, activeDays };
    });
  }

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <section className="glass rounded-lg p-5 shadow-card">
      <h3 className="text-lg font-black">Configurações</h3>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <TextField label="Preço por hora" value={form.pricePerHour} onChange={(value) => setForm((current) => ({ ...current, pricePerHour: value }))} />
        <TextField label="Abertura" type="time" value={form.openingTime} onChange={(value) => setForm((current) => ({ ...current, openingTime: value }))} />
        <TextField label="Fechamento" type="time" value={form.closingTime} onChange={(value) => setForm((current) => ({ ...current, closingTime: value }))} />
        <SelectField label="Intervalo" value={form.slotMinutes} onChange={(value) => setForm((current) => ({ ...current, slotMinutes: Number(value) }))} options={[[15, "15 minutos"], [30, "30 minutos"], [60, "60 minutos"]]} />
        <div>
          <p className="text-sm font-bold text-slate-200">Dias ativos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {days.map(([day, label]) => (
              <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-md border px-3 py-2 text-xs font-bold ${form.activeDays.includes(day) ? "border-nt-cyan bg-nt-cyan/15 text-nt-cyan" : "border-slate-700 bg-white/5 text-slate-300"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <TextareaField label="Aviso após reserva" value={form.reservationNotice} onChange={(value) => setForm((current) => ({ ...current, reservationNotice: value }))} rows={2} />
        <AdminButton type="submit" icon={CheckCircle2}>Salvar configurações</AdminButton>
      </form>
    </section>
  );
}

function ArenaPage({ arenaData, onReservationStatus, onDeleteReservation, onCreateReservation, onCreateBlock, onSaveStation, onDeleteStation, onSaveSettings }) {
  const [filters, setFilters] = useState({ date: todayIsoDate(), status: "", stationId: "", query: "" });
  const [manual, setManual] = useState({ stationId: "", reservationDate: todayIsoDate(), startTime: "14:00", durationMinutes: 60, customerName: "", customerPhone: "", notes: "" });
  const [block, setBlock] = useState({ stationId: "", reservationDate: todayIsoDate(), startTime: "12:00", endTime: "13:00", reason: "" });
  const stations = arenaData.stations || [];
  const reservations = arenaData.reservations || [];
  const settings = arenaData.settings || {};
  const today = todayIsoDate();

  useEffect(() => {
    const firstStation = stations[0]?.id || "";
    setManual((current) => ({ ...current, stationId: current.stationId || firstStation }));
    setBlock((current) => ({ ...current, stationId: current.stationId || firstStation }));
  }, [stations]);

  const filteredReservations = reservations.filter((reservation) => {
    const matchesDate = !filters.date || reservation.reservationDate === filters.date;
    const matchesStatus = !filters.status || reservation.status === filters.status;
    const matchesStation = !filters.stationId || reservation.stationId === filters.stationId;
    const query = filters.query.trim().toLowerCase();
    const matchesQuery = !query || `${reservation.customerName} ${reservation.customerPhone}`.toLowerCase().includes(query);
    return matchesDate && matchesStatus && matchesStation && matchesQuery;
  });

  const todayReservations = reservations.filter((reservation) => reservation.reservationDate === today);
  const pending = reservations.filter((reservation) => reservation.status === "pendente");
  const confirmed = reservations.filter((reservation) => reservation.status === "confirmado");
  const blocked = reservations.filter((reservation) => reservation.status === "bloqueado");

  function submitManual(event) {
    event.preventDefault();
    onCreateReservation(manual);
    setManual((current) => ({ ...current, customerName: "", customerPhone: "", notes: "" }));
  }

  function submitBlock(event) {
    event.preventDefault();
    onCreateBlock(block);
    setBlock((current) => ({ ...current, reason: "" }));
  }

  return (
    <div className="grid gap-6">
      {arenaData.localMode ? (
        <div className="rounded-md border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
          Supabase não configurado. A Arena está em modo local de teste e não representa reservas reais.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryCard label="Reservas de hoje" value={todayReservations.length} icon={CalendarDays} />
        <SummaryCard label="Pendentes" value={pending.length} icon={CalendarDays} />
        <SummaryCard label="Confirmadas" value={confirmed.length} icon={CheckCircle2} />
        <SummaryCard label="Bloqueios" value={blocked.length} icon={X} />
      </div>

      <section className="glass rounded-lg p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <TextField label="Data" type="date" value={filters.date} onChange={(value) => setFilters((current) => ({ ...current, date: value }))} />
          <SelectField label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={[["", "Todos"], ["pendente", "Pendente"], ["confirmado", "Confirmado"], ["cancelado", "Cancelado"], ["concluido", "Concluído"], ["bloqueado", "Bloqueado"]]} />
          <SelectField label="Equipamento" value={filters.stationId} onChange={(value) => setFilters((current) => ({ ...current, stationId: value }))} options={[["", "Todos"], ...stations.map((station) => [station.id, station.name])]} />
          <TextField label="Buscar cliente" value={filters.query} onChange={(value) => setFilters((current) => ({ ...current, query: value }))} placeholder="Nome ou WhatsApp" />
        </div>

        <div className="mt-5 grid gap-3">
          {filteredReservations.length ? filteredReservations.map((reservation) => (
            <article key={reservation.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg">{reservation.customerName}</strong>
                    <span className="rounded-full border border-nt-cyan/30 px-2 py-1 text-xs font-bold text-nt-cyan">{reservation.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{reservation.stationName} · {reservation.reservationDate} · {reservation.startTime} até {reservation.endTime}</p>
                  <p className="mt-1 text-sm text-slate-400">{reservation.customerPhone || "Sem telefone"} · {reservation.durationMinutes} min · {formatCurrency(reservation.totalPrice)}</p>
                  {reservation.notes ? <p className="mt-2 text-sm text-slate-300">{reservation.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminButton type="button" variant="secondary" onClick={() => onReservationStatus(reservation.id, "confirmado")} icon={CheckCircle2}>Confirmar</AdminButton>
                  <AdminButton type="button" variant="secondary" onClick={() => onReservationStatus(reservation.id, "concluido")} icon={CheckCircle2}>Concluir</AdminButton>
                  <AdminButton type="button" variant="secondary" onClick={() => onReservationStatus(reservation.id, "cancelado")} icon={X}>Cancelar</AdminButton>
                  <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-700 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-nt-cyan" href={reservationWhatsappHref(reservation)} target="_blank" rel="noreferrer">WhatsApp</a>
                  <AdminButton type="button" variant="danger" onClick={() => onDeleteReservation(reservation.id)} icon={Trash2}>Excluir</AdminButton>
                </div>
              </div>
            </article>
          )) : <p className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Nenhuma reserva encontrada com os filtros atuais.</p>}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="glass rounded-lg p-5 shadow-card">
          <h3 className="text-lg font-black">Criar reserva manual</h3>
          <form onSubmit={submitManual} className="mt-4 grid gap-3">
            <SelectField label="Equipamento" value={manual.stationId} onChange={(value) => setManual((current) => ({ ...current, stationId: value }))} options={stations.map((station) => [station.id, station.name])} />
            <TextField label="Data" type="date" value={manual.reservationDate} onChange={(value) => setManual((current) => ({ ...current, reservationDate: value }))} required />
            <TextField label="Início" type="time" value={manual.startTime} onChange={(value) => setManual((current) => ({ ...current, startTime: value }))} required />
            <SelectField label="Duração" value={manual.durationMinutes} onChange={(value) => setManual((current) => ({ ...current, durationMinutes: Number(value) }))} options={[[30, "30 minutos"], [60, "1 hora"], [120, "2 horas"], [180, "3 horas"]]} />
            <TextField label="Nome do cliente" value={manual.customerName} onChange={(value) => setManual((current) => ({ ...current, customerName: value }))} required />
            <TextField label="WhatsApp" value={manual.customerPhone} onChange={(value) => setManual((current) => ({ ...current, customerPhone: value }))} required />
            <TextareaField label="Observações" value={manual.notes} onChange={(value) => setManual((current) => ({ ...current, notes: value }))} rows={2} />
            <AdminButton type="submit" icon={Plus}>Criar reserva</AdminButton>
          </form>
        </section>

        <section className="glass rounded-lg p-5 shadow-card">
          <h3 className="text-lg font-black">Bloqueio manual de horário</h3>
          <form onSubmit={submitBlock} className="mt-4 grid gap-3">
            <SelectField label="Equipamento" value={block.stationId} onChange={(value) => setBlock((current) => ({ ...current, stationId: value }))} options={stations.map((station) => [station.id, station.name])} />
            <TextField label="Data" type="date" value={block.reservationDate} onChange={(value) => setBlock((current) => ({ ...current, reservationDate: value }))} required />
            <TextField label="Início" type="time" value={block.startTime} onChange={(value) => setBlock((current) => ({ ...current, startTime: value }))} required />
            <TextField label="Fim" type="time" value={block.endTime} onChange={(value) => setBlock((current) => ({ ...current, endTime: value }))} required />
            <TextareaField label="Motivo" value={block.reason} onChange={(value) => setBlock((current) => ({ ...current, reason: value }))} rows={2} />
            <AdminButton type="submit" icon={X}>Bloquear horário</AdminButton>
          </form>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ArenaStationForm stations={stations} onSave={onSaveStation} onDelete={onDeleteStation} />
        <ArenaSettingsForm settings={settings} onSave={onSaveSettings} />
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <section className="glass rounded-lg p-6">
      <h2 className="text-2xl font-black">Configurações</h2>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <TextField label="Nome da empresa" value={businessName} onChange={() => {}} readOnly />
        <TextField label="URL do site" value="https://nt-informatica-site.vercel.app" onChange={() => {}} readOnly />
        <TextField label="Supabase" value={isSupabaseConfigured ? "Configurado" : "Usando fallback local"} onChange={() => {}} readOnly />
        <TextField label="Host Supabase no build" value={supabaseDiagnostics.urlHost || "Nao configurado"} onChange={() => {}} readOnly />
        <TextField label="URL Supabase valida" value={supabaseDiagnostics.validUrl ? "Sim" : "Nao"} onChange={() => {}} readOnly />
        <TextField label="Importador por link" value="Protótipo visual" onChange={() => {}} readOnly />
      </div>
    </section>
  );
}

function PlaceholderPage({ title }) {
  return (
    <section className="glass rounded-lg p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        Área reservada para evolução do painel. Nenhuma informação pública é alterada nesta fase.
      </p>
    </section>
  );
}

export function AdminApp() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pcs, setPcs] = useState([]);
  const [arenaData, setArenaData] = useState({ stations: [], reservations: [], settings: {}, localMode: !isSupabaseConfigured });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const info = routeInfo(currentPath);
  const mode = isSupabaseConfigured ? "Supabase" : "Local";

  async function loadAdminData() {
    setLoading(true);
    setError("");
    try {
      const loadedCategories = await listCategories();
      const loadedProducts = await listProducts(loadedCategories);
      const loadedPcs = await listAssembledPcs();
      const loadedArenaData = await listArenaData();
      setCategories(loadedCategories);
      setProducts(loadedProducts);
      setPcs(loadedPcs);
      setArenaData(loadedArenaData);
      setNotice(isSupabaseConfigured ? "" : "Supabase não configurado. O painel está usando localStorage como fallback.");
    } catch (loadError) {
      console.error(loadError);
      setError("Não foi possível carregar os dados do painel. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (info.page !== "login" && !localStorage.getItem(adminSessionKey)) {
      localStorage.setItem(adminSessionKey, JSON.stringify({ email: "prototipo@nt.local", startedAt: new Date().toISOString() }));
    }
    loadAdminData();
  }, [info.page]);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname);
    }

    function handleAdminLinkClick(event) {
      const link = event.target.closest("a[href^='/admin']");
      if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setCurrentPath(url.pathname);
      setMobileOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleAdminLinkClick);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleAdminLinkClick);
    };
  }, []);

  async function runAction(action, successMessage = "") {
    setError("");
    try {
      await action();
      await loadAdminData();
      if (successMessage) setNotice(successMessage);
      return true;
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Não foi possível concluir a ação.");
      return false;
    }
  }

  async function saveProduct(id, product) {
    return runAction(async () => {
      if (id) await updateProduct(id, product, categories);
      else await createProduct(product, categories);
    }, "Produto salvo com sucesso.");
  }

  async function removeProduct(id) {
    return runAction(async () => deleteProduct(id, categories), "Produto excluído.");
  }

  async function duplicateProduct(product) {
    return runAction(async () => {
      await createProduct(
        {
          ...product,
          id: undefined,
          name: `${product.name} cópia`,
          slug: `${product.slug}-copia-${Date.now()}`,
          status: "rascunho",
          featured: false,
        },
        categories,
      );
    }, "Produto duplicado como rascunho.");
  }

  async function changeProductStatus(product, status) {
    return runAction(async () => updateProductStatus(product.id, status, categories), "Status atualizado.");
  }

  async function changeProductFeatured(product, featured) {
    return runAction(async () => updateProductFeatured(product.id, featured, categories), "Destaque atualizado.");
  }

  async function moveProductStock(product, movement) {
    return runAction(async () => createStockMovement({ product, ...movement }), "Estoque atualizado com sucesso.");
  }

  async function savePc(id, pc) {
    return runAction(async () => {
      if (id) await updateAssembledPc(id, pc);
      else await createAssembledPc(pc);
    }, "PC salvo com sucesso.");
  }

  async function removePc(id) {
    return runAction(async () => deleteAssembledPc(id), "PC excluído.");
  }

  async function duplicatePc(pc) {
    return runAction(async () => {
      await createAssembledPc({
        ...pc,
        id: undefined,
        name: `${pc.name} cópia`,
        slug: `${pc.slug}-copia-${Date.now()}`,
        published: false,
        featured: false,
      });
    }, "PC duplicado como despublicado.");
  }

  async function changePcPublished(pc, published) {
    return runAction(async () => updateAssembledPcPublished(pc.id, published), "Publicação do PC atualizada.");
  }

  async function changePcFeatured(pc, featured) {
    return runAction(async () => updateAssembledPcFeatured(pc.id, featured), "Destaque do PC atualizado.");
  }

  async function addCategory(category) {
    return runAction(async () => createCategory(category), "Categoria criada.");
  }

  async function editCategory(id, category) {
    return runAction(async () => updateCategory(id, category), "Categoria atualizada.");
  }

  async function removeCategory(id) {
    return runAction(async () => deleteCategory(id), "Categoria excluída.");
  }

  async function changeArenaReservationStatus(id, status) {
    return runAction(async () => updateArenaReservationStatus(id, status), "Reserva atualizada.");
  }

  async function removeArenaReservation(id) {
    return runAction(async () => deleteArenaReservation(id), "Reserva excluída.");
  }

  async function addArenaReservation(reservation) {
    return runAction(async () => createArenaReservation(reservation), "Reserva criada como pendente.");
  }

  async function addArenaBlock(block) {
    return runAction(async () => createArenaBlock(block), "Horário bloqueado.");
  }

  async function saveArenaStationAction(station) {
    return runAction(async () => saveArenaStation(station), "Equipamento salvo.");
  }

  async function removeArenaStation(id) {
    return runAction(async () => deleteArenaStation(id), "Equipamento excluído.");
  }

  async function saveArenaSettingsAction(settings) {
    return runAction(async () => updateArenaSettings(settings), "Configurações da Arena salvas.");
  }

  if (info.page === "login") return <LoginPage />;

  const titles = {
    dashboard: ["Dashboard", "Resumo rápido do catálogo e da operação."],
    products: ["Produtos", "Busca, filtros, estoque, publicação e ações rápidas."],
    productForm: [info.mode === "edit" ? "Editar Produto" : "Novo Produto", "Cadastro completo preparado para Supabase."],
    pcs: ["PCs Montados", "Computadores prontos da loja para Home e página pública."],
    pcForm: [info.mode === "edit" ? "Editar PC" : "Novo PC", "Cadastro completo de computadores montados."],
    categories: ["Categorias", "Cadastro de categorias com ordem, status e ícone."],
    codexAssistant: ["Assistente Codex", "Gere prompts para importacao segura de produtos via SQL."],
    arena: ["Arena Gamer", "Reservas, equipamentos e configurações da Arena."],
    settings: ["Configurações", "Status das integrações do painel."],
    placeholder: [info.title, "Área preparada para uma próxima etapa."],
  };
  const [title, subtitle] = titles[info.page] || titles.dashboard;

  return (
    <AdminShell title={title} subtitle={subtitle} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} mode={mode} notice={notice}>
      {error ? <div className="mb-5 rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
      {loading ? <p className="rounded-md border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Carregando dados do painel...</p> : null}
      {!loading && info.page === "dashboard" ? <Dashboard products={products} categories={categories} pcs={pcs} /> : null}
      {!loading && info.page === "products" ? (
        <ProductsPage
          products={products}
          categories={categories}
          onDelete={removeProduct}
          onDuplicate={duplicateProduct}
          onStatus={changeProductStatus}
          onFeatured={changeProductFeatured}
          onStockMove={moveProductStock}
        />
      ) : null}
      {!loading && info.page === "productForm" ? <ProductFormPage mode={info.mode} productId={info.id} products={products} categories={categories} onSave={saveProduct} onStockMove={moveProductStock} error={error} /> : null}
      {!loading && info.page === "pcs" ? <PcsPage pcs={pcs} onDelete={removePc} onDuplicate={duplicatePc} onPublished={changePcPublished} onFeatured={changePcFeatured} /> : null}
      {!loading && info.page === "pcForm" ? <PcFormPage mode={info.mode} pcId={info.id} pcs={pcs} onSave={savePc} error={error} /> : null}
      {!loading && info.page === "categories" ? <CategoriesPage categories={categories} products={products} onCreate={addCategory} onUpdate={editCategory} onDelete={removeCategory} error={error} /> : null}
      {!loading && info.page === "codexAssistant" ? <CodexAssistantPage categories={categories} /> : null}
      {!loading && info.page === "arena" ? (
        <ArenaPage
          arenaData={arenaData}
          onReservationStatus={changeArenaReservationStatus}
          onDeleteReservation={removeArenaReservation}
          onCreateReservation={addArenaReservation}
          onCreateBlock={addArenaBlock}
          onSaveStation={saveArenaStationAction}
          onDeleteStation={removeArenaStation}
          onSaveSettings={saveArenaSettingsAction}
        />
      ) : null}
      {!loading && info.page === "settings" ? <SettingsPage /> : null}
      {!loading && info.page === "placeholder" ? <PlaceholderPage title={info.title} /> : null}
    </AdminShell>
  );
}
