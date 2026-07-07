export function Card({ children, className = "" }) {
  return <div className={`glass motion-card rounded-lg p-6 shadow-card ${className}`}>{children}</div>;
}

export function IconBadge({ icon: Icon }) {
  return (
    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-nt-cyan/40 bg-nt-cyan/10 text-nt-cyan">
      <Icon size={24} />
    </div>
  );
}
