export async function readJson(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON invalido.");
  }
}

export function isUuid(value: unknown) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function cleanText(value: unknown) {
  return String(value || "").trim();
}

export function requireUuid(value: unknown, field: string) {
  if (!isUuid(value)) throw new Error(`${field} invalido.`);
  return String(value);
}

export function safeMoney(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}
