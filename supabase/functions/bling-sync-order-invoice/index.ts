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

type InvoiceStatus = "pending" | "authorized" | "rejected" | "cancelled" | "error";
type InvoiceDocuments = { xmlPath?: string; pdfPath?: string };
type InvoiceDocumentFormat = "xml" | "pdf";
type InvoiceDocumentContent = { bytes: ArrayBuffer; contentType: "application/xml" | "application/pdf"; source: string };

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
    console.info("bling-sync-order-invoice invoice detail fetched", {
      orderId: order.id,
      stage: "fetch_invoice_detail",
      blingOrderId: order.bling_order_id,
      blingInvoiceId: cleanText(detail.id || invoiceIdFromOrder),
      rawStatus: invoiceStatusDiagnostic(detail),
    });
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
      if (isObject(detail) && matchesOrderReference(detail, order)) {
        console.info("bling-sync-order-invoice invoice detail fetched", {
          orderId: order.id,
          stage: "fetch_invoice_detail",
          blingOrderId: order.bling_order_id,
          blingInvoiceId: cleanText(detail.id || candidateId),
          rawStatus: invoiceStatusDiagnostic(detail),
        });
        return { invoice: detail, source: "nfe_list" };
      }
    }
  }

  for (const candidate of candidates.slice(0, 20)) {
    const candidateId = positiveInteger(isObject(candidate) ? candidate.id : null);
    if (!candidateId) continue;
    const detail = await loadBlingInvoiceDetail(context, candidateId);
    if (matchesOrderReference(detail, order)) {
      console.info("bling-sync-order-invoice invoice detail fetched", {
        orderId: order.id,
        stage: "fetch_invoice_detail",
        blingOrderId: order.bling_order_id,
        blingInvoiceId: cleanText(detail.id || candidateId),
        rawStatus: invoiceStatusDiagnostic(detail),
      });
      return { invoice: detail, source: "nfe_detail_scan" };
    }
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
  if (isObject(situacao)) {
    return cleanText(situacao.descricao || situacao.nome || situacao.label || situacao.status || situacao.situacao || situacao.valor || situacao.id || situacao.codigo);
  }
  return cleanText(situacao);
}

function invoiceStatusCode(invoice: JsonObject) {
  const situacao = invoice.situacao;
  if (isObject(situacao)) {
    return positiveInteger(situacao.id || situacao.codigo || situacao.code || situacao.valor || situacao.situacao);
  }
  return positiveInteger(situacao);
}

function invoiceStatusDiagnostic(invoice: JsonObject) {
  const situacao = invoice.situacao;
  if (isObject(situacao)) {
    return {
      type: "object",
      id: positiveInteger(situacao.id),
      codigo: positiveInteger(situacao.codigo),
      code: positiveInteger(situacao.code),
      valor: cleanText(situacao.valor),
      descricao: cleanText(situacao.descricao || situacao.nome || situacao.label || situacao.status || situacao.situacao),
    };
  }
  return {
    type: typeof situacao,
    value: cleanText(situacao),
  };
}

function mapInvoiceStatus(invoice: JsonObject): InvoiceStatus {
  const statusCode = invoiceStatusCode(invoice);
  if ([5, 6, 7].includes(statusCode || 0)) return "authorized";
  if (statusCode === 2) return "cancelled";
  if ([4, 9].includes(statusCode || 0)) return "rejected";
  if (statusCode === 11) return "error";

  const statusText = invoiceStatusText(invoice).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (statusText.includes("autoriz") || statusText.includes("emitid") || statusText.includes("registrad")) return "authorized";
  if (statusText.includes("cancel")) return "cancelled";
  if (statusText.includes("rejeit") || statusText.includes("deneg")) return "rejected";
  if (statusText.includes("erro") || statusText.includes("bloque")) return "error";
  return "pending";
}

function arrayBufferToText(bytes: ArrayBuffer) {
  return new TextDecoder().decode(bytes);
}

