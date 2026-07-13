import {
  Cable,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Cpu,
  Fan,
  Gamepad2,
  HardDrive,
  Headphones,
  Keyboard,
  MapPin,
  MessageCircle,
  MemoryStick,
  Monitor,
  Mouse,
  PcCase,
  PlayCircle,
  Server,
  ShoppingBag,
  Sparkles,
  Star,
  Tv,
  Wrench,
} from "lucide-react";
import heroImage from "./assets/hero-nt-gaming.png";
import arenaImage from "./assets/arena-gamer-banner.png";
import { Button, WhatsAppButton, whatsappLink } from "./components/Button";
import { Card, IconBadge } from "./components/Card";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { TechPlaceholder } from "./components/Placeholder";
import { Section } from "./components/Section";
import { AdminApp } from "./admin/AdminApp";
import {
  arenaFeatures,
  arenaBookingUrl,
  arenaPlans,
  arenaRules,
  contactInfo,
  contentCards,
  highlights,
  pcs,
  productCategories,
  services,
  socialLinks,
  testimonials,
  videos,
} from "./data/siteData";

const messages = {
  arena: "Olá, gostaria de agendar um horário na NT Arena Gamer.",
  budget: "Olá, gostaria de solicitar um orçamento para assistência técnica.",
  product: "Olá, tenho interesse em um produto da NT Informática, Celulares e Games.",
  contact: "Olá, gostaria de falar com a NT Informática, Celulares e Games.",
};

function LineSvgIcon({ size = 24, strokeWidth = 2, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function PsuIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="3" />
      <path d="M9 9v6M6 12h6" />
      <path d="M15 9h3M15 12h3M15 15h3" />
    </LineSvgIcon>
  );
}

function GpuIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <rect x="3" y="7" width="15" height="10" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="13" cy="12" r="2" />
      <path d="M18 10h3v4h-3M6 17v2M14 17v2" />
    </LineSvgIcon>
  );
}

function AirCoolerIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <rect x="8" y="4" width="8" height="16" rx="1.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9v6M9 12h6M5 7h3M5 11h3M5 15h3M16 7h3M16 11h3M16 15h3" />
    </LineSvgIcon>
  );
}

function WaterCoolerIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <rect x="3" y="6" width="10" height="12" rx="2" />
      <circle cx="8" cy="12" r="2.5" />
      <path d="M13 9c3 0 3-3 6-3M13 15c3 0 3 3 6 3" />
      <circle cx="20" cy="6" r="1.5" />
      <circle cx="20" cy="18" r="1.5" />
    </LineSvgIcon>
  );
}

function HubIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <rect x="7" y="8" width="10" height="8" rx="2" />
      <path d="M12 8V4M12 16v4M7 12H3M17 12h4" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="12" cy="20" r="1.5" />
      <circle cx="3" cy="12" r="1.5" />
      <circle cx="21" cy="12" r="1.5" />
    </LineSvgIcon>
  );
}

const homeCategoryIcons = {
  Monitores: Monitor,
  Teclados: Keyboard,
  Mouses: Mouse,
  Headsets: Headphones,
  Gabinetes: PcCase,
  Fontes: PsuIcon,
  SSDs: HardDrive,
  "Memórias RAM": MemoryStick,
  "Placas de Vídeo": GpuIcon,
  Processadores: Cpu,
  "Air Coolers": AirCoolerIcon,
  "Water Coolers": WaterCoolerIcon,
  "Fans e Ventoinhas RGB": Fan,
  "Controladoras e Hubs": HubIcon,
  Controles: Gamepad2,
  Consoles: Server,
  "Game Stick": Tv,
  "Carregadores e Cabos": Cable,
};

