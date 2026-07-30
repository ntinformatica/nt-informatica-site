export function onlyDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

export function formatCpf(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidCpf(value = "") {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calcDigit = (size) => {
    let sum = 0;
    for (let index = 0; index < size; index += 1) {
      sum += Number(cpf[index]) * (size + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10]);
}

export function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function isValidBrazilianPhone(value = "") {
  const digits = onlyDigits(value);
  return digits.length >= 10 && digits.length <= 11;
}

export function passwordStrength(value = "") {
  const password = String(value || "");
  return {
    min: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isStrongPassword(value = "") {
  const rules = passwordStrength(value);
  return Object.values(rules).every(Boolean);
}

export function passwordHelpText(value = "") {
  const rules = passwordStrength(value);
  const missing = [];
  if (!rules.min) missing.push("mínimo 8 caracteres");
  if (!rules.upper) missing.push("letra maiúscula");
  if (!rules.lower) missing.push("letra minúscula");
  if (!rules.number) missing.push("número");
  if (!rules.special) missing.push("caractere especial");
  return missing.length ? `Inclua ${missing.join(", ")}.` : "Senha forte.";
}

export function normalizeProfilePayload(values) {
  return {
    full_name: String(values.fullName || values.full_name || "").trim(),
    cpf: onlyDigits(values.cpf),
    birth_date: values.birthDate || values.birth_date || null,
    phone: formatPhone(values.phone),
    phone_normalized: onlyDigits(values.phone),
    secondary_phone: values.secondaryPhone ? formatPhone(values.secondaryPhone) : "",
    secondary_phone_normalized: values.secondaryPhone ? onlyDigits(values.secondaryPhone) : "",
    avatar_url: String(values.avatarUrl || values.avatar_url || "").trim(),
  };
}

export function normalizeAddressPayload(values) {
  return {
    label: String(values.label || "Principal").trim() || "Principal",
    cep: onlyDigits(values.cep).slice(0, 8),
    street: String(values.street || "").trim(),
    number: String(values.number || "").trim(),
    complement: String(values.complement || "").trim(),
    neighborhood: String(values.neighborhood || "").trim(),
    city: String(values.city || "").trim(),
    state: String(values.state || "").trim().toUpperCase().slice(0, 2),
    country: String(values.country || "Brasil").trim() || "Brasil",
  };
}
