import Link from 'next/link';
import { FighterRatingWithFighter } from '@/data/lib/definitions';

// No champion-pinning here -- Pound-for-Pound isn't a division with an
// official titleholder to pin, just the top raw display_score across
// divisions (see the design spec's "Pound-for-Pound" section) -- plain rank
// order throughout.
export default function PoundForPoundList({ fighters, title }: { fighters: FighterRatingWithFighter[]; title: string }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-card p-4">
      <h3 className="mb-2 font-display text-sm uppercase tracking-wide text-ink-secondary">{title}</h3>
      {fighters.map((fighter, i) => (
        <div key={fighter.id} className="flex items-center gap-3 border-b border-base-border py-2 last:border-b-0">
          <span className="w-8 shrink-0 text-center font-display text-xs uppercase tracking-wide text-accent">#{i + 1}</span>
          <span className="flex-1 text-sm text-ink-primary">
            <Link href={`/fighters/${fighter.fighter_id}`} className="hover:text-accent">
              {fighter.fighter_name}
            </Link>
          </span>
          <span className="text-xs text-ink-secondary">{fighter.weight_class}</span>
          <span className="w-14 shrink-0 text-right font-display text-sm text-ink-primary">{Number(fighter.display_score).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}