const whyChooseCards = [
  {
    title: "Assistência Técnica Especializada",
    description: "Consertamos celulares, notebooks, computadores, videogames e diversos equipamentos eletrônicos com diagnóstico técnico e atendimento especializado.",
    icon: Wrench,
    href: "#servicos",
  },
  {
    title: "NT Arena Gamer",
    description: "PCs Gamer de alto desempenho e PlayStation 5 para jogar os principais títulos da atualidade.",
    icon: Gamepad2,
    href: arenaBookingUrl,
  },
  {
    title: "Produtos Selecionados",
    description: "Produtos escolhidos com foco em qualidade, garantia e suporte especializado.",
    icon: ShoppingBag,
    href: "/produtos",
  },
  {
    title: "Atendimento Personalizado",
    description: "Nossa equipe ajuda você a encontrar a melhor solução para sua necessidade.",
    icon: Headphones,
    href: whatsappLink(messages.contact),
    external: true,
  },
];

const howItWorksSteps = [
  "Entre em contato.",
  "Receba o diagnóstico.",
  "Aprove o orçamento.",
  "Receba seu equipamento pronto.",
];

function Hero() {
  return (
    <section id="inicio" className="relative min-h-[92vh] overflow-hidden pt-20">
      <img src={heroImage} alt="Arena gamer e assistência técnica da NT Informática" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-nt-ink via-nt-ink/82 to-nt-ink/30" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-nt-ink to-transparent" />

      <div className="relative mx-auto flex min-h-[calc(92vh-5rem)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex rounded-md border border-nt-cyan/40 bg-nt-cyan/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-nt-cyan">
            Assistência, loja e Arena Gamer
          </p>
          <h1 className="text-balance text-4xl font-black leading-tight text-white sm:text-6xl lg:text-7xl">
            Tecnologia, manutenção e diversão em um só lugar.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
            Assistência técnica, computadores, acessórios e Arena Gamer com PCs de alto desempenho e PlayStation 5.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button href={arenaBookingUrl} icon={CalendarCheck}>Agendar Arena Gamer</Button>
            <WhatsAppButton message={messages.budget}>Solicitar Orçamento</WhatsAppButton>
            <Button href="#produtos" variant="secondary" icon={ShoppingBag}>Ver Produtos</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyChoose() {
  return (
    <Section id="porque-escolher" eyebrow="Confiança" title="Por que escolher a NT Informática?">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {whyChooseCards.map(({ title, description, icon: Icon, href, external }) => (
          <a
            key={title}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className="glass motion-card rounded-lg p-6 shadow-card"
          >
            <IconBadge icon={Icon} />
            <h3 className="text-xl font-black text-white">{title}</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">{description}</p>
          </a>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section id="como-funciona" eyebrow="Atendimento" title="Como funciona?">
      <div className="grid gap-4 md:grid-cols-4">
        {howItWorksSteps.map((step, index) => (
          <Card key={step} className="p-5">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-nt-cyan/10 text-lg font-black text-nt-cyan">
              {index + 1}
            </span>
            <p className="mt-5 text-lg font-black text-white">{step}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Highlights() {
  return (
    <div className="mx-auto -mt-16 grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-6">
      {highlights.map(({ title, text, icon: Icon }) => (
        <Card key={title} className="relative z-10 p-5">
          <IconBadge icon={Icon} />
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
        </Card>
      ))}
    </div>
  );
}

function Arena() {
  return (
    <Section
      id="arena"
      eyebrow="Arena Gamer"
      title="Jogue por horário, chame os amigos e aproveite setups de alto desempenho."
      description="A Arena Gamer da NT foi pensada para partidas casuais, treinos, eventos e campeonatos com estrutura moderna."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <div className="relative overflow-hidden rounded-lg border border-nt-cyan/25">
            <img src={arenaImage} alt="Arena Gamer da NT Informática" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-nt-ink via-nt-ink/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-nt-cyan">NT Gaming</p>
              <h3 className="mt-2 text-2xl font-black text-white">Arena Gamer pronta para sua próxima partida.</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {arenaFeatures.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                <CheckCircle2 className="shrink-0 text-nt-cyan" size={18} />
                {item}
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            {arenaPlans.map((plan) => (
              <Card key={plan.name} className="flex flex-col">
                <p className="text-lg font-black text-white">{plan.name}</p>
                <p className="mt-3 text-3xl font-black text-nt-cyan">{plan.price}</p>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{plan.detail}</p>
                <Button href={arenaBookingUrl} icon={CalendarCheck} className="mt-5 w-full">Ver horários</Button>
              </Card>
            ))}
          </div>
          <Card>
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
              <Sparkles className="text-nt-cyan" /> Regras da Arena
            </h3>
            <div className="grid gap-3">
              {arenaRules.map((rule) => (
                <p key={rule} className="flex gap-3 text-sm leading-6 text-slate-300">
                  <CheckCircle2 className="mt-1 shrink-0 text-nt-cyan" size={16} />
                  {rule}
                </p>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Services() {
  return (
    <Section id="servicos" eyebrow="Serviços" title="Assistência técnica para celular, computador, notebook e videogame.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {services.map(({ title, icon: Icon, items, whatsappMessage }) => (
          <Card key={title}>
            <IconBadge icon={Icon} />
            <h3 className="text-xl font-black text-white">{title}</h3>
            <ul className="mt-5 grid gap-2 text-sm text-slate-300">
              {items.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-nt-cyan" /> {item}
                </li>
              ))}
            </ul>
            <WhatsAppButton message={whatsappMessage} className="mt-6 w-full">Solicitar orçamento</WhatsAppButton>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Products() {
  return (
    <Section id="produtos" eyebrow="Produtos" title="Escolha uma categoria para abrir a vitrine." description="Cada segmento abre uma página própria com os produtos daquela linha, deixando a loja mais organizada para o cliente.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] lg:gap-4">
        {productCategories.map(({ name, description, icon }) => {
          const categoryUrl = `/produtos?categoria=${encodeURIComponent(name)}`;
          const Icon = homeCategoryIcons[name] || icon || ShoppingBag;

          return (
            <a
              key={name}
              href={categoryUrl}
              className="glass motion-card flex min-h-[132px] flex-col rounded-lg p-3 text-left shadow-card transition hover:border-nt-cyan/60 sm:min-h-[142px] sm:p-4"
            >
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-md border border-nt-cyan/20 bg-nt-cyan/10 text-nt-cyan sm:h-16 sm:w-16">
                <Icon size={38} strokeWidth={1.9} />
              </div>
              <h3 className="text-[13px] font-black leading-tight text-white sm:text-sm">{name}</h3>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-300 sm:text-xs">{description}</p>
              <span className="mt-auto pt-3 text-xs font-bold text-nt-cyan">Ver produtos</span>
            </a>
          );
        })}
      </div>
    </Section>
  );
}

function PcShowcase() {
  return (
    <Section id="pcs" eyebrow="PCs à venda" title="Computadores prontos para vender, estudar, trabalhar e jogar.">
      <div className="grid gap-5 lg:grid-cols-3">
        {pcs.map((pc) => (
          <Card key={pc.name}>
            <TechPlaceholder label="Foto do PC" icon={Monitor} />
            <h3 className="mt-5 text-2xl font-black text-white">{pc.name}</h3>
            <dl className="mt-5 grid gap-3 text-sm">
              {[
                ["Processador", pc.cpu],
                ["Memória RAM", pc.ram],
                ["Armazenamento", pc.storage],
                ["Placa de vídeo", pc.gpu],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="text-right font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-3xl font-black text-nt-cyan">{pc.price}</p>
            <p className="mt-1 text-sm text-slate-300">{pc.installment} · {pc.pix}</p>
            <WhatsAppButton message={messages.product} className="mt-5 w-full">Tenho interesse</WhatsAppButton>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Content() {
  return (
    <Section id="conteudo" eyebrow="Conteúdo" title="Acompanhe a NT Informática e a NT Gaming nas redes sociais.">
      <div className="grid gap-5 md:grid-cols-4">
        {contentCards.map(({ title, icon: Icon, href }) => (
          <Card key={title} className="text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-md bg-nt-cyan/10 text-nt-cyan">
              <Icon />
            </div>
            <h3 className="min-h-12 text-base font-black text-white">{title}</h3>
            <Button href={href} variant="secondary" className="mt-5 w-full">Abrir canal</Button>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-4">
        {videos.map((video) => (
          <Card key={video} className="p-4">
            <TechPlaceholder label="Vídeo recente" icon={PlayCircle} />
            <h3 className="mt-4 text-base font-black text-white">{video}</h3>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Testimonials() {
  return (
    <Section id="avaliacoes" eyebrow="Avaliações" title="O que os clientes valorizam na NT.">
      <div className="grid gap-5 md:grid-cols-3">
        {testimonials.map((text) => (
          <Card key={text}>
            <div className="mb-4 flex gap-1 text-nt-cyan">
              {[1, 2, 3, 4, 5].map((item) => <Star key={item} size={18} fill="currentColor" />)}
            </div>
            <p className="text-lg font-semibold leading-8 text-white">“{text}”</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Contact() {
  return (
    <Section id="contato" eyebrow="Contato" title="Chame a NT agora e fale direto pelo WhatsApp.">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <h3 className="text-2xl font-black text-white">{contactInfo.store}</h3>
          <div className="mt-6 grid gap-4 text-slate-300">
            <p className="flex items-center gap-3"><MessageCircle className="text-nt-cyan" /> WhatsApp: {contactInfo.phone}</p>
            <p className="flex items-center gap-3"><Clock className="text-nt-cyan" /> {contactInfo.hours}</p>
            <p className="flex items-center gap-3"><MapPin className="text-nt-cyan" /> {contactInfo.address}</p>
            <p className="flex items-center gap-3"><MessageCircle className="text-nt-cyan" /> {contactInfo.email}</p>
            <p className="flex items-center gap-3"><CheckCircle2 className="text-nt-cyan" /> CNPJ: {contactInfo.cnpj}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a href={socialLinks.instagram} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-4 py-2 text-slate-200 hover:border-nt-cyan">Instagram</a>
            <a href={socialLinks.youtubeInfo} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-4 py-2 text-slate-200 hover:border-nt-cyan">YouTube</a>
            <a href={socialLinks.tiktok} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-4 py-2 text-slate-200 hover:border-nt-cyan">TikTok</a>
          </div>
          <WhatsAppButton message={messages.contact} className="mt-8 w-full text-base">Chamar no WhatsApp agora</WhatsAppButton>
        </Card>
        <a href={socialLinks.googleMaps} target="_blank" rel="noreferrer" className="min-h-[360px] overflow-hidden rounded-lg border border-slate-700 bg-grid bg-[length:28px_28px]">
          <div className="flex h-full min-h-[360px] items-center justify-center bg-gradient-to-br from-nt-blue/20 to-black/30 p-8 text-center">
            <div>
              <MapPin className="mx-auto mb-4 text-nt-cyan" size={42} />
              <p className="text-xl font-black text-white">Abrir localização no Google Maps</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">{contactInfo.address}</p>
            </div>
          </div>
        </a>
      </div>
    </Section>
  );
}

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminApp />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header />
      <Hero />
      <Highlights />
      <WhyChoose />
      <HowItWorks />
      <Arena />
      <Services />
      <Products />
      <PcShowcase />
      <Content />
      <Testimonials />
      <Contact />
      <Footer />
      <a
        href={whatsappLink(messages.contact)}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-nt-blue text-white shadow-glow transition hover:-translate-y-1 hover:bg-nt-cyan"
        target="_blank"
        rel="noreferrer"
        aria-label="Chamar no WhatsApp"
      >
        <MessageCircle />
      </a>
    </div>
  );
}
