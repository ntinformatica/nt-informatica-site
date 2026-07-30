import { LogOut, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
import logoNt from "../assets/nt-informatica-logo.jpg";
import { useCustomerAuth } from "../customer/CustomerAuthContext";
import { navLinks } from "../data/siteData";
import { WhatsAppButton } from "./Button";

const contactMessage = "Olá, gostaria de falar com a NT Informática, Celulares e Games.";

export function Header({ onNavigate, getNavHref }) {
  const [open, setOpen] = useState(false);
  const auth = useCustomerAuth();
  const hrefFor = (id) => getNavHref ? getNavHref(id) : `#${id}`;
  const customerName = auth.profile?.full_name?.split(" ")[0] || auth.user?.user_metadata?.full_name?.split(" ")[0] || auth.user?.email?.split("@")[0] || "cliente";
  const handleNavigate = (id, event) => {
    setOpen(false);
    if (onNavigate) onNavigate(id, event);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-nt-ink/86 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href={hrefFor("inicio")} className="flex items-center gap-3" onClick={(event) => handleNavigate("inicio", event)}>
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
            <a key={id} href={hrefFor(id)} className="text-sm font-semibold text-slate-300 transition hover:text-white" onClick={(event) => handleNavigate(id, event)}>
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {auth.authenticated ? (
            <>
              <span className="max-w-[140px] truncate text-sm font-bold text-slate-300">Olá, {customerName}</span>
              <a href="/minha-conta" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-600 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:border-nt-cyan hover:bg-nt-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nt-cyan">
                <UserRound size={17} /> Minha Conta
              </a>
              <button type="button" onClick={auth.signOut} className="grid h-11 w-11 place-items-center rounded-md border border-white/10 text-slate-300 transition hover:border-red-300/40 hover:bg-red-400/10 hover:text-red-100" aria-label="Sair">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="text-sm font-bold text-slate-300 transition hover:text-white">Entrar</a>
              <a href="/cadastro" className="inline-flex min-h-11 items-center justify-center rounded-md bg-nt-blue px-4 py-2 text-sm font-black text-white shadow-glow transition hover:bg-nt-cyan">Cadastrar</a>
            </>
          )}
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
                href={hrefFor(id)}
                className="rounded-md px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5"
                onClick={(event) => handleNavigate(id, event)}
              >
                {label}
              </a>
            ))}
            {auth.authenticated ? (
              <div className="mt-2 grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-bold text-slate-300">Olá, {customerName}</p>
                <a href="/minha-conta" className="rounded-md px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5">Minha Conta</a>
                <a href="/minha-conta/pedidos" className="rounded-md px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5">Meus Pedidos</a>
                <button type="button" onClick={() => { setOpen(false); auth.signOut(); }} className="rounded-md px-3 py-3 text-left text-sm font-semibold text-red-100 hover:bg-red-400/10">Sair</button>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a href="/login" className="rounded-md border border-white/10 px-3 py-3 text-center text-sm font-bold text-slate-200 hover:bg-white/5">Entrar</a>
                <a href="/cadastro" className="rounded-md bg-nt-blue px-3 py-3 text-center text-sm font-black text-white">Cadastrar</a>
              </div>
            )}
            <WhatsAppButton message={contactMessage} className="mt-2 w-full" />
          </nav>
        </div>
      )}
    </header>
  );
}
