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
import { isSupabaseConfigured } from "../lib/supabase";
import { businessName } from "../data/siteData";
import { adminRecentChanges, adminSessionKey, adminStatuses } from "./adminData";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./services/categoryService";
import { slugify } from "./services/localStorageHelpers";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  updateProductFeatured,
  updateProductStatus,
} from "./services/productService";

const menuItems = [
  ["Dashboard", "/admin", Home],
  ["Produtos", "/admin/produtos", Boxes],
  ["Categorias", "/admin/categorias", Layers3],
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
  images: "",
  gallery: "",
  variations: "",
  stock: 0,
  status: "rascunho",
  featured: false,
  sku: "",
  warranty: "",
  internalNotes: "",
};

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "Consulte";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function routeInfo(pathname) {
  if (pathname === "/admin/login") return { page: "login" };
  if (pathname === "/admin/produtos/novo") return { page: "productForm", mode: "new" };
  if (pathname.startsWith("/admin/produtos/editar/")) {
    return { page: "productForm", mode: "edit", id: decodeURIComponent(pathname.replace("/admin/produtos/editar/", "")) };
  }
  if (pathname === "/admin/produtos") return { page: "products" };
  if (pathname === "/admin/categorias") return { page: "categories" };
  if (pathname === "/admin/arena") return { page: "arena" };
  if (pathname === "/admin/configuracoes") return { page: "settings" };
  if (pathname === "/admin/avaliacoes") return { page: "placeholder", title: "Avaliações" };
  if (pathname === "/admin/conteudo") return { page: "placeholder", title: "Conteúdo" };
  return { page: "dashboard" };
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
            Fase 2 preparada para Supabase. A autenticação real entra em uma próxima etapa.
          </p>
          <label className="mt-6 block text-sm font-bold text-slate-200">
            E-mail
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"
            />
          </label>
          <label className="mt-4 block text-sm font-bold text-slate-200">
            Senha
            <input
              type="password"
              value="prototipo"
              readOnly
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"
            />
          </label>
          <AdminButton type="submit" className="mt-6 w-full" icon={CheckCircle2}>Acessar painel</AdminButton>
          <a href="/" className="mt-4 block text-center text-sm font-semibold text-slate-400 hover:text-white">Voltar ao site</a>
        </form>
      </section>
    </main>
  );
}

