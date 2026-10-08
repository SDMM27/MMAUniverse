import type { CareerStats } from '@/data/lib/career-stats';

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const fmtRate = (value: number) => decimal.format(value);
const fmtPercent = (ratio: number | null) => (ratio === null ? '—' : `${percent.format(ratio * 100)} %`);
const fmtDuration = (seconds: number | null) =>
  seconds === null ? '—' : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-bg/40 p-3">
      <p className="font-display text-xl text-ink-primary">{value}</p>
      <p className="text-xs uppercase tracking-wide text-ink-secondary">{label}</p>
    </div>
  );
}

function DistributionRow({ label, ratio }: { label: string; ratio: number }) {
  const width = Math.round(ratio * 100);
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-ink-secondary">
        <span>{label}</span>
        <span className="font-semibold text-ink-primary">{width} %</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-base-border">
        <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function FighterCareerStats({ stats }: { stats: CareerStats | null }) {
  if (!stats) return null;
  const { strikeDistribution } = stats;

  return (
    <section className="rounded-lg bg-base-card p-4">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-secondary">Statistiques UFC (source UFCStats)</h2>
      <p className="mb-3 text-xs text-ink-secondary">
        Moyennes de carrière sur {stats.fights} combat{stats.fights > 1 ? 's' : ''} en UFC uniquement.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Frappes sign. / min" value={fmtRate(stats.sigStrikesLandedPerMinute)} />
        <Stat label="Précision frappes" value={fmtPercent(stats.sigStrikeAccuracy)} />
        {stats.sigStrikesAbsorbedPerMinute !== null && (
          <Stat label="Frappes encaissées / min" value={fmtRate(stats.sigStrikesAbsorbedPerMinute)} />
        )}
        <Stat label="Knockdowns" value={String(stats.knockdowns)} />
        <Stat label="Amenées au sol / 15 min" value={fmtRate(stats.takedownsPer15)} />
        <Stat label="Précision amenées" value={fmtPercent(stats.takedownAccuracy)} />
        {stats.takedownDefense !== null && <Stat label="Défense amenées" value={fmtPercent(stats.takedownDefense)} />}
        <Stat label="Soumissions tentées / 15 min" value={fmtRate(stats.submissionAttemptsPer15)} />
        {stats.averageControlSeconds !== null && (
          <Stat label="Contrôle moyen / combat" value={fmtDuration(stats.averageControlSeconds)} />
        )}
        {stats.controlShare !== null && <Stat label="Part du temps en contrôle" value={fmtPercent(stats.controlShare)} />}
      </div>
      {strikeDistribution && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-secondary">Répartition des frappes significatives</p>
          <DistributionRow label="Tête" ratio={strikeDistribution.head} />
          <DistributionRow label="Corps" ratio={strikeDistribution.body} />
          <DistributionRow label="Jambes" ratio={strikeDistribution.leg} />
        </div>
      )}
    </section>
  );
}
