export function Section({ id, eyebrow, title, description, children, className = "" }) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${className}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {(eyebrow || title || description) && (
          <div className="mb-10 max-w-3xl">
            {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.28em] text-nt-cyan">{eyebrow}</p>}
            {title && <h2 className="text-balance text-3xl font-black text-white sm:text-4xl">{title}</h2>}
            {description && <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
