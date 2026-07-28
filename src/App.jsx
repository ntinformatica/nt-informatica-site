import {
  Cable,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { listPublicGames } from "./admin/services/gameLibraryService";
import { listPublicAssembledPcs, pcCategories, pcTypeLabel, pcTypeOptions } from "./admin/services/assembledPcService";
import { classifyFps, formatBenchmarkResolution, formatFps, getGameImage, isValidHttpUrl, normalizeProductBenchmark, resolveBenchmarkGamesWithLibrary } from "./utils/pcBenchmark";
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

function sortByPortugueseName(items, getName = (item) => item?.name) {
  return [...items]
    .filter((item) => String(getName(item) || "").trim())
    .sort((first, second) => getName(first).localeCompare(getName(second), "pt-BR", { sensitivity: "base" }));
}

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

function pcCashPrice(pc) {
  const promoPrice = parseMoney(pc.promoPrice);
  if (promoPrice !== null) return promoPrice;
  return cashValue(pc.price);
}

function pcPrice(pc) {
  return pcCashPrice(pc) ?? Number.POSITIVE_INFINITY;
}

function pcSummary(pc) {
  return [
    pc.processor,
    pc.graphicsCard,
    pc.memory,
    pc.storage,
  ].filter(Boolean).join(" | ");
}

function pcPublicUrl(pc) {
  return window.location.origin + "/computadores/" + encodeURIComponent(pc.slug);
}

function pcWhatsappMessage(pc) {
  const url = pcPublicUrl(pc);
  return `Olá! Tenho interesse no computador ${pc.name}.
Configuração:
${pcSummary(pc) || "Configuração a consultar"}
Preço à vista: ${formatCurrency(pcCashPrice(pc))}
Link: ${url}`;
}

function pcShareMessage(pc) {
  return "Confira este computador montado pela NT Informática:\n\n" + pc.name + "\n\n" + (pcSummary(pc) || "Configuração a consultar") + "\n\nPreço à vista: " + formatCurrency(pcCashPrice(pc)) + "\n\nLink: " + pcPublicUrl(pc);
}

function getComputerSlugFromPath(pathname) {
  const withoutPrefix = pathname.replace(/^\/computadores\/?/, "").replace(/\/$/, "");
  if (!withoutPrefix) return "";

  try {
    return decodeURIComponent(withoutPrefix);
  } catch {
    return withoutPrefix;
  }
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
  const fromGallery = typeof pc.gallery === "string"
    ? pc.gallery.split("\n").map((image) => image.trim()).filter(Boolean)
    : Array.isArray(pc.gallery) ? pc.gallery : [];
  return [...new Set([pc.mainImage, pc.main_image, pc.image, pc.imageUrl, pc.image_url, ...fromText, ...fromGallery].filter(Boolean))];
}

function PcPriceBlock({ pc, detail = false }) {
  const cashPrice = pcCashPrice(pc);
  const installmentPrice = parseMoney(pc.price);

  return (
    <div className={detail ? "mt-5" : "mt-5"}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={(detail ? "text-4xl" : "text-3xl") + " font-black text-nt-cyan"}>
          {formatCurrency(cashPrice)}
        </span>
        <span className="text-sm font-bold uppercase tracking-[0.08em] text-lime-200">À vista com 15% OFF</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-300">
        {formatCurrency(installmentPrice)} em 10x sem juros
      </p>
    </div>
  );
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
        const [pcsList, gamesList] = await Promise.all([
          listPublicAssembledPcs(),
          listPublicGames().catch((libraryError) => {
            console.warn("Nao foi possivel carregar a biblioteca de jogos publica:", libraryError);
            return [];
          }),
        ]);
        const enrichedPcs = pcsList.map((pc) => {
          const benchmark = normalizeProductBenchmark(pc);
          return {
            ...pc,
            benchmarkGames: resolveBenchmarkGamesWithLibrary(benchmark.benchmarkGames, gamesList),
          };
        });
        if (mounted) setItems(enrichedPcs);
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
        <a
          href={arenaBookingUrl}
          aria-label="Ver horários da NT Arena Gamer"
          className="group block rounded-lg text-inherit outline-none transition focus-visible:ring-2 focus-visible:ring-nt-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-nt-ink"
        >
          <Card className="h-full cursor-pointer transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-glow">
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
        </a>

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
  const sortedCategories = sortByPortugueseName(productCategories);

  return (
    <Section id="produtos" eyebrow="Produtos" title="Escolha uma categoria para abrir a vitrine." description="Cada segmento abre uma página própria com os produtos daquela linha, deixando a loja mais organizada para o cliente.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] lg:gap-4">
        {sortedCategories.map(({ name, slug, description, icon }) => {
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

function pcList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value).split("\n").map((item) => item.trim()).filter(Boolean);
}

function isInteractiveCarouselTarget(target) {
  return Boolean(target?.closest?.("a, button, input, select, textarea, [role='button'], [data-no-drag]"));
}

function useHorizontalCarousel({ itemCount = 0, autoplay = true, autoplayMs = 7000 } = {}) {
  const scrollRef = useRef(null);
  const interactionTimeoutRef = useRef(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    suppressClick: false,
  });
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const paused = hoverPaused || interactionPaused;

  function pauseTemporarily(duration = 5000) {
    setInteractionPaused(true);
    if (interactionTimeoutRef.current) window.clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = window.setTimeout(() => setInteractionPaused(false), duration);
  }

  useEffect(() => () => {
    if (interactionTimeoutRef.current) window.clearTimeout(interactionTimeoutRef.current);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    function updateState() {
      const overflow = element.scrollWidth > element.clientWidth + 8;
      setHasOverflow(overflow);
      setCanGoBack(overflow && element.scrollLeft > 8);
      setCanGoForward(overflow && element.scrollLeft + element.clientWidth < element.scrollWidth - 8);
    }

    updateState();
    element.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);

    let resizeObserver = null;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(updateState);
      resizeObserver.observe(element);
    }

    return () => {
      element.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [itemCount]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !autoplay || !hasOverflow || paused || !inView || itemCount <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 1023px)").matches) return;

    const timer = window.setInterval(() => {
      const amount = Math.max(280, element.clientWidth * 0.9);
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 8;

      if (atEnd) {
        element.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        element.scrollBy({ left: amount, behavior: "smooth" });
      }
    }, autoplayMs);

    return () => window.clearInterval(timer);
  }, [autoplay, autoplayMs, hasOverflow, inView, itemCount, paused]);

  function scrollByDirection(direction) {
    const element = scrollRef.current;
    if (!element) return;
    pauseTemporarily();
    element.scrollBy({ left: direction * Math.max(280, element.clientWidth * 0.9), behavior: "smooth" });
  }

  function handleKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    scrollByDirection(event.key === "ArrowLeft" ? -1 : 1);
  }

  function handlePointerDown(event) {
    const element = scrollRef.current;
    if (!element || event.pointerType !== "mouse") return;
    if (isInteractiveCarouselTarget(event.target)) {
      dragRef.current = {
        active: false,
        moved: false,
        pointerId: null,
        startX: 0,
        startScrollLeft: element.scrollLeft,
        suppressClick: false,
      };
      return;
    }

    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
      suppressClick: false,
    };
    element.setPointerCapture?.(event.pointerId);
    setInteractionPaused(true);
  }

  function handlePointerMove(event) {
    const element = scrollRef.current;
    const drag = dragRef.current;
    if (!element || !drag.active || event.pointerId !== drag.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 8) {
      drag.moved = true;
      drag.suppressClick = true;
      element.scrollLeft = drag.startScrollLeft - deltaX;
      event.preventDefault();
    }
  }

  function finishPointerInteraction(event) {
    const element = scrollRef.current;
    const drag = dragRef.current;
    if (!drag.active || event.pointerId !== drag.pointerId) return;

    element?.releasePointerCapture?.(event.pointerId);
    drag.pointerId = null;
    drag.active = false;
    if (drag.suppressClick) {
      window.setTimeout(() => {
        dragRef.current.suppressClick = false;
      }, 350);
    }
    pauseTemporarily();
  }

  function handleClickCapture(event) {
    if (!dragRef.current.suppressClick) return;

    event.preventDefault();
    event.stopPropagation();
    window.setTimeout(() => {
      dragRef.current.suppressClick = false;
    }, 0);
  }

  return {
    scrollRef,
    canGoBack,
    canGoForward,
    hasOverflow,
    setPaused: setHoverPaused,
    scrollByDirection,
    carouselProps: {
      onKeyDown: handleKeyDown,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPointerInteraction,
      onPointerCancel: finishPointerInteraction,
      onClickCapture: handleClickCapture,
    },
  };
}

