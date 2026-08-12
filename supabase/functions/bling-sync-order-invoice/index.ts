import {
  BLING_API_BASE_URL,
  BlingHttpError,
} from "../_shared/bling.ts";
import {
  accessTokenForBlingConnection,
  blingRequestWithTokenRefresh,
  loadActiveBlingConnection,
  type BlingAccessContext,
} from "../_shared/blingConnection.ts";
import { handleCors } from "../_shared/cors.ts";
import { fail, ok } from "../_shared/responses.ts";
import { getSingle, supabaseRest } from "../_shared/supabaseAdmin.ts";

type JsonObject = Record<string, unknown>;

type SupabaseAuthUser = {
  id?: string;
  email?: string;
};

type StoreOrder = {
  id: string;
  order_number: string;
  bling_order_id?: string | null;
  fiscal_status?: string | null;
  order_invoices?: JsonObject[];
};

const INVOICE_BUCKET = "store-invoices";
const NFE_LOOKUP_LIMIT = 100;

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
}

function supabaseUrl() {
  return env("SUPABASE_URL").replace(/\/+$/, "");
}

function serviceRoleKey() {
  return env("SUPABASE_SERVICE_ROLE_KEY");
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function positiveInteger(value: unknown) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function nowIso() {
  return new Date().toISOString();
}

function safeStorageSegment(value: unknown) {
  return cleanText(value).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "arquivo";
}

function storageObjectUrl(path: string) {
  return `${supabaseUrl()}/storage/v1/object/${INVOICE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getUserFromJwt(token: string) {
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey(),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = await parseResponse(response);
  if (!response.ok) return null;
  return payload as SupabaseAuthUser;
}

async function isAdminUser(userId: string) {
  const adminUser = await getSingle(
    `/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
  );
  return Boolean(adminUser);
}

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text) return {};
  const payload = JSON.parse(text);
  return isObject(payload) ? payload : {};
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value));
}

async function loadOrder(orderId: string) {
  const select = "id,order_number,bling_order_id,fiscal_status,order_invoices(*)";
  return await getSingle(
    `/store_orders?id=eq.${encodeURIComponent(orderId)}&select=${encodeURIComponent(select)}&limit=1`,
  ) as StoreOrder | null;
}

function rowsFromBlingResponse(response: unknown) {
  if (isObject(response) && Array.isArray(response.data)) return response.data;
  if (isObject(response) && isObject(response.data)) return [response.data];
  return [];
}

function dataFromBlingResponse(response: unknown) {
  return isObject(response) && isObject(response.data) ? response.data : response;
}

function extractInvoiceId(value: unknown): number | null {
  if (!isObject(value)) return null;
  const direct = positiveInteger(value.idNotaFiscal || value.idNfe || value.idNFe);
  if (direct) return direct;
  for (const key of ["notaFiscal", "nfe", "nota"]) {
    const nested = value[key];
    if (isObject(nested)) {
      const id = positiveInteger(nested.id || nested.idNotaFiscal || nested.idNfe || nested.idNFe);
      if (id) return id;
    }
  }
  return null;
}

function matchesOrderReference(invoice: unknown, order: StoreOrder) {
  if (!isObject(invoice)) return false;
  const expectedOrderNumber = cleanText(order.order_number).toLowerCase();
  const expectedBlingOrderId = cleanText(order.bling_order_id);
  const references = [
    invoice.numeroPedidoLoja,
    invoice.numeroLoja,
    invoice.numeroPedidoVenda,
    isObject(invoice.pedidoVenda) ? invoice.pedidoVenda.numeroLoja : "",
    isObject(invoice.pedido) ? invoice.pedido.numeroLoja : "",
    isObject(invoice.origem) ? invoice.origem.numero : "",
  ].map((value) => cleanText(value).toLowerCase());

  if (expectedOrderNumber && references.includes(expectedOrderNumber)) return true;

  const ids = [
    isObject(invoice.pedidoVenda) ? invoice.pedidoVenda.id : "",
    isObject(invoice.pedido) ? invoice.pedido.id : "",
    isObject(invoice.origem) ? invoice.origem.id : "",
    isObject(invoice.venda) ? invoice.venda.id : "",
  ].map(cleanText);

  return Boolean(expectedBlingOrderId && ids.includes(expectedBlingOrderId));
}

