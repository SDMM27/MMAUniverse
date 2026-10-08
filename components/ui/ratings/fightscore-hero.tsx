import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { FighterRatingWithFighter, FightScoreSummary } from '@/data/lib/definitions';
import { formatScore, formatUpdatedAt, StreakBadge } from './fightscore-parts';
import { fighterHref } from '@/data/lib/slug';

// The homepage's opening section: FightScore is the site's flagship feature
// (see docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md),
// so the page opens on the pitch plus the current pound-for-pound #1, ahead
// of events and news.
export default function FightScoreHero({ leader, summary }: { leader: FighterRatingWithFighter | null; summary: FightScoreSummary | null }) {
  const updatedAt = formatUpdatedAt(summary?.updated_at ?? null);

  return (
    <section className="relative overflow-hidden border-b border-base-border">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,59,48,0.18),transparent_60%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 md:py-16 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-display text-xs uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            FightScore · UFC
          </span>
          <h1 className="mt-5 font-display text-4xl uppercase leading-[0.95] text-ink-primary sm:text-5xl lg:text-6xl">
            Le classement MMA <span className="text-accent">calculé</span>, pas décrété.
          </h1>
          <p className="mt-5 max-w-xl text-base text-ink-secondary">
            Chaque combat UFC passé au crible : dominance round par round, niveau des adversaires battus, activité. Le
            résultat : un score sur 100 dans chaque catégorie, recalculé chaque lundi, après les combats du week-end.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/classement-calcule"
              className="rounded-md bg-accent px-5 py-2.5 font-display text-sm uppercase tracking-wide text-white transition-opacity hover:opacity-90"
            >
              Voir le classement
            </Link>
            <Link
              href="/classement-calcule/methodologie"
              className="rounded-md border border-base-border px-5 py-2.5 font-display text-sm uppercase tracking-wide text-ink-primary transition-colors hover:border-accent hover:text-accent"
            >
              Comment ça marche
            </Link>
          </div>

          {summary && (
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-base-border pt-6">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-secondary">Combattants classés</dt>
                <dd className="mt-1 font-display text-2xl text-ink-primary">{summary.ranked_count}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-secondary">Catégories</dt>
                <dd className="mt-1 font-display text-2xl text-ink-primary">{summary.division_count}</dd>
              </div>
              {updatedAt && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-ink-secondary">Mis à jour</dt>
                  <dd className="mt-1 font-display text-2xl text-ink-primary">{updatedAt}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {leader && (
          <Link
            href={fighterHref({ id: leader.fighter_id, name: leader.fighter_name })}
            className="group relative mx-auto block aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-base-border transition-colors hover:border-accent"
          >
            <CoverImage
              src={leader.fighter_image_url}
              alt={leader.fighter_name}
              className="absolute inset-0"
              sizes="(max-width: 1024px) 90vw, 384px"
              objectPosition="top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <span className="absolute left-4 top-4 rounded bg-accent px-2.5 py-1 font-display text-xs uppercase tracking-widest text-white">
              N°1 pound-for-pound
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-xs uppercase tracking-widest text-ink-secondary">{leader.weight_class}</p>
              <p className="mt-1 flex items-center gap-2 font-display text-3xl uppercase leading-none text-white group-hover:text-accent">
                <CountryFlag code={leader.fighter_nationality} className="shrink-0 text-lg" />
                {leader.fighter_name}
              </p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-ink-secondary">FightScore</p>
                  <p className="font-display text-5xl leading-none text-accent">{formatScore(leader.display_score)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StreakBadge streak={leader.current_streak} />
                  {leader.style_archetype && <span className="text-xs text-ink-secondary">{leader.style_archetype}</span>}
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
