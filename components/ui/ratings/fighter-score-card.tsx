import Link from 'next/link';
import { FighterRatingWithFighter, QualityWin } from '@/data/lib/definitions';

type RatingWithRank = FighterRatingWithFighter & { division_rank: string };

// Embedded straight into the fighter page's hero card (app/fighters/[slug]/page.tsx),
// same convention as FighterRecordCard -- no outer border/background of its
// own. Shows the FightScore, division rank, style archetype, and quality
// wins (the explicit "adversaire bien classé" signal, see
// fetchQualityWinsByFighterId's own doc comment) -- surfaced directly next
// to the record, not buried behind a link, per the plan's own instruction.
export default function FighterScoreCard({ ratings, qualityWins }: { ratings: RatingWithRank[]; qualityWins: QualityWin[] }) {
  if (ratings.length === 0) return null;

  return (
    <div className="mt-4 border-t border-base-border pt-4">
      <h2 className="mb-2 font-display text-xs uppercase tracking-wide text-ink-secondary">FightScore</h2>
      <div className="flex flex-col gap-2">
        {ratings.map((rating) => (
          <div key={rating.id} className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-accent/15 px-2 py-0.5 font-display text-xs uppercase tracking-wide text-accent">
              {rating.is_champion ? 'Champion' : `#${rating.division_rank}`} {rating.weight_class}
            </span>
            <span className="font-display text-lg text-ink-primary">{Number(rating.display_score).toFixed(1)}</span>
            {rating.style_archetype && (
              <span className="rounded border border-base-border px-2 py-0.5 text-xs text-ink-secondary">{rating.style_archetype}</span>
            )}
          </div>
        ))}
      </div>

      {qualityWins.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-ink-secondary">Victoires notables</p>
          <ul className="flex flex-col gap-1">
            {qualityWins.map((win) => (
              <li key={win.id} className="text-sm text-ink-primary">
                Battu <span className="font-semibold">{win.opponent_name}</span>
                <span className="text-ink-secondary"> · {win.event_name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/classement-calcule/methodologie" className="mt-2 inline-block text-xs text-accent hover:underline">
        Comment ce score est calculé
      </Link>
    </div>
  );
}
