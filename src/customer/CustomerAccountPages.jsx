import { CalendarDays, Home, Lock, LogOut, PackageCheck, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Section } from "../components/Section";
import { useCustomerAuth } from "./CustomerAuthContext";
import {
  createCustomerInvoiceSignedUrl,
  deleteCustomerAddress,
  getCustomerOrderDetails,
  listCustomerAddresses,
  listCustomerOrders,
  saveCustomerAddress,
  upsertCustomerProfile,
} from "./customerService";
import { formatCpf, formatPhone, isValidCpf, passwordHelpText } from "./customerValidation";
import { Alert, Field, inputClass } from "./CustomerAuthPages";

const accountLinks = [
  ["/minha-conta/perfil", "Meu Perfil", UserRound],
  ["/minha-conta/pedidos", "Meus Pedidos", PackageCheck],
  ["/minha-conta/enderecos", "Endereço de faturamento", Home],
  ["/minha-conta/seguranca", "Segurança", ShieldCheck],
];

const financialLabels = {
  pending: "Aguardando pagamento",
  processing: "Processando",
  approved: "Pago",
  rejected: "Recusado",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Estornado",
  charged_back: "Contestação",
};

const operationalLabels = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  separating: "Separando pedido",
  ready_for_pickup: "Pronto para retirada",
  delivered: "Retirado",
  cancelled: "Cancelado",
  manual_review: "Revisão manual",
};

const customerFinancialLabels = {
  pending: "Aguardando pagamento",
  processing: "Pagamento em processamento",
  in_process: "Pagamento em processamento",
  approved: "Pago",
  paid: "Pago",
  accredited: "Pago",
  processed: "Pago",
  rejected: "Pagamento recusado",
  cancelled: "Pagamento cancelado",
  expired: "Pagamento expirado",
  refunded: "Pagamento reembolsado",
  charged_back: "Pagamento estornado",
};

const customerOperationalLabels = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  separating: "Pedido em separacao",
  ready_for_pickup: "Pronto para retirada",
  delivered: "Retirado / Entregue",
  cancelled: "Pedido cancelado",
  manual_review: "Em revisao pela loja",
};

const fiscalLabels = {
  pending: "Aguardando emissão",
  issued: "Emitida",
  authorized: "Autorizada",
  cancelled: "Cancelada",
  not_applicable: "Sem emissão fiscal",
  error: "Problema fiscal",
};

const paymentDetailLabels = {
  accredited: "Pagamento aprovado.",
  approved: "Pagamento aprovado.",
  paid: "Pagamento aprovado.",
  processed: "Pagamento processado.",
  waiting_transfer: "Aguardando pagamento Pix.",
  aguardando_transferencia: "Aguardando pagamento Pix.",
  pending: "Pagamento aguardando confirmacao.",
  processing: "Pagamento em processamento.",
  in_process: "Pagamento em processamento.",
  pending_review_manual: "Pagamento em analise.",
  insufficient_amount: "Pagamento recusado por saldo ou limite insuficiente.",
  cc_rejected_insufficient_amount: "Pagamento recusado por saldo ou limite insuficiente.",
  invalid_installments: "A quantidade de parcelas selecionada nao foi aceita.",
  high_risk: "Pagamento nao autorizado.",
  rejected: "Pagamento recusado.",
  failed: "Pagamento recusado.",
  cancelled: "Pagamento cancelado.",
  expired: "Pagamento expirado.",
  refunded: "Pagamento reembolsado.",
  charged_back: "Pagamento estornado.",
};

const orderEventLabels = {
  order_created: "Pedido criado",
  pedido_criado: "Pedido criado",
  payment_approved: "Pagamento recebido",
  payment_rejected: "Pagamento recusado",
  payment_cancelled: "Pagamento cancelado",
  payment_expired: "Pagamento expirado",
  payment_refunded: "Pagamento reembolsado",
  status_operacional_alterado: "Status do pedido atualizado",
  operational_status_changed: "Status do pedido atualizado",
  stock_committed: "Produtos reservados para retirada",
  manual_review_required: "Pedido em revisao pela loja",
};

const pcConfigLabels = {
  processor: "Processador",
  motherboard: "Placa-mae",
  memory: "Memoria",
  storage: "Armazenamento",
  graphics_card: "Placa de video",
  power_supply: "Fonte",
  case_model: "Gabinete",
  cooling: "Refrigeracao",
  operating_system: "Sistema",
};

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function orderItemImage(item) {
  return item?.main_image || item?.image_url || item?.configuration_snapshot?.main_image || "";
}

