/** Says which data a figure covers ("UFC uniquement", "Toutes organisations", an organization's name). */
export default function ScopeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-base-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
      {label}
    </span>
  );
}
