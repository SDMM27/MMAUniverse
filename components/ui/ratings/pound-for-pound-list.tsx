import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { FighterRankRow } from './fightscore-parts';

// No champion-pinning here -- Pound-for-Pound isn't a division with an
// official titleholder to pin, just the top raw display_score across
// divisions (see the design spec's "Pound-for-Pound" section) -- plain rank
// order throughout.
export default function PoundForPoundList({ fighters, title }: { fighters: FighterRatingWithFighter[]; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-base-border bg-base-card">
      <h3 className="border-b border-base-border px-4 py-3 font-display text-sm uppercase tracking-widest text-ink-secondary">
        {title}
      </h3>
      {fighters.map((fighter, i) => (
        <FighterRankRow
          key={fighter.id}
          fighter={fighter}
          rankLabel={String(i + 1)}
          rank={i + 1}
          highlight={i === 0}
          subtitle={fighter.weight_class}
        />
      ))}
    </div>
  );
}
