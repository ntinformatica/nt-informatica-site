import { navLinks, socialLinks } from "../data/siteData";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/40 py-10">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-lg font-black text-white">NT Informática, Celulares e Games</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Assistência técnica, produtos, PCs gamers e NT Arena Gamer.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-nt-cyan">Links rápidos</p>
          <div className="grid gap-2">
            {navLinks.map(([label, id]) => (
              <a key={id} href={`#${id}`} className="text-sm text-slate-400 hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-nt-cyan">Redes sociais</p>
          <div className="grid gap-2 text-sm">
            <a href={socialLinks.instagram} className="text-slate-400 hover:text-white" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href={socialLinks.youtubeInfo} className="text-slate-400 hover:text-white" target="_blank" rel="noreferrer">
              YouTube NT Informática
            </a>
            <a href={socialLinks.youtubeGaming} className="text-slate-400 hover:text-white" target="_blank" rel="noreferrer">
              YouTube NT Gaming
            </a>
            <a href={socialLinks.tiktok} className="text-slate-400 hover:text-white" target="_blank" rel="noreferrer">
              TikTok
            </a>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-7xl px-4 text-xs text-slate-500 sm:px-6 lg:px-8">
        © {new Date().getFullYear()} NT Informática, Celulares e Games. Todos os direitos reservados.
      </p>
    </footer>
  );
}
