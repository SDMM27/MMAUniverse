// components/ui/picks/pick-result.tsx
import type { FightWithFighters, MethodCategory } from '@/data/lib/definitions';
import type { StoredPick } from '@/data/lib/picks-data';
import { scorePick } from '@/data/lib/scoring';

const methodLabels: Record<MethodCategory, string> = {
  ko_tko: 'KO / TKO',
  submission: 'Soumission',
  decision: 'Décision',
};

export default function PickResult({
  fight,
  pick,
}: {
  fight: FightWithFighters;
  pick: StoredPick | null;
}) {
  // Same reasoning as PickForm: don't render nothing, say why there's nothing to show.
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <p className="rounded-lg border border-base-border bg-base-card p-4 text-center text-xs text-ink-secondary">
        Pronostic indisponible : données des combattants manquantes.
      </p>
    );
  }

  if (!pick) {
    return (
      <p className="rounded-lg border border-base-border bg-base-card p-4 text-center text-xs text-ink-secondary">
        Aucun pronostic enregistré pour ce combat.
      </p>
    );
  }

  const points = fight.fight_finished
    ? scorePick(
        { predicted_winner_id: pick.predicted_winner_id, predicted_method_category: pick.predicted_method_category, predicted_round: pick.predicted_round },
        { winner_id: fight.winner_id, method: fight.method, round: fight.round },
      )
    : null;

  const predictedWinnerName = pick.predicted_winner_id === fight.fighter1.id ? fight.fighter1.name : fight.fighter2.name;
  const correct = points !== null && points > 0;

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-base-border bg-base-card p-4 text-center">
      <p className="text-xs text-ink-secondary">
        Ton pronostic : <span className="text-ink-primary">{predictedWinnerName}</span> par {methodLabels[pick.predicted_method_category]}
        {pick.predicted_round ? ` au round ${pick.predicted_round}` : ''}
      </p>
      {points !== null && (
        <p className={`font-display text-sm uppercase tracking-wide ${correct ? 'text-win' : 'text-accent'}`}>
          {correct ? `Correct — +${points} pts` : 'Incorrect — 0 pt'}
        </p>
      )}
    </div>
  );
}
