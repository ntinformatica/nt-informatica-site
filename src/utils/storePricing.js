export const PIX_DISCOUNT_PERCENTAGE = 15;
export const PIX_DISCOUNT_RATE = PIX_DISCOUNT_PERCENTAGE / 100;
export const STORE_INSTALLMENT_COUNT = 10;

export function parseStoreMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim().replace(/[R$\s]/g, "");
  if (!raw) return null;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot !== -1) {
    const [integerPart, decimalPart = ""] = raw.split(".");
    normalized = decimalPart.length === 3 && integerPart.length <= 3
      ? raw.replace(/\./g, "")
      : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundStoreMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function formatStoreMoneyInput(value) {
  const parsed = parseStoreMoney(value);
  if (parsed === null) return "";
  return roundStoreMoney(parsed).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function calculatePixPriceFromNormal(normalPrice) {
  const parsed = parseStoreMoney(normalPrice);
  if (parsed === null || parsed <= 0) return null;
  return roundStoreMoney(parsed * (1 - PIX_DISCOUNT_RATE));
}

export function calculatePricingFromPix(pixPrice) {
  const parsed = parseStoreMoney(pixPrice);
  if (parsed === null || parsed <= 0) return null;

  const pixCents = Math.round(parsed * 100);
  const normalCents = Math.round(pixCents / (1 - PIX_DISCOUNT_RATE));
  const discountCents = normalCents - pixCents;

  return {
    pixPrice: pixCents / 100,
    normalPrice: normalCents / 100,
    discountValue: discountCents / 100,
    installmentValue: roundStoreMoney((normalCents / 100) / STORE_INSTALLMENT_COUNT),
  };
}

export function pricingValidationMessage(pixPrice, label = "Preço no Pix") {
  const parsed = parseStoreMoney(pixPrice);
  if (parsed === null) return `${label} é obrigatório.`;
  if (parsed <= 0) return `${label} deve ser maior que zero.`;
  return "";
}