function bytesStartWith(bytes: ArrayBuffer, value: string) {
  const prefix = new TextEncoder().encode(value);
  const data = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, prefix.length));
  return prefix.every((byte, index) => data[index] === byte);
}

function xmlStartIndex(value: string) {
  const match = value.match(/<\?xml|<nfeProc|<NFe|<procEventoNFe/i);
  return match?.index ?? -1;
}

function looksLikeXmlText(value: string) {
  return xmlStartIndex(value.trim()) === 0;
}

function topLevelKeys(value: unknown) {
  return isObject(value) ? Object.keys(value).slice(0, 20) : [];
}

function safeBodyType(value: unknown) {
  if (Array.isArray(value)) return "array";
  if (isObject(value)) return "json";
  return typeof value;
}

function possibleBase64(value: string) {
  let compact = value.replace(/^data:[^,]+,/, "").replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (compact.length < 32 || !/^[A-Za-z0-9+/=]+$/.test(compact)) return "";
  const remainder = compact.length % 4;
  if (remainder === 1) return "";
  if (remainder > 0) compact = compact.padEnd(compact.length + (4 - remainder), "=");
  return compact;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function validateDocumentBytes(bytes: ArrayBuffer, format: InvoiceDocumentFormat) {
  if (format === "pdf") return bytesStartWith(bytes, "%PDF");
  return looksLikeXmlText(arrayBufferToText(bytes));
}

function documentContentFromBytes(bytes: ArrayBuffer, contentType: string, format: InvoiceDocumentFormat, source: string): InvoiceDocumentContent | null {
  const normalizedType = contentType.toLowerCase();
  if (format === "pdf" && (normalizedType.includes("application/pdf") || bytesStartWith(bytes, "%PDF"))) {
    return { bytes, contentType: "application/pdf", source };
  }
  if (format === "xml" && (normalizedType.includes("xml") || looksLikeXmlText(arrayBufferToText(bytes)))) {
    return { bytes, contentType: "application/xml", source };
  }
  return null;
}

function documentContentFromString(value: string, format: InvoiceDocumentFormat, source: string): InvoiceDocumentContent | null {
  const text = cleanText(value);
  if (format === "xml" && looksLikeXmlText(text)) {
    const bytes = new TextEncoder().encode(text);
    return { bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), contentType: "application/xml", source };
  }
  const xmlIndex = format === "xml" ? xmlStartIndex(text) : -1;
  if (xmlIndex > 0) return documentContentFromString(text.slice(xmlIndex), format, source);
  const encoded = possibleBase64(text);
  if (!encoded) return null;
  try {
    const bytes = decodeBase64(encoded);
    return validateDocumentBytes(bytes, format)
      ? { bytes, contentType: format === "xml" ? "application/xml" : "application/pdf", source }
      : null;
  } catch {
    return null;
  }
}

