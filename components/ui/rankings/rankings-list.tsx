import Link from 'next/link';
import { groupRankingsByWeightClass } from '@/data/lib/ranking-utils';
import { RankingWithFighter } from '@/data/lib/definitions';
import { fighterHref } from '@/data/lib/slug';
import { OctBadge } from '@/components/ui/fx/octagon';

// Reuses the ranking-pill convention already established (until now, dead --
// fighters.ranking was always 0) on the fighter detail page.
function RankingRow({ ranking }: { ranking: RankingWithFighter }) {
  const champion = ranking.rank === 0;
  return (
    <div
      className={`fx-row flex items-center gap-3 border px-3 py-2 ${
        champion ? 'border-accent bg-accent/10' : 'border-transparent border-b-line'
      }`}
    >
      <OctBadge tone={champion ? 'accent' : 'muted'} size={36}>
        {champion ? 'C' : ranking.rank}
      </OctBadge>
      <span className="min-w-0 flex-1 text-sm text-ink [overflow-wrap:anywhere]">
        {ranking.fighter_id ? (
          <Link
            href={fighterHref({ id: ranking.fighter_id, name: ranking.fighter_name })}
            className="-my-2 flex min-h-11 items-center py-2 font-display text-base uppercase hover:text-accent-strong"
          >
            {ranking.fighter_name}
          </Link>
        ) : (
          <span className="font-display text-base uppercase">{ranking.fighter_name}</span>
        )}
      </span>
    </div>
  );
}

export default function RankingsList({ rankings }: { rankings: RankingWithFighter[] }) {
  const groups = groupRankingsByWeightClass(rankings);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.weightClass} className="border border-line bg-surface p-4">
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">{group.weightClass}</h2>
          {group.champion && <RankingRow ranking={group.champion} />}
          {group.contenders.map((ranking) => (
            <RankingRow key={ranking.id} ranking={ranking} />
          ))}
        </div>
      ))}
    </div>
  );
}
