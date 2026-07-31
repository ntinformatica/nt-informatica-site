import { CalendarDays, Home, Lock, LogOut, PackageCheck, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Section } from "../components/Section";
import { useCustomerAuth } from "./CustomerAuthContext";
import {
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
  ["/minha-conta/enderecos", "Endereço", Home],
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

function OrdersPanel({ path = "" }) {
  const auth = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const routeOrderId = path.match(/^\/minha-conta\/pedidos\/([^/]+)/)?.[1] || "";

  useEffect(() => {
    let mounted = true;
    listCustomerOrders(auth.user?.email).then((rows) => {
      if (mounted) setOrders(rows || []);
    }).finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [auth.user?.email]);

  useEffect(() => {
    if (routeOrderId) openOrder(decodeURIComponent(routeOrderId));
  }, [routeOrderId, auth.user?.email]);

  async function openOrder(orderId) {
    const details = await getCustomerOrderDetails(auth.user?.email, orderId);
    setSelected(details);
  }

  return (
    <Card>
      <h2 className="text-2xl font-black text-white">Meus Pedidos</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Estrutura preparada para pedidos de retirada na loja. Nenhum status de envio será usado nesta operação.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
            <tr><th className="py-3">Número</th><th>Data</th><th>Valor</th><th>Pagamento</th><th>Status financeiro</th><th>Status operacional</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? <tr><td colSpan={7} className="py-5 text-slate-300">Carregando pedidos...</td></tr> : null}
            {!loading && !orders.length ? <tr><td colSpan={7} className="py-5 text-slate-300">Nenhum pedido encontrado para este e-mail.</td></tr> : null}
            {orders.map((order) => (
              <tr key={order.id} className="text-slate-200">
                <td className="py-4 font-black text-white">{order.order_number}</td>
                <td>{formatDate(order.created_at)}</td>
                <td>{formatCurrency(order.total_amount)}</td>
                <td>{order.payment_method === "card" ? "Cartão" : order.payment_method === "pix" ? "Pix" : "-"}</td>
                <td>{financialLabels[order.financial_status] || order.financial_status}</td>
                <td>{operationalLabels[order.operational_status] || order.operational_status}</td>
                <td><a href={`/minha-conta/pedidos/${encodeURIComponent(order.id)}`} onClick={(event) => { event.preventDefault(); window.history.pushState({}, "", `/minha-conta/pedidos/${encodeURIComponent(order.id)}`); openOrder(order.id); }} className="rounded-md border border-nt-cyan/40 px-3 py-2 text-xs font-black text-nt-cyan hover:bg-nt-cyan/10">Ver detalhes</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <div className="mt-6 rounded-lg border border-white/10 bg-slate-950 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-nt-cyan">Pedido</p><h3 className="mt-1 text-xl font-black text-white">{selected.order_number}</h3></div>
            <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">Fechar</button>
          </div>
          {(() => {
            const payment = selected.store_payments?.[0];
            const pixPending = payment?.payment_method === "pix" && payment?.qr_code && !["approved", "cancelled", "expired", "rejected", "refunded", "charged_back"].includes(payment.status);
            return pixPending ? (
              <div className="mt-5 rounded-md border border-lime-300/20 bg-lime-300/10 p-4">
                <p className="font-black text-lime-100">Pix aguardando pagamento</p>
                {payment.qr_code_base64 ? <img src={`data:image/png;base64,${payment.qr_code_base64}`} alt="QR Code Pix do pedido" className="mt-4 w-48 rounded-md bg-white p-2" /> : null}
                <textarea readOnly value={payment.qr_code} className="mt-4 min-h-24 w-full rounded-md border border-white/10 bg-slate-950 p-3 text-sm text-slate-100" />
              </div>
            ) : null;
          })()}
          <dl className="mt-5 grid gap-3 md:grid-cols-3">
            <div><dt className="text-xs text-slate-400">Pagamento</dt><dd className="font-bold text-white">{selected.payment_method === "card" ? "Cartão" : selected.payment_method === "pix" ? "Pix" : "-"}</dd></div>
            <div><dt className="text-xs text-slate-400">Financeiro</dt><dd className="font-bold text-white">{financialLabels[selected.financial_status] || selected.financial_status}</dd></div>
            <div><dt className="text-xs text-slate-400">Operação</dt><dd className="font-bold text-white">{operationalLabels[selected.operational_status] || selected.operational_status}</dd></div>
          </dl>
          <div className="mt-5 rounded-md border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
            <p className="font-black text-white">Local de retirada</p>
            <p className="mt-2">Rua Johann Sachse, 2891, Sala 1 - Badenfurt, Blumenau - SC.</p>
            <p>Aguarde a confirmacao de que o pedido esta pronto antes de retirar.</p>
          </div>
          <div className="mt-5 grid gap-3">
            {(selected.store_order_items || []).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {orderItemImage(item) ? <img src={orderItemImage(item)} alt={item.product_name} className="h-14 w-14 rounded-md object-cover" /> : null}
                  <div><p className="font-bold text-white">{item.product_name}</p><p className="text-sm text-slate-400">{item.variation_name || item.sku || item.internal_code}</p></div>
                </div>
                <p className="text-sm text-slate-300">{item.quantity} x {formatCurrency(item.final_unit_price)}</p>
              </div>
            ))}
          </div>
          {selected.store_order_logs?.length ? (
            <div className="mt-5 rounded-md border border-white/10 bg-white/5 p-4">
              <p className="font-black text-white">Historico</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                {selected.store_order_logs.map((log) => (
                  <p key={log.id}><span className="text-slate-500">{formatDate(log.created_at)}</span> - {log.message || log.action}</p>
                ))}
              </div>
            </div>
          ) : null}
          <p className="mt-5 text-right text-xl font-black text-nt-cyan">Total: {formatCurrency(selected.total_amount)}</p>
        </div>
      ) : null}
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
      <Alert>Pedidos atualmente são somente para retirada na loja. O endereço fica cadastrado para futuras entregas.</Alert>
      <Card>
        <h2 className="text-2xl font-black text-white">Endereços</h2>
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
      {active === "pedidos" ? <OrdersPanel path={path} /> : null}
      {active === "enderecos" ? <AddressesPanel /> : null}
      {active === "seguranca" ? <SecurityPanel /> : null}
      {active === "perfil" ? <ProfilePanel /> : null}
    </AccountShell>
  );
}