async function loadBlingInvoiceDetail(context: BlingAccessContext, invoiceId: number) {
  const response = await blingRequestWithTokenRefresh(context, `/nfe/${encodeURIComponent(String(invoiceId))}`, { method: "GET" });
  const invoice = dataFromBlingResponse(response);
  if (!isObject(invoice)) throw new Error("bling_invoice_invalid_response");
  return invoice;
}

async function findBlingInvoiceForOrder(context: BlingAccessContext, order: StoreOrder) {
  if (!order.bling_order_id) throw new Error("bling_order_missing");

  const remoteOrderResponse = await blingRequestWithTokenRefresh(
    context,
    `/pedidos/vendas/${encodeURIComponent(cleanText(order.bling_order_id))}`,
    { method: "GET" },
  );
  const remoteOrder = dataFromBlingResponse(remoteOrderResponse);
  const invoiceIdFromOrder = extractInvoiceId(remoteOrder);
  if (invoiceIdFromOrder) {
    const detail = await loadBlingInvoiceDetail(context, invoiceIdFromOrder);
    return { invoice: detail, source: "order_detail" };
  }

  const query = new URLSearchParams();
  query.set("pagina", "1");
  query.set("limite", String(NFE_LOOKUP_LIMIT));
  query.set("numeroPedidoLoja", order.order_number);
  const listResponse = await blingRequestWithTokenRefresh(context, `/nfe?${query.toString()}`, { method: "GET" });
  const candidates = rowsFromBlingResponse(listResponse);

  for (const candidate of candidates) {
    if (matchesOrderReference(candidate, order)) {
      const candidateId = positiveInteger(isObject(candidate) ? candidate.id : null);
      const detail = candidateId ? await loadBlingInvoiceDetail(context, candidateId) : candidate;
      if (matchesOrderReference(detail, order)) return { invoice: detail, source: "nfe_list" };
    }
  }

  for (const candidate of candidates.slice(0, 20)) {
    const candidateId = positiveInteger(isObject(candidate) ? candidate.id : null);
    if (!candidateId) continue;
    const detail = await loadBlingInvoiceDetail(context, candidateId);
    if (matchesOrderReference(detail, order)) return { invoice: detail, source: "nfe_detail_scan" };
  }

  throw new Error("bling_invoice_not_found");
}

function invoiceAccessKey(invoice: JsonObject) {
  return cleanDigits(invoice.chaveAcesso || invoice.chave || invoice.accessKey);
}

function invoiceNumber(invoice: JsonObject) {
  return cleanText(invoice.numero || invoice.numeroNota || invoice.nfeNumero);
}

function invoiceSeries(invoice: JsonObject) {
  return cleanText(invoice.serie || invoice.numeroSerie || "1");
}

function invoiceIssueDate(invoice: JsonObject) {
  const value = cleanText(invoice.dataEmissao || invoice.dataOperacao || invoice.emissao);
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function invoiceStatusText(invoice: JsonObject) {
  const situacao = invoice.situacao;
  if (isObject(situacao)) return cleanText(situacao.descricao || situacao.nome || situacao.situacao || situacao.valor);
  return cleanText(situacao);
}

function mapInvoiceStatus(invoice: JsonObject) {
  const statusText = invoiceStatusText(invoice).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (statusText.includes("autoriz") || statusText.includes("emitid")) return "issued";
  if (statusText.includes("cancel")) return "cancelled";
  if (statusText.includes("rejeit") || statusText.includes("erro")) return "error";
  return "pending";
}

async function fetchBlingDocument(
  context: BlingAccessContext,
  accessKey: string,
  format: "xml" | "pdf",
) {
  const path = `/nfe/documento/${encodeURIComponent(accessKey)}?formato=${format}`;
  const request = async () => {
    const response = await fetch(`${BLING_API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        Accept: format === "xml" ? "application/xml,text/xml,application/json" : "application/pdf,application/json",
        "enable-jwt": "1",
      },
    });
    const contentType = response.headers.get("content-type") || (format === "xml" ? "application/xml" : "application/pdf");
    if (!response.ok) {
      const payload = await parseResponse(response);
      throw new BlingHttpError(response.status, payload);
    }
    return { bytes: await response.arrayBuffer(), contentType };
  };

  try {
    return await request();
  } catch (error) {
    if (error instanceof BlingHttpError && error.status === 401 && context.connection.refresh_token_encrypted) {
      context.accessToken = await accessTokenForBlingConnection(context.connection, true);
      return await request();
    }
    throw error;
  }
}

function xmlBytesFromInvoice(invoice: JsonObject) {
  const xml = cleanText(invoice.xml);
  return xml.startsWith("<") ? new TextEncoder().encode(xml).buffer : null;
}

async function uploadInvoiceDocument(path: string, bytes: ArrayBuffer, contentType: string) {
  const response = await fetch(storageObjectUrl(path), {
    method: "POST",
    headers: {
      apikey: serviceRoleKey(),
      Authorization: `Bearer ${serviceRoleKey()}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload));
  }
}

