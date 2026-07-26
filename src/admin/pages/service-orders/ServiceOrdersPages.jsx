import { CheckCircle2, FilePlus2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  archiveServiceOrder,
  createServiceOrder,
  defaultAccessories,
  defaultAuthorizations,
  defaultDeviceCondition,
  defaultRequestedServices,
  formatServiceOrderMoney,
  getNextServiceOrderNumberPreview,
  getServiceOrderById,
  getServiceOrderSummary,
  listServiceOrders,
  parseServiceOrderMoney,
  serviceOrderStatuses,
  serviceOrderStatusTones,
  updateServiceOrder,
  updateServiceOrderStatus,
} from "../../services/serviceOrdersService";

const pageSize = 20;

const accessoryOptions = [
  ["charger", "Carregador"],
  ["power_supply", "Fonte"],
  ["power_cable", "Cabo de energia"],
  ["usb_cable", "Cabo USB"],
  ["case", "Capa"],
  ["screen_protector", "Película"],
  ["sim_card", "Chip"],
  ["memory_card", "Cartão de memória"],
  ["removable_battery", "Bateria removível"],
  ["controller", "Controle"],
  ["other", "Outros"],
];

const conditionOptions = [
  ["powers_on", "Liga normalmente"],
  ["does_not_power_on", "Não liga"],
  ["turns_on_and_off", "Liga e desliga"],
  ["no_image", "Sem imagem"],
  ["broken_screen", "Tela quebrada"],
  ["touch_not_working", "Touch não funciona"],
  ["scratched_cover", "Tampa riscada"],
  ["broken_housing", "Carcaça quebrada"],
  ["damaged_buttons", "Botões danificados"],
  ["oxidation_signs", "Sinais de oxidação"],
  ["wet_device", "Equipamento molhado"],
  ["broken_seals", "Lacres violados"],
  ["previously_opened", "Equipamento já aberto"],
  ["missing_parts", "Peças faltando"],
  ["other", "Outros"],
];

const requestedServiceOptions = [
  ["diagnostic", "Diagnóstico"],
  ["repair", "Reparo"],
  ["screen_replacement", "Troca de tela"],
  ["battery_replacement", "Troca de bateria"],
  ["connector_replacement", "Troca de conector"],
  ["formatting", "Formatação"],
  ["preventive_cleaning", "Limpeza preventiva"],
  ["data_recovery", "Recuperação de dados"],
  ["upgrade", "Upgrade"],
  ["board_repair", "Reparo em placa"],
  ["quote", "Orçamento"],
  ["other", "Outros"],
];

const authorizationOptions = [
  ["diagnostic", "Cliente autoriza diagnóstico"],
  ["device_opening", "Cliente autoriza abertura do equipamento"],
  ["testing", "Cliente autoriza testes com o equipamento"],
  ["formatting_if_needed", "Cliente autoriza formatação, se necessária"],
  ["whatsapp_contact", "Cliente autoriza contato via WhatsApp"],
  ["data_loss_risk", "Cliente está ciente do risco de perda de dados"],
  ["budget_may_change", "Cliente está ciente de que o orçamento pode mudar após o diagnóstico"],
];

function nowFormValues() {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
}

function emptyServiceOrderForm() {
  const now = nowFormValues();
  return {
    status: "Recebido",
    entryDate: now.date,
    entryTime: now.time,
    customerName: "",
    customerDocument: "",
    customerPhone: "",
    deviceBrand: "",
    deviceModel: "",
    deviceColor: "",
    deviceSerialImei: "",
    devicePassword: "",
    unlockPattern: "",
    accessories: { ...defaultAccessories },
    deviceCondition: { ...defaultDeviceCondition },
    reportedDefect: "",
    requestedServices: { ...defaultRequestedServices },
    analysisPrice: "",
    servicePrice: "",
    estimatedDeadline: "",
    customerNotes: "",
    internalNotes: "",
    authorizations: { ...defaultAuthorizations },
    warrantyDays: 90,
  };
}