function AdminShell({ children, title, subtitle, mobileOpen, setMobileOpen, mode, notice }) {
  const pathname = window.location.pathname;

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

function Dashboard({ products, categories }) {
  const totals = {
    products: products.length,
    featured: products.filter((item) => item.featured).length,
    soldOut: products.filter((item) => item.status === "esgotado").length,
    categories: categories.length,
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="Total de produtos" value={totals.products} icon={Boxes} />
        <SummaryCard label="Produtos em destaque" value={totals.featured} icon={Star} tone="green" />
        <SummaryCard label="Produtos esgotados" value={totals.soldOut} icon={X} tone="red" />
        <SummaryCard label="Categorias cadastradas" value={totals.categories} icon={Layers3} />
        <SummaryCard label="Reservas da Arena" value="0" icon={CalendarDays} tone="amber" />
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
          A importação automática será conectada depois. Nesta fase o banco já está preparado para receber rascunhos.
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <AdminButton variant="secondary" onClick={onClose}>Cancelar</AdminButton>
          <AdminButton icon={UploadCloud} onClick={onClose}>Gerar rascunho</AdminButton>
        </div>
      </div>
    </div>
  );
}

function ProductsPage({ products, categories, onDelete, onDuplicate, onStatus, onFeatured }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [importOpen, setImportOpen] = useState(false);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "Todas" || product.category === category;
    const matchStatus = status === "Todos" || product.status === status;
    return matchSearch && matchCategory && matchStatus;
  }), [products, search, category, status]);

  return (
    <>
      <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_auto_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-500" size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome" className="w-full rounded-md border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none focus:border-nt-cyan" />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option>Todas</option>
          {categories.map((item) => <option key={item.id}>{item.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
          <option>Todos</option>
          {adminStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <AdminButton icon={Import} variant="secondary" onClick={() => setImportOpen(true)} className="xl:min-w-56">Importar produto por link</AdminButton>
        <a href="/admin/produtos/novo" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-nt-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-nt-cyan">
          <Plus size={17} />
          Novo Produto
        </a>
      </div>
      <section className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#0b111d] shadow-card">
        <div className="hidden grid-cols-[1.25fr_0.65fr_0.65fr_0.55fr_1.25fr] border-b border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 lg:grid">
          <span>Produto</span>
          <span>Categoria</span>
          <span>Status</span>
          <span>Preço</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-white/10">
          {filteredProducts.map((product) => (
            <article key={product.id} className="grid gap-4 p-5 lg:grid-cols-[1.25fr_0.65fr_0.65fr_0.55fr_1.25fr] lg:items-center">
              <div>
                <p className="font-black">{product.name}</p>
                <p className="mt-1 text-sm text-slate-400">{product.brand} {product.model} · SKU {product.sku || "sem código"}</p>
              </div>
              <p className="text-sm text-slate-300">{product.category}</p>
              <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">{product.status}</span>
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
                  {product.featured ? "Tirar destaque" : "Destacar"}
                </AdminButton>
                <AdminButton variant="danger" onClick={() => onDelete(product.id)} icon={Trash2}>Excluir</AdminButton>
              </div>
            </article>
          ))}
          {!filteredProducts.length ? <p className="p-6 text-sm text-slate-400">Nenhum produto encontrado com os filtros atuais.</p> : null}
        </div>
      </section>
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}

function ProductFormPage({ mode, productId, products, categories, onSave }) {
  const existingProduct = products.find((product) => product.id === productId);
  const firstCategory = categories[0];
  const [form, setForm] = useState(existingProduct || { ...emptyProduct, categoryId: firstCategory?.id || "", category: firstCategory?.name || "" });
  const isEdit = mode === "edit";

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

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave(isEdit ? existingProduct.id : null, form);
    window.location.href = "/admin/produtos";
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
      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 lg:grid-cols-2">
        <TextField label="Nome" value={form.name} onChange={(value) => updateField("name", value)} required />
        <TextField label="Slug" value={form.slug} onChange={(value) => updateField("slug", value)} required />
        <SelectField label="Categoria" value={form.categoryId} onChange={(value) => updateField("categoryId", value)} options={categories.map((item) => [item.id, item.name])} />
        <TextField label="Marca" value={form.brand} onChange={(value) => updateField("brand", value)} />
        <TextField label="Modelo" value={form.model} onChange={(value) => updateField("model", value)} />
        <TextField label="SKU/código interno" value={form.sku} onChange={(value) => updateField("sku", value)} />
        <TextField label="Preço" value={form.price} onChange={(value) => updateField("price", value)} />
        <TextField label="Preço promocional" value={form.promoPrice} onChange={(value) => updateField("promoPrice", value)} />
        <TextField label="Estoque" type="number" value={form.stock} onChange={(value) => updateField("stock", Number(value))} />
        <SelectField label="Status" value={form.status} onChange={(value) => updateField("status", value)} options={adminStatuses.map((item) => [item, item])} />
        <TextField label="Garantia" value={form.warranty} onChange={(value) => updateField("warranty", value)} />
        <label className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={form.featured} onChange={(event) => updateField("featured", event.target.checked)} />
          Produto em destaque
        </label>
      </section>
      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5">
        <TextareaField label="Descrição curta" value={form.shortDescription} onChange={(value) => updateField("shortDescription", value)} />
        <TextareaField label="Descrição completa" value={form.fullDescription} onChange={(value) => updateField("fullDescription", value)} rows={6} />
        <TextareaField label="Imagens" value={form.images} onChange={(value) => updateField("images", value)} placeholder="Uma URL por linha" />
        <TextareaField label="Galeria" value={form.gallery} onChange={(value) => updateField("gallery", value)} placeholder="URLs extras, uma por linha" />
        <TextareaField label="Variações" value={form.variations} onChange={(value) => updateField("variations", value)} placeholder="Ex.: Preto: R$ 425 no Pix / Branco: R$ 425 no Pix" />
        <TextareaField label="Observações internas" value={form.internalNotes} onChange={(value) => updateField("internalNotes", value)} />
      </section>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <a href="/admin/produtos" className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-nt-cyan">Cancelar</a>
        <AdminButton type="submit" icon={FilePlus2}>{isEdit ? "Salvar alterações" : "Criar produto"}</AdminButton>
      </div>
    </form>
  );
}

function TextField({ label, value, onChange, type = "text", ...props }) {
  return (
    <label className="block text-sm font-bold text-slate-200">
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

function CategoriesPage({ categories, products, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState({ name: "", slug: "", description: "", sortOrder: categories.length + 1, active: true });
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
    setForm({ name: "", slug: "", description: "", sortOrder: categories.length + 1, active: true });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={submit} className="glass rounded-lg p-5 shadow-card">
        <h2 className="text-xl font-black">{editingId ? "Editar categoria" : "Nova categoria"}</h2>
        <div className="mt-5 grid gap-4">
          <TextField label="Nome" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value, slug: current.slug || slugify(value) }))} required />
          <TextField label="Slug" value={form.slug} onChange={(value) => setForm((current) => ({ ...current, slug: value }))} required />
          <TextField label="Ordem" type="number" value={form.sortOrder} onChange={(value) => setForm((current) => ({ ...current, sortOrder: Number(value) }))} />
          <TextareaField label="Descrição" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
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
                  <p className="text-xl font-black">{category.name}</p>
                  <p className="mt-2 text-sm text-slate-400">{total} produto(s) · slug: {category.slug}</p>
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

function ArenaPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {["Reservas de hoje", "Horários aguardando confirmação", "Planos ativos"].map((label) => (
        <SummaryCard key={label} label={label} value="0" icon={CalendarDays} />
      ))}
      <section className="glass rounded-lg p-6 lg:col-span-3">
        <h2 className="text-2xl font-black">Arena Gamer</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          A integração da Arena com banco online fica para uma próxima fase. Produtos e categorias já estão preparados para Supabase.
        </p>
      </section>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const info = routeInfo(window.location.pathname);
  const mode = isSupabaseConfigured ? "Supabase" : "Local";

  async function loadAdminData() {
    setLoading(true);
    try {
      const loadedCategories = await listCategories();
      const loadedProducts = await listProducts(loadedCategories);
      setCategories(loadedCategories);
      setProducts(loadedProducts);
      setNotice(isSupabaseConfigured ? "" : "Supabase não configurado. O painel está usando localStorage como fallback.");
    } catch (error) {
      console.error(error);
      const fallbackCategories = await listCategories();
      const fallbackProducts = await listProducts(fallbackCategories);
      setCategories(fallbackCategories);
      setProducts(fallbackProducts);
      setNotice("Não foi possível acessar o Supabase. O painel carregou o fallback local.");
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

  async function saveProduct(id, product) {
    if (id) await updateProduct(id, product, categories);
    else await createProduct(product, categories);
    await loadAdminData();
  }

  async function removeProduct(id) {
    await deleteProduct(id, categories);
    await loadAdminData();
  }

  async function duplicateProduct(product) {
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
    await loadAdminData();
  }

  async function changeProductStatus(product, status) {
    await updateProductStatus(product.id, status, categories);
    await loadAdminData();
  }

  async function changeProductFeatured(product, featured) {
    await updateProductFeatured(product.id, featured, categories);
    await loadAdminData();
  }

  async function addCategory(category) {
    await createCategory(category);
    await loadAdminData();
  }

  async function editCategory(id, category) {
    await updateCategory(id, category);
    await loadAdminData();
  }

  async function removeCategory(id) {
    await deleteCategory(id);
    await loadAdminData();
  }

  if (info.page === "login") return <LoginPage />;

  const titles = {
    dashboard: ["Dashboard", "Resumo rápido do catálogo e da operação."],
    products: ["Produtos", "Busca, filtros, publicação e ações rápidas."],
    productForm: [info.mode === "edit" ? "Editar Produto" : "Novo Produto", "Rascunho preparado para Supabase."],
    categories: ["Categorias", "Cadastro real ou local das categorias."],
    arena: ["Arena Gamer", "Base visual para futuras reservas online."],
    settings: ["Configurações", "Status das integrações do painel."],
    placeholder: [info.title, "Área preparada para uma próxima etapa."],
  };
  const [title, subtitle] = titles[info.page] || titles.dashboard;

  return (
    <AdminShell title={title} subtitle={subtitle} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} mode={mode} notice={notice}>
      {loading ? <p className="rounded-md border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Carregando dados do painel...</p> : null}
      {!loading && info.page === "dashboard" ? <Dashboard products={products} categories={categories} /> : null}
      {!loading && info.page === "products" ? (
        <ProductsPage
          products={products}
          categories={categories}
          onDelete={removeProduct}
          onDuplicate={duplicateProduct}
          onStatus={changeProductStatus}
          onFeatured={changeProductFeatured}
        />
      ) : null}
      {!loading && info.page === "productForm" ? <ProductFormPage mode={info.mode} productId={info.id} products={products} categories={categories} onSave={saveProduct} /> : null}
      {!loading && info.page === "categories" ? <CategoriesPage categories={categories} products={products} onCreate={addCategory} onUpdate={editCategory} onDelete={removeCategory} /> : null}
      {!loading && info.page === "arena" ? <ArenaPage /> : null}
      {!loading && info.page === "settings" ? <SettingsPage /> : null}
      {!loading && info.page === "placeholder" ? <PlaceholderPage title={info.title} /> : null}
    </AdminShell>
  );
}