function orderItemCatalogHref(item) {
  const itemType = String(item?.item_type || "").trim();
  const slug = String(item?.slug || item?.configuration_snapshot?.slug || item?.metadata?.slug || "").trim();
  if (itemType === "assembled_pc") {
    return slug ? "/computadores/" + encodeURIComponent(slug) : "";
  }
  if (itemType === "product") {
    const productId = String(item?.product_id || "").trim();
    const productIdentifier = slug || productId;
    return productIdentifier ? "/produtos?produto=" + encodeURIComponent(productIdentifier) : "";
  }
  return "";
}

function paymentLabel(value) {
  if (value === "card") return "Cartao";
  if (value === "pix") return "Pix";
  return "-";
}

function latestPayment(order) {
  return Array.isArray(order?.store_payments) ? order.store_payments[0] || null : null;
}

function normalizePaymentStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function consolidatedFinancialStatus(order, payment) {
  const orderStatus = normalizePaymentStatus(order?.financial_status);
  const paymentStatus = normalizePaymentStatus(payment?.status);
  const approvedStatuses = ["approved", "paid", "accredited", "processed"];
  const processingStatuses = ["processing", "in_process"];
  const finalStatuses = ["rejected", "cancelled", "expired", "refunded", "charged_back"];

  if (approvedStatuses.includes(orderStatus)) return "approved";
  if (processingStatuses.includes(orderStatus)) return "processing";
  if (finalStatuses.includes(orderStatus) || orderStatus === "pending") return orderStatus;
  if (approvedStatuses.includes(paymentStatus)) return "approved";
  if (processingStatuses.includes(paymentStatus)) return "processing";
  if (finalStatuses.includes(paymentStatus) || paymentStatus === "pending") return paymentStatus;
  return orderStatus || paymentStatus || "";
}

function paymentStatusLabel(payment, order) {
  const status = consolidatedFinancialStatus(order, payment);
  return customerFinancialLabels[status] || financialLabels[status] || status || "-";
}

function displayFiscalStatus(order, invoice = null) {
  if (["issued", "authorized"].includes(invoice?.status)) return "issued";
  if (invoice?.status === "cancelled") return "cancelled";
  if (invoice?.status === "error") return "error";
  if (order?.operational_status === "cancelled") return "not_applicable";
  if (["expired", "cancelled", "rejected", "refunded", "charged_back"].includes(order?.financial_status)) return "not_applicable";
  return order?.fiscal_status || "pending";
}

function paymentDetailMessage(detail) {
  const normalized = String(detail || "").trim().toLowerCase();
  return paymentDetailLabels[normalized] || (normalized ? "Acompanhe a atualizacao do pagamento em Meus Pedidos." : "Status atualizado automaticamente pela NT Informatica.");
}

function isPixActive(payment, order) {
  const financialStatus = consolidatedFinancialStatus(order, payment);
  if (!payment || payment.payment_method !== "pix" || !payment.qr_code) return false;
  if (!["pending", "processing"].includes(financialStatus)) return false;
  if (payment.expires_at && new Date(payment.expires_at).getTime() <= Date.now()) return false;
  return true;
}

function isPendingPixExpired(payment, order) {
  const financialStatus = consolidatedFinancialStatus(order, payment);
  const paymentStatus = normalizePaymentStatus(payment?.status);
  if (financialStatus !== "pending") return false;
  if (paymentStatus && paymentStatus !== "pending") return false;
  if (!payment || payment.payment_method !== "pix" || !payment.expires_at) return false;
  return new Date(payment.expires_at).getTime() <= Date.now();
}

function itemConfigEntries(item) {
  const snapshot = item?.configuration_snapshot && typeof item.configuration_snapshot === "object" ? item.configuration_snapshot : {};
  return Object.entries(pcConfigLabels)
    .map(([key, label]) => [label, snapshot[key]])
    .filter(([, value]) => value);
}

function publicOrderEventLabel(log) {
  return orderEventLabels[log?.event_type] || "Atualizacao do pedido";
}

function routeKey(path) {
  if (path.includes("/pedidos")) return "pedidos";
  if (path.includes("/enderecos")) return "enderecos";
  if (path.includes("/seguranca")) return "seguranca";
  return "perfil";
}