function normalizeForm(order) {
  return {
    ...emptyServiceOrderForm(),
    ...order,
    accessories: { ...defaultAccessories, ...(order?.accessories || {}) },
    deviceCondition: { ...defaultDeviceCondition, ...(order?.deviceCondition || {}) },
    requestedServices: { ...defaultRequestedServices, ...(order?.requestedServices || {}) },
    authorizations: { ...defaultAuthorizations, ...(order?.authorizations || {}) },
    analysisPrice: formatServiceOrderMoney(order?.analysisPrice),
    servicePrice: formatServiceOrderMoney(order?.servicePrice),
    warrantyDays: order?.warrantyDays ?? 90,
  };
}

function goToAdmin(path, replace = false) {
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDateTime(date, time = "") {
  if (!date) return "Não informado";
  const parsed = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("pt-BR") + (time ? ` às ${time}` : "");
}

function formatDateTimeFromIso(value) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function serviceOrderValue(order) {
  const parsed = parseServiceOrderMoney(order.servicePrice);
  if (parsed === null) return "Não definido";
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function equipmentLabel(order) {
  return [order.deviceBrand, order.deviceModel].filter(Boolean).join(" ") || "Não informado";
}

function activeRequestedServiceCount(value = {}) {
  return Object.entries(value).filter(([key, item]) => key !== "other_description" && item === true).length;
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

function TextField({ label, value, onChange, error, helper, className = "", ...props }) {
  return (
    <label className={`block text-sm font-bold text-slate-200 ${className}`}>
      {label}
      <input
        className={`mt-2 w-full rounded-md border bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-nt-cyan ${error ? "border-red-400" : "border-slate-700"}`}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
      {helper ? <span className="mt-1 block text-xs font-medium leading-5 text-slate-400">{helper}</span> : null}
      {error ? <span className="mt-1 block text-xs font-bold leading-5 text-red-200">{error}</span> : null}
    </label>
  );
}

function TextAreaField({ label, value, onChange, error, helper, className = "", ...props }) {
  return (
    <label className={`block text-sm font-bold text-slate-200 ${className}`}>
      {label}
      <textarea
        className={`mt-2 min-h-28 w-full rounded-md border bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-nt-cyan ${error ? "border-red-400" : "border-slate-700"}`}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
      {helper ? <span className="mt-1 block text-xs font-medium leading-5 text-slate-400">{helper}</span> : null}
      {error ? <span className="mt-1 block text-xs font-bold leading-5 text-red-200">{error}</span> : null}
    </label>
  );
}

function SelectField({ label, value, onChange, options, error, className = "" }) {
  return (
    <label className={`block text-sm font-bold text-slate-200 ${className}`}>
      {label}
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-md border bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-nt-cyan ${error ? "border-red-400" : "border-slate-700"}`}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs font-bold leading-5 text-red-200">{error}</span> : null}
    </label>
  );
}

function CheckboxGroup({ title, value, options, onChange, error, otherKey = "other_description" }) {
  return (
    <fieldset className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
      <legend className="px-1 text-sm font-black text-white">{title}</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {options.map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 rounded-md border border-slate-700 bg-white/5 px-3 py-3 text-sm font-bold text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(value?.[key])}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      {value?.other ? (
        <TextField
          label="Descreva outros"
          value={value?.[otherKey] || ""}
          onChange={(text) => onChange({ ...value, [otherKey]: text })}
          className="mt-4"
        />
      ) : null}
      {error ? <p className="mt-3 text-xs font-bold text-red-200">{error}</p> : null}
    </fieldset>
  );
}

export function ServiceOrderStatusBadge({ status }) {
  const tone = serviceOrderStatusTones[status] || "slate";
  const tones = {
    blue: "border-sky-300/30 bg-sky-400/10 text-sky-100",
    cyan: "border-nt-cyan/30 bg-nt-cyan/10 text-nt-cyan",
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    orange: "border-orange-300/30 bg-orange-300/10 text-orange-100",
    purple: "border-purple-300/30 bg-purple-300/10 text-purple-100",
    green: "border-lime-300/30 bg-lime-300/10 text-lime-100",
    slate: "border-slate-500/40 bg-slate-500/10 text-slate-200",
    red: "border-red-400/30 bg-red-500/10 text-red-100",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${tones[tone] || tones.slate}`}>
      {status || "Recebido"}
    </span>
  );
}

function ServiceOrderSummaryCards({ summary, statusFilter, onStatus }) {
  const cards = [
    ["Recebidos", "Recebido"],
    ["Em análise", "Em análise"],
    ["Aguardando autorização", "Aguardando autorização"],
    ["Aguardando peça", "Aguardando peça"],
    ["Em reparo", "Em reparo"],
    ["Prontos", "Pronto"],
    ["Entregues", "Entregue"],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, status]) => (
        <button
          key={status}
          type="button"
          onClick={() => onStatus(status)}
          className={`rounded-lg border p-4 text-left transition hover:border-nt-cyan ${statusFilter === status ? "border-nt-cyan bg-nt-cyan/10" : "border-white/10 bg-white/5"}`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-white">{summary.statuses?.[status] || 0}</p>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onStatus("Todos os status")}
        className={`rounded-lg border p-4 text-left transition hover:border-nt-cyan ${statusFilter === "Todos os status" ? "border-nt-cyan bg-nt-cyan/10" : "border-white/10 bg-white/5"}`}
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Total de OS ativas</p>
        <p className="mt-2 text-3xl font-black text-white">{summary.total || 0}</p>
      </button>
    </div>
  );
}

function ServiceOrdersTable({ orders, onStatus, onArchive }) {
  if (!orders.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center text-sm text-slate-300">
        Nenhuma Ordem de Serviço encontrada para os filtros atuais.
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-white/10 xl:block">
        <div className="grid grid-cols-[0.55fr_0.8fr_1fr_0.8fr_1fr_0.8fr_0.8fr_0.85fr_1.1fr] border-b border-white/10 bg-slate-950/80 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          <span>OS</span>
          <span>Entrada</span>
          <span>Cliente</span>
          <span>Telefone</span>
          <span>Equipamento</span>
          <span>Status</span>
          <span>Valor</span>
          <span>Atualização</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-white/10">
          {orders.map((order) => (
            <article key={order.id} className="grid grid-cols-[0.55fr_0.8fr_1fr_0.8fr_1fr_0.8fr_0.8fr_0.85fr_1.1fr] items-center gap-3 px-4 py-4 text-sm">
              <strong className="text-white">OS {order.osNumber}</strong>
              <span className="text-slate-300">{formatDateTime(order.entryDate, order.entryTime)}</span>
              <span className="font-bold text-slate-100">{order.customerName || "Sem nome"}</span>
              <span className="text-slate-300">{order.customerPhone || "Não informado"}</span>
              <span className="text-slate-300">{equipmentLabel(order)}</span>
              <ServiceOrderStatusBadge status={order.status} />
              <span className="font-bold text-slate-100">{serviceOrderValue(order)}</span>
              <span className="text-slate-300">{formatDateTimeFromIso(order.updatedAt)}</span>
              <div className="flex flex-wrap gap-2">
                <a href={`/admin/os/editar/${order.id}`} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 hover:border-nt-cyan">
                  <Pencil size={14} />
                  Editar
                </a>
                <select
                  value={order.status}
                  onChange={(event) => onStatus(order.id, event.target.value)}
                  className="min-h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-slate-100"
                  aria-label={`Alterar status da OS ${order.osNumber}`}
                >
                  {serviceOrderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button type="button" onClick={() => onArchive(order)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-red-400/40 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/10">
                  <Trash2 size={14} />
                  Arquivar
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:hidden">
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-lg text-white">OS {order.osNumber}</strong>
                <p className="mt-1 text-sm text-slate-400">{formatDateTime(order.entryDate, order.entryTime)}</p>
              </div>
              <ServiceOrderStatusBadge status={order.status} />
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <p><span className="font-bold text-slate-100">Cliente:</span> {order.customerName || "Sem nome"}</p>
              <p><span className="font-bold text-slate-100">Telefone:</span> {order.customerPhone || "Não informado"}</p>
              <p><span className="font-bold text-slate-100">Equipamento:</span> {equipmentLabel(order)}</p>
              <p><span className="font-bold text-slate-100">Valor:</span> {serviceOrderValue(order)}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <a href={`/admin/os/editar/${order.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-bold text-slate-100 hover:border-nt-cyan">
                <Pencil size={15} />
                Editar
              </a>
              <select
                value={order.status}
                onChange={(event) => onStatus(order.id, event.target.value)}
                className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-slate-100"
                aria-label={`Alterar status da OS ${order.osNumber}`}
              >
                {serviceOrderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button type="button" onClick={() => onArchive(order)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-400/40 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-500/10">
                <Trash2 size={15} />
                Arquivar
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function ServiceOrdersManagerPage() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ total: 0, statuses: {} });
  const [filters, setFilters] = useState({
    search: "",
    status: "Todos os status",
    sort: "recent",
    dateFrom: "",
    dateTo: "",
    page: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(filters.search);
      setFilters((current) => ({ ...current, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  async function loadOrders() {
    setLoading(true);
    setError("");
    const loadOptions = {
      ...filters,
      search: debouncedSearch,
      pageSize,
    };
    try {
      const [listResult, summaryResult] = await Promise.all([
        listServiceOrders(loadOptions),
        getServiceOrderSummary(loadOptions),
      ]);
      setOrders(listResult.items);
      setTotal(listResult.total);
      setSummary(summaryResult);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Não foi possível carregar as Ordens de Serviço.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [debouncedSearch, filters.status, filters.sort, filters.dateFrom, filters.dateTo, filters.page]);

  async function handleStatus(id, status) {
    setNotice("");
    setError("");
    try {
      await updateServiceOrderStatus(id, status);
      setNotice("Status da OS atualizado com sucesso.");
      await loadOrders();
    } catch (statusError) {
      setError(statusError.message || "Erro ao alterar status da OS.");
    }
  }

  async function handleArchive(order) {
    const confirmed = window.confirm(`Deseja arquivar a OS ${order.osNumber}? Ela deixará de aparecer na listagem principal, mas seus dados serão preservados.`);
    if (!confirmed) return;

    setNotice("");
    setError("");
    try {
      await archiveServiceOrder(order.id);
      setNotice(`OS ${order.osNumber} arquivada com sucesso.`);
      await loadOrders();
    } catch (archiveError) {
      setError(archiveError.message || "Erro ao arquivar a OS.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Ordens de Serviço</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Gerencie atendimentos, equipamentos recebidos, status, valores e arquivamento por soft delete.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AdminButton type="button" variant="secondary" icon={RefreshCw} onClick={loadOrders} disabled={loading}>Atualizar</AdminButton>
          <a href="/admin/os/nova" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-nt-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-nt-cyan">
            <Plus size={17} />
            Nova OS
          </a>
        </div>
      </div>

      <ServiceOrderSummaryCards
        summary={summary}
        statusFilter={filters.status}
        onStatus={(status) => setFilters((current) => ({ ...current, status, page: 1 }))}
      />

      {notice ? <div className="rounded-md border border-lime-300/30 bg-lime-300/10 p-4 text-sm text-lime-100">{notice}</div> : null}
      {error ? <div className="rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.65fr_0.55fr_0.55fr_0.75fr]">
          <label className="block text-sm font-bold text-slate-200">
            Buscar
            <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 focus-within:border-nt-cyan">
              <Search size={17} className="text-slate-500" />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="OS 1001, cliente, telefone, CPF, marca, modelo, série ou IMEI"
                className="min-h-11 w-full bg-transparent text-white outline-none"
              />
            </div>
          </label>
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))}
            options={[["Todos os status", "Todos os status"], ...serviceOrderStatuses.map((status) => [status, status])]}
          />
          <TextField label="Data inicial" type="date" value={filters.dateFrom} onChange={(dateFrom) => setFilters((current) => ({ ...current, dateFrom, page: 1 }))} />
          <TextField label="Data final" type="date" value={filters.dateTo} onChange={(dateTo) => setFilters((current) => ({ ...current, dateTo, page: 1 }))} />
          <SelectField
            label="Ordenar"
            value={filters.sort}
            onChange={(sort) => setFilters((current) => ({ ...current, sort, page: 1 }))}
            options={[
              ["recent", "OS mais recente"],
              ["oldest", "OS mais antiga"],
              ["numberDesc", "Maior número de OS"],
              ["numberAsc", "Menor número de OS"],
              ["customerAsc", "Cliente de A a Z"],
            ]}
          />
        </div>
      </section>

      {loading ? <p className="rounded-md border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Carregando Ordens de Serviço...</p> : <ServiceOrdersTable orders={orders} onStatus={handleStatus} onArchive={handleArchive} />}

      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <span>Total encontrado: <strong className="text-white">{total}</strong> · Página <strong className="text-white">{filters.page}</strong> de <strong className="text-white">{totalPages}</strong></span>
        <div className="flex gap-2">
          <AdminButton type="button" variant="secondary" disabled={filters.page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Anterior</AdminButton>
          <AdminButton type="button" variant="secondary" disabled={filters.page >= totalPages || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Próxima</AdminButton>
        </div>
      </div>
    </div>
  );
}

function validateForm(form) {
  const errors = {};
  if (!form.customerName.trim()) errors.customerName = "Informe o nome do cliente.";
  if (!form.customerPhone.trim()) errors.customerPhone = "Informe o WhatsApp/telefone.";
  if (!form.deviceBrand.trim()) errors.deviceBrand = "Informe a marca do equipamento.";
  if (!form.deviceModel.trim()) errors.deviceModel = "Informe o modelo do equipamento.";
  if (!form.reportedDefect.trim()) errors.reportedDefect = "Descreva o defeito informado pelo cliente.";
  if (!activeRequestedServiceCount(form.requestedServices)) errors.requestedServices = "Selecione pelo menos um serviço solicitado.";
  if (!serviceOrderStatuses.includes(form.status)) errors.status = "Selecione um status válido.";
  if (Number(form.warrantyDays) < 0 || Number(form.warrantyDays) > 3650) errors.warrantyDays = "Informe uma garantia entre 0 e 3650 dias.";
  if (form.analysisPrice && parseServiceOrderMoney(form.analysisPrice) === null) errors.analysisPrice = "Valor inválido.";
  if (form.servicePrice && parseServiceOrderMoney(form.servicePrice) === null) errors.servicePrice = "Valor inválido.";
  return errors;
}

function ServiceOrderForm({ mode, orderId }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(emptyServiceOrderForm);
  const [existingOrder, setExistingOrder] = useState(null);
  const [nextNumber, setNextNumber] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        if (isEdit) {
          if (!orderId) throw new Error("ID da OS inválido.");
          const order = await getServiceOrderById(orderId);
          if (!active) return;
          setExistingOrder(order);
          if (order) setForm(normalizeForm(order));
        } else {
          const number = await getNextServiceOrderNumberPreview().catch(() => null);
          if (!active) return;
          setNextNumber(number);
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Não foi possível carregar a Ordem de Serviço.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [isEdit, orderId]);

  function updateField(field, value) {
    setDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  }

  function updateJsonField(field, value) {
    setDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  }

  function focusFirstError(nextErrors) {
    const firstKey = Object.keys(nextErrors).find((key) => nextErrors[key]);
    if (!firstKey) return;
    const target = formRef.current?.querySelector(`[data-field="${firstKey}"] input, [data-field="${firstKey}"] textarea, [data-field="${firstKey}"] select`);
    target?.focus();
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function save(modeAfterSave) {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setNotice("");
    setError("");

    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const saved = isEdit ? await updateServiceOrder(orderId, form) : await createServiceOrder(form);
      setDirty(false);
      setNotice(isEdit ? "OS atualizada com sucesso." : "OS criada com sucesso.");

      if (modeAfterSave === "edit") {
        goToAdmin(`/admin/os/editar/${saved.id}`, true);
      } else if (modeAfterSave === "back") {
        goToAdmin("/admin/os", true);
      } else {
        setExistingOrder(saved);
        setForm(normalizeForm(saved));
      }
    } catch (saveError) {
      setError(saveError.message || "Não foi possível salvar a Ordem de Serviço.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveCurrentOrder() {
    if (!existingOrder) return;
    const confirmed = window.confirm(`Deseja arquivar a OS ${existingOrder.osNumber}? Ela deixará de aparecer na listagem principal, mas seus dados serão preservados.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await archiveServiceOrder(existingOrder.id);
      goToAdmin("/admin/os", true);
    } catch (archiveError) {
      setError(archiveError.message || "Não foi possível arquivar a OS.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm("Existem alterações não salvas. Deseja sair mesmo assim?")) return;
    goToAdmin("/admin/os");
  }

  if (loading) {
    return <p className="rounded-md border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Carregando Ordem de Serviço...</p>;
  }

  if (isEdit && !existingOrder) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        <h2 className="text-2xl font-black text-white">Ordem de Serviço não encontrada</h2>
        <p className="mt-2">Confira o link acessado ou volte para a listagem.</p>
        <AdminButton type="button" variant="secondary" className="mt-5" onClick={() => goToAdmin("/admin/os")}>Voltar</AdminButton>
      </section>
    );
  }

  const archived = Boolean(existingOrder?.deletedAt);

  return (
    <form ref={formRef} className="grid gap-5" onSubmit={(event) => event.preventDefault()}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">{isEdit ? `Editar OS ${existingOrder?.osNumber || ""}` : "Nova Ordem de Serviço"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {isEdit ? "Atualize os dados da OS sem alterar numeração e auditoria original." : "Preencha os dados mínimos para registrar o atendimento."}
          </p>
        </div>
        <AdminButton type="button" variant="secondary" onClick={cancel}>Cancelar</AdminButton>
      </div>

      {notice ? <div className="rounded-md border border-lime-300/30 bg-lime-300/10 p-4 text-sm text-lime-100">{notice}</div> : null}
      {error ? <div className="rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
      {existingOrder?.deletedAt ? <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">Esta OS está arquivada. Evite alterações até a etapa de restauração ser implementada.</div> : null}

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-xl font-black text-white">Identificação da OS</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="rounded-md border border-slate-700 bg-slate-950 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{isEdit ? "Número da OS" : "Prévia da próxima OS"}</p>
            <p className="mt-2 text-3xl font-black text-white">{isEdit ? `OS ${existingOrder?.osNumber}` : nextNumber ? `OS ${nextNumber}` : "--"}</p>
            {!isEdit ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">O número definitivo será gerado ao salvar.</p> : null}
          </div>
          <div data-field="entryDate"><TextField label="Data de entrada" type="date" value={form.entryDate} onChange={(value) => updateField("entryDate", value)} /></div>
          <div data-field="entryTime"><TextField label="Hora de entrada" type="time" value={form.entryTime} onChange={(value) => updateField("entryTime", value)} /></div>
          <div data-field="status"><SelectField label="Status" value={form.status} onChange={(value) => updateField("status", value)} options={serviceOrderStatuses.map((status) => [status, status])} error={errors.status} /></div>
        </div>
        {isEdit ? (
          <p className="mt-4 text-xs font-semibold text-slate-400">
            Criada em {formatDateTimeFromIso(existingOrder?.createdAt)} · Última atualização {formatDateTimeFromIso(existingOrder?.updatedAt)}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-xl font-black text-white">Dados do cliente</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div data-field="customerName"><TextField label="Nome completo" value={form.customerName} onChange={(value) => updateField("customerName", value)} error={errors.customerName} /></div>
          <TextField label="CPF ou CNPJ" value={form.customerDocument} onChange={(value) => updateField("customerDocument", value)} />
          <div data-field="customerPhone"><TextField label="WhatsApp/telefone" value={form.customerPhone} onChange={(value) => updateField("customerPhone", value)} error={errors.customerPhone} helper="Pode colar com ou sem formatação." /></div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-xl font-black text-white">Equipamento</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div data-field="deviceBrand"><TextField label="Marca" value={form.deviceBrand} onChange={(value) => updateField("deviceBrand", value)} error={errors.deviceBrand} /></div>
          <div data-field="deviceModel"><TextField label="Modelo" value={form.deviceModel} onChange={(value) => updateField("deviceModel", value)} error={errors.deviceModel} /></div>
          <TextField label="Cor" value={form.deviceColor} onChange={(value) => updateField("deviceColor", value)} />
          <TextField label="Número de série ou IMEI" value={form.deviceSerialImei} onChange={(value) => updateField("deviceSerialImei", value)} />
          <TextField label="Senha do aparelho" type={showPassword ? "text" : "password"} value={form.devicePassword} onChange={(value) => updateField("devicePassword", value)} helper="Informação sensível, exibida apenas nesta tela." />
          <TextField label="Padrão de desbloqueio" value={form.unlockPattern} onChange={(value) => updateField("unlockPattern", value)} placeholder="Ex.: 1-2-5-8" />
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm font-bold text-slate-200">
          <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
          Mostrar senha nesta tela
        </label>
      </section>

      <div className="grid gap-5">
        <CheckboxGroup title="Acessórios recebidos" value={form.accessories} options={accessoryOptions} onChange={(value) => updateJsonField("accessories", value)} />
        <CheckboxGroup title="Estado do equipamento na entrada" value={form.deviceCondition} options={conditionOptions} onChange={(value) => updateJsonField("deviceCondition", value)} />
      </div>

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-xl font-black text-white">Defeito e serviço</h3>
        <div className="mt-4 grid gap-4">
          <div data-field="reportedDefect">
            <TextAreaField
              label="Defeito informado pelo cliente"
              value={form.reportedDefect}
              onChange={(value) => updateField("reportedDefect", value)}
              helper="Descreva exatamente o problema informado pelo cliente."
              error={errors.reportedDefect}
            />
          </div>
          <div data-field="requestedServices">
            <CheckboxGroup title="Serviço solicitado" value={form.requestedServices} options={requestedServiceOptions} onChange={(value) => updateJsonField("requestedServices", value)} error={errors.requestedServices} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-xl font-black text-white">Valores e prazo</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div data-field="analysisPrice"><TextField label="Valor da análise" value={form.analysisPrice} onChange={(value) => updateField("analysisPrice", value)} error={errors.analysisPrice} placeholder="Ex.: 50,00" /></div>
          <div data-field="servicePrice"><TextField label="Valor do serviço" value={form.servicePrice} onChange={(value) => updateField("servicePrice", value)} error={errors.servicePrice} placeholder="Ex.: 180,00" /></div>
          <TextField label="Prazo estimado" value={form.estimatedDeadline} onChange={(value) => updateField("estimatedDeadline", value)} placeholder="Ex.: 3 a 5 dias úteis" />
        </div>
      </section>

      <CheckboxGroup title="Autorizações" value={form.authorizations} options={authorizationOptions} onChange={(value) => updateJsonField("authorizations", value)} />

      <section className="rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="text-xl font-black text-white">Observações e garantia</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextAreaField label="Observações para o cliente" value={form.customerNotes} onChange={(value) => updateField("customerNotes", value)} />
          <TextAreaField label="Observações internas da loja" value={form.internalNotes} onChange={(value) => updateField("internalNotes", value)} helper="Visível apenas no painel administrativo." />
          <div data-field="warrantyDays">
            <TextField
              label="Garantia do serviço em dias"
              type="number"
              min="0"
              max="3650"
              step="1"
              value={form.warrantyDays}
              onChange={(value) => updateField("warrantyDays", Number(value))}
              error={errors.warrantyDays}
              helper="A garantia cobre exclusivamente o serviço executado e as peças substituídas, conforme as condições da Ordem de Serviço."
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {isEdit ? <AdminButton type="button" variant="danger" icon={Trash2} disabled={saving || archived} onClick={archiveCurrentOrder}>Arquivar OS</AdminButton> : null}
        <AdminButton type="button" variant="secondary" disabled={saving} onClick={cancel}>Cancelar</AdminButton>
        {isEdit ? (
          <>
            <AdminButton type="button" variant="secondary" icon={CheckCircle2} disabled={saving || archived} onClick={() => save("stay")}>{saving ? "Salvando..." : "Salvar alterações"}</AdminButton>
            <AdminButton type="button" icon={CheckCircle2} disabled={saving || archived} onClick={() => save("back")}>Salvar e voltar</AdminButton>
          </>
        ) : (
          <>
            <AdminButton type="button" variant="secondary" icon={FilePlus2} disabled={saving} onClick={() => save("back")}>{saving ? "Salvando..." : "Salvar OS"}</AdminButton>
            <AdminButton type="button" icon={FilePlus2} disabled={saving} onClick={() => save("edit")}>Salvar e continuar editando</AdminButton>
          </>
        )}
      </div>
    </form>
  );
}

export function NewServiceOrderManagerPage() {
  return <ServiceOrderForm mode="new" />;
}

export function EditServiceOrderManagerPage({ serviceOrderId }) {
  return <ServiceOrderForm mode="edit" orderId={serviceOrderId} />;
}
