import { ArrowLeft, FileText, Pencil, Printer, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { archiveServiceOrder, getServiceOrderById } from "../../services/serviceOrdersService";
import { ServiceOrderPrintDocument } from "./ServiceOrderPrintDocument";
import { formatDateTime, formatOsNumber, statusTone } from "./serviceOrderPrintUtils";

function goToAdmin(path, replace = false) {
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  const event = typeof PopStateEvent === "function" ? new PopStateEvent("popstate") : new Event("popstate");
  window.dispatchEvent(event);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function AdminAction({ children, icon: Icon, variant = "secondary", className = "", ...props }) {
  const styles = {
    primary: "bg-nt-blue text-white hover:bg-nt-cyan",
    secondary: "border border-slate-700 bg-white/5 text-slate-100 hover:border-nt-cyan",
    danger: "border border-red-400/40 bg-red-500/10 text-red-100 hover:bg-red-500/20",
  };

  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    >
      {Icon ? <Icon size={17} /> : null}
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const tone = statusTone(status);
  const styles = {
    blue: "border-blue-400/40 bg-blue-500/10 text-blue-100",
    cyan: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
    amber: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    orange: "border-orange-400/40 bg-orange-500/10 text-orange-100",
    purple: "border-purple-400/40 bg-purple-500/10 text-purple-100",
    green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    slate: "border-slate-400/40 bg-slate-500/10 text-slate-100",
    red: "border-red-400/40 bg-red-500/10 text-red-100",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${styles[tone] || styles.slate}`}>
      {status || "Não informado"}
    </span>
  );
}

export function ServiceOrderViewPage({ serviceOrderId }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generatedAt = useMemo(() => new Date().toISOString(), [serviceOrderId]);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        if (!serviceOrderId) throw new Error("ID da OS inválido.");
        const result = await getServiceOrderById(serviceOrderId);
        if (!active) return;
        setOrder(result || null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Não foi possível carregar a Ordem de Serviço.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      active = false;
    };
  }, [serviceOrderId]);

  async function archiveCurrentOrder() {
    if (!order || order.deletedAt) return;
    const confirmed = window.confirm(`Deseja arquivar a ${formatOsNumber(order)}? Ela deixará de aparecer na listagem principal, mas seus dados serão preservados.`);
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const archived = await archiveServiceOrder(order.id);
      setOrder(archived);
      setNotice("Ordem de Serviço arquivada com sucesso.");
    } catch (archiveError) {
      setError(archiveError.message || "Não foi possível arquivar a Ordem de Serviço.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-6 text-slate-300 shadow-card">
        Carregando Ordem de Serviço...
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/5 p-6 shadow-card">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-nt-cyan">Ordem de Serviço</p>
        <h2 className="mt-2 text-2xl font-black text-white">OS não encontrada</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{error || "Não encontramos uma Ordem de Serviço com este identificador."}</p>
        <AdminAction icon={ArrowLeft} className="mt-5" onClick={() => goToAdmin("/admin/os")}>Voltar para listagem</AdminAction>
      </section>
    );
  }

  const archived = Boolean(order.deletedAt);
  const canceled = order.status === "Cancelado";

  return (
    <div className="service-order-view">
      <section className="print-hidden mb-6 rounded-lg border border-white/10 bg-white/5 p-6 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-nt-cyan">Visualização da OS</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-white">Ordem de Serviço {formatOsNumber(order)}</h2>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Confira os dados antes da impressão. O documento possui Página 1 — Ordem de Serviço e Página 2 — Termo de Responsabilidade.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-400">
              <span>Criada em: {formatDateTime(order.createdAt)}</span>
              <span>Última atualização: {formatDateTime(order.updatedAt)}</span>
              {archived ? <span className="text-amber-200">Esta Ordem de Serviço está arquivada.</span> : null}
              {canceled ? <span className="text-red-200">Ordem de Serviço cancelada.</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <AdminAction icon={ArrowLeft} onClick={() => goToAdmin("/admin/os")}>Voltar</AdminAction>
            <AdminAction icon={Pencil} onClick={() => goToAdmin(`/admin/os/editar/${order.id}`)}>Editar OS</AdminAction>
            <AdminAction icon={Printer} variant="primary" onClick={() => window.print()}>Imprimir OS</AdminAction>
            {!archived ? <AdminAction icon={Trash2} variant="danger" disabled={saving} onClick={archiveCurrentOrder}>Arquivar OS</AdminAction> : null}
          </div>
        </div>

        {notice ? <div className="mt-5 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">{notice}</div> : null}
        {error ? <div className="mt-5 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">{error}</div> : null}

        <div className="mt-5 rounded-md border border-slate-700 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 shrink-0 text-nt-cyan" size={18} />
            <p>
              A pré-visualização abaixo representa exatamente o documento impresso. Para manter uma cópia na loja e entregar outra ao cliente, selecione 2 cópias na janela de impressão. Para gerar o arquivo digital, selecione "Salvar como PDF".
            </p>
          </div>
        </div>
      </section>

      <ServiceOrderPrintDocument order={order} generatedAt={generatedAt} />
    </div>
  );
}
