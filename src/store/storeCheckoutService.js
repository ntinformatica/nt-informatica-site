import { supabaseFunction, supabaseRequest } from "../lib/supabase";
import { checkoutItemErrors, checkoutItems } from "../cart/cartStorage";
import { isValidCpf, onlyDigits } from "../customer/customerValidation";

export const pickupInfo = {
  title: "Retirada na loja",
  address: "Rua Johann Sachse, 2891, Sala 1",
  district: "Badenfurt, Blumenau - SC",
  hours: ["Segunda a sexta: 08:00 às 19:00", "Sábado: 08:00 às 13:00", "Domingo: fechado"],
};

export function customerPayload(user, profile) {
  return {
    customer_name: profile?.full_name || user?.user_metadata?.full_name || user?.email || "",
    customer_phone: profile?.phone || "",
    customer_phone_normalized: profile?.phone_normalized || onlyDigits(profile?.phone || ""),
    customer_email: user?.email || "",
    customer_document: onlyDigits(profile?.cpf || ""),
  };
}

export function billingAddressPayload(address) {
  return {
    postal_code: onlyDigits(address?.cep || address?.postal_code || ""),
    street: String(address?.street || "").trim(),
    number: String(address?.number || "").trim(),
    complement: String(address?.complement || "").trim(),
    district: String(address?.neighborhood || address?.district || "").trim(),
    city: String(address?.city || "").trim(),
    state: String(address?.state || "").trim().toUpperCase().slice(0, 2),
    country: String(address?.country || "Brasil").trim() || "Brasil",
  };
}

export function missingBillingAddressFields(address) {
  const payload = billingAddressPayload(address);
  const missing = [];
  if (payload.postal_code.length !== 8) missing.push("CEP");
  if (!payload.street) missing.push("logradouro");
  if (!payload.number) missing.push("numero");
  if (!payload.district) missing.push("bairro");
  if (!payload.city) missing.push("cidade");
  if (!/^[A-Z]{2}$/.test(payload.state)) missing.push("estado");
  return missing;
}

export function missingCheckoutProfileFields(user, profile) {
  const missing = [];
  const cpf = onlyDigits(profile?.cpf || "");
  const metadata = user?.user_metadata || {};
  const termsAccepted = Boolean(profile?.terms_accepted_at || metadata.terms_accepted || metadata.acceptTerms || metadata.termsAccepted);
  const privacyAccepted = Boolean(profile?.privacy_accepted_at || metadata.privacy_accepted || metadata.acceptPrivacy || metadata.privacyAccepted);
  if (!profile?.full_name) missing.push("nome completo");
  if (!isValidCpf(cpf)) missing.push("CPF");
  if (!profile?.phone_normalized && !profile?.phone) missing.push("telefone");
  if (!user?.email) missing.push("e-mail");
  if (!termsAccepted) missing.push("aceite dos termos");
  if (!privacyAccepted) missing.push("aceite da politica de privacidade");
  return missing;
}

export function createCheckoutAttemptKey(items, paymentMethod) {
  const raw = JSON.stringify({
    items: checkoutItems(items),
    paymentMethod,
    day: new Date().toISOString().slice(0, 10),
  });
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  return `store-checkout-${paymentMethod}-${Date.now()}-${Math.abs(hash)}`;
}

export async function createStoreCheckout({ user, profile, billingAddress, items, paymentMethod, installments = 1, card = null, idempotencyKey }) {
  const itemErrors = checkoutItemErrors(items);
  if (itemErrors.length) {
    throw new Error(`Nao foi possivel finalizar: ${itemErrors.join("; ")}.`);
  }

  try {
    return await supabaseFunction("store-create-checkout", {
      method: "POST",
      body: JSON.stringify({
        customer: customerPayload(user, profile),
        billing_address: billingAddressPayload(billingAddress),
        items: checkoutItems(items),
        payment_method: paymentMethod,
        installments: paymentMethod === "pix" ? 1 : installments,
        idempotency_key: idempotencyKey,
        ...(paymentMethod === "card" ? { card } : {}),
      }),
    });
  } catch (error) {
    console.error("Erro ao criar checkout da loja:", {
      message: error?.message || "",
      status: error?.status || null,
      paymentStatus: error?.details?.status || null,
      statusDetail: error?.details?.status_detail || null,
      hasOrder: Boolean(error?.details?.order),
      hasPayment: Boolean(error?.details?.payment),
    });
    throw error;
  }
}

export async function getOrderPaymentStatus(orderId) {
  const rows = await supabaseRequest(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}`
    + "&select=*,store_order_items(*),store_payments(id,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,qr_code,qr_code_base64,ticket_url,expires_at,created_at,updated_at)&limit=1",
  );
  return Array.isArray(rows) ? rows[0] || null : rows;
}
