import { CalendarDays, CheckCircle2, ClipboardList, CreditCard, Eye, PackageCheck, RefreshCw, Search, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  allowedStoreOperationalStatuses,
  createAdminInvoiceSignedUrl,
  displayStoreFiscalStatus,
  formatStoreDateTime,
  formatStoreMoney,
  listStoreOrders,
  orderItemCount,
  orderMatchesSearch,
  paymentLabel,
  saveStoreOrderInvoice,
  sendStoreOrderToBling,
  storeFiscalLabels,
  storeFinancialLabels,
  storeOperationalFlow,
  storeOperationalLabels,
  storeOperationalOptions,
  syncStoreOrderInvoiceFromBling,
  updateStoreOrderInternalNotes,
  updateStoreOrderOperationalStatus,
} from "../../services/storeOrderService";

const quickFilters = [
  ["all", "Todos"],
  ["financial:pending", "Aguardando pagamento"],
  ["financial:approved", "Pago"],
  ["operational:separating", "Separando pedido"],
  ["operational:ready_for_pickup", "Pronto para retirada"],
  ["operational:delivered", "Retirado"],
  ["operational:cancelled", "Cancelado"],
  ["fiscal:paid_pending", "Pagos sem nota fiscal"],
  ["fiscal:issued", "Nota emitida"],
  ["fiscal:cancelled", "Nota cancelada"],
  ["fiscal:error", "Erro fiscal"],
];

const financialTones = {
  pending: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  processing: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  approved: "border-lime-300/30 bg-lime-300/10 text-lime-100",
  rejected: "border-red-400/30 bg-red-500/10 text-red-100",
  cancelled: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  expired: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  refunded: "border-purple-300/30 bg-purple-400/10 text-purple-100",
  charged_back: "border-red-400/30 bg-red-500/10 text-red-100",
  not_applicable: "border-slate-500/40 bg-slate-500/10 text-slate-200",
};

const operationalTones = {
  awaiting_payment: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  paid: "border-lime-300/30 bg-lime-300/10 text-lime-100",
  separating: "border-sky-300/30 bg-sky-400/10 text-sky-100",
  ready_for_pickup: "border-nt-cyan/30 bg-nt-cyan/10 text-nt-cyan",
  delivered: "border-lime-300/30 bg-lime-300/10 text-lime-100",
  cancelled: "border-red-400/30 bg-red-500/10 text-red-100",
  manual_review: "border-purple-300/30 bg-purple-400/10 text-purple-100",
};

