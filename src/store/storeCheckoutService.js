import { supabaseFunction, supabaseRequest } from "../lib/supabase";
import { checkoutItems } from "../cart/cartStorage";
import { onlyDigits } from "../customer/customerValidation";

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

export function missingCheckoutProfileFields(user, profile) {
  const missing = [];
  if (!profile?.full_name) missing.push("nome completo");
  if (!profile?.cpf) missing.push("CPF");
  if (!profile?.phone_normalized && !profile?.phone) missing.push("telefone");
  if (!user?.email) missing.push("e-mail");
  if (!profile?.terms_accepted_at) missing.push("aceite dos termos");
  if (!profile?.privacy_accepted_at) missing.push("aceite da política de privacidade");
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

export async function createStoreCheckout({ user, profile, items, paymentMethod, installments = 1, card = null, idempotencyKey }) {
  return supabaseFunction("store-create-checkout", {
    method: "POST",
    body: JSON.stringify({
      customer: customerPayload(user, profile),
      items: checkoutItems(items),
      payment_method: paymentMethod,
      installments: paymentMethod === "pix" ? 1 : installments,
      idempotency_key: idempotencyKey,
      ...(paymentMethod === "card" ? { card } : {}),
    }),
  });
}

export async function getOrderPaymentStatus(orderId) {
  const rows = await supabaseRequest(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}`
    + "&select=*,store_order_items(*),store_payments(id,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,qr_code,qr_code_base64,ticket_url,expires_at,created_at,updated_at)&limit=1",
  );
  return Array.isArray(rows) ? rows[0] || null : rows;
}
