import { supabaseRequest } from "../lib/supabase";
import { normalizeAddressPayload, normalizeProfilePayload } from "./customerValidation";

function firstRow(rows) {
  return Array.isArray(rows) ? rows[0] || null : rows;
}

export async function getCustomerProfile(userId) {
  if (!userId) return null;
  const rows = await supabaseRequest(`/customer_profiles?id=eq.${encodeURIComponent(userId)}&limit=1`);
  return firstRow(rows);
}

export async function upsertCustomerProfile(userId, values) {
  const payload = {
    id: userId,
    ...normalizeProfilePayload(values),
  };

  const rows = await supabaseRequest("/customer_profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });
  return firstRow(rows);
}

export async function markCustomerLastLogin(userId) {
  if (!userId) return null;
  return supabaseRequest(`/customer_profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_login_at: new Date().toISOString() }),
  }).catch(() => null);
}

export async function listCustomerAddresses(userId) {
  if (!userId) return [];
  return supabaseRequest(`/customer_addresses?user_id=eq.${encodeURIComponent(userId)}&order=is_default.desc,created_at.asc`);
}

export async function saveCustomerAddress(userId, values) {
  const payload = {
    user_id: userId,
    ...normalizeAddressPayload(values),
    is_default: Boolean(values.isDefault || values.is_default),
  };

  if (values.id) {
    const rows = await supabaseRequest(`/customer_addresses?id=eq.${encodeURIComponent(values.id)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return firstRow(rows);
  }

  const rows = await supabaseRequest("/customer_addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return firstRow(rows);
}

export async function deleteCustomerAddress(userId, addressId) {
  if (!userId || !addressId) return null;
  return supabaseRequest(`/customer_addresses?id=eq.${encodeURIComponent(addressId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function listCustomerOrders(email) {
  if (!email) return [];
  return supabaseRequest(
    `/store_orders?customer_email=eq.${encodeURIComponent(email)}`
    + "&select=id,order_number,created_at,total_amount,payment_method,financial_status,operational_status,pickup_status&order=created_at.desc",
  ).catch((error) => {
    console.warn("Nao foi possivel carregar pedidos do cliente:", error);
    return [];
  });
}

export async function getCustomerOrderDetails(email, orderId) {
  if (!email || !orderId) return null;
  const orderRows = await supabaseRequest(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}&customer_email=eq.${encodeURIComponent(email)}`
    + "&select=*,store_order_items(*)&limit=1",
  );
  const order = firstRow(orderRows);
  if (!order) return null;

  const payments = await supabaseRequest(
    `/store_payments?order_id=eq.${encodeURIComponent(order.id)}`
    + "&select=id,payment_method,payment_type,status,status_detail,amount,installments,installment_amount,qr_code,qr_code_base64,ticket_url,expires_at,approved_at,paid_at,created_at,updated_at"
    + "&order=created_at.desc",
  );

  let logs = [];
  let logsUnavailable = false;
  try {
    logs = await supabaseRequest(
      `/store_order_logs?order_id=eq.${encodeURIComponent(order.id)}`
      + "&select=id,event_type,message,created_at,actor_type,source"
      + "&order=created_at.asc",
    );
  } catch (error) {
    logsUnavailable = true;
    console.warn("Historico do pedido indisponivel para o cliente:", {
      orderId: order.id,
      message: error?.message || "",
    });
  }

  return {
    ...order,
    store_payments: Array.isArray(payments) ? payments : [],
    store_order_logs: Array.isArray(logs) ? logs : [],
    logsUnavailable,
  };
}
