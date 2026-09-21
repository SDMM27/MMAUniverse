import Link from 'next/link';
import { groupFighterRatingsByWeightClass, orderDivisionWithChampionPinned } from '@/data/lib/rating/order-division';
import { FighterRatingWithFighter } from '@/data/lib/definitions';

// Champion is always pinned to position 1 regardless of display_score (an
// editorial choice, not an artifact of the ranking math -- see the design
// spec's "Position du champion" section) -- so the row itself always shows
// "C" for the champion, and everyone else is numbered by their position in
// the already-champion-pinned array (1, 2, 3... starting right after the
// champion, or from 1 if there's no matched champion yet).
function FightScoreRow({
  fighter,
  position,
  isChampion,
  showAsterisk,
}: {
  fighter: FighterRatingWithFighter;
  position: number | null; // null for the champion row (shows "C" instead)
  isChampion: boolean;
  showAsterisk: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-base-border py-2 last:border-b-0">
      <span className="w-8 shrink-0 rounded bg-accent/15 px-2 py-0.5 text-center font-display text-xs uppercase tracking-wide text-accent">
        {isChampion ? 'C' : `#${position}`}
      </span>
      <span className="flex-1 text-sm text-ink-primary">
        <Link href={`/fighters/${fighter.fighter_id}`} className="hover:text-accent">
          {fighter.fighter_name}
        </Link>
        {isChampion && showAsterisk && (
          <sup className="ml-1 text-accent" title="Porte la ceinture, mais n'a pas le FightScore le plus élevé de la division en ce moment — voir la méthodologie.">
            *
          </sup>
        )}
      </span>
      {fighter.style_archetype && (
        <span className="hidden shrink-0 rounded border border-base-border px-2 py-0.5 text-xs text-ink-secondary sm:inline-block">
          {fighter.style_archetype}
        </span>
      )}
      <span className="w-14 shrink-0 text-right font-display text-sm text-ink-primary">{Number(fighter.display_score).toFixed(1)}</span>
    </div>
  );
}

export default function FightScoreList({ ratings }: { ratings: FighterRatingWithFighter[] }) {
  const groups = groupFighterRatingsByWeightClass(ratings);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const { fighters, championOutranked } = orderDivisionWithChampionPinned(group.fighters);
        const champion = fighters.find((f) => f.is_champion) ?? null;
        const contenders = fighters.filter((f) => !f.is_champion);

        return (
          <div key={group.weightClass} className="rounded-lg border border-base-border bg-base-card p-4">
            <h2 className="mb-2 font-display text-sm uppercase tracking-wide text-ink-secondary">{group.weightClass}</h2>
            {champion && <FightScoreRow fighter={champion} position={null} isChampion={true} showAsterisk={championOutranked} />}
            {contenders.map((fighter, i) => (
              <FightScoreRow key={fighter.id} fighter={fighter} position={i + 1} isChampion={false} showAsterisk={false} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
