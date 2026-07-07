export function TechPlaceholder({ label = "Imagem do produto", icon: Icon }) {
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-grid bg-[length:24px_24px]">
      <div className="absolute inset-0 bg-gradient-to-br from-nt-blue/25 via-transparent to-white/5" />
      <div className="relative text-center">
        {Icon ? <Icon className="mx-auto mb-3 text-nt-cyan" size={34} /> : null}
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">{label}</p>
      </div>
    </div>
  );
}