async function downloadAndStoreInvoiceDocuments(context: BlingAccessContext, order: StoreOrder, invoice: JsonObject) {
  const accessKey = invoiceAccessKey(invoice);
  if (!accessKey) throw new Error("bling_invoice_access_key_missing");

  const basePath = `${safeStorageSegment(order.order_number || order.id)}/bling-${safeStorageSegment(invoiceNumber(invoice) || invoice.id)}-${accessKey.slice(-8)}`;
  const xmlPath = `${basePath}.xml`;
  const pdfPath = `${basePath}.pdf`;

  const xmlFromDetail = xmlBytesFromInvoice(invoice);
  if (xmlFromDetail) {
    await uploadInvoiceDocument(xmlPath, xmlFromDetail, "application/xml");
  } else {
    const xmlDocument = await fetchBlingDocument(context, accessKey, "xml");
    await uploadInvoiceDocument(xmlPath, xmlDocument.bytes, xmlDocument.contentType || "application/xml");
  }

  const pdfDocument = await fetchBlingDocument(context, accessKey, "pdf");
  await uploadInvoiceDocument(pdfPath, pdfDocument.bytes, pdfDocument.contentType || "application/pdf");

  return { xmlPath, pdfPath };
}

async function upsertInvoice(order: StoreOrder, invoice: JsonObject, documents: { xmlPath: string; pdfPath: string } | null) {
  const status = mapInvoiceStatus(invoice);
  const accessKey = invoiceAccessKey(invoice) || null;
  const issuedAt = invoiceIssueDate(invoice);
  const payload = {
    order_id: order.id,
    provider: "bling",
    bling_invoice_id: cleanText(invoice.id),
    provider_status: invoiceStatusText(invoice),
    status,
    invoice_number: invoiceNumber(invoice),
    invoice_series: invoiceSeries(invoice),
    access_key: accessKey,
    issued_at: issuedAt,
    authorized_at: status === "issued" ? issuedAt || nowIso() : null,
    xml_storage_path: documents?.xmlPath || "",
    pdf_storage_path: documents?.pdfPath || "",
    xml_original_name: documents?.xmlPath ? `${safeStorageSegment(invoiceNumber(invoice)) || "nfe"}.xml` : "",
    pdf_original_name: documents?.pdfPath ? `${safeStorageSegment(invoiceNumber(invoice)) || "danfe"}.pdf` : "",
    xml_mime_type: documents?.xmlPath ? "application/xml" : "",
    pdf_mime_type: documents?.pdfPath ? "application/pdf" : "",
    metadata: {
      provider: "bling",
      bling_invoice_id: cleanText(invoice.id),
      bling_status: invoiceStatusText(invoice),
      last_synced_at: nowIso(),
    },
  };

  const rows = await supabaseRest("/order_invoices?on_conflict=order_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });

  await supabaseRest(`/store_orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ fiscal_status: status }),
  });

  await supabaseRest("/store_order_logs", {
    method: "POST",
    body: JSON.stringify({
      order_id: order.id,
      event_type: "invoice_synced_from_bling",
      message: `NF-e ${payload.invoice_number || payload.bling_invoice_id} sincronizada do Bling.`,
      actor_type: "admin",
      source: "bling",
      metadata: {
        bling_invoice_id: payload.bling_invoice_id,
        invoice_status: payload.status,
        access_key_masked: accessKey ? `${accessKey.slice(0, 4)}***${accessKey.slice(-4)}` : "",
      },
    }),
  }).catch(() => null);

  return Array.isArray(rows) ? rows[0] || null : rows;
}

function sanitizeBlingError(error: BlingHttpError) {
  return {
    status: error.status,
    temporary: error.temporary,
  };
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  let orderId = "";
  let currentStage = "idle";

  try {
    if (request.method !== "POST") return fail(request, "Metodo nao permitido.", 405);

    const token = bearerToken(request);
    if (!token) return fail(request, "Nao autenticado.", 401);

    const user = await getUserFromJwt(token);
    if (!user?.id) return fail(request, "Nao autenticado.", 401);

    const admin = await isAdminUser(user.id);
    if (!admin) return fail(request, "Acesso restrito a administradores.", 403);

    const body = await readJsonBody(request);
    orderId = cleanText(body.order_id);
    if (!isUuid(orderId)) return fail(request, "Pedido invalido.", 400, { code: "invalid_order_id" });

    const order = await loadOrder(orderId);
    if (!order) return fail(request, "Pedido nao encontrado.", 404, { code: "order_not_found" });
    if (!cleanText(order.bling_order_id)) {
      return fail(request, "Pedido ainda nao esta vinculado ao Bling.", 422, { code: "bling_order_missing" });
    }

    const connection = await loadActiveBlingConnection();
    const accessToken = await accessTokenForBlingConnection(connection);
    const context = { connection, accessToken };

    currentStage = "find_invoice";
    const { invoice, source } = await findBlingInvoiceForOrder(context, order);
    const status = mapInvoiceStatus(invoice);
    const accessKey = invoiceAccessKey(invoice);

    console.info("bling-sync-order-invoice invoice located", {
      orderId,
      stage: currentStage,
      blingOrderId: order.bling_order_id,
      blingInvoiceId: cleanText(invoice.id),
      invoiceStatus: status,
      source,
    });

    let documents: { xmlPath: string; pdfPath: string } | null = null;
    if (status === "issued") {
      if (!accessKey) return fail(request, "NF-e autorizada sem chave de acesso retornada pelo Bling.", 422, { code: "bling_invoice_access_key_missing" });
      currentStage = "download_documents";
      documents = await downloadAndStoreInvoiceDocuments(context, order, invoice);
    }

    currentStage = "upsert_invoice";
    const savedInvoice = await upsertInvoice(order, invoice, documents);

    return ok(request, {
      success: true,
      invoice: savedInvoice,
      bling_invoice_id: cleanText(invoice.id),
      invoice_status: status,
      documents_saved: Boolean(documents),
    });
  } catch (error) {
    if (error instanceof BlingHttpError) {
      console.error("bling-sync-order-invoice BlingHttpError", {
        orderId,
        stage: currentStage,
        blingError: sanitizeBlingError(error),
      });
      return fail(request, "Nao foi possivel consultar a NF-e no Bling.", error.temporary ? 503 : error.status, {
        code: "bling_api_error",
        stage: currentStage,
        status: error.status,
      });
    }

    const message = error instanceof Error ? error.message : "Erro interno ao sincronizar NF-e.";
    console.error("bling-sync-order-invoice", { orderId, stage: currentStage, message });

    if (message === "bling_not_connected") return fail(request, "Bling nao conectado.", 409, { code: message });
    if (message === "bling_not_active") return fail(request, "Conexao Bling nao esta ativa.", 409, { code: message });
    if (message === "bling_access_token_missing") return fail(request, "Access token do Bling ausente.", 409, { code: message });
    if (message === "bling_refresh_token_missing") return fail(request, "Refresh token do Bling ausente.", 409, { code: message });
    if (message === "bling_invoice_not_found") return fail(request, "Nenhuma NF-e do Bling foi localizada para este pedido.", 404, { code: message });
    if (message === "bling_invoice_invalid_response") return fail(request, "Resposta da NF-e no Bling esta invalida.", 502, { code: message });
    if (message === "bling_invoice_access_key_missing") return fail(request, "NF-e autorizada sem chave de acesso retornada pelo Bling.", 422, { code: message });

    return fail(request, "Erro interno ao sincronizar NF-e.", 500);
  }
});