function stringLooksLikeUrl(value: string) {
  try {
    const url = new URL(cleanText(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function findDocumentUrl(value: unknown, format: InvoiceDocumentFormat, depth = 0): string {
  if (depth > 5) return "";
  if (typeof value === "string" && stringLooksLikeUrl(value)) return cleanText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDocumentUrl(item, format, depth + 1);
      if (found) return found;
    }
  }
  if (!isObject(value)) return "";

  const preferredKeys = format === "pdf"
    ? ["linkPDF", "linkPdf", "linkDanfe", "danfe", "pdf", "url", "link"]
    : ["xml", "linkXml", "linkXML", "url", "link"];
  for (const key of preferredKeys) {
    const found = findDocumentUrl(value[key], format, depth + 1);
    if (found) return found;
  }
  for (const key of Object.keys(value)) {
    const found = findDocumentUrl(value[key], format, depth + 1);
    if (found) return found;
  }
  return "";
}

function findDocumentContent(value: unknown, format: InvoiceDocumentFormat, depth = 0): InvoiceDocumentContent | null {
  if (depth > 5) return null;
  if (typeof value === "string") {
    if (stringLooksLikeUrl(value)) return null;
    return documentContentFromString(value, format, "json_payload");
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDocumentContent(item, format, depth + 1);
      if (found) return found;
    }
  }
  if (!isObject(value)) return null;

  const preferredKeys = format === "pdf"
    ? ["base64", "content", "conteudo", "arquivo", "documento", "pdf", "data"]
    : ["xml", "base64", "content", "conteudo", "arquivo", "documento", "data"];
  for (const key of preferredKeys) {
    const found = findDocumentContent(value[key], format, depth + 1);
    if (found) return found;
  }
  for (const key of Object.keys(value)) {
    const found = findDocumentContent(value[key], format, depth + 1);
    if (found) return found;
  }
  return null;
}

function documentLinksFromInvoice(invoice: JsonObject) {
  const xmlLink = stringLooksLikeUrl(cleanText(invoice.xml)) ? cleanText(invoice.xml) : "";
  const linkPDF = stringLooksLikeUrl(cleanText(invoice.linkPDF || invoice.linkPdf)) ? cleanText(invoice.linkPDF || invoice.linkPdf) : "";
  const linkDanfe = stringLooksLikeUrl(cleanText(invoice.linkDanfe || invoice.danfe)) ? cleanText(invoice.linkDanfe || invoice.danfe) : "";
  return { xmlLink, linkPDF, linkDanfe };
}

function logInvoiceDocumentLinkPresence(order: StoreOrder, invoice: JsonObject) {
  const links = documentLinksFromInvoice(invoice);
  console.info("bling-sync-order-invoice invoice document links", {
    orderId: order.id,
    stage: "invoice_document_links",
    blingOrderId: order.bling_order_id,
    blingInvoiceId: cleanText(invoice.id),
    hasXmlLink: Boolean(links.xmlLink),
    hasLinkDanfe: Boolean(links.linkDanfe),
    hasLinkPDF: Boolean(links.linkPDF),
  });
  return links;
}

function parseJsonPayload(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasKnownDocumentField(value: unknown, field: string): boolean {
  if (!isObject(value)) return false;
  return Object.prototype.hasOwnProperty.call(value, field);
}

function dataDiagnostics(payload: unknown, format: InvoiceDocumentFormat) {
  const data = isObject(payload) ? payload.data : undefined;
  const dataIsArray = Array.isArray(data);
  const dataIsObject = isObject(data);
  const dataString = typeof data === "string" ? data : "";
  const dataContent = findDocumentContent(data, format);
  const dataUrl = findDocumentUrl(data, format);
  return {
    dataType: dataIsArray ? "array" : typeof data,
    dataIsArray,
    dataKeys: dataIsObject ? Object.keys(data).slice(0, 20) : [],
    dataLength: dataString.length || 0,
    startsWithXml: dataString ? looksLikeXmlText(dataString) : false,
    containsXml: dataString ? xmlStartIndex(dataString) >= 0 : false,
    looksBase64: dataString ? Boolean(possibleBase64(dataString)) : false,
    hasUrl: Boolean(dataUrl),
    hasBase64OrContent: Boolean(dataContent),
    knownFields: {
      url: hasKnownDocumentField(data, "url"),
      link: hasKnownDocumentField(data, "link"),
      documento: hasKnownDocumentField(data, "documento"),
      conteudo: hasKnownDocumentField(data, "conteudo"),
      content: hasKnownDocumentField(data, "content"),
      xml: hasKnownDocumentField(data, "xml"),
      pdf: hasKnownDocumentField(data, "pdf"),
      arquivo: hasKnownDocumentField(data, "arquivo"),
      base64: hasKnownDocumentField(data, "base64"),
    },
  };
}

function isEmptyDocumentDataResponse(payload: unknown) {
  return isObject(payload) && Array.isArray(payload.data) && payload.data.length === 0;
}

function logDocumentResponseInspection(
  order: StoreOrder,
  invoice: JsonObject,
  format: InvoiceDocumentFormat,
  response: Response,
  bytes: ArrayBuffer,
  payload: unknown,
) {
  const payloadText = payload === null ? arrayBufferToText(bytes) : "";
  const bodyLooksJson = payload !== null;
  console.info("bling-sync-order-invoice inspect_invoice_document_response", {
    orderId: order.id,
    stage: "inspect_invoice_document_response",
    blingOrderId: order.bling_order_id,
    blingInvoiceId: cleanText(invoice.id),
    format,
    httpStatus: response.status,
    contentType: response.headers.get("content-type") || "",
    contentLength: response.headers.get("content-length") || "",
    redirected: response.redirected,
    endpoint: "/nfe/documento/{chaveAcesso}",
    bodyType: bodyLooksJson ? safeBodyType(payload) : "binary_or_text",
    topLevelKeys: topLevelKeys(payload),
    hasUrl: Boolean(findDocumentUrl(payload, format)),
    hasBase64: Boolean(findDocumentContent(payload, format)),
    data: dataDiagnostics(payload, format),
    bodyApproxBytes: bytes.byteLength || payloadText.length,
  });
}

async function fetchDocumentUrl(context: BlingAccessContext, url: string, format: InvoiceDocumentFormat) {
  const request = async () => {
    const parsed = new URL(url);
    const isBling = parsed.hostname.endsWith("bling.com.br");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: format === "xml" ? "application/xml, text/xml" : "application/pdf",
        ...(isBling ? { Authorization: `Bearer ${context.accessToken}`, "enable-jwt": "1" } : {}),
      },
    });
    const bytes = await response.arrayBuffer();
    if (!response.ok) throw new BlingHttpError(response.status, parseJsonPayload(arrayBufferToText(bytes)) || { message: "Falha ao baixar URL do documento." });
    const contentType = response.headers.get("content-type") || "";
    const directContent = documentContentFromBytes(bytes, contentType, format, "document_url");
    if (directContent) return directContent;

    const text = arrayBufferToText(bytes);
    const payload = parseJsonPayload(text);
    const content = findDocumentContent(payload ?? text, format);
    if (!content) throw new Error("invalid_document_url_response");
    return content;
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

async function fetchBlingDocument(
  context: BlingAccessContext,
  accessKey: string,
  format: InvoiceDocumentFormat,
  order: StoreOrder,
  invoice: JsonObject,
) {
  const path = `/nfe/documento/${encodeURIComponent(accessKey)}?formato=${format}`;
  const request = async () => {
    const response = await fetch(`${BLING_API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        Accept: format === "xml" ? "application/xml, text/xml" : "application/pdf",
        "enable-jwt": "1",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const bytes = await response.arrayBuffer();
    if (!response.ok) {
      const payload = parseJsonPayload(arrayBufferToText(bytes)) || { message: "Falha ao baixar documento da NF-e." };
      throw new BlingHttpError(response.status, payload);
    }

    const directContent = documentContentFromBytes(bytes, contentType, format, "bling_document_endpoint");
    if (directContent) {
      logDocumentResponseInspection(order, invoice, format, response, bytes, null);
      return directContent;
    }

    const text = arrayBufferToText(bytes);
    const payload = parseJsonPayload(text);
    logDocumentResponseInspection(order, invoice, format, response, bytes, payload);
    if (isEmptyDocumentDataResponse(payload)) throw new Error("document_not_available_from_endpoint");

    const embeddedContent = findDocumentContent(payload ?? text, format);
    if (embeddedContent) return embeddedContent;

    const documentUrl = findDocumentUrl(payload ?? text, format);
    if (documentUrl) return await fetchDocumentUrl(context, documentUrl, format);

    throw new Error("unsupported_document_response");
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

function sanitizeDocumentDownloadError(error: unknown) {
  if (error instanceof BlingHttpError) {
    return {
      status: error.status,
      temporary: error.temporary,
    };
  }
  return {
    message: error instanceof Error ? error.message : "document_download_failed",
  };
}

async function downloadAndStoreInvoiceDocuments(context: BlingAccessContext, order: StoreOrder, invoice: JsonObject) {
  const accessKey = invoiceAccessKey(invoice);
  if (!accessKey) throw new Error("bling_invoice_access_key_missing");

  const basePath = `${safeStorageSegment(order.order_number || order.id)}/bling-${safeStorageSegment(invoiceNumber(invoice) || invoice.id)}-${accessKey.slice(-8)}`;
  const xmlPath = `${basePath}.xml`;
  const pdfPath = `${basePath}.pdf`;
  const documents: InvoiceDocuments = {};
  const links = logInvoiceDocumentLinkPresence(order, invoice);

  console.info("bling-sync-order-invoice invoice document download started", {
    orderId: order.id,
    stage: "download_documents",
    blingOrderId: order.bling_order_id,
    blingInvoiceId: cleanText(invoice.id),
    formats: ["xml", "pdf"],
  });

  try {
    const xmlFromDetail = xmlBytesFromInvoice(invoice);
    if (xmlFromDetail) {
      await uploadInvoiceDocument(xmlPath, xmlFromDetail, "application/xml");
    } else if (links.xmlLink) {
      const xmlDocument = await fetchDocumentUrl(context, links.xmlLink, "xml");
      await uploadInvoiceDocument(xmlPath, xmlDocument.bytes, xmlDocument.contentType);
    } else {
      const xmlDocument = await fetchBlingDocument(context, accessKey, "xml", order, invoice);
      await uploadInvoiceDocument(xmlPath, xmlDocument.bytes, xmlDocument.contentType);
    }
    documents.xmlPath = xmlPath;
    console.info("bling-sync-order-invoice invoice document downloaded", {
      orderId: order.id,
      stage: "download_documents",
      blingOrderId: order.bling_order_id,
      blingInvoiceId: cleanText(invoice.id),
      format: "xml",
    });
  } catch (error) {
    console.warn("bling-sync-order-invoice invoice document download failed", {
      orderId: order.id,
      stage: "download_documents",
      blingOrderId: order.bling_order_id,
      blingInvoiceId: cleanText(invoice.id),
      format: "xml",
      error: sanitizeDocumentDownloadError(error),
    });
  }

  try {
    const pdfLink = links.linkPDF || links.linkDanfe;
    const pdfDocument = pdfLink
      ? await fetchDocumentUrl(context, pdfLink, "pdf")
      : await fetchBlingDocument(context, accessKey, "pdf", order, invoice);
    await uploadInvoiceDocument(pdfPath, pdfDocument.bytes, pdfDocument.contentType);
    documents.pdfPath = pdfPath;
    console.info("bling-sync-order-invoice invoice document downloaded", {
      orderId: order.id,
      stage: "download_documents",
      blingOrderId: order.bling_order_id,
      blingInvoiceId: cleanText(invoice.id),
      format: "pdf",
    });
  } catch (error) {
    console.warn("bling-sync-order-invoice invoice document download failed", {
      orderId: order.id,
      stage: "download_documents",
      blingOrderId: order.bling_order_id,
      blingInvoiceId: cleanText(invoice.id),
      format: "pdf",
      error: sanitizeDocumentDownloadError(error),
    });
  }

  console.info("bling-sync-order-invoice invoice documents persisted", {
    orderId: order.id,
    stage: "download_documents",
    blingOrderId: order.bling_order_id,
    blingInvoiceId: cleanText(invoice.id),
    documents: {
      xml: Boolean(documents.xmlPath),
      pdf: Boolean(documents.pdfPath),
    },
  });

  return documents;
}

async function upsertInvoice(
  order: StoreOrder,
  invoice: JsonObject,
  status: InvoiceStatus,
  documents?: InvoiceDocuments,
) {
  const accessKey = invoiceAccessKey(invoice) || null;
  const issuedAt = invoiceIssueDate(invoice);
  const storeFiscalStatus = status === "authorized" ? "issued" : status;
  const payload: JsonObject = {
    order_id: order.id,
    provider: "bling",
    bling_invoice_id: cleanText(invoice.id),
    provider_status: invoiceStatusText(invoice),
    status,
    invoice_number: invoiceNumber(invoice),
    invoice_series: invoiceSeries(invoice),
    access_key: accessKey,
    issued_at: issuedAt,
    authorized_at: status === "authorized" ? issuedAt || nowIso() : null,
    metadata: {
      provider: "bling",
      bling_invoice_id: cleanText(invoice.id),
      bling_status: invoiceStatusText(invoice),
      bling_status_code: invoiceStatusCode(invoice),
      mapped_status: status,
      last_synced_at: nowIso(),
    },
  };

  if (documents?.xmlPath) {
    payload.xml_storage_path = documents.xmlPath;
    payload.xml_original_name = `${safeStorageSegment(invoiceNumber(invoice)) || "nfe"}.xml`;
    payload.xml_mime_type = "application/xml";
  }

  if (documents?.pdfPath) {
    payload.pdf_storage_path = documents.pdfPath;
    payload.pdf_original_name = `${safeStorageSegment(invoiceNumber(invoice)) || "danfe"}.pdf`;
    payload.pdf_mime_type = "application/pdf";
  }

  const rows = await supabaseRest("/order_invoices?on_conflict=order_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });

  await supabaseRest(`/store_orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ fiscal_status: storeFiscalStatus }),
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

  console.info("bling-sync-order-invoice invoice persisted", {
    orderId: order.id,
    stage: "upsert_invoice",
    blingOrderId: order.bling_order_id,
    blingInvoiceId: payload.bling_invoice_id,
    rawStatusCode: invoiceStatusCode(invoice),
    mappedStatus: status,
    fiscalStatus: storeFiscalStatus,
    documentsSaved: Boolean(documents?.xmlPath || documents?.pdfPath),
  });

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
      rawStatus: invoiceStatusDiagnostic(invoice),
      invoiceStatus: status,
      mappedStatus: status,
      source,
    });

    console.info("bling-sync-order-invoice invoice status mapped", {
      orderId,
      stage: "map_invoice_status",
      blingOrderId: order.bling_order_id,
      blingInvoiceId: cleanText(invoice.id),
      rawStatusCode: invoiceStatusCode(invoice),
      invoiceStatus: status,
      mappedStatus: status,
      source,
    });

    currentStage = "upsert_invoice";
    let documents: InvoiceDocuments | null = null;
    let savedInvoice = await upsertInvoice(order, invoice, status);

    if (status === "authorized") {
      if (accessKey) {
        currentStage = "download_documents";
        documents = await downloadAndStoreInvoiceDocuments(context, order, invoice);
        if (documents.xmlPath || documents.pdfPath) {
          currentStage = "upsert_invoice_documents";
          savedInvoice = await upsertInvoice(order, invoice, status, documents);
        }
      } else {
        console.warn("bling-sync-order-invoice invoice document download failed", {
          orderId,
          stage: "download_documents",
          blingOrderId: order.bling_order_id,
          blingInvoiceId: cleanText(invoice.id),
          format: "all",
          error: { message: "bling_invoice_access_key_missing" },
        });
      }
    }

    return ok(request, {
      success: true,
      invoice: savedInvoice,
      bling_invoice_id: cleanText(invoice.id),
      invoice_status: status,
      documents_saved: Boolean(documents?.xmlPath || documents?.pdfPath),
      documents: {
        xml: Boolean(documents?.xmlPath),
        pdf: Boolean(documents?.pdfPath),
      },
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
