import { Menu, X } from "lucide-react";
import { useState } from "react";
import logoNt from "../assets/nt-informatica-logo.jpg";
import { navLinks } from "../data/siteData";
import { WhatsAppButton } from "./Button";

const contactMessage = "Olá, gostaria de falar com a NT Informática, Celulares e Games.";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-nt-ink/86 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#inicio" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-md border border-nt-cyan/35 bg-slate-950 shadow-glow">
            <img src={logoNt} alt="Logo NT Informática" className="h-full w-full object-cover" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black uppercase text-white sm:text-base">NT Informática</span>
            <span className="block text-xs font-semibold text-nt-cyan">Celulares e Games</span>
          </span>
        </a>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map(([label, id]) => (
            <a key={id} href={`#${id}`} className="text-sm font-semibold text-slate-300 transition hover:text-white">
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <WhatsAppButton message={contactMessage} />
        </div>

        <button
          aria-label="Abrir menu"
          className="grid h-11 w-11 place-items-center rounded-md border border-white/15 text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-nt-ink px-4 py-5 lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-3">
            {navLinks.map(([label, id]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-md px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            ))}
            <WhatsAppButton message={contactMessage} className="mt-2 w-full" />
          </nav>
        </div>
      )}
    </header>
  );
}
