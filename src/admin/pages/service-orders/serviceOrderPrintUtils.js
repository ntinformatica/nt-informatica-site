import { parseServiceOrderMoney, serviceOrderStatusTones } from "../../services/serviceOrdersService";

export const serviceOrderCompany = {
  name: "NT Informática, Celulares e Games",
  addressLines: ["Rua Johann Sachse, 2891, Sala 1", "Badenfurt", "Blumenau - SC"],
  whatsapp: "(47) 99930-9344",
  email: "ntinformaticacomercial@gmail.com",
  cnpj: "57.659.145/0001-16",
  hours: ["Segunda a sexta-feira: 08:00 às 19:00", "Sábado: 08:00 às 13:00"],
};

export const accessoryLabels = {
  charger: "Carregador",
  power_supply: "Fonte",
  power_cable: "Cabo de energia",
  usb_cable: "Cabo USB",
  case: "Capa",
  screen_protector: "Película",
  sim_card: "Chip",
  memory_card: "Cartão de memória",
  removable_battery: "Bateria removível",
  controller: "Controle",
  other: "Outros",
};

export const conditionLabels = {
  powers_on: "Liga normalmente",
  does_not_power_on: "Não liga",
  turns_on_and_off: "Liga e desliga",
  no_image: "Sem imagem",
  broken_screen: "Tela quebrada",
  touch_not_working: "Touch não funciona",
  scratched_cover: "Tampa riscada",
  broken_housing: "Carcaça quebrada",
  damaged_buttons: "Botões danificados",
  oxidation_signs: "Sinais de oxidação",
  wet_device: "Equipamento molhado",
  broken_seals: "Lacres violados",
  previously_opened: "Equipamento já aberto",
  missing_parts: "Peças faltando",
  other: "Outros",
};

export const requestedServiceLabels = {
  diagnostic: "Diagnóstico",
  repair: "Reparo",
  screen_replacement: "Troca de tela",
  battery_replacement: "Troca de bateria",
  connector_replacement: "Troca de conector",
  formatting: "Formatação",
  preventive_cleaning: "Limpeza preventiva",
  data_recovery: "Recuperação de dados",
  upgrade: "Upgrade",
  board_repair: "Reparo em placa",
  quote: "Orçamento",
  other: "Outros",
};

export const authorizationLabels = {
  diagnostic: ["Diagnóstico", "Autorizado", "Não autorizado"],
  device_opening: ["Abertura do equipamento", "Autorizada", "Não autorizada"],
  testing: ["Testes", "Autorizados", "Não autorizados"],
  formatting_if_needed: ["Formatação, se necessária", "Autorizada", "Não autorizada"],
  whatsapp_contact: ["Contato por WhatsApp", "Autorizado", "Não autorizado"],
  data_loss_risk: ["Risco de perda de dados", "Ciente", "Não confirmado"],
  budget_may_change: ["Possibilidade de alteração do orçamento", "Ciente", "Não confirmado"],
};

export const serviceOrderTerms = [
  "O cliente declara que as informações fornecidas sobre o equipamento, acessórios e defeitos são verdadeiras.",
  "A análise técnica poderá exigir a abertura e desmontagem parcial ou completa do equipamento.",
  "O orçamento inicial poderá ser alterado após o diagnóstico técnico, especialmente quando forem identificados defeitos adicionais ou necessidade de substituição de peças.",
  "Nenhum serviço adicional será executado sem autorização do cliente, salvo quando previamente autorizado nesta Ordem de Serviço.",
  "A assistência não se responsabiliza por dados, arquivos, aplicativos, senhas ou configurações armazenadas no equipamento. Sempre que possível, o cliente deverá realizar cópia de segurança antes da entrega.",
  "Equipamentos com sinais de oxidação, contato com líquido, danos severos, componentes alterados, reparos anteriores ou lacres violados poderão apresentar falhas adicionais durante a análise ou reparo.",
  "Em serviços que envolvam placa, processador, memória, soldagem, retrabalho, recuperação de dados ou equipamentos que já não ligam, existe risco técnico de agravamento do defeito ou perda definitiva de funcionamento.",
  "O prazo informado é uma estimativa e poderá sofrer alteração por complexidade do serviço, necessidade de testes ou indisponibilidade de peças.",
  "A garantia cobre exclusivamente o serviço executado e as peças substituídas pela assistência. Não cobre quedas, impactos, líquidos, oxidação, mau uso, violação, intervenção de terceiros, problemas diferentes do serviço realizado ou danos decorrentes de acessórios externos.",
  "Equipamentos não retirados após a conclusão do serviço poderão permanecer armazenados conforme as regras internas da empresa. Não há cobrança automática ou prazo de abandono definido nesta Ordem de Serviço.",
  "Ao assinar esta Ordem de Serviço, o cliente declara que leu, compreendeu e concorda com as informações e autorizações registradas.",
];

export function emptyText(value, fallback = "Não informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function formatOsNumber(order) {
  return order?.osNumber ? `OS ${order.osNumber}` : "OS sem número";
}

export function formatDate(value) {
  if (!value) return "Não informado";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}

export function formatTime(value) {
  if (!value) return "Não informado";
  return String(value).slice(0, 5);
}

export function formatDateTime(value) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatMoney(value, fallback = "A definir após diagnóstico") {
  const parsed = parseServiceOrderMoney(value);
  if (parsed === null) return fallback;
  return parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return emptyText(value);
}

export function formatDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  if (digits.length === 14) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  return emptyText(value, "-");
}

export function statusTone(status) {
  return serviceOrderStatusTones[status] || "slate";
}

export function checkedItems(value, labels) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { items: [], unknown: Boolean(value) };
  }

  const items = Object.entries(labels)
    .filter(([key]) => value[key] === true)
    .map(([key, label]) => {
      if (key === "other" && value.other_description) return `${label}: ${value.other_description}`;
      return label;
    });

  return { items, unknown: false };
}

export function authorizationItems(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { items: [], unknown: Boolean(value) };
  }

  return {
    unknown: false,
    items: Object.entries(authorizationLabels).map(([key, [label, yes, no]]) => ({
      label,
      result: value[key] ? yes : no,
      checked: Boolean(value[key]),
    })),
  };
}

export function parseUnlockPattern(value) {
  const text = String(value || "").trim();
  if (!text) return { text: "", points: [], valid: false };

  const points = text
    .split(/[^1-9]+/)
    .map((item) => Number(item))
    .filter((item) => item >= 1 && item <= 9);

  const uniqueEnough = points.length >= 2 && points.every((point, index) => points.indexOf(point) === index);
  return { text, points, valid: uniqueEnough };
}
