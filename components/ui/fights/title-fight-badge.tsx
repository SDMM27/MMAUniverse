export default function TitleFightBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border border-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-wide text-amber-400 ${className}`}
    >
      <span aria-hidden="true">🏆</span>
      Titre en jeu
    </span>
  );
}
