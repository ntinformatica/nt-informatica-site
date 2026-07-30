import { CreditCard, Minus, PackageCheck, Plus, QrCode, ShoppingCart, Trash2 } from "lucide-react";
import { Component, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Section } from "../components/Section";
import { useCustomerAuth } from "../customer/CustomerAuthContext";
import { Alert } from "../customer/CustomerAuthPages";
import { onlyDigits } from "../customer/customerValidation";
import { useCart } from "./CartContext";
import { cartTotals, itemKey } from "./cartStorage";
import { createCheckoutAttemptKey, createStoreCheckout, getOrderPaymentStatus, missingCheckoutProfileFields, pickupInfo } from "../store/storeCheckoutService";

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function nested(input, path) {
  return path.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), input);
}

function cardInstallments(cardData) {
  return Number(cardData?.installments || nested(cardData, ["payment_method", "installments"]) || 1);
}

function brickPayloadSummary(cardData) {
  return {
    hasToken: Boolean(cardData?.token || cardData?.cardToken || nested(cardData, ["payment_method", "token"])),
    paymentMethodId: cardData?.payment_method_id || cardData?.paymentMethodId || nested(cardData, ["payment_method", "id"]) || "",
    hasIssuer: Boolean(cardData?.issuer_id || cardData?.issuerId || nested(cardData, ["issuer", "id"])),
    installments: cardInstallments(cardData),
  };
}

class EcommerceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Erro na área pública do e-commerce:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Section eyebrow="E-commerce" title="Não foi possível carregar esta etapa." description="Recarregue a página para tentar novamente. Se continuar acontecendo, fale com a NT Informática.">
        <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan">Recarregar página</button>
      </Section>
    );
  }
}

function PageShell({ children, onNavigate, getNavHref }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header onNavigate={onNavigate} getNavHref={getNavHref} />
      <main className="pt-20"><EcommerceErrorBoundary>{children}</EcommerceErrorBoundary></main>
      <Footer />
    </div>
  );
}

function PickupNotice() {
  return (
    <Alert>
      Todos os pedidos são exclusivamente para retirada na loja da NT Informática, Celulares e Games. Retirada em {pickupInfo.address}, {pickupInfo.district}. {pickupInfo.hours.join(" | ")}
    </Alert>
  );
}

function CartSummary({ totals, action, loading }) {
  return (
    <Card className="h-fit">
      <h2 className="text-xl font-black text-white">Resumo</h2>
      <div className="mt-5 grid gap-3 text-sm">
        <div className="flex justify-between text-slate-300"><span>Subtotal cartão</span><strong className="text-white">{formatCurrency(totals.subtotal)}</strong></div>
        <div className="flex justify-between text-slate-300"><span>Desconto estimado no Pix</span><strong className="text-lime-200">-{formatCurrency(totals.pixDiscount)}</strong></div>
        <div className="border-t border-white/10 pt-3">
          <div className="flex justify-between text-base"><span className="font-bold text-white">Total no Pix</span><strong className="text-nt-cyan">{formatCurrency(totals.pixTotal)}</strong></div>
          <p className="mt-1 text-xs text-slate-400">O valor final é recalculado pelo backend ao finalizar.</p>
        </div>
      </div>
      {action ? <div className="mt-6">{action}</div> : null}
      {loading ? <p className="mt-3 text-sm text-slate-400">Processando...</p> : null}
    </Card>
  );
}

