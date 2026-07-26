import { parseServiceOrderMoney, serviceOrderStatusTones } from "../../services/serviceOrdersService";

export const serviceOrderCompany = {
  name: "NT Informática, Celulares e Games",
  subtitle: "Celulares, Games e Assistência Técnica",
  addressLines: ["Rua Johann Sachse, 2891, Sala 1", "Badenfurt", "Blumenau - SC"],
  whatsapp: "(47) 99930-9344",
  email: "ntinformaticacomercial@gmail.com",
  cnpj: "57.659.145/0001-16",
  hours: ["Segunda a sexta-feira: 08:00 às 19:00", "Sábado: 08:00 às 13:00"],
};

export const accessoryLabels = {
  power_supply: "Fonte",
  charger: "Carregador",
  usb_cable: "Cabo USB",
  hdmi_cable: "Cabo HDMI",
  controller: "Controle",
  mouse: "Mouse",
  keyboard: "Teclado",
  case: "Bolsa ou case",
  screen_protector: "Película",
  memory_card: "Cartão SD",
  sim_card: "Chip",
  removable_battery: "Bateria removível",
  power_cable: "Cabo de energia",
  other: "Outro",
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
  oxidation_signs: "Oxidação",
  wet_device: "Equipamento molhado",
  broken_seals: "Lacres violados",
  previously_opened: "Já aberto por terceiros",
  missing_parts: "Peças faltando",
  other: "Outro",
};

export const requestedServiceLabels = {
  diagnostic: "Diagnóstico",
  repair: "Reparo",
  screen_replacement: "Troca de tela",
  battery_replacement: "Troca de bateria",
  board_repair: "Reparo de placa",
  formatting: "Formatação",
  preventive_cleaning: "Limpeza",
  upgrade: "Upgrade",
  data_recovery: "Recuperação de dados",
  connector_replacement: "Troca de conector",
  quote: "Orçamento",
  other: "Outro",
};

export const authorizationLabels = {
  diagnostic: "Autorizo somente análise técnica.",
  device_opening: "Autorizo abertura e desmontagem do equipamento.",
  whatsapp_contact: "Autorizo contato via WhatsApp.",
  quote: "Desejo receber orçamento antes de qualquer reparo.",
  image_use: "Autorizo uso de imagens e vídeos do equipamento.",
  testing: "Autorizo testes técnicos no equipamento.",
  formatting_if_needed: "Autorizo formatação, se necessária.",
  data_loss_risk: "Estou ciente do risco de perda de dados.",
  budget_may_change: "Estou ciente de que o orçamento pode mudar após diagnóstico.",
};

