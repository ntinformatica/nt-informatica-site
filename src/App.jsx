import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Monitor,
  PlayCircle,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import heroImage from "./assets/hero-nt-gaming.png";
import arenaImage from "./assets/arena-gamer-banner.png";
import { Button, WhatsAppButton, whatsappLink } from "./components/Button";
import { Card, IconBadge } from "./components/Card";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { TechPlaceholder } from "./components/Placeholder";
import { Section } from "./components/Section";
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
  arena: "Olá, gostaria de agendar um horário na Arena Gamer da NT Informática.",
  budget: "Olá, gostaria de solicitar um orçamento para assistência técnica.",
  product: "Olá, tenho interesse neste produto da NT Informática.",
  contact: "Olá, gostaria de falar com a NT Informática.",
};

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
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {productCategories.map(({ name, description, image }) => {
          const categoryUrl = `/produtos?categoria=${encodeURIComponent(name)}`;

          return (
            <a
              key={name}
              href={categoryUrl}
              className="glass motion-card min-w-[150px] snap-start overflow-hidden rounded-lg text-left shadow-card transition hover:border-nt-cyan/60 sm:min-w-0"
            >
              <div className="relative overflow-hidden border-b border-white/10">
                <img src={image} alt={`Categoria ${name}`} className="h-24 w-full object-cover sm:h-auto sm:aspect-[4/3]" />
              </div>
              <div className="p-3 sm:p-5">
                <h3 className="text-sm font-black leading-tight text-white sm:text-lg">{name}</h3>
                <p className="mt-2 hidden text-sm leading-6 text-slate-300 sm:block">{description}</p>
                <span className="mt-3 inline-flex text-xs font-bold text-nt-cyan sm:mt-5 sm:text-sm">Ver produtos</span>
              </div>
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
    <Section id="avaliacoes" eyebrow="Avaliações" title="Depoimentos editáveis de clientes.">
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
            <p className="flex items-center gap-3"><MessageCircle className="text-nt-cyan" /> WhatsApp: editar número no código</p>
            <p className="flex items-center gap-3"><Clock className="text-nt-cyan" /> {contactInfo.hours}</p>
            <p className="flex items-center gap-3"><MapPin className="text-nt-cyan" /> {contactInfo.address}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a href={socialLinks.instagram} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-4 py-2 text-slate-200 hover:border-nt-cyan">Instagram</a>
            <a href={socialLinks.youtubeInfo} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-4 py-2 text-slate-200 hover:border-nt-cyan">YouTube</a>
            <a href={socialLinks.tiktok} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-4 py-2 text-slate-200 hover:border-nt-cyan">TikTok</a>
          </div>
          <WhatsAppButton message={messages.contact} className="mt-8 w-full text-base">Chamar no WhatsApp agora</WhatsAppButton>
        </Card>
        <div className="min-h-[360px] overflow-hidden rounded-lg border border-slate-700 bg-grid bg-[length:28px_28px]">
          <div className="flex h-full min-h-[360px] items-center justify-center bg-gradient-to-br from-nt-blue/20 to-black/30 p-8 text-center">
            <div>
              <MapPin className="mx-auto mb-4 text-nt-cyan" size={42} />
              <p className="text-xl font-black text-white">Mapa placeholder</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">Substitua por um iframe do Google Maps quando o endereço definitivo estiver pronto.</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-nt-ink text-white">
      <Header />
      <Hero />
      <Highlights />
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
