import { FighterStats, MethodBreakdown } from '@/data/lib/definitions';

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function MethodRow({
  label,
  count,
  total,
  barColorClass,
}: {
  label: string;
  count: number;
  total: number;
  barColorClass: string;
}) {
  const percentage = pct(count, total);
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-ink-secondary">
        <span>{label}</span>
        <span className="font-semibold text-ink-primary">
          {count} · {percentage}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-base-border">
        <div className={`h-full rounded-full ${barColorClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function RecordColumn({
  label,
  total,
  methods,
  badgeClass,
  barColorClass,
}: {
  label: string;
  total: number;
  methods: MethodBreakdown;
  badgeClass: string;
  barColorClass: string;
}) {
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-baseline gap-2">
        <span className={`rounded px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wide ${badgeClass}`}>
          {label}
        </span>
        <span className="font-display text-xl text-ink-primary">{total}</span>
      </div>
      <MethodRow label="KO/TKO" count={methods.koTko} total={total} barColorClass={barColorClass} />
      <MethodRow label="Soumissions" count={methods.submission} total={total} barColorClass={barColorClass} />
      <MethodRow label="Décisions" count={methods.decision} total={total} barColorClass={barColorClass} />
    </div>
  );
}

export default function FighterRecordCard({ stats }: { stats: FighterStats }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-card p-4">
      {stats.draws > 0 && (
        <p className="mb-3 text-xs text-ink-secondary">
          {stats.wins}-{stats.losses} · {stats.draws} nul{stats.draws > 1 ? 's' : ''}
        </p>
      )}
      <div className="flex gap-4">
        <RecordColumn
          label="Victoires"
          total={stats.wins}
          methods={stats.winMethods}
          badgeClass="bg-win text-base-bg"
          barColorClass="bg-win"
        />
        <div className="w-px bg-base-border" />
        <RecordColumn
          label="Défaites"
          total={stats.losses}
          methods={stats.lossMethods}
          badgeClass="bg-accent text-ink-primary"
          barColorClass="bg-accent"
        />
      </div>
    </div>
  );
}
