import CountUp from '@/components/ui/fx/count-up';
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
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase text-muted">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 whitespace-nowrap font-bold text-ink">
          {count} · {percentage}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden bg-surface-2">
        <div className={`fx-bar h-full ${barColorClass}`} style={{ width: `${percentage}%` }} />
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
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-baseline gap-2">
        <span className={`px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${badgeClass}`}>
          {label}
        </span>
        <CountUp value={String(total)} className="font-display text-5xl leading-none text-ink sm:text-6xl" />
      </div>
      <MethodRow label="KO/TKO" count={methods.koTko} total={total} barColorClass={barColorClass} />
      <MethodRow label="Soumissions" count={methods.submission} total={total} barColorClass={barColorClass} />
      <MethodRow label="Décisions" count={methods.decision} total={total} barColorClass={barColorClass} />
    </div>
  );
}

// No outer border/background of its own — it's embedded straight into the
// fighter page's hero card (app/fighters/[slug]/page.tsx), which already
// supplies that container.
export default function FighterRecordCard({ stats }: { stats: FighterStats }) {
  return (
    <div>
      {stats.draws > 0 && (
        <p className="mb-3 font-mono text-[11px] uppercase text-muted">
          {stats.wins}-{stats.losses} · {stats.draws} nul{stats.draws > 1 ? 's' : ''}
        </p>
      )}
      <div className="flex gap-4">
        <RecordColumn
          label="Victoires"
          total={stats.wins}
          methods={stats.winMethods}
          badgeClass="bg-live text-[#04140a]"
          barColorClass="bg-live"
        />
        <div className="w-px bg-line" />
        <RecordColumn
          label="Défaites"
          total={stats.losses}
          methods={stats.lossMethods}
          badgeClass="bg-accent text-accent-ink"
          barColorClass="bg-accent"
        />
      </div>
    </div>
  );
}