export function CartPage({ onNavigate, getNavHref, navigateTo }) {
  const cart = useCart();
  const totals = cart.totals;

  function checkout() {
    if (!cart.items.length) return;
    navigateTo("/checkout");
  }

  return (
    <PageShell onNavigate={onNavigate} getNavHref={getNavHref}>
      <Section eyebrow="Carrinho" title="Seu carrinho NT" description="Revise produtos, quantidades e siga para pagamento seguro.">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4">
            <PickupNotice />
            {cart.lastAction ? <Alert type="success">{cart.lastAction}</Alert> : null}
            {!cart.items.length ? (
              <Card className="text-center">
                <ShoppingCart className="mx-auto text-nt-cyan" size={42} />
                <h2 className="mt-4 text-2xl font-black text-white">Carrinho vazio</h2>
                <p className="mt-2 text-sm text-slate-300">Escolha produtos ou PCs montados para iniciar sua compra.</p>
                <Button href="/produtos" className="mt-6">Continuar comprando</Button>
              </Card>
            ) : cart.items.map((item) => {
              const key = itemKey(item);
              return (
                <Card key={key} className="p-4">
                  <div className="grid gap-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                    <div className="h-24 overflow-hidden rounded-md border border-white/10 bg-slate-950">
                      {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div>
                      <p className="text-lg font-black text-white">{item.name}</p>
                      {item.variationName ? <p className="mt-1 text-sm text-nt-cyan">{item.variationName}</p> : null}
                      <p className="mt-2 text-sm text-slate-300">Unitário: {formatCurrency(item.unitPrice)}</p>
                      <p className="text-sm text-slate-400">Subtotal: {formatCurrency(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label="Diminuir quantidade" onClick={() => cart.updateQuantity(key, Number(item.quantity || 1) - 1)} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 hover:bg-white/10"><Minus size={16} /></button>
                      <input aria-label="Quantidade" value={item.quantity} onChange={(event) => cart.updateQuantity(key, event.target.value)} className="h-10 w-16 rounded-md border border-slate-700 bg-slate-950 text-center font-bold text-white" />
                      <button type="button" aria-label="Aumentar quantidade" onClick={() => cart.updateQuantity(key, Number(item.quantity || 1) + 1)} className="grid h-10 w-10 place-items-center rounded-md border border-white/10 hover:bg-white/10"><Plus size={16} /></button>
                      <button type="button" aria-label="Remover item" onClick={() => cart.removeItem(key)} className="grid h-10 w-10 place-items-center rounded-md border border-red-300/30 text-red-100 hover:bg-red-400/10"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
            {cart.items.length ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button href="/produtos" variant="secondary">Continuar comprando</Button>
                <button type="button" onClick={cart.clearCart} className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-300/30 px-5 py-3 text-sm font-bold text-red-100 transition hover:bg-red-400/10">Limpar carrinho</button>
              </div>
            ) : null}
          </div>
          <CartSummary totals={totals} action={<button type="button" onClick={checkout} disabled={!cart.items.length} className="w-full rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan disabled:opacity-60">Finalizar compra</button>} />
        </div>
      </Section>
    </PageShell>
  );
}

function useMercadoPagoBrick({ enabled, amount, onSubmit }) {
  const controllerRef = useRef(null);
  const submitRef = useRef(onSubmit);
  const [status, setStatus] = useState("");

  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    let mounted = true;
    async function loadScript(src) {
      const absoluteSrc = new URL(src, window.location.href).href;
      if ([...document.scripts].some((script) => script.src === absoluteSrc || script.getAttribute("src") === src)) return;
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    async function boot() {
      if (!enabled) {
        setStatus("");
        return;
      }
      setStatus("Carregando formulário seguro...");
      try {
        await loadScript("https://sdk.mercadopago.com/js/v2");
        await loadScript("/arena/mercado-pago-config.js");
        const publicKey = window.NT_ARENA_MERCADO_PAGO_CONFIG?.publicKey || "";
        if (!window.MercadoPago || !publicKey) throw new Error("Public Key do Mercado Pago não configurada.");
        if (controllerRef.current) await controllerRef.current.unmount();
        const mp = new window.MercadoPago(publicKey);
        const bricks = mp.bricks();
        controllerRef.current = await bricks.create("cardPayment", "storeCardPaymentBrick", {
          initialization: { amount },
          customization: { paymentMethods: { types: { excluded: ["debit_card", "prepaid_card"] } } },
          callbacks: {
            onReady: () => {
              console.info("Card Payment Brick pronto para o checkout.");
              if (mounted) setStatus("");
            },
            onSubmit: async (cardData) => {
              console.info("Card Payment Brick onSubmit executado.", brickPayloadSummary(cardData));
              try {
                return await submitRef.current?.(cardData);
              } catch (error) {
                console.error("Falha no submit do Card Payment Brick:", error);
                if (mounted) setStatus(error?.message || "Não foi possível enviar o pagamento com cartão.");
                throw error;
              }
            },
            onError: (error) => {
              console.error("Erro no Card Payment Brick do e-commerce.", error);
              if (mounted) setStatus("Não foi possível carregar o formulário do cartão.");
            },
          },
        });
        if (mounted) setStatus("");
      } catch (error) {
        console.error(error);
        if (mounted) setStatus(error.message || "Falha ao carregar cartão.");
      }
    }

    boot();
    return () => {
      mounted = false;
      if (controllerRef.current) {
        controllerRef.current.unmount?.();
        controllerRef.current = null;
      }
    };
  }, [enabled, amount]);

  return status;
}

export function CheckoutPage({ onNavigate, getNavHref, navigateTo }) {
  const cart = useCart();
  const auth = useCustomerAuth();
  const refreshedProfileRef = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [attemptKey, setAttemptKey] = useState("");
  const missing = missingCheckoutProfileFields(auth.user, auth.profile);
  const totals = cartTotals(cart.items);

  useEffect(() => {
    console.info("Checkout perfil carregado.", {
      authenticated: auth.authenticated,
      profileLoaded: Boolean(auth.profile),
      cpfDigits: onlyDigits(auth.profile?.cpf || "").length,
      missingFields: missing,
    });
  }, [auth.authenticated, auth.profile, missing.join("|")]);

  useEffect(() => {
    if (!auth.loading && !auth.authenticated) {
      sessionStorage.setItem("nt-post-login-redirect", "/checkout");
      navigateTo("/login");
    }
  }, [auth.loading, auth.authenticated]);

  useEffect(() => {
    if (!auth.authenticated || refreshedProfileRef.current) return;
    refreshedProfileRef.current = true;
    auth.refreshProfile().then((profile) => {
      console.info("Perfil atualizado ao abrir checkout.", {
        profileLoaded: Boolean(profile),
        cpfDigits: onlyDigits(profile?.cpf || "").length,
        missingFields: missingCheckoutProfileFields(auth.user, profile),
      });
    }).catch((refreshError) => {
      console.warn("Nao foi possivel atualizar o perfil antes do checkout:", refreshError);
    });
  }, [auth.authenticated, auth.user]);

  useEffect(() => {
    if (!cart.items.length) navigateTo("/carrinho");
  }, [cart.items.length]);

  const finishCheckout = useCallback(async (cardData = null) => {
    if (processing) return;
    const isPix = paymentMethod === "pix";
    if (isPix) console.info("Clique em Gerar Pix recebido.");
    setProcessing(true);
    setError("");
    console.info("Inicio da validacao do checkout.", {
      paymentMethod,
      currentMissingFields: missing,
    });
    let currentProfile = auth.profile;
    try {
      currentProfile = await auth.refreshProfile();
    } catch (refreshError) {
      console.warn("Nao foi possivel recarregar o perfil no checkout:", refreshError);
    }
    const currentMissing = missingCheckoutProfileFields(auth.user, currentProfile);
    console.info("Resultado da validacao do perfil no checkout.", {
      paymentMethod,
      cpfDigits: onlyDigits(currentProfile?.cpf || "").length,
      missingFields: currentMissing,
    });
    if (currentMissing.length) {
      setError(`Complete seu perfil antes de finalizar: ${currentMissing.join(", ")}.`);
      setProcessing(false);
      return;
    }
    const key = attemptKey || createCheckoutAttemptKey(cart.items, paymentMethod);
    setAttemptKey(key);
    try {
      console.info("Inicio do checkout.", {
        paymentMethod,
        itemCount: cart.items.length,
        hasPendingProfileFields: Boolean(missing.length),
      });
      const result = await createStoreCheckout({
        user: auth.user,
        profile: currentProfile,
        items: cart.items,
        paymentMethod,
        installments: cardInstallments(cardData),
        card: cardData || null,
        idempotencyKey: key,
      });
      const orderId = result?.data?.order?.id || result?.order?.id;
      console.info("Resposta da Edge Function store-create-checkout.", {
        ok: result?.ok !== false,
        hasOrderId: Boolean(orderId),
        paymentMethod,
      });
      if (!orderId) throw new Error("Pedido criado, mas o identificador nao foi retornado.");
      navigateTo(`/pedido/${orderId}/pagamento`);
    } catch (checkoutError) {
      console.error("Falha ao finalizar checkout:", checkoutError);
      setError(checkoutError.message || "Não foi possível finalizar a compra.");
    } finally {
      setProcessing(false);
    }
  }, [processing, missing, cart, paymentMethod, attemptKey, auth.user, auth.profile, auth.refreshProfile, navigateTo]);

  const brickStatus = useMercadoPagoBrick({
    enabled: paymentMethod === "card" && auth.authenticated && Boolean(cart.items.length),
    amount: totals.cardTotal,
    onSubmit: (cardData) => finishCheckout(cardData),
  });

  return (
    <PageShell onNavigate={onNavigate} getNavHref={getNavHref}>
      <Section eyebrow="Checkout" title="Finalizar compra" description="Pedido com retirada na loja e pagamento seguro pelo Mercado Pago.">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-5">
            <PickupNotice />
            {error ? <Alert type="error">{error}</Alert> : null}
            <Card>
              <h2 className="text-xl font-black text-white">Dados do cliente</h2>
              <p className="mt-3 text-sm text-slate-300">{auth.profile?.full_name} | {auth.user?.email} | {auth.profile?.phone}</p>
              {missing.length ? (
                <div className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
                  <p className="text-sm font-bold text-amber-100">Dados pendentes: {missing.join(", ")}.</p>
                  <a href="/minha-conta/perfil" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-amber-200/40 px-4 py-2 text-sm font-black text-amber-50 transition hover:bg-amber-200/10">Completar perfil</a>
                </div>
              ) : null}
            </Card>
            <Card><h2 className="text-xl font-black text-white">Produtos</h2><div className="mt-4 grid gap-3">{cart.items.map((item) => <div key={itemKey(item)} className="flex justify-between gap-4 rounded-md border border-white/10 bg-white/5 p-3 text-sm"><span>{item.quantity}x {item.name} {item.variationName ? `- ${item.variationName}` : ""}</span><strong>{formatCurrency(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</strong></div>)}</div></Card>
            <Card><h2 className="text-xl font-black text-white">Forma de retirada</h2><p className="mt-3 text-sm leading-6 text-slate-300">{pickupInfo.title}: {pickupInfo.address}, {pickupInfo.district}. Aguarde a confirmação de que o pedido está pronto e apresente documento, se solicitado.</p><p className="mt-3 text-sm text-slate-400">Seu endereço está cadastrado para futuras opções de entrega. Este pedido será retirado na loja.</p></Card>
            <Card>
              <h2 className="text-xl font-black text-white">Forma de pagamento</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setPaymentMethod("pix")} className={`rounded-md border px-4 py-4 text-left transition ${paymentMethod === "pix" ? "border-lime-300/50 bg-lime-300/10 text-lime-100" : "border-white/10 bg-white/5 text-slate-200"}`}><QrCode className="mb-2" />Pix com 15% OFF</button>
                <button type="button" onClick={() => setPaymentMethod("card")} className={`rounded-md border px-4 py-4 text-left transition ${paymentMethod === "card" ? "border-nt-cyan/50 bg-nt-cyan/10 text-nt-cyan" : "border-white/10 bg-white/5 text-slate-200"}`}><CreditCard className="mb-2" />Cartão em até 10x</button>
              </div>
              {paymentMethod === "pix" ? <button type="button" disabled={processing} onClick={() => finishCheckout()} className="mt-5 w-full rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan disabled:cursor-wait disabled:opacity-60">{processing ? "Gerando Pix..." : "Gerar Pix"}</button> : null}
              {paymentMethod === "card" ? <div className="mt-5"><p className="mb-3 text-sm text-slate-300">As opções de parcelamento serão exibidas conforme o cartão. Apenas crédito.</p>{brickStatus ? <p className="mb-3 text-sm text-amber-100">{brickStatus}</p> : null}<div id="storeCardPaymentBrick" className="rounded-lg bg-white p-3 text-slate-950" /></div> : null}
            </Card>
          </div>
          <CartSummary totals={totals} loading={processing} />
        </div>
      </Section>
    </PageShell>
  );
}

export function OrderPaymentPage({ orderId, onNavigate, getNavHref }) {
  const cart = useCart();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer = 0;
    async function load() {
      try {
        const data = await getOrderPaymentStatus(orderId);
        if (!mounted) return;
        setOrder(data);
        const payment = data?.store_payments?.[0];
        const resolvedStatus = payment?.status || data?.financial_status || "";
        if (["approved"].includes(data?.financial_status) || ["approved"].includes(payment?.status)) cart.clearCart();
        if (["approved", "paid", "cancelled", "expired", "failed", "rejected", "refunded", "charged_back"].includes(resolvedStatus)) {
          window.clearInterval(timer);
        }
      } catch (loadError) {
        if (mounted) setError(loadError.message || "Erro ao consultar pedido.");
      }
    }
    load();
    timer = window.setInterval(load, 8000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [orderId]);

  const payment = order?.store_payments?.[0];
  const status = payment?.status || order?.financial_status || "pending";
  const pixCode = payment?.qr_code || "";

  async function copyPix() {
    await navigator.clipboard?.writeText(pixCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <PageShell onNavigate={onNavigate} getNavHref={getNavHref}>
      <Section eyebrow="Pagamento" title={order ? `Pedido ${order.order_number}` : "Carregando pedido..."} description="Acompanhe o status do pagamento e a preparação para retirada.">
        {error ? <Alert type="error">{error}</Alert> : null}
        {!order ? <Card>Consultando pedido...</Card> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card>
              <div className="flex items-center gap-3"><PackageCheck className="text-nt-cyan" /><h2 className="text-2xl font-black text-white">{status === "approved" ? "Pagamento aprovado" : status === "expired" ? "Pagamento expirado" : status === "rejected" ? "Pagamento recusado" : "Aguardando pagamento"}</h2></div>
              <p className="mt-3 text-sm leading-6 text-slate-300">Status financeiro: {status}. Quando aprovado, aguarde a preparação do pedido para retirada na loja.</p>
              {payment?.payment_method === "pix" && pixCode && status !== "approved" ? (
                <div className="mt-6 grid gap-4">
                  {payment.qr_code_base64 ? <img src={`data:image/png;base64,${payment.qr_code_base64}`} alt="QR Code Pix" className="mx-auto w-full max-w-xs rounded-lg bg-white p-3" /> : null}
                  <textarea readOnly value={pixCode} className="min-h-28 rounded-md border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200" />
                  <button type="button" onClick={copyPix} className="rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow hover:bg-nt-cyan">{copied ? "Código copiado" : "Copiar código Pix"}</button>
                </div>
              ) : null}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button href="/minha-conta/pedidos">Ver meus pedidos</Button>
                <Button href="/produtos" variant="secondary">Continuar comprando</Button>
              </div>
            </Card>
            <Card>
              <h3 className="text-xl font-black text-white">Resumo</h3>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">{(order.store_order_items || []).map((item) => <div key={item.id} className="flex justify-between gap-3"><span>{item.quantity}x {item.product_name}</span><strong className="text-white">{formatCurrency(item.subtotal_amount)}</strong></div>)}</div>
              <p className="mt-5 border-t border-white/10 pt-4 text-right text-2xl font-black text-nt-cyan">{formatCurrency(order.total_amount)}</p>
            </Card>
          </div>
        )}
      </Section>
    </PageShell>
  );
}
