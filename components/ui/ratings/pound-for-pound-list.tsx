import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { FighterRankRow } from './fightscore-parts';

// No champion-pinning here -- Pound-for-Pound isn't a division with an
// official titleholder to pin, just the top raw display_score across
// divisions (see the design spec's "Pound-for-Pound" section) -- plain rank
// order throughout. The #1 is framed in red.
export default function PoundForPoundList({ fighters, title }: { fighters: FighterRatingWithFighter[]; title?: string }) {
  return (
    // min-w-0: inside a grid, the truncated names would otherwise widen the column.
    <div className="min-w-0">
      {title && <h3 className="mb-3 font-display text-2xl uppercase leading-none text-ink">{title}</h3>}
      <ol className="flex flex-col gap-2">
        {fighters.map((fighter, i) => (
          <li key={fighter.id}>
            <FighterRankRow
              fighter={fighter}
              rankLabel={String(i + 1)}
              rank={i + 1}
              highlight={i === 0}
              subtitle={fighter.weight_class}
              index={i}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
