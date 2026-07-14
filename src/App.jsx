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
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import heroImage from "./assets/hero-nt-gaming.png";
import arenaImage from "./assets/arena-gamer-banner.png";
import { Button, WhatsAppButton, whatsappLink } from "./components/Button";
import { Card, IconBadge } from "./components/Card";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { TechPlaceholder } from "./components/Placeholder";
import { Section } from "./components/Section";
import { AdminApp } from "./admin/AdminApp";
import { isSupabaseConfigured } from "./lib/supabase";
import { listPublicAssembledPcs, pcCategories } from "./admin/services/assembledPcService";
import {
  arenaFeatures,
  arenaBookingUrl,
  arenaPlans,
  arenaRules,
  contactInfo,
  contentCards,
  highlights,
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

function parseMoney(value) {
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
    normalized = decimalPart.length === 3 && integerPart.length <= 3 ? raw.replace(/\./g, "") : raw;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  const parsed = parseMoney(value);
  if (parsed === null) return "Consulte";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function cashValue(value) {
  const parsed = parseMoney(value);
  return parsed === null ? null : parsed * 0.85;
}

function pcPrice(pc) {
  return parseMoney(pc.promoPrice || pc.price) ?? Number.POSITIVE_INFINITY;
}

function pcSummary(pc) {
  return [
    pc.processor,
    pc.graphicsCard,
    pc.memory,
    pc.storage,
  ].filter(Boolean).join(" | ");
}

function pcWhatsappMessage(pc) {
  const url = `${window.location.origin}/computadores/${pc.slug}`;
  return `Olá! Tenho interesse no computador ${pc.name}.
Configuração:
${pcSummary(pc) || "Configuração a consultar"}
Preço: ${formatCurrency(pc.promoPrice || pc.price)}
Link: ${url}`;
}

function sortPcs(items, sort = "relevance") {
  return items
    .map((pc, index) => ({ pc, index }))
    .sort((first, second) => {
      const firstAvailable = Number(first.pc.stock || 0) >= 1;
      const secondAvailable = Number(second.pc.stock || 0) >= 1;
      if (firstAvailable !== secondAvailable) return firstAvailable ? -1 : 1;

      if (sort === "price-asc" || sort === "price-desc") {
        const diff = pcPrice(first.pc) - pcPrice(second.pc);
        if (diff !== 0) return sort === "price-asc" ? diff : -diff;
      }

      if (first.pc.featured !== second.pc.featured) return first.pc.featured ? -1 : 1;
      return first.index - second.index;
    })
    .map((item) => item.pc);
}

function pcGallery(pc) {
  const fromText = typeof pc.images === "string"
    ? pc.images.split("\n").map((image) => image.trim()).filter(Boolean)
    : Array.isArray(pc.images) ? pc.images : [];
  return [...new Set([pc.mainImage, ...fromText].filter(Boolean))];
}

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

function MotherboardIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <rect x="8" y="7" width="5" height="5" rx="1" />
      <path d="M15 7h2M15 10h2M7 15h10M7 18h4" />
      <path d="M4 7H2M4 12H2M4 17H2M20 7h2M20 12h2M20 17h2" />
      <circle cx="16" cy="17" r="1" />
    </LineSvgIcon>
  );
}

function ChairIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <path d="M8 4h8l1 8H7l1-8Z" />
      <path d="M7 12h10v3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-3Z" />
      <path d="M10 17v3M14 17v3M8 20h8" />
      <path d="M6 10H4v5M18 10h2v5" />
    </LineSvgIcon>
  );
}

