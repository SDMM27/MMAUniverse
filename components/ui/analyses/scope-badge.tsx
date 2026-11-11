/** Says which data a figure covers ("UFC uniquement", "Toutes organisations", an organization's name). */
export default function ScopeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center border border-line px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-muted">
      {label}
    </span>
  );
}
