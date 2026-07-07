import {
  Cpu,
  Camera,
  CirclePlay,
  Gamepad2,
  HardDrive,
  Headphones,
  Keyboard,
  Monitor,
  Mouse,
  Play,
  Printer,
  ShieldCheck,
  Smartphone,
  Star,
  Tv,
  Wrench,
} from "lucide-react";

// EDITE AQUI: número do WhatsApp com DDI e DDD, somente números.
export const whatsappNumber = "5547999309344";

// EDITE AQUI: links definitivos das redes sociais.
export const socialLinks = {
  instagram: "https://instagram.com/",
  youtubeInfo: "https://youtube.com/",
  youtubeGaming: "https://youtube.com/",
  tiktok: "https://tiktok.com/",
};

// EDITE AQUI: link do sistema de agendamento da Arena Gamer.
export const arenaBookingUrl = "arena/index.html?v=20260706-1030";

export const navLinks = [
  ["Início", "inicio"],
  ["Arena Gamer", "arena"],
  ["Serviços", "servicos"],
  ["Produtos", "produtos"],
  ["PCs à venda", "pcs"],
  ["Conteúdo", "conteudo"],
  ["Contato", "contato"],
];

export const highlights = [
  { title: "Assistência Técnica", icon: Wrench, text: "Celulares, notebooks, PCs e videogames com diagnóstico especializado." },
  { title: "Arena Gamer", icon: Gamepad2, text: "PCs Gamer e PlayStation 5 para jogar por hora ou agendamento." },
  { title: "PCs Gamers", icon: Cpu, text: "Montagens equilibradas para estudo, trabalho, streaming e jogos." },
  { title: "Acessórios", icon: Headphones, text: "Periféricos, cabos, carregadores e itens gamer para pronta entrega." },
  { title: "Videogames", icon: Tv, text: "Manutenção preventiva, limpeza e suporte para consoles modernos." },
  { title: "Personalizados", icon: Printer, text: "Canecas personalizadas, pecas sob medida e impressoes 3D para presentes e projetos." },
];

// EDITE AQUI: planos da Arena Gamer.
export const arenaPlans = [
  { name: "1 hora de jogo", price: "R$ 20,00", detail: "Ideal para partidas rápidas e testes de setup." },
  { name: "Pacote 3 horas", price: "R$ 50,00", detail: "Mais tempo para jogar com amigos e montar squad." },
  { name: "Mensal / fidelidade", price: "A partir de R$ 150,00", detail: "10 horas mensais para jogar na Arena Gamer, com agendamento antecipado." },
];

export const arenaFeatures = [
  "PCs Gamer disponíveis",
  "PlayStation 5",
  "Jogos populares",
  "Agendamento por horário",
  "Ambiente para jogar com amigos",
  "Eventos e campeonatos",
];

export const arenaRules = [
  "Respeitar os horários agendados",
  "Cuidar dos equipamentos",
  "Não consumir alimentos próximos aos PCs",
  "Menores de idade devem ter autorização dos responsáveis quando necessário",
  "Em caso de atraso, o horário poderá ser reduzido conforme disponibilidade",
];

export const services = [
  {
    title: "Assistência em Celulares",
    icon: Smartphone,
    whatsappMessage: "Olá, NT Informática. Preciso de ajuda com assistência em celular.",
    items: ["Troca de tela", "Troca de bateria", "Conector de carga", "Alto-falante", "Microfone", "Câmera", "Atualização e backup"],
  },
  {
    title: "Computadores e Notebooks",
    icon: Monitor,
    whatsappMessage: "Olá, NT Informática. Preciso de ajuda com assistência em computador ou notebook.",
    items: ["Formatação", "Limpeza interna", "Troca de pasta térmica", "Upgrade de SSD", "Upgrade de memória RAM", "Montagem de PC Gamer", "Diagnóstico técnico"],
  },
  {
    title: "Assistência em Videogames",
    icon: Gamepad2,
    whatsappMessage: "Olá, NT Informática. Preciso de ajuda com assistência em videogame.",
    items: ["PS4", "PS5", "Xbox One", "Xbox Series", "Nintendo Switch", "Limpeza", "Troca de pasta térmica", "Manutenção preventiva", "Diagnóstico de defeitos"],
  },
];

