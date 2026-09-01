import Link from 'next/link';
import { groupRankingsByWeightClass } from '@/data/lib/ranking-utils';
import { RankingWithFighter } from '@/data/lib/definitions';

// Reuses the ranking-pill convention already established (until now, dead --
// fighters.ranking was always 0) on the fighter detail page.
function RankingRow({ ranking }: { ranking: RankingWithFighter }) {
  return (
    <div className="flex items-center gap-3 border-b border-base-border py-2 last:border-b-0">
      <span className="rounded bg-accent/15 px-2 py-0.5 font-display text-xs uppercase tracking-wide text-accent">
        {ranking.rank === 0 ? 'C' : `#${ranking.rank}`}
      </span>
      <span className="text-sm text-ink-primary">
        {ranking.fighter_id ? (
          <Link href={`/fighters/${ranking.fighter_id}`} className="hover:text-accent">
            {ranking.fighter_name}
          </Link>
        ) : (
          ranking.fighter_name
        )}
      </span>
    </div>
  );
}

export default function RankingsList({ rankings }: { rankings: RankingWithFighter[] }) {
  const groups = groupRankingsByWeightClass(rankings);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.weightClass} className="rounded-lg border border-base-border bg-base-card p-4">
          <h2 className="mb-2 font-display text-sm uppercase tracking-wide text-ink-secondary">{group.weightClass}</h2>
          {group.champion && <RankingRow ranking={group.champion} />}
          {group.contenders.map((ranking) => (
            <RankingRow key={ranking.id} ranking={ranking} />
          ))}
        </div>
      ))}
    </div>
  );
}