function AccountShell({ path, onNavigate, getNavHref, navigateTo, children }) {
  const auth = useCustomerAuth();
  const active = routeKey(path);

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-nt-ink text-white">
        <Header onNavigate={onNavigate} getNavHref={getNavHref} />
        <main className="pt-20"><Section eyebrow="Minha Conta" title="Verificando sessão..."><Card>Carregando dados da conta.</Card></Section></main>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="min-h-screen bg-nt-ink text-white">
        <Header onNavigate={onNavigate} getNavHref={getNavHref} />
        <main className="pt-20">
          <Section eyebrow="Acesso protegido" title="Entre para acessar sua conta." description="Sua área do cliente utiliza Supabase Auth e só exibe dados do usuário autenticado.">
            <Card className="max-w-2xl">
              <Button href="/login">Entrar</Button>
              <Button href="/cadastro" variant="secondary" className="ml-0 mt-3 sm:ml-3 sm:mt-0">Criar conta</Button>
            </Card>
          </Section>
        </main>
      </div>
    );
  }

  async function logout() {
    await auth.signOut();
    navigateTo("/");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header onNavigate={onNavigate} getNavHref={getNavHref} />
      <main className="pt-20">
        <Section eyebrow="Minha Conta" title={`Olá, ${auth.profile?.full_name?.split(" ")[0] || auth.user?.email || "cliente"}`} description="Gerencie seus dados e acompanhe a preparação do e-commerce da NT Informática.">
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-lg border border-white/10 bg-white/5 p-3">
              <nav className="grid gap-2" aria-label="Menu da conta">
                {accountLinks.map(([href, label, Icon]) => (
                  <a key={href} href={href} className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-bold transition ${active === routeKey(href) ? "bg-nt-cyan/15 text-nt-cyan" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                    <Icon size={18} /> {label}
                  </a>
                ))}
                <button type="button" onClick={logout} className="flex items-center gap-3 rounded-md px-4 py-3 text-left text-sm font-bold text-red-200 transition hover:bg-red-400/10">
                  <LogOut size={18} /> Sair
                </button>
              </nav>
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

function ProfilePanel() {
  const auth = useCustomerAuth();
  const metadata = auth.user?.user_metadata || {};
  const termsAccepted = Boolean(auth.profile?.terms_accepted_at || metadata.terms_accepted || metadata.acceptTerms || metadata.termsAccepted);
  const privacyAccepted = Boolean(auth.profile?.privacy_accepted_at || metadata.privacy_accepted || metadata.acceptPrivacy || metadata.privacyAccepted);
  const [values, setValues] = useState({
    fullName: auth.profile?.full_name || "",
    cpf: auth.profile?.cpf ? formatCpf(auth.profile.cpf) : "",
    birthDate: auth.profile?.birth_date || "",
    phone: auth.profile?.phone || "",
    secondaryPhone: auth.profile?.secondary_phone || "",
    avatarUrl: auth.profile?.avatar_url || "",
    acceptTerms: termsAccepted,
    acceptPrivacy: privacyAccepted,
    termsAcceptedAt: auth.profile?.terms_accepted_at || "",
    privacyAcceptedAt: auth.profile?.privacy_accepted_at || "",
  });
  const [email, setEmail] = useState(auth.user?.email || "");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const hasSavedValidCpf = isValidCpf(auth.profile?.cpf || "");

  useEffect(() => {
    setValues({
      fullName: auth.profile?.full_name || "",
      cpf: auth.profile?.cpf ? formatCpf(auth.profile.cpf) : "",
      birthDate: auth.profile?.birth_date || "",
      phone: auth.profile?.phone || "",
      secondaryPhone: auth.profile?.secondary_phone || "",
      avatarUrl: auth.profile?.avatar_url || "",
      acceptTerms: termsAccepted,
      acceptPrivacy: privacyAccepted,
      termsAcceptedAt: auth.profile?.terms_accepted_at || "",
      privacyAcceptedAt: auth.profile?.privacy_accepted_at || "",
    });
    setEmail(auth.user?.email || "");
  }, [auth.profile, auth.user?.email, termsAccepted, privacyAccepted]);

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSuccess("");
    try {
      if (!isValidCpf(values.cpf)) throw new Error("Informe um CPF valido com 11 digitos.");
      if (!values.termsAcceptedAt && !values.acceptTerms) throw new Error("Aceite os Termos de Uso para continuar.");
      if (!values.privacyAcceptedAt && !values.acceptPrivacy) throw new Error("Aceite a Politica de Privacidade para continuar.");
      await upsertCustomerProfile(auth.user.id, values);
      if (email !== auth.user.email) await auth.updateEmail(email);
      await auth.refreshProfile();
      setSuccess("Perfil atualizado com sucesso.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-2xl font-black text-white">Meu Perfil</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">CPF pode ser preenchido uma vez e fica somente leitura apos salvo corretamente. Alteracao de e-mail segue confirmacao segura pelo Supabase.</p>
      {message ? <div className="mt-5"><Alert type="error">{message}</Alert></div> : null}
      {success ? <div className="mt-5"><Alert type="success">{success}</Alert></div> : null}
      <form className="mt-6 grid gap-5 md:grid-cols-2" onSubmit={save}>
        <Field id="profile-name" label="Nome"><input id="profile-name" value={values.fullName} onChange={(event) => setField("fullName", event.target.value)} className={inputClass()} /></Field>
        <Field id="profile-cpf" label="CPF" hint={hasSavedValidCpf ? "CPF salvo. Para alterar, fale com a NT Informatica." : "Digite 11 numeros para liberar o checkout."}><input id="profile-cpf" value={values.cpf} onChange={(event) => setField("cpf", formatCpf(event.target.value))} className={`${inputClass()} ${hasSavedValidCpf ? "opacity-75" : ""}`} inputMode="numeric" readOnly={hasSavedValidCpf} /></Field>
        <Field id="profile-email" label="E-mail"><input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass()} /></Field>
        <Field id="profile-phone" label="Telefone"><input id="profile-phone" value={values.phone} onChange={(event) => setField("phone", formatPhone(event.target.value))} className={inputClass()} /></Field>
        <Field id="profile-birth" label="Data de nascimento"><input id="profile-birth" type="date" value={values.birthDate || ""} onChange={(event) => setField("birthDate", event.target.value)} className={inputClass()} /></Field>
        <Field id="profile-secondary" label="Telefone secundário"><input id="profile-secondary" value={values.secondaryPhone} onChange={(event) => setField("secondaryPhone", formatPhone(event.target.value))} className={inputClass()} /></Field>
        <Field id="profile-avatar" label="Foto de perfil por URL" hint="Upload de foto pode ser ligado ao Storage em uma etapa futura."><input id="profile-avatar" value={values.avatarUrl} onChange={(event) => setField("avatarUrl", event.target.value)} className={inputClass()} /></Field>
        <div className="md:col-span-2 rounded-md border border-white/10 bg-white/5 p-4">
          <h3 className="text-base font-black text-white">Termos e privacidade</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            {values.termsAcceptedAt ? (
              <p className="font-bold text-lime-100">Termos de Uso aceitos em {formatDate(values.termsAcceptedAt)}.</p>
            ) : (
              <label className="flex gap-3">
                <input type="checkbox" checked={values.acceptTerms} onChange={(event) => setField("acceptTerms", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-nt-cyan" />
                <span>Aceito os <a href="/termos-de-uso" target="_blank" rel="noreferrer" className="font-black text-nt-cyan hover:text-white">Termos de Uso</a>.</span>
              </label>
            )}
            {values.privacyAcceptedAt ? (
              <p className="font-bold text-lime-100">Politica de Privacidade aceita em {formatDate(values.privacyAcceptedAt)}.</p>
            ) : (
              <label className="flex gap-3">
                <input type="checkbox" checked={values.acceptPrivacy} onChange={(event) => setField("acceptPrivacy", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-nt-cyan" />
                <span>Aceito a <a href="/politica-de-privacidade" target="_blank" rel="noreferrer" className="font-black text-nt-cyan hover:text-white">Politica de Privacidade</a>.</span>
              </label>
            )}
          </div>
        </div>
        <div className="flex items-end"><button type="submit" disabled={saving} className="min-h-12 w-full rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan disabled:opacity-60">{saving ? "Salvando..." : "Salvar perfil"}</button></div>
      </form>
    </Card>
  );
}

function OrdersPanel({ path = "", navigateTo }) {
  const auth = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);
  const routeOrderId = path.match(/^\/minha-conta\/pedidos\/([^/]+)/)?.[1] || "";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listCustomerOrders(auth.user?.email).then((rows) => {
      if (mounted) setOrders(rows || []);
    }).finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [auth.user?.email]);

  useEffect(() => {
    if (routeOrderId) openOrder(decodeURIComponent(routeOrderId));
    else {
      setSelected(null);
      setDetailError("");
      setCopiedPix(false);
    }
  }, [routeOrderId, auth.user?.email]);

  async function openOrder(orderId) {
    setDetailLoading(true);
    setDetailError("");
    setCopiedPix(false);
    try {
      const details = await getCustomerOrderDetails(auth.user?.email, orderId);
      setSelected(details);
      if (!details) setDetailError("Pedido nao encontrado ou voce nao possui acesso a ele.");
    } catch (error) {
      console.error("Erro ao carregar detalhe do pedido:", {
        orderId,
        message: error?.message || "",
      });
      setSelected(null);
      setDetailError(error?.message || "Nao foi possivel carregar os detalhes do pedido.");
    } finally {
      setDetailLoading(false);
    }
  }

  function openOrderRoute(orderId) {
    navigateTo("/minha-conta/pedidos/" + encodeURIComponent(orderId));
  }

  function closeOrderDetails() {
    navigateTo("/minha-conta/pedidos");
  }

  async function copyPixCode(code) {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedPix(true);
  }

  async function openInvoiceDocument(invoice, kind) {
    try {
      const url = await createCustomerInvoiceSignedUrl(invoice, kind);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setDetailError(error?.message || "Nao foi possivel abrir o documento fiscal.");
    }
  }

  async function copyInvoiceAccessKey(accessKey) {
    if (!accessKey) return;
    await navigator.clipboard.writeText(accessKey);
  }

  function renderOrderDetails() {
    if (!selected) return null;
    const payment = latestPayment(selected);
    const paymentMethod = payment?.payment_method || selected.payment_method;
    const items = Array.isArray(selected.store_order_items) ? selected.store_order_items : [];
    const logs = Array.isArray(selected.store_order_logs) ? selected.store_order_logs : [];
    const financialStatus = consolidatedFinancialStatus(selected, payment);
    const pixActive = isPixActive(payment, selected);
    const pixExpired = isPendingPixExpired(payment, selected);
    const cardRejected = paymentMethod === "card" && ["rejected", "cancelled", "expired", "refunded", "charged_back"].includes(financialStatus);
    const installments = Number(payment?.installments || selected.installments || 1);
    const installmentAmount = Number(payment?.installment_amount || (installments > 1 ? Number(selected.total_amount || 0) / installments : 0));
    const invoice = Array.isArray(selected.order_invoices) ? selected.order_invoices[0] || null : null;
    const invoiceAuthorized = ["issued", "authorized"].includes(invoice?.status);
    const fiscalStatus = displayFiscalStatus(selected, invoice);

    return (
      <div className="rounded-lg border border-white/10 bg-slate-950 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-nt-cyan">Pedido</p>
            <h3 className="mt-1 text-2xl font-black text-white">{selected.order_number}</h3>
            <p className="mt-2 text-sm text-slate-400">Criado em {formatDate(selected.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 text-xs font-black text-lime-100">{paymentStatusLabel(payment, selected)}</span>
            <span className="rounded-full border border-nt-cyan/30 bg-nt-cyan/10 px-3 py-1 text-xs font-black text-nt-cyan">{customerOperationalLabels[selected.operational_status] || selected.operational_status || "-"}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={closeOrderDetails} className="rounded-md border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10">Voltar para Meus Pedidos</button>
          <Button href="/produtos" variant="secondary">Continuar comprando</Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Resumo</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Subtotal</dt><dd className="font-bold text-white">{formatCurrency(selected.subtotal_amount)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Desconto</dt><dd className="font-bold text-white">{formatCurrency(selected.discount_amount)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2"><dt className="text-slate-200">Total</dt><dd className="text-lg font-black text-nt-cyan">{formatCurrency(selected.total_amount)}</dd></div>
            </dl>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Pagamento</p>
            <dl className="mt-3 grid gap-2 text-sm text-slate-300">
              <div><dt className="text-slate-500">Forma</dt><dd className="font-bold text-white">{paymentLabel(paymentMethod)}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd className="font-bold text-white">{paymentStatusLabel(payment, selected)}</dd></div>
              {payment?.status_detail ? <div><dt className="text-slate-500">Detalhe</dt><dd className="font-bold text-white">{paymentDetailMessage(payment.status_detail)}</dd></div> : null}
              {paymentMethod === "card" ? <div><dt className="text-slate-500">Parcelas</dt><dd className="font-bold text-white">{installments > 1 ? installments + "x de " + formatCurrency(installmentAmount) : "A vista"}</dd></div> : null}
              {payment?.approved_at || payment?.paid_at ? <div><dt className="text-slate-500">Confirmado em</dt><dd className="font-bold text-white">{formatDate(payment.approved_at || payment.paid_at)}</dd></div> : null}
              {payment?.expires_at ? <div><dt className="text-slate-500">Vencimento</dt><dd className="font-bold text-white">{formatDate(payment.expires_at)}</dd></div> : null}
            </dl>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Retirada</p>
            <div className="mt-3 text-sm leading-6 text-slate-300">
              <p className="font-black text-white">NT Informatica, Celulares e Games</p>
              <p>Rua Johann Sachse, 2891</p>
              <p>Sala 1 - Badenfurt</p>
              <p>Blumenau - SC</p>
              <p className="mt-3 text-slate-400">Aguarde o status "Pronto para retirada" antes de buscar o pedido.</p>
            </div>
          </div>
        </div>

        {pixActive ? (
          <div className="mt-6 rounded-md border border-lime-300/20 bg-lime-300/10 p-4">
            <p className="font-black text-lime-100">Pix aguardando pagamento</p>
            <p className="mt-2 text-sm text-lime-50/80">Use o QR Code ou copie o codigo Pix abaixo. Esta tela nao gera uma nova cobranca.</p>
            {payment.qr_code_base64 ? <img src={"data:image/png;base64," + payment.qr_code_base64} alt="QR Code Pix do pedido" className="mt-4 w-48 rounded-md bg-white p-2" /> : null}
            <textarea readOnly value={payment.qr_code} className="mt-4 min-h-24 w-full rounded-md border border-white/10 bg-slate-950 p-3 text-sm text-slate-100" />
            <button type="button" onClick={() => copyPixCode(payment.qr_code)} className="mt-3 rounded-md bg-lime-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-lime-300">{copiedPix ? "Codigo copiado" : "Copiar codigo Pix"}</button>
          </div>
        ) : null}

        {!pixActive && pixExpired ? (
          <div className="mt-6"><Alert type="error">Pagamento expirado. Refaca a compra para gerar uma nova cobranca.</Alert></div>
        ) : null}

        {cardRejected ? (
          <div className="mt-6 rounded-md border border-red-300/30 bg-red-400/10 p-4">
            <p className="font-black text-red-100">Pagamento recusado</p>
            <p className="mt-2 text-sm text-red-50/80">{paymentDetailMessage(payment?.status_detail)} Tente outro cartao ou outra forma de pagamento.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button href="/carrinho">Voltar ao carrinho</Button>
              <Button href="/produtos" variant="secondary">Continuar comprando</Button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-md border border-white/10 bg-white/5 p-4">
          <p className="text-lg font-black text-white">Nota fiscal</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            <p>Status: <strong className="text-white">{fiscalLabels[fiscalStatus] || fiscalStatus}</strong></p>
            {invoiceAuthorized ? (
              <>
                <p>Numero: <strong className="text-white">{invoice.invoice_number || "-"}</strong></p>
                <p>Serie: <strong className="text-white">{invoice.invoice_series || "-"}</strong></p>
                <p>Data de emissao: <strong className="text-white">{formatDate(invoice.issued_at)}</strong></p>
                <p>Chave de acesso: <strong className="break-all text-white">{invoice.access_key}</strong></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {invoiceAuthorized && invoice.pdf_storage_path ? <button type="button" onClick={() => openInvoiceDocument(invoice, "pdf")} className="rounded-md border border-nt-cyan/40 px-3 py-2 text-xs font-black text-nt-cyan transition hover:bg-nt-cyan/10">Visualizar DANFE</button> : null}
                  {invoiceAuthorized && invoice.pdf_storage_path ? <button type="button" onClick={() => openInvoiceDocument(invoice, "pdf")} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10">Baixar DANFE PDF</button> : null}
                  {invoiceAuthorized && invoice.xml_storage_path ? <button type="button" onClick={() => openInvoiceDocument(invoice, "xml")} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10">Baixar XML</button> : null}
                  <button type="button" onClick={() => copyInvoiceAccessKey(invoice.access_key)} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10">Copiar chave de acesso</button>
                </div>
              </>
            ) : invoice ? (
              <p className="text-slate-400">A nota fiscal ainda nao esta autorizada para disponibilizacao.</p>
            ) : fiscalStatus === "not_applicable" ? (
              <p className="text-slate-400">Este pedido foi cancelado, expirado ou recusado e nao possui emissao fiscal prevista.</p>
            ) : (
              <p className="text-slate-400">A nota fiscal sera disponibilizada aqui apos emissao pela NT Informatica.</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-lg font-black text-white">Itens do pedido</p>
          <div className="mt-3 grid gap-3">
            {items.map((item) => {
              const configEntries = itemConfigEntries(item);
              const catalogHref = orderItemCatalogHref(item);
              const productName = item.product_name || "Item do pedido";
              const productImage = orderItemImage(item);
              return (
                <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {productImage && catalogHref ? (
                        <a href={catalogHref} aria-label={"Abrir produto " + productName} className="block rounded-md outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-nt-cyan">
                          <img src={productImage} alt={productName} className="h-16 w-16 rounded-md object-cover transition hover:brightness-110" />
                        </a>
                      ) : productImage ? (
                        <img src={productImage} alt={productName} className="h-16 w-16 rounded-md object-cover" />
                      ) : (
                        <div className="h-16 w-16 rounded-md bg-slate-800" />
                      )}
                      <div className="min-w-0">
                        {catalogHref ? (
                          <a href={catalogHref} aria-label={"Abrir produto " + productName} className="font-bold text-white outline-none transition hover:text-nt-cyan focus-visible:ring-2 focus-visible:ring-nt-cyan">{productName}</a>
                        ) : (
                          <p className="font-bold text-white">{productName}</p>
                        )}
                        <p className="text-sm text-slate-400">{item.variation_name || item.sku || item.internal_code || "Item do pedido"}</p>
                        {!catalogHref ? <p className="mt-1 text-xs text-slate-500">Produto nao disponivel no catalogo</p> : null}
                      </div>
                    </div>
                    <div className="text-right text-sm text-slate-300">
                      <p>{item.quantity} x {formatCurrency(item.final_unit_price)}</p>
                      <p className="font-black text-white">{formatCurrency(item.total_price || Number(item.final_unit_price || 0) * Number(item.quantity || 0))}</p>
                    </div>
                  </div>
                  {configEntries.length ? (
                    <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                      {configEntries.map(([label, value]) => (
                        <div key={label} className="flex gap-2"><dt className="text-slate-500">{label}:</dt><dd className="font-bold text-slate-200">{value}</dd></div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-md border border-white/10 bg-white/5 p-4">
          <p className="font-black text-white">Historico publico</p>
          {selected.logsUnavailable ? <p className="mt-3 text-sm text-slate-400">Historico detalhado indisponivel para visualizacao do cliente nesta etapa.</p> : null}
          {!selected.logsUnavailable && logs.length ? (
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              {logs.map((log) => (
                <p key={log.id}><span className="text-slate-500">{formatDate(log.created_at)}</span> - {publicOrderEventLabel(log)}</p>
              ))}
            </div>
          ) : null}
          {!selected.logsUnavailable && !logs.length ? <p className="mt-3 text-sm text-slate-400">Nenhum evento publico disponivel.</p> : null}
        </div>
      </div>
    );
  }

  if (routeOrderId) {
    return (
      <Card>
        <h2 className="text-2xl font-black text-white">Detalhes do pedido</h2>
        {detailLoading ? <div className="mt-6 rounded-lg border border-white/10 bg-slate-950 p-5 text-sm font-bold text-slate-200">Carregando detalhes do pedido...</div> : null}
        {!detailLoading && detailError ? (
          <div className="mt-6 rounded-lg border border-red-300/30 bg-red-400/10 p-5">
            <Alert type="error">{detailError}</Alert>
            <button type="button" onClick={closeOrderDetails} className="mt-4 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">Voltar para Meus Pedidos</button>
          </div>
        ) : null}
        {!detailLoading && !detailError ? <div className="mt-6">{renderOrderDetails()}</div> : null}
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-2xl font-black text-white">Meus Pedidos</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Acompanhe seus pedidos de retirada na loja e veja detalhes do pagamento.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr><th className="py-3">Numero</th><th>Data</th><th>Valor</th><th>Status operacional</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? <tr><td colSpan={5} className="py-5 text-slate-300">Carregando pedidos...</td></tr> : null}
            {!loading && !orders.length ? <tr><td colSpan={5} className="py-5 text-slate-300">Nenhum pedido encontrado para este e-mail.</td></tr> : null}
            {orders.map((order) => (
              <tr key={order.id} className="text-slate-200">
                <td className="py-4 font-black text-white">{order.order_number}</td>
                <td>{formatDate(order.created_at)}</td>
                <td>{formatCurrency(order.total_amount)}</td>
                <td>{customerOperationalLabels[order.operational_status] || operationalLabels[order.operational_status] || order.operational_status}</td>
                <td><a href={"/minha-conta/pedidos/" + encodeURIComponent(order.id)} onClick={(event) => { event.preventDefault(); openOrderRoute(order.id); }} className="inline-flex min-h-9 min-w-[104px] items-center justify-center whitespace-nowrap rounded-md border border-nt-cyan/40 px-3 py-2 text-center text-xs font-black leading-none text-nt-cyan transition hover:bg-nt-cyan/10">Ver detalhes</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function AddressesPanel() {
  const auth = useCustomerAuth();
  const emptyAddress = useMemo(() => ({ label: "Principal", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", country: "Brasil", isDefault: true }), []);
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(emptyAddress);
  const [message, setMessage] = useState("");

  async function load() {
    const rows = await listCustomerAddresses(auth.user.id);
    setAddresses(rows || []);
  }

  useEffect(() => {
    load();
  }, [auth.user.id]);

  async function save(event) {
    event.preventDefault();
    setMessage("");
    await saveCustomerAddress(auth.user.id, editing);
    setEditing(emptyAddress);
    await load();
    setMessage("Endereço salvo.");
  }

  async function remove(id) {
    await deleteCustomerAddress(auth.user.id, id);
    await load();
  }

  function setField(field, value) {
    setEditing((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid gap-5">
      <Alert>Pedidos atualmente são somente para retirada na loja. Este endereço será usado para faturamento e emissão fiscal.</Alert>
      <Card>
        <h2 className="text-2xl font-black text-white">Endereço de faturamento</h2>
        {message ? <div className="mt-5"><Alert type="success">{message}</Alert></div> : null}
        <form className="mt-6 grid gap-5 md:grid-cols-2" onSubmit={save}>
          <Field id="address-label" label="Identificação"><input id="address-label" value={editing.label} onChange={(event) => setField("label", event.target.value)} className={inputClass()} /></Field>
          <Field id="address-cep" label="CEP"><input id="address-cep" value={editing.cep} onChange={(event) => setField("cep", event.target.value)} className={inputClass()} /></Field>
          <Field id="address-street" label="Rua"><input id="address-street" value={editing.street} onChange={(event) => setField("street", event.target.value)} className={inputClass()} /></Field>
          <Field id="address-number" label="Número"><input id="address-number" value={editing.number} onChange={(event) => setField("number", event.target.value)} className={inputClass()} /></Field>
          <Field id="address-complement" label="Complemento"><input id="address-complement" value={editing.complement} onChange={(event) => setField("complement", event.target.value)} className={inputClass()} /></Field>
          <Field id="address-neighborhood" label="Bairro"><input id="address-neighborhood" value={editing.neighborhood} onChange={(event) => setField("neighborhood", event.target.value)} className={inputClass()} /></Field>
          <Field id="address-city" label="Cidade"><input id="address-city" value={editing.city} onChange={(event) => setField("city", event.target.value)} className={inputClass()} /></Field>
          <Field id="address-state" label="Estado"><input id="address-state" value={editing.state} onChange={(event) => setField("state", event.target.value.toUpperCase().slice(0, 2))} className={inputClass()} /></Field>
          <Field id="address-country" label="País"><input id="address-country" value={editing.country} onChange={(event) => setField("country", event.target.value)} className={inputClass()} /></Field>
          <div className="flex items-end"><button type="submit" className="min-h-12 w-full rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan">{editing.id ? "Atualizar endereço" : "Adicionar endereço"}</button></div>
        </form>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {addresses.map((address) => (
          <Card key={address.id} className="p-5">
            <p className="font-black text-white">{address.label}</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{address.street}, {address.number}<br />{address.neighborhood} - {address.city}/{address.state}<br />CEP {address.cep}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setEditing({ ...address, isDefault: address.is_default })} className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">Editar</button>
              <button type="button" onClick={() => remove(address.id)} className="rounded-md border border-red-300/30 px-3 py-2 text-sm text-red-200 hover:bg-red-400/10">Excluir</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SecurityPanel() {
  const auth = useCustomerAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  async function save(event) {
    event.preventDefault();
    setMessage("");
    setSuccess("");
    if (password !== confirmPassword) {
      setMessage("As senhas não conferem.");
      return;
    }
    try {
      await auth.updatePassword(password);
      setPassword("");
      setConfirmPassword("");
      setSuccess("Senha alterada com sucesso.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <h2 className="text-2xl font-black text-white">Segurança</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/5 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Último acesso</p><p className="mt-2 font-bold text-white">{auth.profile?.last_login_at ? formatDate(auth.profile.last_login_at) : "Registrado no próximo login"}</p></div>
          <div className="rounded-md border border-white/10 bg-white/5 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Sessões</p><p className="mt-2 font-bold text-white">Gerenciadas pelo Supabase Auth</p></div>
        </div>
        {message ? <div className="mt-5"><Alert type="error">{message}</Alert></div> : null}
        {success ? <div className="mt-5"><Alert type="success">{success}</Alert></div> : null}
        <form className="mt-6 grid gap-5 md:grid-cols-2" onSubmit={save}>
          <Field id="security-password" label="Nova senha" hint={passwordHelpText(password)}><input id="security-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass()} /></Field>
          <Field id="security-confirm" label="Confirmar senha"><input id="security-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass()} /></Field>
          <button type="submit" className="min-h-12 rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan">Alterar senha</button>
          <button type="button" onClick={auth.signOutEverywhere} className="min-h-12 rounded-md border border-red-300/30 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-400/10">Encerrar todas as sessões</button>
        </form>
      </Card>
    </div>
  );
}

export function CustomerAccountPage({ path, onNavigate, getNavHref, navigateTo }) {
  const active = routeKey(path);
  return (
    <AccountShell path={path} onNavigate={onNavigate} getNavHref={getNavHref} navigateTo={navigateTo}>
      {active === "pedidos" ? <OrdersPanel path={path} navigateTo={navigateTo} /> : null}
      {active === "enderecos" ? <AddressesPanel /> : null}
      {active === "seguranca" ? <SecurityPanel /> : null}
      {active === "perfil" ? <ProfilePanel /> : null}
    </AccountShell>
  );
}
