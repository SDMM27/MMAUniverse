import Link from 'next/link';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { groupFighterRatingsByWeightClass, sortWeightClassGroups } from '@/data/lib/rating/order-division';
import { formatScore } from './fightscore-parts';
import { fighterHref } from '@/data/lib/slug';
import { OctBadge, initials } from '@/components/ui/fx/octagon';

// Homepage: one card per division with its belt holder -- or, in a division
// without one, its FightScore #1. Cards lift on hover and the octagon shakes.
// Expects the rows fetchAllFighterRatings returns (champion always included).
export default function ChampionsGrid({ ratings }: { ratings: FighterRatingWithFighter[] }) {
  const groups = sortWeightClassGroups(groupFighterRatingsByWeightClass(ratings));

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
      {groups.map((group) => {
        const champion = group.fighters.find((f) => f.is_champion);
        const top = champion ?? [...group.fighters].sort((a, b) => Number(b.display_score) - Number(a.display_score))[0];
        if (!top) return null;
        return (
          <li key={group.weightClass}>
            <Link
              href={fighterHref({ id: top.fighter_id, name: top.fighter_name })}
              className="fx-card flex h-full items-center gap-3.5 border border-line bg-surface p-4"
            >
              <OctBadge tone="ink" size={56} shake>
                {initials(top.fighter_name)}
              </OctBadge>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent-strong">{group.weightClass}</span>
                <strong className="font-display text-2xl uppercase leading-[0.95] text-ink">{top.fighter_name}</strong>
                <span className="font-mono text-[11px] uppercase text-muted">
                  {champion ? 'Champion' : 'N°1 FightScore'} · {formatScore(top.display_score)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
