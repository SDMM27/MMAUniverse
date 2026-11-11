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
      <p className="border border-line bg-surface p-4 text-center text-xs text-muted">
        Pronostic indisponible : données des combattants manquantes.
      </p>
    );
  }

  if (!pick) {
    return (
      <p className="border border-line bg-surface p-4 text-center text-xs text-muted">
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
    <div className="flex flex-col items-center gap-1 border border-line bg-surface p-4 text-center">
      <p className="font-mono text-[11px] uppercase text-muted">
        Ton pronostic : <span className="font-bold text-ink">{predictedWinnerName}</span> par {methodLabels[pick.predicted_method_category]}
        {pick.predicted_round ? ` au round ${pick.predicted_round}` : ''}
      </p>
      {points !== null && (
        <p className={`font-display text-lg uppercase ${correct ? 'text-win-strong' : 'text-danger'}`}>
          {correct ? `Correct — +${points} pts` : 'Incorrect — 0 pt'}
        </p>
      )}
    </div>
  );
}
