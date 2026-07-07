import { MessageCircle } from "lucide-react";
import { whatsappNumber } from "../data/siteData";

export function whatsappLink(message) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function Button({ href, children, variant = "primary", icon: Icon, className = "" }) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-nt-cyan focus:ring-offset-2 focus:ring-offset-nt-ink";
  const styles =
    variant === "secondary"
      ? "border border-slate-600 bg-white/5 text-white hover:border-nt-cyan hover:bg-nt-cyan/10"
      : "bg-nt-blue text-white shadow-glow hover:bg-nt-cyan";

  return (
    <a href={href} className={`${base} ${styles} ${className}`} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {Icon ? <Icon size={18} /> : null}
      {children}
    </a>
  );
}

export function WhatsAppButton({ message, children = "Falar no WhatsApp", className = "" }) {
  return (
    <Button href={whatsappLink(message)} icon={MessageCircle} className={className}>
      {children}
    </Button>
  );
}