export const responsibilityTerms = [
  {
    title: "1. Autorização para análise",
    paragraphs: [
      "O cliente autoriza a abertura, desmontagem parcial ou total e a realização dos procedimentos técnicos necessários para análise, diagnóstico e testes do equipamento.",
    ],
  },
  {
    title: "2. Aprovação de orçamento",
    paragraphs: [
      "Nenhum reparo adicional será realizado sem autorização prévia do cliente, salvo quando houver autorização expressa registrada nesta Ordem de Serviço.",
    ],
  },
  {
    title: "3. Responsabilidade sobre dados",
    paragraphs: [
      "A NT Informática recomenda que o cliente mantenha cópia de segurança de arquivos, documentos, fotos, vídeos, aplicativos, contas, senhas, sistemas e demais dados armazenados no equipamento.",
      "Procedimentos técnicos, falhas do equipamento, problemas no armazenamento, formatação, restauração ou substituição de componentes podem resultar em perda de dados.",
      "A assistência não garante a preservação ou recuperação de dados, especialmente quando o equipamento ou o dispositivo de armazenamento já apresenta falhas.",
    ],
  },
  {
    title: "4. Equipamentos com líquido ou oxidação",
    paragraphs: [
      "Equipamentos com sinais de contato com líquidos, umidade ou oxidação podem apresentar novos defeitos durante ou após a análise ou o reparo, em razão de danos já existentes nos componentes eletrônicos.",
    ],
  },
  {
    title: "5. Defeitos ocultos e reparos anteriores",
    paragraphs: [
      "Durante a desmontagem e os testes poderão ser identificados defeitos não aparentes no momento da entrada.",
      "Equipamentos já abertos, violados, modificados ou reparados por terceiros também podem apresentar danos adicionais, peças faltantes, componentes incompatíveis ou falhas provocadas por intervenções anteriores.",
      "Caso sejam identificados novos problemas, o cliente será informado antes da continuidade do serviço, quando aplicável.",
    ],
  },
  {
    title: "6. Riscos técnicos",
    paragraphs: [
      "Serviços que envolvem placa eletrônica, processador, memória, soldagem, retrabalho, recuperação de dados ou equipamentos que já não ligam possuem riscos técnicos.",
      "Dependendo do estado do equipamento, poderá ocorrer agravamento da falha ou perda definitiva do funcionamento, mesmo quando os procedimentos forem realizados de forma técnica.",
    ],
  },
  {
    title: "7. Garantia",
    paragraphs: [
      "A NT Informática, Celulares e Games concede garantia legal de 90 dias sobre o serviço executado e sobre as peças substituídas pela assistência, contados a partir da conclusão ou entrega do serviço, conforme aplicável.",
      "A garantia cobre exclusivamente o defeito relacionado ao serviço executado ou à peça substituída.",
      "A garantia não cobre quedas, impactos, trincas, mau uso, contato com líquidos, umidade, oxidação, surtos elétricos, violação ou abertura do equipamento, reparos realizados por terceiros, danos provocados por acessórios inadequados, novos defeitos, defeitos diferentes do serviço executado ou danos físicos ocorridos após a entrega.",
      "O equipamento deverá ser apresentado para avaliação da garantia. A existência da garantia não significa substituição ou devolução automática; o equipamento deverá passar por análise técnica para confirmação da relação entre o defeito apresentado e o serviço executado.",
    ],
  },
  {
    title: "8. Garantia em troca de telas",
    paragraphs: [
      "Nos serviços de troca de tela, a NT Informática poderá fornecer película de proteção como brinde.",
      "A película auxilia na proteção contra riscos e pequenos impactos, mas não torna a tela resistente a quedas, pressão, torção ou danos físicos.",
      "A garantia da tela cobre defeitos de fabricação ou falhas relacionadas à instalação.",
      "Não são cobertos: tela trincada, vidro quebrado, manchas causadas por impacto, display danificado, vazamento de cristal, riscos profundos, marcas de pressão, danos decorrentes de queda, contato com líquido ou mau uso.",
      "A análise da garantia deverá considerar a existência ou não de dano físico e a relação do defeito com o serviço executado.",
    ],
  },
  {
    title: "9. Prazos",
    paragraphs: [
      "Os prazos informados são estimados e poderão sofrer alterações em razão da complexidade do serviço, necessidade de testes adicionais, disponibilidade de peças ou surgimento de defeitos não identificados inicialmente.",
    ],
  },
  {
    title: "10. Peças e orçamentos",
    paragraphs: [
      "Valores e disponibilidade de peças poderão sofrer alteração até a aprovação definitiva do orçamento.",
      "Nenhuma peça adicional será instalada sem a autorização do cliente.",
      "Peças substituídas poderão ser descartadas após a conclusão do serviço, salvo quando o cliente solicitar previamente sua devolução e não existir impedimento técnico, sanitário, ambiental ou de garantia.",
    ],
  },
  {
    title: "11. Retirada do equipamento",
    paragraphs: [
      "Após a comunicação de conclusão, cancelamento ou impossibilidade de reparo, o cliente deverá providenciar a retirada do equipamento.",
      "Qualquer medida referente a equipamentos não retirados deverá respeitar a legislação aplicável e as políticas internas previamente comunicadas ao cliente.",
    ],
  },
  {
    title: "12. Comunicação",
    paragraphs: [
      "O cliente autoriza contato por telefone, WhatsApp ou e-mail para envio de orçamento, solicitação de autorização, atualização do atendimento, comunicação de conclusão e informações relacionadas ao equipamento.",
    ],
  },
  {
    title: "13. Uso de imagens e vídeos",
    paragraphs: [
      "A utilização de imagens e vídeos do equipamento para divulgação institucional, redes sociais ou produção de conteúdo somente será permitida quando o cliente marcar expressamente essa autorização na Ordem de Serviço.",
      "A NT Informática deverá preservar dados pessoais, notificações, fotos, arquivos, conversas, contas, documentos e demais conteúdos particulares do cliente.",
      "A autorização poderá ser recusada sem impedir a prestação do serviço.",
    ],
  },
  {
    title: "14. Declaração",
    paragraphs: [
      "O cliente declara que as informações fornecidas são verdadeiras, conferiu os acessórios entregues, foi informado sobre as condições aparentes do equipamento, leu e compreendeu os termos desta Ordem de Serviço, recebeu oportunidade para esclarecer dúvidas e concorda com as autorizações expressamente marcadas.",
    ],
  },
];

export function emptyText(value, fallback = "Não informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function formatOsNumber(order) {
  return order?.osNumber ? `OS Nº ${order.osNumber}` : "OS sem número";
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

function normalizeLegacyItem(key, labels, value) {
  if (key === "other" && value?.other_description) return `${labels[key]}: ${value.other_description}`;
  return labels[key] || key;
}

export function checkedItems(value, labels) {
  if (value === null || value === undefined || value === "") return { items: [], unknown: false };
  if (Array.isArray(value)) {
    return { items: value.map((item) => String(item).trim()).filter(Boolean), unknown: false };
  }
  if (typeof value === "string") return { items: [], unknown: true };
  if (typeof value !== "object") return { items: [], unknown: true };

  const items = Object.entries(labels)
    .filter(([key]) => value[key] === true)
    .map(([key]) => normalizeLegacyItem(key, labels, value));

  return { items, unknown: false };
}

export function authorizationItems(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const unknown = Boolean(value) && (typeof value !== "object" || Array.isArray(value));

  return {
    unknown,
    items: Object.entries(authorizationLabels).map(([key, label]) => ({
      key,
      label,
      checked: Boolean(source[key]),
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