function dateOnly(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function isSameMonth(value, base = new Date()) {
  const parsed = new Date(value);
  return parsed.getFullYear() === base.getFullYear() && parsed.getMonth() === base.getMonth();
}

function statusBadge(value, labels, tones) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${tones[value] || "border-slate-500/40 bg-slate-500/10 text-slate-200"}`}>
      {labels[value] || value || "-"}
    </span>
  );
}

function OperationalStatusSelect({ order, saving = false, onChange }) {
  const allowedStatuses = allowedStoreOperationalStatuses(order);
  const current = order.operational_status || "awaiting_payment";
  return (
    <label className="block min-w-[190px] text-xs font-black text-slate-300" onClick={(event) => event.stopPropagation()}>
      <span className="sr-only">Status operacional</span>
      <select
        value={current}
        disabled={saving}
        onChange={(event) => onChange(order, event.target.value)}
        className={`min-h-10 w-full rounded-md border bg-slate-950 px-3 py-2 text-xs font-black outline-none transition focus:border-nt-cyan disabled:cursor-wait disabled:opacity-60 ${operationalTones[current] || "border-slate-700 text-slate-100"}`}
      >
        {storeOperationalOptions.map((status) => (
          <option key={status} value={status} disabled={!allowedStatuses.includes(status)}>
            {storeOperationalLabels[status]}
          </option>
        ))}
      </select>
      {saving ? <span className="mt-1 block text-[11px] text-nt-cyan">Salvando...</span> : null}
    </label>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = "cyan" }) {
  const tones = {
    cyan: "text-nt-cyan bg-nt-cyan/10",
    green: "text-lime-300 bg-lime-300/10",
    amber: "text-amber-300 bg-amber-300/10",
    blue: "text-sky-300 bg-sky-400/10",
  };
  return (
    <div className="glass min-w-0 rounded-lg p-4 shadow-card">
      <div className={`mb-3 grid h-9 w-9 place-items-center rounded-md ${tones[tone] || tones.cyan}`}>
        <Icon size={18} />
      </div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 break-words text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function orderPayment(order) {
  return order.store_payments?.[0] || null;
}

function orderApprovalDate(order) {
  const payment = orderPayment(order);
  return order.paid_at || payment?.paid_at || payment?.approved_at || "";
}

function orderImage(item) {
  return item.main_image || item.configuration_snapshot?.main_image || "";
}

function orderBilling(order) {
  return order.order_billing_snapshots?.[0] || {
    customer_name: order.customer_name || "",
    customer_document: order.customer_document || "",
    customer_email: order.customer_email || "",
    customer_phone: order.customer_phone || "",
    postal_code: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  };
}

function formatBillingAddress(billing) {
  return [
    `${billing.street || ""}, ${billing.number || ""}${billing.complement ? " - " + billing.complement : ""}`.trim(),
    `${billing.district || ""} - ${billing.city || ""}/${billing.state || ""}`.trim(),
    billing.postal_code ? `CEP ${billing.postal_code}` : "",
  ].filter(Boolean).join("\n");
}

function invoiceSummary(order) {
  const billing = orderBilling(order);
  const payment = orderPayment(order);
  const items = (order.store_order_items || []).map((item, index) => (
    `${index + 1}. ${item.quantity}x ${item.product_name}\nSKU: ${item.sku || item.internal_code || "-"}\nValor unitario: ${formatStoreMoney(item.final_unit_price)}\nValor total: ${formatStoreMoney(item.subtotal_amount)}`
  )).join("\n\n");

  return `PEDIDO ${order.order_number}

CLIENTE
Nome: ${billing.customer_name || order.customer_name || "-"}
CPF: ${billing.customer_document || order.customer_document || "-"}
E-mail: ${billing.customer_email || order.customer_email || "-"}
Telefone: ${billing.customer_phone || order.customer_phone || "-"}

ENDERECO
CEP: ${billing.postal_code || "-"}
Logradouro: ${billing.street || "-"}
Numero: ${billing.number || "-"}
Complemento: ${billing.complement || "-"}
Bairro: ${billing.district || "-"}
Cidade: ${billing.city || "-"}
Estado: ${billing.state || "-"}

ITENS
${items || "-"}

PAGAMENTO
Forma: ${paymentLabel(order)}
Valor total: ${formatStoreMoney(order.total_amount)}
Data da aprovacao: ${formatStoreDateTime(orderApprovalDate(order))}
Transacao: ${payment?.mercado_pago_payment_id || payment?.mercado_pago_order_id || "-"}`;
}

async function copyText(value) {
  await navigator.clipboard?.writeText(String(value || ""));
}

function OrderDetails({ order, notes, setNotes, saving, onStatus, onSaveNotes, onInvoiceSaved, onSyncInvoice, onSendBling, blingSaving = false, invoiceSyncSaving = false }) {
  const payment = orderPayment(order);
  const allowedStatuses = allowedStoreOperationalStatuses(order);
  const billing = orderBilling(order);
  const invoice = order.order_invoices?.[0] || null;
  const invoiceAuthorized = ["issued", "authorized"].includes(invoice?.status);
  const fiscalStatus = displayStoreFiscalStatus(order, invoice);
  const canAttachInvoice = fiscalStatus !== "not_applicable";
  const blingLinked = Boolean(order.bling_order_id);
  const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: "", invoiceSeries: "1", accessKey: "", issuedAt: "", xmlFile: null, pdfFile: null });
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  function setInvoiceField(field, value) {
    setInvoiceForm((current) => ({ ...current, [field]: value }));
  }

  async function attachInvoice(event) {
    event.preventDefault();
    setInvoiceSaving(true);
    setInvoiceMessage("");
    try {
      const saved = await saveStoreOrderInvoice(order, invoiceForm);
      setInvoiceMessage("Nota fiscal anexada com sucesso.");
      onInvoiceSaved(order.id, saved);
    } catch (error) {
      setInvoiceMessage(error?.message || "Nao foi possivel anexar a nota fiscal.");
    } finally {
      setInvoiceSaving(false);
    }
  }

  async function openInvoice(kind) {
    try {
      const url = await createAdminInvoiceSignedUrl(invoice, kind);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setInvoiceMessage(error?.message || "Nao foi possivel abrir o documento.");
    }
  }

  function printBillingOrder() {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return;
    printWindow.document.write(`<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${invoiceSummary(order).replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]))}</pre>`);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <section className="glass rounded-lg p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-nt-cyan">Detalhe do pedido</p>
          <h2 className="mt-2 text-2xl font-black text-white">{order.order_number}</h2>
          <p className="mt-2 text-sm text-slate-400">{formatStoreDateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {storeOperationalFlow.map((status) => (
            <button
              key={status}
              type="button"
              disabled={saving || !allowedStatuses.includes(status)}
              onClick={() => onStatus(status)}
              className={`min-h-10 rounded-md border px-3 py-2 text-xs font-black transition hover:border-nt-cyan disabled:cursor-not-allowed disabled:opacity-45 ${order.operational_status === status ? "border-nt-cyan bg-nt-cyan/10 text-nt-cyan" : "border-slate-700 bg-white/5 text-slate-100"}`}
              title={!allowedStatuses.includes(status) ? "Transicao operacional nao permitida para este pedido." : ""}
            >
              {storeOperationalLabels[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Cliente</p>
          <p className="mt-3 font-black text-white">{order.customer_name}</p>
          <p className="mt-1 text-sm text-slate-300">CPF: {order.customer_document || "-"}</p>
          <p className="text-sm text-slate-300">Telefone: {order.customer_phone || "-"}</p>
          <p className="break-all text-sm text-slate-300">Email: {order.customer_email || "-"}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Pagamento</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {statusBadge(order.financial_status, storeFinancialLabels, financialTones)}
            {statusBadge(order.operational_status, storeOperationalLabels, operationalTones)}
          </div>
          <p className="mt-3 text-sm text-slate-300">Forma: {paymentLabel(order)}</p>
          <p className="text-sm text-slate-300">Parcelas: {order.installments || payment?.installments || 1}x</p>
          <p className="text-sm text-slate-300">Aprovado em: {formatStoreDateTime(orderApprovalDate(order))}</p>
          <p className="text-sm text-slate-300">Retirado em: {formatStoreDateTime(order.picked_up_at)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Retirada</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">Rua Johann Sachse, 2891<br />Sala 1<br />Badenfurt<br />Blumenau</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {order.store_order_items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {orderImage(item) ? <img src={orderImage(item)} alt={item.product_name} className="h-16 w-16 rounded-md object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-md bg-slate-900 text-xs text-slate-500">sem foto</div>}
              <div className="min-w-0">
                <p className="font-black text-white">{item.product_name}</p>
                <p className="text-sm text-slate-400">{item.variation_name || item.sku || item.internal_code || item.item_type}</p>
              </div>
            </div>
            <div className="grid gap-1 text-sm text-slate-300 sm:text-right">
              <span>Qtd: {item.quantity}</span>
              <span>Unitario: {formatStoreMoney(item.final_unit_price)}</span>
              <strong className="text-white">Subtotal: {formatStoreMoney(item.subtotal_amount)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Bling ERP</p>
            <p className="mt-2 text-sm text-slate-300">
              Status: <strong className="text-white">{blingLinked ? "Enviado ao Bling" : order.bling_sync_status === "syncing" ? "Enviando ao Bling" : "Nao enviado ao Bling"}</strong>
            </p>
            {order.bling_order_id ? <p className="mt-2 text-sm text-slate-300">ID Bling: <strong className="text-white">{order.bling_order_id}</strong></p> : null}
            {order.bling_order_number ? <p className="text-sm text-slate-300">Numero Bling: <strong className="text-white">{order.bling_order_number}</strong></p> : null}
            {order.bling_synced_at ? <p className="text-sm text-slate-300">Enviado em: <strong className="text-white">{formatStoreDateTime(order.bling_synced_at)}</strong></p> : null}
            {order.bling_sync_error ? <p className="mt-2 text-sm text-red-100">{order.bling_sync_error}</p> : null}
            <p className="mt-3 text-xs leading-5 text-slate-500">Esta acao cria ou atualiza o pedido de venda no Bling. Nenhuma nota fiscal sera emitida automaticamente.</p>
          </div>
          <button
            type="button"
            disabled={saving || blingSaving || order.bling_sync_status === "syncing"}
            onClick={() => onSendBling(order)}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-nt-cyan/40 bg-nt-cyan/10 px-4 py-2 text-sm font-black text-nt-cyan transition hover:bg-nt-cyan/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {blingSaving ? (blingLinked ? "Atualizando no Bling..." : "Enviando...") : blingLinked ? "Atualizar pedido no Bling" : "Enviar ao Bling"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Dados para emissao fiscal</p>
            <p className="mt-2 text-sm text-slate-300">Status fiscal: <strong className="text-white">{storeFiscalLabels[fiscalStatus] || fiscalStatus}</strong></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copyText(billing.customer_document || order.customer_document)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10">Copiar CPF</button>
            <button type="button" onClick={() => copyText(`Nome: ${billing.customer_name || order.customer_name}\nCPF: ${billing.customer_document || order.customer_document}\nE-mail: ${billing.customer_email || order.customer_email}\nTelefone: ${billing.customer_phone || order.customer_phone}`)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10">Copiar dados do cliente</button>
            <button type="button" onClick={() => copyText(formatBillingAddress(billing))} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10">Copiar endereco completo</button>
            <button type="button" onClick={() => copyText(invoiceSummary(order))} className="rounded-md border border-nt-cyan/40 px-3 py-2 text-xs font-black text-nt-cyan hover:bg-nt-cyan/10">Copiar resumo para faturamento</button>
            <button type="button" onClick={printBillingOrder} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10">Imprimir ordem de faturamento</button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
            <p className="font-black text-white">{billing.customer_name || order.customer_name}</p>
            <p>CPF: {billing.customer_document || order.customer_document || "-"}</p>
            <p>E-mail: {billing.customer_email || order.customer_email || "-"}</p>
            <p>Telefone: {billing.customer_phone || order.customer_phone || "-"}</p>
            <p className="mt-3 whitespace-pre-line">{formatBillingAddress(billing) || "Endereco de faturamento nao registrado."}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
            {invoice ? (
              <>
                <p className="font-black text-white">NF-e {invoice.invoice_number || "-"}</p>
                <p>Status: {storeFiscalLabels[invoice.status] || invoice.status || "-"}</p>
                <p>Serie: {invoice.invoice_series || "-"}</p>
                <p>Chave: <span className="break-all">{invoice.access_key}</span></p>
                <p>Emissao: {formatStoreDateTime(invoice.issued_at)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {invoiceAuthorized && invoice.pdf_storage_path ? <button type="button" onClick={() => openInvoice("pdf")} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10">Abrir DANFE</button> : null}
                  {invoiceAuthorized && invoice.xml_storage_path ? <button type="button" onClick={() => openInvoice("xml")} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10">Baixar XML</button> : null}
                </div>
              </>
            ) : fiscalStatus === "not_applicable" ? (
              <p>Nao ha emissao fiscal prevista para pedido cancelado, expirado ou recusado.</p>
            ) : (
              <p>Nenhuma nota fiscal anexada ainda.</p>
            )}
            {order.bling_order_id && fiscalStatus !== "not_applicable" ? (
              <button
                type="button"
                onClick={() => onSyncInvoice(order)}
                disabled={invoiceSyncSaving || saving}
                className="mt-4 min-h-10 rounded-md border border-nt-cyan/40 px-3 py-2 text-xs font-black text-nt-cyan transition hover:bg-nt-cyan/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {invoiceSyncSaving ? "Atualizando NF-e..." : "Atualizar NF-e do Bling"}
              </button>
            ) : null}
          </div>
        </div>

        {canAttachInvoice ? <form className="mt-4 grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 md:grid-cols-2" onSubmit={attachInvoice}>
          <label className="text-sm font-bold text-slate-200">Numero da NF-e<input value={invoiceForm.invoiceNumber} onChange={(event) => setInvoiceField("invoiceNumber", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200">Serie<input value={invoiceForm.invoiceSeries} onChange={(event) => setInvoiceField("invoiceSeries", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200 md:col-span-2">Chave de acesso<input value={invoiceForm.accessKey} onChange={(event) => setInvoiceField("accessKey", event.target.value.replace(/\D/g, "").slice(0, 44))} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-nt-cyan" inputMode="numeric" /></label>
          <label className="text-sm font-bold text-slate-200">Data de emissao<input type="datetime-local" value={invoiceForm.issuedAt} onChange={(event) => setInvoiceField("issuedAt", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200">XML autorizado<input type="file" accept=".xml,application/xml,text/xml" onChange={(event) => setInvoiceField("xmlFile", event.target.files?.[0] || null)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          <label className="text-sm font-bold text-slate-200">DANFE PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => setInvoiceField("pdfFile", event.target.files?.[0] || null)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={invoiceSaving || saving} className="min-h-10 rounded-md bg-nt-blue px-4 py-2 text-sm font-black text-white transition hover:bg-nt-cyan disabled:opacity-60">{invoiceSaving ? "Salvando..." : "Salvar nota fiscal"}</button>
            {invoiceMessage ? <p className="text-sm text-slate-300">{invoiceMessage}</p> : null}
          </div>
        </form> : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <label className="text-sm font-black text-white">
            Observacoes internas
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-3 min-h-28 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-nt-cyan"
              placeholder="Visivel apenas no painel administrativo."
            />
          </label>
          <button type="button" disabled={saving} onClick={onSaveNotes} className="mt-3 min-h-10 rounded-md bg-nt-blue px-4 py-2 text-sm font-black text-white transition hover:bg-nt-cyan disabled:opacity-60">Salvar observacoes</button>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex justify-between text-sm text-slate-300"><span>Subtotal</span><strong>{formatStoreMoney(order.subtotal_amount)}</strong></div>
          <div className="mt-2 flex justify-between text-sm text-slate-300"><span>Desconto</span><strong>{formatStoreMoney(order.discount_amount)}</strong></div>
          <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-lg font-black text-nt-cyan"><span>Total</span><strong>{formatStoreMoney(order.total_amount)}</strong></div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="font-black text-white">Historico dos eventos</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-300">
          {order.store_order_logs.length ? order.store_order_logs.map((log) => (
            <p key={log.id}><span className="text-slate-500">{formatStoreDateTime(log.created_at)}</span> - {log.message || log.event_type}</p>
          )) : <p>Nenhum evento registrado.</p>}
        </div>
      </div>
    </section>
  );
}

export function StoreOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [filters, setFilters] = useState({ startDate: "", endDate: "", paymentMethod: "", customer: "", orderNumber: "", document: "", phone: "", search: "" });
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState("");
  const [blingSavingId, setBlingSavingId] = useState("");
  const [invoiceSyncSavingId, setInvoiceSyncSavingId] = useState("");
  const detailsRef = useRef(null);
  const pendingScrollOrderIdRef = useRef("");
  const selectedOrder = orders.find((order) => order.id === selectedId) || null;
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await listStoreOrders();
      setOrders(rows);
      if (selectedId && !rows.some((order) => order.id === selectedId)) setSelectedId("");
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Nao foi possivel carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setNotes(selectedOrder?.pickup_notes || "");
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (!selectedOrder || pendingScrollOrderIdRef.current !== selectedOrder.id) return;
    pendingScrollOrderIdRef.current = "";
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedOrder?.id]);

  function mergeUpdatedOrder(updatedOrder) {
    if (!updatedOrder?.id) return;
    setOrders((currentOrders) => currentOrders.map((order) => (
      order.id === updatedOrder.id
        ? {
            ...order,
            ...updatedOrder,
            store_order_items: order.store_order_items,
            store_payments: order.store_payments,
            store_order_logs: order.store_order_logs,
          }
        : order
    )));
  }

  async function sendBling(order) {
    if (!order?.id) return;
    const blingLinked = Boolean(order.bling_order_id);
    const confirmed = window.confirm(
      blingLinked
        ? "O pedido vinculado sera atualizado no Bling sem criar outro pedido. Deseja continuar?"
        : "Este pedido sera criado no Bling. Nenhuma nota fiscal sera emitida automaticamente nesta etapa. Deseja continuar?",
    );
    if (!confirmed) return;

    setBlingSavingId(order.id);
    setError("");
    setNotice("");
    try {
      const result = await sendStoreOrderToBling(order.id);
      if (result?.order) mergeUpdatedOrder(result.order);
      setNotice(blingLinked || result?.already_linked ? "Pedido atualizado no Bling." : "Pedido enviado ao Bling com sucesso.");
    } catch (blingError) {
      console.error(blingError);
      setError(blingError?.message || "Nao foi possivel enviar o pedido ao Bling.");
      await load();
    } finally {
      setBlingSavingId("");
    }
  }

  function mergeInvoice(orderId, invoice) {
    setOrders((currentOrders) => currentOrders.map((order) => (
      order.id === orderId
        ? {
            ...order,
            fiscal_status: ["issued", "authorized"].includes(invoice?.status) ? "issued" : invoice?.status || order.fiscal_status,
            order_invoices: invoice ? [invoice] : order.order_invoices,
          }
        : order
    )));
  }

  async function syncInvoice(order) {
    if (!order?.id) return;
    if (!order.bling_order_id) {
      setError("Pedido ainda nao esta vinculado ao Bling.");
      return;
    }

    setInvoiceSyncSavingId(order.id);
    setError("");
    setNotice("");
    try {
      const result = await syncStoreOrderInvoiceFromBling(order.id);
      if (result?.invoice) mergeInvoice(order.id, result.invoice);
      setNotice(result?.documents_saved ? "NF-e sincronizada do Bling." : "Status da NF-e atualizado do Bling.");
      await load();
    } catch (invoiceError) {
      console.error(invoiceError);
      setError(invoiceError?.message || "Nao foi possivel atualizar a NF-e do Bling.");
    } finally {
      setInvoiceSyncSavingId("");
    }
  }

  function openOrder(orderId) {
    pendingScrollOrderIdRef.current = orderId;
    if (selectedId === orderId) {
      pendingScrollOrderIdRef.current = "";
      requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    setSelectedId(orderId);
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (quickFilter.startsWith("financial:") && order.financial_status !== quickFilter.replace("financial:", "")) return false;
      if (quickFilter.startsWith("operational:") && order.operational_status !== quickFilter.replace("operational:", "")) return false;
      const fiscalStatus = displayStoreFiscalStatus(order, order.order_invoices?.[0] || null);
      if (quickFilter === "fiscal:paid_pending" && !(order.financial_status === "approved" && order.operational_status !== "cancelled" && fiscalStatus === "pending")) return false;
      if (quickFilter.startsWith("fiscal:") && quickFilter !== "fiscal:paid_pending" && fiscalStatus !== quickFilter.replace("fiscal:", "")) return false;
      if (filters.startDate && dateOnly(order.created_at) < filters.startDate) return false;
      if (filters.endDate && dateOnly(order.created_at) > filters.endDate) return false;
      if (filters.paymentMethod && order.payment_method !== filters.paymentMethod) return false;
      if (filters.customer && !String(order.customer_name || "").toLowerCase().includes(filters.customer.toLowerCase())) return false;
      if (filters.orderNumber && !String(order.order_number || "").toLowerCase().includes(filters.orderNumber.toLowerCase())) return false;
      if (filters.document && !String(order.customer_document || "").replace(/\D/g, "").includes(filters.document.replace(/\D/g, ""))) return false;
      if (filters.phone && !String(order.customer_phone_normalized || order.customer_phone || "").replace(/\D/g, "").includes(filters.phone.replace(/\D/g, ""))) return false;
      return orderMatchesSearch(order, filters.search);
    });
  }, [orders, quickFilter, filters]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const approvedToday = orders.filter((order) => order.financial_status === "approved" && dateOnly(order.paid_at || order.updated_at || order.created_at) === today);
    const approvedMonth = orders.filter((order) => order.financial_status === "approved" && isSameMonth(order.paid_at || order.updated_at || order.created_at));
    return {
      today: orders.filter((order) => dateOnly(order.created_at) === today).length,
      pending: orders.filter((order) => order.financial_status === "pending").length,
      paid: orders.filter((order) => order.financial_status === "approved").length,
      ready: orders.filter((order) => order.operational_status === "ready_for_pickup").length,
      fiscalPending: orders.filter((order) => order.financial_status === "approved" && order.operational_status !== "cancelled" && displayStoreFiscalStatus(order, order.order_invoices?.[0] || null) === "pending").length,
      soldToday: approvedToday.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      soldMonth: approvedMonth.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    };
  }, [orders]);

  function setFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  async function changeStatus(order, status) {
    if (!order || order.operational_status === status) return;
    const previousStatus = order.operational_status;
    setSavingStatusId(order.id);
    setError("");
    setNotice("");
    try {
      const updatedOrder = await updateStoreOrderOperationalStatus(order, status);
      mergeUpdatedOrder(updatedOrder || { id: order.id, operational_status: status });
      setNotice("Status operacional atualizado.");
    } catch (statusError) {
      console.error("Falha ao atualizar status operacional do pedido:", {
        orderId: order.id,
        previousStatus,
        nextStatus: status,
        error: statusError,
      });
      setError(statusError.message || "Nao foi possivel atualizar o status operacional.");
    } finally {
      setSavingStatusId("");
    }
  }

  async function saveNotes() {
    if (!selectedOrder) return;
    setSavingNotes(true);
    setError("");
    setNotice("");
    try {
      const updatedOrder = await updateStoreOrderInternalNotes(selectedOrder.id, notes);
      mergeUpdatedOrder(updatedOrder || { id: selectedOrder.id, pickup_notes: String(notes || "").trim() });
      setNotice("Observacoes internas salvas.");
    } catch (notesError) {
      console.error(notesError);
      setError(notesError.message || "Nao foi possivel salvar as observacoes.");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="grid gap-6">
      {error ? <div className="rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
      {notice ? <div className="rounded-md border border-lime-300/30 bg-lime-300/10 p-4 text-sm text-lime-100">{notice}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <SummaryCard label="Pedidos hoje" value={summary.today} icon={CalendarDays} />
        <SummaryCard label="Aguardando pagamento" value={summary.pending} icon={WalletCards} tone="amber" />
        <SummaryCard label="Pedidos pagos" value={summary.paid} icon={CheckCircle2} tone="green" />
        <SummaryCard label="Prontos para retirada" value={summary.ready} icon={PackageCheck} tone="blue" />
        <SummaryCard label="Pagos sem nota fiscal" value={summary.fiscalPending} icon={ClipboardList} tone="amber" />
        <SummaryCard label="Vendido hoje" value={formatStoreMoney(summary.soldToday)} icon={CreditCard} tone="green" />
        <SummaryCard label="Vendido no mes" value={formatStoreMoney(summary.soldMonth)} icon={ClipboardList} />
      </div>

      <section className="glass rounded-lg p-5 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Pedidos da loja</h2>
            <p className="mt-1 text-sm text-slate-400">Status financeiro vem do Mercado Pago. Aqui a equipe altera apenas a operacao de retirada.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-700 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-nt-cyan disabled:opacity-60">
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {quickFilters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setQuickFilter(value)}
              className={`rounded-full border px-4 py-2 text-xs font-black transition hover:border-nt-cyan ${quickFilter === value ? "border-nt-cyan bg-nt-cyan/10 text-nt-cyan" : "border-white/10 bg-white/5 text-slate-200"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-bold text-slate-200">Busca geral<input value={filters.search} onChange={(event) => setFilter("search", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" placeholder="Numero, cliente, CPF, telefone ou email" /></label>
          <label className="text-sm font-bold text-slate-200">Data inicial<input type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200">Data final<input type="date" value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200">Forma de pagamento<select value={filters.paymentMethod} onChange={(event) => setFilter("paymentMethod", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"><option value="">Todas</option><option value="pix">Pix</option><option value="card">Cartao</option></select></label>
          <label className="text-sm font-bold text-slate-200">Cliente<input value={filters.customer} onChange={(event) => setFilter("customer", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200">Numero do pedido<input value={filters.orderNumber} onChange={(event) => setFilter("orderNumber", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200">CPF<input value={filters.document} onChange={(event) => setFilter("document", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" /></label>
          <label className="text-sm font-bold text-slate-200">Telefone<input value={filters.phone} onChange={(event) => setFilter("phone", event.target.value)} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" /></label>
        </div>

        <div className="mt-6 hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr><th className="py-3">Numero</th><th>Data</th><th>Cliente</th><th>Telefone</th><th>Pagamento</th><th>Valor</th><th>Financeiro</th><th>Fiscal</th><th>Operacional</th><th>Itens</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? <tr><td colSpan={11} className="py-5 text-slate-300">Carregando pedidos...</td></tr> : null}
              {!loading && !filteredOrders.length ? <tr><td colSpan={11} className="py-5 text-slate-300">Nenhum pedido encontrado.</td></tr> : null}
              {filteredOrders.map((order) => (
                <tr key={order.id} className="text-slate-200">
                  <td className="py-4 font-black text-white">{order.order_number}</td>
                  <td>{formatStoreDateTime(order.created_at)}</td>
                  <td>{order.customer_name}</td>
                  <td>{order.customer_phone}</td>
                  <td>{paymentLabel(order)}</td>
                  <td className="font-black text-nt-cyan">{formatStoreMoney(order.total_amount)}</td>
                  <td>{statusBadge(order.financial_status, storeFinancialLabels, financialTones)}</td>
                  <td>{statusBadge(displayStoreFiscalStatus(order, order.order_invoices?.[0] || null), storeFiscalLabels, financialTones)}</td>
                  <td><OperationalStatusSelect order={order} saving={savingStatusId === order.id} onChange={changeStatus} /></td>
                  <td>{orderItemCount(order)}</td>
                  <td><button type="button" onClick={() => openOrder(order.id)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 hover:border-nt-cyan"><Eye size={15} /> Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-3 xl:hidden">
          {loading ? <p className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Carregando pedidos...</p> : null}
          {!loading && !filteredOrders.length ? <p className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Nenhum pedido encontrado.</p> : null}
          {filteredOrders.map((order) => (
            <article key={order.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-black text-white">{order.order_number}</p><p className="mt-1 text-sm text-slate-400">{formatStoreDateTime(order.created_at)}</p></div>
                <button type="button" onClick={() => openOrder(order.id)} className="rounded-md border border-slate-700 px-3 py-2 text-xs font-bold text-slate-100 hover:border-nt-cyan">Abrir</button>
              </div>
              <p className="mt-3 text-sm text-slate-300">{order.customer_name} - {order.customer_phone}</p>
              <div className="mt-3 flex flex-wrap gap-2">{statusBadge(order.financial_status, storeFinancialLabels, financialTones)}{statusBadge(displayStoreFiscalStatus(order, order.order_invoices?.[0] || null), storeFiscalLabels, financialTones)}<OperationalStatusSelect order={order} saving={savingStatusId === order.id} onChange={changeStatus} /></div>
              <p className="mt-3 text-sm font-black text-nt-cyan">{formatStoreMoney(order.total_amount)} - {paymentLabel(order)} - {orderItemCount(order)} itens</p>
            </article>
          ))}
        </div>
      </section>

      {selectedOrder ? (
        <div ref={detailsRef} className="scroll-mt-24">
          <OrderDetails
            order={selectedOrder}
            notes={notes}
            setNotes={setNotes}
            saving={savingNotes || savingStatusId === selectedOrder.id}
            onStatus={(status) => changeStatus(selectedOrder, status)}
            onSaveNotes={saveNotes}
            onInvoiceSaved={mergeInvoice}
            onSyncInvoice={syncInvoice}
            onSendBling={sendBling}
            blingSaving={blingSavingId === selectedOrder.id}
            invoiceSyncSaving={invoiceSyncSavingId === selectedOrder.id}
          />
        </div>
      ) : null}
    </div>
  );
}