// EDITE AQUI: produtos, preços e descrições.
services.push({
  title: "Personalizados e Impressão 3D",
  icon: Printer,
  whatsappMessage: "Olá, NT Informática. Quero fazer um orçamento de personalizados, canecas ou impressão 3D.",
  items: ["Canecas personalizadas", "Temas de games", "Temas de filmes e séries", "Presentes personalizados", "Peças sob medida", "Protótipos", "Impressão 3D"],
});

export const productCategories = [
  { name: "Monitores", image: "category-assets/monitores.svg", icon: Monitor, description: "Telas para trabalho, estudo e jogos." },
  { name: "Teclados", image: "category-assets/teclados.svg", icon: Keyboard, description: "Modelos gamer, mecânicos e de escritório." },
  { name: "Mouses", image: "category-assets/mouses.svg", icon: Mouse, description: "Precisão para jogos e produtividade." },
  { name: "Headsets", image: "category-assets/headsets.svg", icon: Headphones, description: "Áudio, microfone e conforto para jogar." },
  { name: "Gabinetes", image: "category-assets/gabinetes.svg", icon: Monitor, description: "Visual gamer e boa refrigeração." },
  { name: "SSDs", image: "category-assets/ssds.svg", icon: HardDrive, description: "Mais velocidade para PC e notebook." },
  { name: "Memórias RAM", image: "category-assets/memorias.svg", icon: Cpu, description: "Upgrades para desempenho e multitarefa." },
  { name: "Fontes", image: "category-assets/fontes.svg", icon: ShieldCheck, description: "Energia estável para seu computador." },
  { name: "Controles", image: "category-assets/controles.svg", icon: Gamepad2, description: "Controles para PC, consoles e games." },
  { name: "Carregadores e cabos", image: "category-assets/carregadores.svg", icon: Smartphone, description: "Carregadores, fontes, HDMI, USB e adaptadores." },
  { name: "Kits e combos", image: "category-assets/kits.svg", icon: Keyboard, description: "Combos gamer e kits para escritório." },
  { name: "Acessórios gamer", image: "category-assets/acessorios.svg", icon: Gamepad2, description: "Itens para completar seu setup." },
];