function PeripheralKitIcon(props) {
  return (
    <LineSvgIcon {...props}>
      <rect x="3" y="6" width="12" height="7" rx="1.5" />
      <path d="M5.5 8.5h.01M8 8.5h.01M10.5 8.5h.01M13 8.5h.01" />
      <path d="M5.5 11h7.5" />
      <rect x="17" y="7" width="4" height="7" rx="2" />
      <path d="M19 7v2.5" />
      <path d="M8 16h4M10 13v3" />
      <path d="M6 19h12" />
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
  Ventoinhas: Fan,
  "Controladoras e Hubs": HubIcon,
  Controles: Gamepad2,
  Consoles: Server,
  "Carregadores e Cabos": Cable,
  Acessórios: Wrench,
  "Placas-mãe": MotherboardIcon,
  Cadeiras: ChairIcon,
  "Kit Periféricos": PeripheralKitIcon,
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

function usePublicPcs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPcs() {
      setLoading(true);
      setError("");
      try {
        const pcsList = await listPublicAssembledPcs();
        if (mounted) setItems(pcsList);
      } catch (loadError) {
        console.error(loadError);
        if (mounted) {
          setItems([]);
          setError("Não foi possível carregar os computadores agora.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPcs();
    return () => {
      mounted = false;
    };
  }, []);

  return {
    pcs: items,
    loading,
    error,
    localMode: !isSupabaseConfigured,
  };
}

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
        {productCategories.map(({ name, slug, description, icon }) => {
          const categoryUrl = `/produtos?categoria=${encodeURIComponent(slug || name)}`;
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
  const { pcs, loading, error, localMode } = usePublicPcs();
  const visiblePcs = sortPcs(pcs.filter((pc) => Number(pc.stock || 0) >= 1)).slice(0, 3);

  return (
    <Section id="pcs" eyebrow="PCs à venda" title="Computadores prontos para vender, estudar, trabalhar e jogar.">
      {loading ? <p className="rounded-lg border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Carregando computadores disponíveis...</p> : null}
      {!loading && (error || localMode) ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">
          {error || "Supabase não configurado. Os PCs reais aparecerão aqui assim que forem cadastrados e publicados."}
        </div>
      ) : null}
      {!loading && !visiblePcs.length ? (
        <Card>
          <h3 className="text-2xl font-black text-white">Nenhum PC disponível no momento.</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">Estamos preparando novos computadores montados para pronta entrega. Consulte a loja pelo WhatsApp.</p>
          <WhatsAppButton message="Olá! Gostaria de consultar PCs montados disponíveis na NT Informática." className="mt-5">Consultar no WhatsApp</WhatsAppButton>
        </Card>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-3">
        {visiblePcs.map((pc) => {
          const images = pcGallery(pc);
          return (
          <Card key={pc.id}>
            {images[0] ? (
              <img src={images[0]} alt={pc.name} className="aspect-[4/3] w-full rounded-lg border border-white/10 object-cover" />
            ) : (
              <TechPlaceholder label="Foto do PC" icon={Monitor} />
            )}
            <h3 className="mt-5 text-2xl font-black text-white">{pc.name}</h3>
            <dl className="mt-5 grid gap-3 text-sm">
              {[
                ["Processador", pc.processor],
                ["Memória RAM", pc.memory],
                ["Armazenamento", pc.storage],
                ["Placa de vídeo", pc.graphicsCard],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="text-right font-semibold text-white">{value || "Consulte"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-3xl font-black text-nt-cyan">{formatCurrency(pc.promoPrice || pc.price)}</p>
            <p className="mt-1 text-sm text-slate-300">10x sem juros: {formatCurrency(pc.price)} · Pix/dinheiro: {formatCurrency(cashValue(pc.price))}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button href={`/computadores/${pc.slug}`} variant="secondary">Ver detalhes</Button>
              <Button href={whatsappLink(pcWhatsappMessage(pc))}>Comprar</Button>
            </div>
          </Card>
        );
        })}
      </div>
      <div className="mt-6">
        <Button href="/computadores" variant="secondary" icon={Monitor}>Ver todos os computadores</Button>
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

function PcCard({ pc }) {
  const images = pcGallery(pc);
  const available = Number(pc.stock || 0) >= 1;

  return (
    <Card className="flex flex-col">
      {images[0] ? (
        <img src={images[0]} alt={pc.name} className="aspect-[4/3] w-full rounded-lg border border-white/10 object-cover" />
      ) : (
        <TechPlaceholder label="Foto do PC" icon={Monitor} />
      )}
      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-nt-cyan/30 bg-nt-cyan/10 px-3 py-1 text-xs font-bold text-nt-cyan">{pc.category || "PC montado"}</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${available ? "border-lime-300/30 bg-lime-300/10 text-lime-200" : "border-red-300/30 bg-red-300/10 text-red-200"}`}>
            {available ? "Em estoque" : "Esgotado"}
          </span>
        </div>
        <h3 className="mt-4 text-2xl font-black text-white">{pc.name}</h3>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{pc.shortDescription || pcSummary(pc) || "Computador montado pela NT Informática."}</p>
        <p className="mt-5 text-3xl font-black text-nt-cyan">{formatCurrency(pc.promoPrice || pc.price)}</p>
        <p className="mt-1 text-sm text-slate-300">10x sem juros: {formatCurrency(pc.price)} · Pix/dinheiro: {formatCurrency(cashValue(pc.price))}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button href={`/computadores/${pc.slug}`} variant="secondary">Ver detalhes</Button>
          {available ? (
            <Button href={whatsappLink(pcWhatsappMessage(pc))}>Comprar</Button>
          ) : (
            <WhatsAppButton message={`Olá! Gostaria de consultar disponibilidade do computador ${pc.name}.`}>Consultar</WhatsAppButton>
          )}
        </div>
      </div>
    </Card>
  );
}

function PcDetail({ pc }) {
  const images = pcGallery(pc);
  const [selectedImage, setSelectedImage] = useState(images[0] || "");
  const available = Number(pc.stock || 0) >= 1;
  const specs = [
    ["Processador", pc.processor],
    ["Placa-mãe", pc.motherboard],
    ["Memória RAM", pc.memory],
    ["Armazenamento", pc.storage],
    ["Placa de vídeo", pc.graphicsCard],
    ["Fonte", pc.powerSupply],
    ["Gabinete", pc.caseModel],
    ["Refrigeração", pc.cooling],
    ["Sistema operacional", pc.operatingSystem],
    ["Garantia", pc.warranty],
  ].filter(([, value]) => Boolean(value));

  useEffect(() => {
    setSelectedImage(images[0] || "");
  }, [pc.id]);

  return (
    <Section eyebrow={pc.category || "PC montado"} title={pc.name} description={pc.shortDescription}>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div>
          {selectedImage ? (
            <img src={selectedImage} alt={pc.name} className="aspect-[4/3] w-full rounded-lg border border-white/10 object-cover shadow-card" />
          ) : (
            <TechPlaceholder label="Foto do PC" icon={Monitor} />
          )}
          {images.length > 1 ? (
            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
              {images.map((image) => (
                <button key={image} type="button" onClick={() => setSelectedImage(image)} className={`overflow-hidden rounded-md border ${selectedImage === image ? "border-nt-cyan" : "border-white/10"}`}>
                  <img src={image} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Card>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${available ? "border-lime-300/30 bg-lime-300/10 text-lime-200" : "border-red-300/30 bg-red-300/10 text-red-200"}`}>
            {available ? "Em estoque" : "Esgotado"}
          </span>
          <p className="mt-5 text-4xl font-black text-nt-cyan">{formatCurrency(pc.promoPrice || pc.price)}</p>
          <p className="mt-2 text-sm text-slate-300">10x sem juros: {formatCurrency(pc.price)}</p>
          <p className="mt-1 text-sm text-lime-200">À vista no Pix/dinheiro com 15% off: {formatCurrency(cashValue(pc.price))}</p>
          <p className="mt-5 text-sm leading-6 text-slate-300">{pc.fullDescription || pc.shortDescription || "Computador montado e revisado pela NT Informática."}</p>
          <div className="mt-6 grid gap-3">
            {available ? (
              <Button href={whatsappLink(pcWhatsappMessage(pc))} className="w-full">Comprar via WhatsApp</Button>
            ) : (
              <WhatsAppButton message={`Olá! Gostaria de consultar disponibilidade do computador ${pc.name}.`} className="w-full">Consultar disponibilidade</WhatsAppButton>
            )}
            <Button href="/computadores" variant="secondary" className="w-full">Voltar para computadores</Button>
          </div>
        </Card>
      </div>

      <Card className="mt-8">
        <h2 className="text-2xl font-black text-white">Especificações completas</h2>
        <dl className="mt-5 grid gap-3 md:grid-cols-2">
          {specs.map(([label, value]) => (
            <div key={label} className="rounded-md border border-white/10 bg-white/5 p-4">
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</dt>
              <dd className="mt-2 font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </Section>
  );
}

function ComputersPage() {
  const { pcs, loading, error, localMode } = usePublicPcs();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [sort, setSort] = useState("relevance");
  const slug = decodeURIComponent(window.location.pathname.replace(/^\/computadores\/?/, "")).replace(/\/$/, "");
  const selectedPc = slug ? pcs.find((pc) => pc.slug === slug || pc.id === slug) : null;

  const filteredPcs = useMemo(() => sortPcs(pcs.filter((pc) => {
    const matchSearch = [pc.name, pc.processor, pc.graphicsCard, pc.shortDescription].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "Todas" || pc.category === category;
    return matchSearch && matchCategory;
  }), sort), [pcs, search, category, sort]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header />
      <main className="pt-20">
        {loading ? (
          <Section eyebrow="PCs Montados" title="Carregando computadores...">
            <p className="rounded-lg border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Buscando PCs publicados no Supabase.</p>
          </Section>
        ) : selectedPc ? (
          <PcDetail pc={selectedPc} />
        ) : (
          <Section eyebrow="PCs Montados" title="Computadores prontos da NT Informática" description="Filtre por categoria, compare configurações e chame no WhatsApp para comprar.">
            {(error || localMode) ? (
              <div className="mb-6 rounded-lg border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">
                {error || "Supabase não configurado. Nenhum PC real será exibido no modo local."}
              </div>
            ) : null}
            <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4 lg:grid-cols-[1fr_0.55fr_0.45fr]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, processador ou placa de vídeo" className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
                <option>Todas</option>
                {pcCategories.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan">
                <option value="relevance">Relevância</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
              </select>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {filteredPcs.map((pc) => <PcCard key={pc.id} pc={pc} />)}
            </div>
            {!filteredPcs.length ? (
              <Card className="mt-6 text-center">
                <h2 className="text-2xl font-black text-white">Nenhum computador encontrado.</h2>
                <p className="mt-3 text-sm text-slate-300">Ajuste os filtros ou consulte a loja para montar uma configuração sob medida.</p>
                <WhatsAppButton message="Olá! Gostaria de consultar computadores montados disponíveis ou montar uma configuração." className="mt-5">Consultar no WhatsApp</WhatsAppButton>
              </Card>
            ) : null}
          </Section>
        )}
      </main>
      <Footer />
    </div>
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
        <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
          <iframe
            title="Mapa da NT Informática, Celulares e Games"
            src="https://www.google.com/maps?q=Rua%20Johann%20Sachse%2C%202891%2C%20Sala%201%2C%20Badenfurt%2C%20Blumenau%20-%20SC&output=embed"
            className="h-full min-h-[360px] w-full"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-5">
            <a
              href={socialLinks.googleMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto inline-flex items-center gap-2 rounded-md bg-nt-blue px-5 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-nt-cyan"
            >
              <MapPin size={18} />
              Abrir localização no Google Maps
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminApp />;
  }

  if (window.location.pathname.startsWith("/computadores")) {
    return <ComputersPage />;
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