function PcShowcase() {
  const { pcs, loading, error, localMode } = usePublicPcs();
  const visiblePcs = sortPcs(pcs.filter((pc) => Number(pc.stock || 0) >= 1));
  const carousel = useHorizontalCarousel({ itemCount: visiblePcs.length });

  return (
    <Section id="pcs" eyebrow="PCs à venda" title="Computadores prontos para vender, estudar, trabalhar e jogar.">
      {loading ? <p className="rounded-lg border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Carregando computadores disponíveis...</p> : null}
      {!loading && (error || localMode) ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">
          {error || "Supabase não configurado. Os PCs reais aparecerão aqui assim que forem cadastrados e publicados."}
        </div>
      ) : null}
      {!loading && !error && !visiblePcs.length ? (
        <Card>
          <h3 className="text-2xl font-black text-white">Nenhum PC disponível no momento.</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">Estamos preparando novos computadores montados para pronta entrega. Consulte a loja pelo WhatsApp.</p>
          <WhatsAppButton message="Olá! Gostaria de consultar PCs montados disponíveis na NT Informática." className="mt-5">Consultar no WhatsApp</WhatsAppButton>
        </Card>
      ) : null}
      {visiblePcs.length ? (
        <div
          className="group relative mt-6"
          onMouseEnter={() => carousel.setPaused(true)}
          onMouseLeave={() => carousel.setPaused(false)}
          onFocus={() => carousel.setPaused(true)}
          onBlur={() => carousel.setPaused(false)}
        >
          {carousel.hasOverflow ? (
            <>
              <button
                type="button"
                aria-label="Ver computadores anteriores"
                disabled={!carousel.canGoBack}
                onClick={() => carousel.scrollByDirection(-1)}
                className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/90 text-white opacity-0 transition hover:border-nt-cyan focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan disabled:pointer-events-none disabled:opacity-20 group-hover:opacity-100 md:inline-flex"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Ver próximos computadores"
                disabled={!carousel.canGoForward}
                onClick={() => carousel.scrollByDirection(1)}
                className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/90 text-white opacity-0 transition hover:border-nt-cyan focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan disabled:pointer-events-none disabled:opacity-20 group-hover:opacity-100 md:inline-flex"
              >
                <ChevronRight size={22} />
              </button>
            </>
          ) : null}
          <div
            ref={carousel.scrollRef}
            tabIndex={0}
            aria-label="Carrossel de computadores montados"
            className="flex cursor-grab snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 outline-none active:cursor-grabbing [scrollbar-width:thin] [scrollbar-color:#38bdf8_#0f172a] focus-visible:ring-2 focus-visible:ring-nt-cyan"
            {...carousel.carouselProps}
          >
            {visiblePcs.map((pc) => (
              <div key={pc.id} className="flex min-w-[86%] snap-start [&>div]:w-full sm:min-w-[48%] lg:min-w-[31.8%]">
                <PcCard pc={pc} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
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

function PcCardImage({ pc, image }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [image]);

  if (!image || failed) {
    return <TechPlaceholder label="Foto do PC" icon={Monitor} />;
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950">
      {!loaded ? (
        <div className="absolute inset-0 grid place-items-center bg-white/5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          Carregando foto
        </div>
      ) : null}
      <img
        src={image}
        alt={pc.name}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          console.warn("Imagem do PC nao carregou:", {
            pcId: pc.id,
            pcName: pc.name,
            imageUrl: image,
          });
          setFailed(true);
        }}
        className={'h-full w-full object-cover transition-opacity duration-200 ' + (loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}

function PcCard({ pc }) {
  const images = pcGallery(pc);
  const available = Number(pc.stock || 0) >= 1;
  const summaryItems = [pc.processor, pc.graphicsCard, pc.memory, pc.storage].filter(Boolean).slice(0, 4);

  return (
    <Card className="flex flex-col">
      <PcCardImage pc={pc} image={images[0]} />
      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-nt-cyan/30 bg-nt-cyan/10 px-3 py-1 text-xs font-bold text-nt-cyan">{pcTypeLabel(pc.pcType)}</span>
          <span className={'rounded-full border px-3 py-1 text-xs font-bold ' + (available ? "border-lime-300/30 bg-lime-300/10 text-lime-200" : "border-red-300/30 bg-red-300/10 text-red-200")}>{available ? "Em estoque" : "Esgotado"}</span>
          {pc.featured ? <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-1 text-xs font-bold text-yellow-100">Destaque</span> : null}
        </div>
        <h3 className="mt-4 text-2xl font-black text-white">{pc.name}</h3>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{pc.shortDescription || pcSummary(pc) || "Computador montado pela NT Informática."}</p>
        <dl className="mt-4 grid gap-2 text-sm">
          {summaryItems.map((item) => <div key={item} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-slate-200">{item}</div>)}
        </dl>
        <PcPriceBlock pc={pc} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button href={'/computadores/' + encodeURIComponent(pc.slug)} variant="secondary">Ver detalhes</Button>
          {available ? <Button href={whatsappLink(pcWhatsappMessage(pc))}>Comprar</Button> : <WhatsAppButton message={'Olá! Gostaria de consultar disponibilidade do computador ' + pc.name + '.'}>Consultar</WhatsAppButton>}
        </div>
      </div>
    </Card>
  );
}

function PcImageGallery({ pc }) {
  const images = pcGallery(pc);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomStyle, setZoomStyle] = useState({ transformOrigin: "center center" });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const selectedImage = images[selectedIndex] || "";

  useEffect(() => {
    setSelectedIndex(0);
    setLightboxOpen(false);
  }, [pc.id]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") setSelectedIndex((current) => (current - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setSelectedIndex((current) => (current + 1) % images.length);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen, images.length]);

  function handleZoom(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomStyle({ transformOrigin: x + "% " + y + "%" });
  }

  function previousImage() {
    setSelectedIndex((current) => (current - 1 + images.length) % images.length);
  }

  function nextImage() {
    setSelectedIndex((current) => (current + 1) % images.length);
  }

  if (!selectedImage) {
    return <TechPlaceholder label="Foto do PC" icon={Monitor} />;
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        onMouseMove={handleZoom}
        onMouseLeave={() => setZoomStyle({ transformOrigin: "center center" })}
        className="group relative block w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950 text-left shadow-card outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan"
        aria-label={"Ampliar imagem de " + pc.name}
      >
        <img
          src={selectedImage}
          alt={"Imagem principal do computador " + pc.name}
          className="aspect-[4/3] w-full object-cover transition-transform duration-300 ease-out md:group-hover:scale-125"
          style={zoomStyle}
        />
      </button>

      {images.length > 1 ? (
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6" aria-label="Fotos do computador">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={'overflow-hidden rounded-md border bg-slate-950 outline-none transition focus-visible:ring-2 focus-visible:ring-nt-cyan ' + (selectedIndex === index ? "border-nt-cyan" : "border-white/10 hover:border-white/30")}
              aria-label={"Selecionar imagem " + (index + 1) + " de " + pc.name}
            >
              <img src={image} alt={"Miniatura " + (index + 1) + " de " + pc.name} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pc-lightbox-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxOpen(false);
          }}
        >
          <h2 id="pc-lightbox-title" className="sr-only">Galeria de imagens de {pc.name}</h2>
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-950/90 text-white outline-none hover:border-nt-cyan focus-visible:ring-2 focus-visible:ring-nt-cyan"
            aria-label="Fechar visualização ampliada"
          >
            <X size={22} />
          </button>
          {images.length > 1 ? (
            <button
              type="button"
              onClick={previousImage}
              className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/90 text-white outline-none hover:border-nt-cyan focus-visible:ring-2 focus-visible:ring-nt-cyan"
              aria-label="Imagem anterior"
            >
              <ChevronLeft size={24} />
            </button>
          ) : null}
          <img src={selectedImage} alt={"Imagem ampliada do computador " + pc.name} className="max-h-[86vh] max-w-[92vw] rounded-lg object-contain shadow-card" />
          {images.length > 1 ? (
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/90 text-white outline-none hover:border-nt-cyan focus-visible:ring-2 focus-visible:ring-nt-cyan"
              aria-label="Próxima imagem"
            >
              <ChevronRight size={24} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PcShareButton({ pc }) {
  const [message, setMessage] = useState("");

  async function handleShare() {
    const url = pcPublicUrl(pc);
    const text = "Confira este computador montado pela NT Informática: " + pc.name;

    try {
      if (navigator.share) {
        await navigator.share({ title: pc.name, text, url });
        return;
      }

      await navigator.clipboard?.writeText(url);
      setMessage("Link copiado para a área de transferência.");
      window.setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Não foi possível compartilhar agora.");
      window.setTimeout(() => setMessage(""), 3000);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-nt-cyan/40 px-5 py-3 text-sm font-bold text-nt-cyan transition hover:bg-nt-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan"
        aria-label={"Compartilhar " + pc.name}
      >
        <Share2 size={18} /> Compartilhar
      </button>
      {message ? <p className="mt-2 text-xs font-semibold text-lime-200" role="status">{message}</p> : null}
    </div>
  );
}

function NtTestedBadge({ children = "Testado pela NT" }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-nt-cyan/30 bg-nt-cyan/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-nt-cyan">
      {children}
    </span>
  );
}

function GameCover({ game }) {
  const [failed, setFailed] = useState(false);
  const coverUrl = getGameImage(game);
  useEffect(() => {
    setFailed(false);
  }, [coverUrl]);
  const initials = String(game.name || "Jogo")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (!coverUrl || failed) {
    return (
      <div className="grid aspect-[3/4] place-items-center rounded-lg border border-white/10 bg-gradient-to-br from-nt-blue/30 via-slate-900 to-nt-cyan/10 p-5 text-center">
        <div>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-nt-cyan/30 bg-nt-cyan/10 text-xl font-black text-nt-cyan">{initials || "NT"}</span>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Capa em breve</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={coverUrl}
      alt={"Capa do jogo " + game.name}
      loading="lazy"
      onError={() => {
        if (!failed) console.warn("Falha ao carregar capa de jogo no site publico:", { game: game.name, url: coverUrl });
        setFailed(true);
      }}
      className="aspect-[3/4] w-full rounded-lg border border-white/10 object-cover"
    />
  );
}

function GameBenchmarkCard({ game }) {
  const resolution = formatBenchmarkResolution(game);
  const videoUrl = isValidHttpUrl(game.videoUrl) ? game.videoUrl : "";

  return (
    <article className="flex h-full min-w-[82%] snap-start flex-col rounded-lg border border-white/10 bg-slate-950/80 p-4 shadow-card sm:min-w-[48%] lg:min-w-[31%] 2xl:min-w-[23%]">
      <GameCover game={game} />
      <div className="mt-4 flex flex-1 flex-col">
        <NtTestedBadge />
        <h3 className="mt-3 line-clamp-2 min-h-[3.5rem] text-xl font-black leading-tight text-white">{game.name || "Jogo não informado"}</h3>
        <dl className="mt-4 grid gap-2 text-sm">
          {game.graphicsPreset ? <div className="rounded-md border border-white/10 bg-white/5 p-3"><dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Gráfico</dt><dd className="mt-1 font-bold text-white">{game.graphicsPreset}</dd></div> : null}
          {resolution ? <div className="rounded-md border border-white/10 bg-white/5 p-3"><dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Resolução</dt><dd className="mt-1 font-bold text-white">{resolution}</dd></div> : null}
        </dl>
        <div className="mt-4 rounded-lg border border-nt-cyan/20 bg-nt-cyan/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-300">FPS médio</p>
          <p className="mt-1 text-3xl font-black text-nt-cyan">{formatFps(game.averageFps)}</p>
          <p className="mt-1 text-sm font-bold text-white">{classifyFps(game.averageFps)}</p>
        </div>
        <div className="mt-auto pt-4">
          {videoUrl ? (
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-nt-blue px-4 py-3 text-center text-sm font-black text-white transition hover:bg-nt-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan">
              <PlayCircle size={18} /> Assistir ao teste deste jogo
            </a>
          ) : (
            <p className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-slate-300">Vídeo em breve</p>
          )}
        </div>
      </div>
    </article>
  );
}

function BenchmarkRequestCard({ pc }) {
  const message = `Olá! Vi o computador ${pc.name} no site da NT Informática e gostaria de solicitar o teste de um jogo nesta configuração.
${typeof window !== "undefined" ? window.location.href : ""}`;

  return (
    <article className="flex min-w-[82%] snap-start flex-col justify-between rounded-lg border border-dashed border-nt-cyan/40 bg-nt-cyan/5 p-5 sm:min-w-[48%] lg:min-w-[31%] 2xl:min-w-[23%]">
      <div>
        <NtTestedBadge>Teste sob consulta</NtTestedBadge>
        <h3 className="mt-4 text-2xl font-black text-white">Não encontrou o jogo que procura?</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">Fale com a NT Informática e consulte a possibilidade de testarmos este computador no seu jogo.</p>
      </div>
      <WhatsAppButton message={message} className="mt-6 w-full">Solicitar teste pelo WhatsApp</WhatsAppButton>
    </article>
  );
}

function BenchmarkSection({ pc }) {
  const benchmark = normalizeProductBenchmark(pc);
  const games = benchmark.benchmarkGames;
  const scrollRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [paused, setPaused] = useState(false);

  const shouldShow = benchmark.showBenchmarkSection && games.length > 0;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !shouldShow) return;

    function updateButtons() {
      setCanGoBack(element.scrollLeft > 8);
      setCanGoForward(element.scrollLeft + element.clientWidth < element.scrollWidth - 8);
    }

    updateButtons();
    element.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      element.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [shouldShow, games.length]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !shouldShow || paused || games.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;

    const timer = window.setInterval(() => {
      const nextLeft = element.scrollLeft + Math.max(280, element.clientWidth * 0.75);
      if (nextLeft + element.clientWidth >= element.scrollWidth - 8) {
        element.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        element.scrollBy({ left: Math.max(280, element.clientWidth * 0.75), behavior: "smooth" });
      }
    }, 7000);

    return () => window.clearInterval(timer);
  }, [shouldShow, paused, games.length]);

  if (!shouldShow) return null;

  function scrollCarousel(direction) {
    const element = scrollRef.current;
    if (!element) return;
    setPaused(true);
    element.scrollBy({ left: direction * Math.max(280, element.clientWidth * 0.85), behavior: "smooth" });
    window.setTimeout(() => setPaused(false), 5000);
  }

  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-nt-cyan/20 bg-white/[0.04] p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-nt-cyan">Benchmark NT</p>
            {benchmark.ntTestaEpisode ? <NtTestedBadge>{benchmark.ntTestaEpisode}</NtTestedBadge> : null}
          </div>
          <h2 className="mt-2 text-3xl font-black text-white">Jogos testados nesta configuração</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Veja o desempenho real deste computador nos jogos testados pela NT Informática.</p>
        </div>
        {isValidHttpUrl(benchmark.fullBenchmarkVideoUrl) ? (
          <div className="max-w-sm rounded-lg border border-white/10 bg-slate-950 p-4">
            <p className="text-sm text-slate-300">Veja o teste completo desta configuração no canal da NT Informática.</p>
            <a href={benchmark.fullBenchmarkVideoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-nt-blue px-4 py-3 text-sm font-black text-white transition hover:bg-nt-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan">
              <PlayCircle size={18} /> Assistir ao teste completo deste PC
            </a>
          </div>
        ) : null}
      </div>

      <div className="group relative mt-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        {games.length > 1 ? (
          <>
            <button type="button" aria-label="Ver jogos anteriores" disabled={!canGoBack} onClick={() => scrollCarousel(-1)} className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/90 text-white opacity-0 transition hover:border-nt-cyan focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan disabled:pointer-events-none disabled:opacity-20 group-hover:opacity-100 md:inline-flex">
              <ChevronLeft size={22} />
            </button>
            <button type="button" aria-label="Ver próximos jogos" disabled={!canGoForward} onClick={() => scrollCarousel(1)} className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/90 text-white opacity-0 transition hover:border-nt-cyan focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan disabled:pointer-events-none disabled:opacity-20 group-hover:opacity-100 md:inline-flex">
              <ChevronRight size={22} />
            </button>
          </>
        ) : null}
        <div ref={scrollRef} tabIndex={0} className="flex gap-4 overflow-x-auto scroll-smooth pb-3 outline-none [scrollbar-width:thin] [scrollbar-color:#38bdf8_#0f172a] snap-x snap-mandatory focus-visible:ring-2 focus-visible:ring-nt-cyan">
          {games.map((game) => <GameBenchmarkCard key={game.id} game={game} />)}
          <BenchmarkRequestCard pc={pc} />
        </div>
      </div>
    </section>
  );
}

function PcDetail({ pc }) {
  const available = Number(pc.stock || 0) >= 1;
  const targetUses = pcList(pc.targetUses);
  const benchmark = normalizeProductBenchmark(pc);
  const recommendedGames = benchmark.benchmarkGames.length ? [] : pcList(pc.recommendedGames);
  const qualityChecks = pcList(pc.qualityChecks);
  const whatsappShareUrl = "https://wa.me/?text=" + encodeURIComponent(pcShareMessage(pc));
  const specs = [
    ["Processador", pc.processor],
    ["Cooler do processador", pc.processorCooler],
    ["Placa-mãe", pc.motherboard],
    ["Memória RAM", pc.memory],
    ["SSD / armazenamento", pc.storage],
    ["HD adicional", pc.hardDrive],
    ["Placa de vídeo", pc.graphicsCard],
    ["Fonte", pc.powerSupply],
    ["Gabinete", pc.caseModel],
    ["Ventoinhas", pc.fans],
    ["Refrigeração", pc.cooling],
    ["Sistema operacional", pc.operatingSystem],
    ["Windows", pc.windowsIncluded ? (pc.windowsVersion || "Incluso") : "Não informado"],
    ["Office", pc.officeIncluded ? "Incluso" : "Não informado"],
    ["Wi-Fi", pc.wifi ? "Sim" : "Não informado"],
    ["Bluetooth", pc.bluetooth ? "Sim" : "Não informado"],
    ["RGB", pc.rgb ? "Sim" : "Não informado"],
    ["Garantia", pc.warranty || (pc.warrantyMonths ? String(pc.warrantyMonths) + " meses" : "")],
  ].filter(([, value]) => Boolean(value));

  return (
    <Section eyebrow={pcTypeLabel(pc.pcType)} title={pc.name} description={pc.shortDescription}>
      <a href="/computadores" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-nt-cyan outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-nt-cyan" aria-label="Voltar para computadores">← Voltar para computadores</a>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <PcImageGallery pc={pc} />
        <Card>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-nt-cyan/30 bg-nt-cyan/10 px-3 py-1 text-xs font-bold text-nt-cyan">{pc.category || pcTypeLabel(pc.pcType)}</span>
            <span className={'inline-flex rounded-full border px-3 py-1 text-xs font-bold ' + (available ? "border-lime-300/30 bg-lime-300/10 text-lime-200" : "border-red-300/30 bg-red-300/10 text-red-200")}>{available ? "Em estoque" : "Esgotado"}</span>
          </div>
          <PcPriceBlock pc={pc} detail />
          <p className="mt-5 text-sm leading-6 text-slate-300">{pc.fullDescription || pc.shortDescription || "Computador montado e revisado pela NT Informática."}</p>
          <div className="mt-6 grid gap-3">
            {available ? <Button href={whatsappLink(pcWhatsappMessage(pc))} className="w-full">Comprar pelo WhatsApp</Button> : <WhatsAppButton message={'Olá! Gostaria de consultar disponibilidade do computador ' + pc.name + '.'} className="w-full">Consultar disponibilidade</WhatsAppButton>}
            <PcShareButton pc={pc} />
            <Button href={whatsappShareUrl} variant="secondary" className="w-full">Compartilhar no WhatsApp</Button>
            <Button href="/computadores" variant="secondary" className="w-full">Voltar para computadores</Button>
          </div>
        </Card>
      </div>
      <Card className="mt-8">
        <h2 className="text-2xl font-black text-white">Especificações completas</h2>
        <dl className="mt-5 grid gap-3 md:grid-cols-2">
          {specs.map(([label, value]) => <div key={label} className="rounded-md border border-white/10 bg-white/5 p-4"><dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</dt><dd className="mt-2 font-semibold text-white">{value}</dd></div>)}
        </dl>
      </Card>
      <BenchmarkSection pc={pc} />
      {(targetUses.length || recommendedGames.length || qualityChecks.length) ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {targetUses.length ? <Card><h2 className="text-xl font-black text-white">Indicado para</h2><ul className="mt-4 grid gap-2 text-sm text-slate-300">{targetUses.map((item) => <li key={item}>- {item}</li>)}</ul></Card> : null}
          {recommendedGames.length ? <Card><h2 className="text-xl font-black text-white">Jogos recomendados</h2><ul className="mt-4 grid gap-2 text-sm text-slate-300">{recommendedGames.map((item) => <li key={item}>- {item}</li>)}</ul></Card> : null}
          {qualityChecks.length ? <Card><h2 className="text-xl font-black text-white">Padrão NT</h2><ul className="mt-4 grid gap-2 text-sm text-slate-300">{qualityChecks.map((item) => <li key={item}>- {item}</li>)}</ul></Card> : null}
        </div>
      ) : null}
    </Section>
  );
}

function PcNotFound({ slug }) {
  return (
    <Section eyebrow="PCs Montados" title="Computador não encontrado." description="O computador solicitado não está disponível no catálogo público ou o link foi alterado.">
      <Card className="max-w-2xl">
        <p className="text-sm leading-6 text-slate-300">
          Verifique o endereço acessado ou consulte a NT Informática para confirmar disponibilidade.
          {slug ? <span className="mt-2 block text-slate-400">Código pesquisado: {slug}</span> : null}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button href="/computadores" variant="secondary">Ver computadores</Button>
          <WhatsAppButton message="Olá! Gostaria de consultar computadores montados disponíveis na NT Informática.">Consultar no WhatsApp</WhatsAppButton>
        </div>
      </Card>
    </Section>
  );
}

function ComputersPage({ path, onNavigate, getNavHref }) {
  const { pcs, loading, error, localMode } = usePublicPcs();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [pcType, setPcType] = useState("Todos");
  const [sort, setSort] = useState("relevance");
  const slug = getComputerSlugFromPath(path || window.location.pathname);
  const selectedPc = slug ? pcs.find((pc) => pc.slug === slug || pc.id === slug) : null;

  const filteredPcs = useMemo(() => sortPcs(pcs.filter((pc) => {
    const matchSearch = [pc.name, pc.internalCode, pc.processor, pc.graphicsCard, pc.memory, pc.storage, pc.shortDescription].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "Todas" || pc.category === category;
    const matchType = pcType === "Todos" || pc.pcType === pcType;
    return matchSearch && matchCategory && matchType;
  }), sort), [pcs, search, category, pcType, sort]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header onNavigate={onNavigate} getNavHref={getNavHref} />
      <main className="pt-20">
        {loading ? <Section eyebrow="PCs Montados" title="Carregando computadores..."><p className="rounded-lg border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Buscando PCs publicados no Supabase.</p></Section> : error ? (
          <Section eyebrow="PCs Montados" title="Falha ao carregar computadores." description="Não foi possível consultar os PCs publicados agora. Tente novamente em instantes ou chame a NT Informática pelo WhatsApp.">
            <Card className="max-w-2xl">
              <p className="text-sm leading-6 text-slate-300">{error}</p>
              {slug ? <p className="mt-3 text-xs text-slate-500">Código pesquisado: {slug}</p> : null}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button href="/computadores" variant="secondary">Tentar novamente</Button>
                <WhatsAppButton message="Olá! Gostaria de consultar computadores montados disponíveis na NT Informática.">Consultar no WhatsApp</WhatsAppButton>
              </div>
            </Card>
          </Section>
        ) : selectedPc ? <PcDetail pc={selectedPc} /> : slug ? <PcNotFound slug={slug} /> : (
          <Section eyebrow="PCs Montados" title="Computadores prontos da NT Informática" description="Filtre por tipo, compare configurações e chame no WhatsApp para comprar.">
            {(error || localMode) ? <div className="mb-6 rounded-lg border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">{error || "Supabase não configurado. Nenhum PC real será exibido no modo local."}</div> : null}
            <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-4 lg:grid-cols-[1fr_0.5fr_0.5fr_0.45fr]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, código, processador, memória ou placa de vídeo" className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan" />
              <select value={pcType} onChange={(event) => setPcType(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"><option value="Todos">Todos os tipos</option>{pcTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"><option>Todas</option>{pcCategories.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-nt-cyan"><option value="relevance">Relevância</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select>
            </div>
            <p className="mt-4 text-sm text-slate-400">{filteredPcs.length} computador(es) encontrado(s). Disponíveis aparecem primeiro.</p>
            <div className="mt-6 grid gap-5 lg:grid-cols-3">{filteredPcs.map((pc) => <PcCard key={pc.id} pc={pc} />)}</div>
            {!error && !filteredPcs.length ? <Card className="mt-6 text-center"><h2 className="text-2xl font-black text-white">Nenhum computador encontrado.</h2><p className="mt-3 text-sm text-slate-300">Ajuste os filtros ou consulte a loja para montar uma configuração sob medida.</p><WhatsAppButton message="Olá! Gostaria de consultar computadores montados disponíveis ou montar uma configuração." className="mt-5">Consultar no WhatsApp</WhatsAppButton></Card> : null}
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
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [pendingSection, setPendingSection] = useState(null);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (currentPath !== "/" || !pendingSection) return;

    const frame = window.requestAnimationFrame(() => {
      if (pendingSection === "inicio") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        document.getElementById(pendingSection)?.scrollIntoView({ behavior: "smooth" });
      }
      setPendingSection(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentPath, pendingSection]);

  const getNavHref = (id) => {
    if (currentPath.startsWith("/computadores") && id === "arena") return arenaBookingUrl;
    if (currentPath.startsWith("/computadores") && id === "produtos") return "/produtos";
    return id === "inicio" ? "/" : `/#${id}`;
  };

  const handleNavigation = (id, event) => {
    if (id === "arena" || id === "produtos") return;

    event?.preventDefault();
    const nextUrl = id === "inicio" ? "/" : `/#${id}`;
    window.history.pushState({}, "", nextUrl);
    setCurrentPath("/");
    setPendingSection(id);
  };

  if (currentPath.startsWith("/admin")) {
    return <AdminApp />;
  }

  if (currentPath.startsWith("/computadores")) {
    return <ComputersPage path={currentPath} onNavigate={handleNavigation} getNavHref={getNavHref} />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header onNavigate={handleNavigation} getNavHref={getNavHref} />
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
