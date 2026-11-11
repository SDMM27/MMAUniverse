import SectionHeading from '@/components/ui/fx/section-heading';
import type { CareerStats } from '@/data/lib/career-stats';

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const fmtRate = (value: number) => decimal.format(value);
const fmtPercent = (ratio: number | null) => (ratio === null ? '—' : `${percent.format(ratio * 100)} %`);
const fmtDuration = (seconds: number | null) =>
  seconds === null ? '—' : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border border-line bg-surface-2 p-3">
      <p className="font-display text-4xl leading-none text-ink">{value}</p>
      <p className="mt-1 font-mono text-[11px] uppercase text-muted">{label}</p>
    </div>
  );
}

function DistributionRow({ label, ratio }: { label: string; ratio: number }) {
  const width = Math.round(ratio * 100);
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase text-muted">
        <span>{label}</span>
        <span className="font-bold text-ink">{width} %</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden bg-surface-2">
        <div className="fx-bar h-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function FighterCareerStats({ stats }: { stats: CareerStats | null }) {
  if (!stats) return null;
  const { strikeDistribution } = stats;

  return (
    <section className="border border-line bg-surface p-4 sm:p-6">
      <SectionHeading title="Statistiques UFC" caption="Source UFCStats" />
      <p className="mb-3 font-mono text-[11px] uppercase text-muted">
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
          <p className="mb-2 font-mono text-[11px] uppercase text-muted">Répartition des frappes significatives</p>
          <DistributionRow label="Tête" ratio={strikeDistribution.head} />
          <DistributionRow label="Corps" ratio={strikeDistribution.body} />
          <DistributionRow label="Jambes" ratio={strikeDistribution.leg} />
        </div>
      )}
    </section>
  );
}
