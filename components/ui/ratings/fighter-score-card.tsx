import Link from 'next/link';
import CountUp from '@/components/ui/fx/count-up';
import { OctBadge } from '@/components/ui/fx/octagon';
import { FighterRatingWithFighter, QualityWin } from '@/data/lib/definitions';
import { displayEventName } from '@/data/lib/event-utils';
import { ScoreBar, scoreValue } from './fightscore-parts';

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
    <div className="mt-4 border-t border-line pt-4">
      <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">FightScore</h2>
      <div className="flex flex-col gap-4">
        {ratings.map((rating) => (
          <div key={rating.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <OctBadge tone={rating.is_champion ? 'accent' : 'ink'} size={56}>
                {rating.is_champion ? '★' : rating.is_ranking_eligible ? `#${rating.division_rank}` : '—'}
              </OctBadge>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <CountUp value={scoreValue(rating.display_score)} className="font-display text-6xl leading-none text-ink" />
                  <span className="font-mono text-[11px] font-bold uppercase text-muted">
                    {rating.is_champion ? 'Champion' : rating.is_ranking_eligible ? 'Classé' : 'Inactif'} · {rating.weight_class}
                  </span>
                </div>
                <ScoreBar score={rating.display_score} className="mt-2" />
              </div>
            </div>
            {rating.style_archetype && (
              <span className="w-fit border border-line px-2 py-0.5 font-mono text-[11px] uppercase text-muted">{rating.style_archetype}</span>
            )}
            {/* ml_win_probability is NUMERIC -> string at runtime, hence Number(...). Secondary to the FightScore: it complements it, doesn't replace it. Not shown for inactive fighters ("against an average opponent today" doesn't mean much for them). */}
            {rating.ml_win_probability != null && rating.is_ranking_eligible && (
              <p className="text-xs text-muted">
                Probabilité de victoire estimée face à un adversaire moyen de la catégorie (modèle ML) :{' '}
                <span className="font-bold text-ink">{Math.round(Number(rating.ml_win_probability) * 100)}%</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {qualityWins.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 font-mono text-[11px] uppercase text-muted">Victoires notables</p>
          <ul className="flex flex-col gap-1">
            {qualityWins.map((win) => (
              <li key={win.id} className="text-sm text-ink">
                Battu <span className="font-bold">{win.opponent_name}</span>
                <span className="text-muted"> · {displayEventName(win.event_name)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/classement-calcule/methodologie" className="mt-2 inline-flex min-h-11 items-center text-xs text-accent-strong hover:underline">
        Comment ce score est calculé
      </Link>
    </div>
  );
}