export const products = [
  { name: "SSD 480GB", category: "SSDs", price: "R$ --,--", icon: HardDrive, description: "Mais velocidade para PC e notebook." },
  { name: "SSD NVMe 1TB", category: "SSDs", price: "R$ --,--", icon: HardDrive, description: "Armazenamento rápido para jogos e programas pesados." },
  { name: "Memória RAM DDR4", category: "Memórias RAM", price: "R$ --,--", icon: Cpu, description: "Upgrade para multitarefa e jogos." },
  { name: "Memória RAM DDR5", category: "Memórias RAM", price: "R$ --,--", icon: Cpu, description: "Desempenho moderno para plataformas atuais." },
  { name: "Fonte 500W", category: "Fontes", price: "R$ --,--", icon: ShieldCheck, description: "Energia estável para seu computador." },
  { name: "Fonte 650W 80 Plus", category: "Fontes", price: "R$ --,--", icon: ShieldCheck, description: "Opção para setups gamers com placa de vídeo." },
  { name: "Gabinete Gamer", category: "Gabinetes", price: "R$ --,--", icon: Monitor, description: "Visual moderno com boa refrigeração." },
  { name: "Gabinete com lateral em vidro", category: "Gabinetes", price: "R$ --,--", icon: Monitor, description: "Modelo editável para destacar setups RGB." },
  { name: "Monitor Full HD", category: "Monitores", price: "R$ --,--", icon: Monitor, description: "Imagem nítida para trabalho e games." },
  { name: "Monitor Gamer 24\"", category: "Monitores", price: "R$ --,--", icon: Monitor, description: "Tela editável para destacar taxa de atualização e entrada HDMI." },
  { name: "Teclado Gamer RGB", category: "Teclados", price: "R$ --,--", icon: Keyboard, description: "Modelo com iluminação para completar o setup." },
  { name: "Teclado Mecânico", category: "Teclados", price: "R$ --,--", icon: Keyboard, description: "Opção editável para jogos e digitação." },
  { name: "Mouse Gamer RGB", category: "Mouses", price: "R$ --,--", icon: Mouse, description: "Precisão e pegada confortável para partidas." },
  { name: "Mouse Sem Fio", category: "Mouses", price: "R$ --,--", icon: Mouse, description: "Praticidade para uso diário e trabalho." },
  { name: "Headset Gamer", category: "Headsets", price: "R$ --,--", icon: Headphones, description: "Som imersivo e microfone para chamadas e jogos." },
  { name: "Headset com microfone", category: "Headsets", price: "R$ --,--", icon: Headphones, description: "Modelo editável para atendimento, estudo e game." },
  { name: "Controle para PC", category: "Controles", price: "R$ --,--", icon: Gamepad2, description: "Para jogar no computador com mais conforto." },
  { name: "Controle sem fio", category: "Controles", price: "R$ --,--", icon: Gamepad2, description: "Produto editável para consoles e games." },
  { name: "Carregador Turbo", category: "Carregadores e cabos", price: "R$ --,--", icon: Smartphone, description: "Carregamento rápido para celulares compatíveis." },
  { name: "Carregador Notebook", category: "Carregadores e cabos", price: "R$ --,--", icon: Smartphone, description: "Fonte editável para modelos de notebook." },
  { name: "Cabo HDMI", category: "Carregadores e cabos", price: "R$ --,--", icon: ShieldCheck, description: "Para TV, monitor, console e computador." },
  { name: "Cabo USB-C", category: "Carregadores e cabos", price: "R$ --,--", icon: ShieldCheck, description: "Cabo editável para carga e transferência." },
  { name: "Combo Gamer Squad", category: "Kits e combos", price: "R$ --,--", icon: Mouse, description: "Teclado, mouse, headset e mousepad no mesmo kit." },
  { name: "Kit Escritório sem fio", category: "Kits e combos", price: "R$ --,--", icon: Keyboard, description: "Teclado e mouse sem fio para mesa limpa e prática." },
  { name: "Kit Escritório com fio", category: "Kits e combos", price: "R$ --,--", icon: Keyboard, description: "Teclado e mouse com fio para uso diário." },
  { name: "Mousepad Gamer", category: "Acessórios gamer", price: "R$ --,--", icon: Mouse, description: "Base confortável para melhorar o setup." },
];

// EDITE AQUI: PCs à venda, preços e configurações.
export const pcs = [
  {
    name: "PC Office Básico",
    cpu: "Intel Core i3 / Ryzen 3",
    ram: "8GB DDR4",
    storage: "SSD 240GB",
    gpu: "Vídeo integrado",
    price: "R$ --,--",
    installment: "10x sem juros",
    pix: "15% OFF no Pix/dinheiro",
  },
  {
    name: "PC Gamer Entrada",
    cpu: "Intel Core i5 / Ryzen 5",
    ram: "16GB DDR4",
    storage: "SSD 480GB",
    gpu: "GTX / RX de entrada",
    price: "R$ --,--",
    installment: "10x sem juros",
    pix: "15% OFF no Pix/dinheiro",
  },
  {
    name: "PC Gamer Intermediário",
    cpu: "Ryzen 5 / Intel Core i5",
    ram: "16GB DDR4",
    storage: "SSD NVMe 1TB",
    gpu: "RTX / RX intermediária",
    price: "R$ --,--",
    installment: "10x sem juros",
    pix: "15% OFF no Pix/dinheiro",
  },
];

export const contentCards = [
  { title: "YouTube NT Informática e Celulares", icon: CirclePlay, href: socialLinks.youtubeInfo },
  { title: "YouTube NT Gaming", icon: Play, href: socialLinks.youtubeGaming },
  { title: "Instagram", icon: Camera, href: socialLinks.instagram },
  { title: "TikTok", icon: Star, href: socialLinks.tiktok },
];

export const videos = [
  "Últimos vídeos de manutenção",
  "Lives da NT Gaming",
  "Bastidores da loja",
  "Testes de PCs e games",
];

export const testimonials = [
  "Atendimento excelente e serviço rápido.",
  "Levei meu notebook para manutenção e ficou perfeito.",
  "Arena Gamer muito top, ambiente confortável e PCs bons.",
];

// EDITE AQUI: horários e endereço.
export const contactInfo = {
  store: "NT Informática e Celulares",
  hours: "Segunda a sábado, 09h às 18h",
  address: "Endereço da loja - editar aqui",
};
