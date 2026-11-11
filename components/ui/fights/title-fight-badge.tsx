export default function TitleFightBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 border-accent bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-accent-strong ${className}`}
    >
      <span aria-hidden="true" className="fx-oct h-2.5 w-2.5 shrink-0 bg-accent" />
      Titre en jeu
    </span>
  );
}
