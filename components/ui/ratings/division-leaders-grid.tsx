import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { groupFighterRatingsByWeightClass, sortWeightClassGroups } from '@/data/lib/rating/order-division';
import { formatScore, weightClassSlug } from './fightscore-parts';

// Homepage overview: one card per division, headed by its FightScore #1
// (plain score order -- the champion-pinning convention belongs to the full
// ranking page) with #2/#3 below, and the belt holder named when it isn't
// the FightScore leader, the most talked-about case. Expects the rows
// fetchAllFighterRatings returns (score-descending per division, champion
// always included).
export default function DivisionLeadersGrid({ ratings, shownPerDivision = 3 }: { ratings: FighterRatingWithFighter[]; shownPerDivision?: number }) {
  const groups = sortWeightClassGroups(groupFighterRatingsByWeightClass(ratings));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((group) => {
        const ranked = [...group.fighters].sort((a, b) => Number(b.display_score) - Number(a.display_score));
        const [leader, ...rest] = ranked.slice(0, shownPerDivision);
        const champion = group.fighters.find((f) => f.is_champion) ?? null;
        if (!leader) return null;

        return (
          <div key={group.weightClass} className="flex flex-col overflow-hidden rounded-xl border border-base-border bg-base-card">
            <Link
              href={`/classement-calcule#${weightClassSlug(group.weightClass)}`}
              className="flex items-center justify-between border-b border-base-border px-4 py-2.5 font-display text-xs uppercase tracking-widest text-ink-secondary hover:text-accent"
            >
              {group.weightClass}
              <span aria-hidden="true">→</span>
            </Link>

            <Link href={`/fighters/${leader.fighter_id}`} className="group flex gap-3 px-4 py-3">
              <CoverImage
                src={leader.fighter_image_url}
                alt={leader.fighter_name}
                className="h-16 w-14 shrink-0 rounded-lg"
                sizes="56px"
                objectPosition="top"
              />
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <p className="break-words text-sm font-semibold leading-tight text-ink-primary group-hover:text-accent">
                  <CountryFlag code={leader.fighter_nationality} className="mr-1.5 text-xs" />
                  {leader.fighter_name}
                </p>
                <div className="flex items-end justify-between gap-2">
                  <span className="font-display text-[11px] uppercase tracking-wide text-ink-secondary">
                    {leader.is_champion ? 'Champion' : 'N°1'}
                  </span>
                  <span className="font-display text-2xl leading-none text-accent">{formatScore(leader.display_score)}</span>
                </div>
              </div>
            </Link>

            <ol className="flex-1 px-4 pb-2">
              {rest.map((fighter, i) => (
                <li key={fighter.id} className="flex items-center gap-2 border-t border-base-border py-1.5 text-sm">
                  <span className="w-4 font-display text-xs text-ink-secondary">{i + 2}</span>
                  <Link href={`/fighters/${fighter.fighter_id}`} className="flex-1 truncate text-ink-primary hover:text-accent">
                    {fighter.fighter_name}
                  </Link>
                  <span className="font-display text-xs text-ink-secondary">{formatScore(fighter.display_score)}</span>
                </li>
              ))}
            </ol>

            {champion && !leader.is_champion && (
              <p className="border-t border-base-border bg-white/[0.02] px-4 py-2 text-xs text-ink-secondary">
                Ceinture :{' '}
                <Link href={`/fighters/${champion.fighter_id}`} className="text-ink-primary hover:text-accent">
                  {champion.fighter_name}
                </Link>{' '}
                ({formatScore(champion.display_score)})
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
