import Link from 'next/link';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { FighterRatingWithFighter, FightScoreSummary } from '@/data/lib/definitions';
import { formatScore, formatUpdatedAt } from './fightscore-parts';
import { fighterHref } from '@/data/lib/slug';
import CountUp from '@/components/ui/fx/count-up';
import RecomputeCountdown from '@/components/ui/fx/recompute-countdown';

// The homepage's opening section, "fight night" poster style: FightScore is
// the site's flagship feature (see
// docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md), so
// the page opens on the pitch, the live countdown to Monday's recompute and
// the current pound-for-pound #1 in a spinning octagon.
export default function FightScoreHero({ leader }: { leader: FighterRatingWithFighter | null }) {
  return (
    <section className="relative">
      {/* Slanted slab behind the hero and the glint sweeping across it. */}
      <div aria-hidden="true" className="absolute inset-y-5 left-[38%] w-[46%] -skew-x-[14deg] bg-accent/10" />
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="fx-glint" />
      </div>

      <div className="relative flex flex-wrap items-center gap-10 py-10 sm:py-14">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
          <p className="inline-flex items-center gap-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
            <span className="fx-live h-2.5 w-2.5 rounded-full bg-accent" />
            FightScore · UFC
          </p>
          <h1 className="font-display text-[clamp(3rem,8.4vw,7rem)] uppercase leading-[0.88] text-ink">
            Le classement MMA{' '}
            <span className="relative inline-block text-accent-strong">
              calculé
              <span aria-hidden="true" className="fx-underline absolute inset-x-0 bottom-1 h-2 bg-accent" />
            </span>
            , pas décrété.
          </h1>
          <p className="max-w-[52ch] text-base leading-relaxed text-muted sm:text-lg">
            Chaque combat UFC passé au crible : dominance round par round, niveau des adversaires battus, activité. Le
            résultat : un score sur 100 dans chaque catégorie, recalculé chaque lundi, après les combats du week-end.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/classement-calcule"
              className="fx-cut inline-flex min-h-11 items-center bg-accent px-6 py-3 font-display text-xl uppercase tracking-[0.04em] text-accent-ink transition-transform duration-base ease-spring hover:-translate-y-0.5"
            >
              Voir le classement
            </Link>
            <Link
              href="/classement-calcule/methodologie"
              className="inline-flex min-h-11 items-center border-2 border-ink px-6 py-3 font-display text-xl uppercase tracking-[0.04em] text-ink transition-colors hover:border-accent hover:text-accent-strong"
            >
              Comment ça marche
            </Link>
          </div>
          <RecomputeCountdown />
        </div>

        {leader && (
          <Link
            href={fighterHref({ id: leader.fighter_id, name: leader.fighter_name })}
            aria-label={`Numéro 1 pound-for-pound : ${leader.fighter_name}, FightScore ${formatScore(leader.display_score)}`}
            className="fx-in-right group mx-auto flex min-w-0 max-w-[420px] flex-[1_1_300px] flex-col items-center gap-2.5 text-center"
          >
            <span className="relative block w-full max-w-[300px]">
              <svg aria-hidden="true" viewBox="0 0 300 300" className="h-auto w-full">
                <polygon
                  className="fx-spin"
                  points="98,14 202,14 286,98 286,202 202,286 98,286 14,202 14,98"
                  fill="none"
                  stroke="var(--sd-accent)"
                  strokeWidth="2"
                  strokeDasharray="10 8"
                />
                <polygon
                  points="108,38 192,38 262,108 262,192 192,262 108,262 38,192 38,108"
                  fill="var(--sd-surface)"
                  stroke="var(--sd-line)"
                  strokeWidth="2"
                  className="transition-[stroke] group-hover:[stroke:var(--sd-accent)]"
                />
              </svg>
              {/* HTML over the SVG so the score can count up and use the page fonts. */}
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-[11px] font-bold uppercase text-accent-strong sm:text-xs">N°1 pound-for-pound</span>
                <span className="font-display text-[clamp(3.5rem,11vw,4.5rem)] leading-none text-ink">
                  <CountUp value={formatScore(leader.display_score)} />
                </span>
                <span className="font-mono text-[11px] uppercase text-muted">FightScore</span>
              </span>
            </span>
            <span className="flex items-center gap-2 font-display text-[2.75rem] uppercase leading-[0.9] text-ink group-hover:text-accent-strong">
              <CountryFlag code={leader.fighter_nationality} className="shrink-0 text-2xl" />
              {leader.fighter_name}
            </span>
            <span className="font-mono text-xs uppercase text-muted">
              {[
                leader.weight_class,
                leader.current_streak >= 2 ? `${leader.current_streak} V d'affilée` : null,
                leader.style_archetype,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}

// Headline numbers under the hero, counting up to their (real) value.
export function FightScoreStats({ summary, organizationCount }: { summary: FightScoreSummary | null; organizationCount: number }) {
  const updatedAt = formatUpdatedAt(summary?.updated_at ?? null);
  const stats: { label: string; value: React.ReactNode }[] = [];
  if (summary) {
    stats.push({ label: 'Combattants classés', value: <CountUp value={String(Number(summary.ranked_count))} /> });
    stats.push({ label: 'Catégories', value: <CountUp value={String(Number(summary.division_count))} /> });
  }
  if (organizationCount > 0) stats.push({ label: 'Organisations suivies', value: <CountUp value={String(organizationCount)} /> });
  if (updatedAt) stats.push({ label: 'Mis à jour', value: updatedAt });
  if (stats.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 border-y-2 border-ink md:grid-cols-4">
      {stats.map((stat, i) => (
        <div key={stat.label} className={`px-4 py-4 sm:px-5 ${i % 2 === 1 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line md:border-t-0' : ''} md:border-l md:first:border-l-0`}>
          <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{stat.label}</dt>
          <dd className="mt-1.5 font-display text-[clamp(2.5rem,6vw,3.5rem)] uppercase leading-[0.9] text-ink">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
