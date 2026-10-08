import type { RatingHistoryPoint } from '@/data/lib/fighter-profile-data';
import FighterRatingChart from './fighter-rating-chart';

// Server wrapper around the client chart: hides the section below 2 rated
// fights. The curve is the raw Glicko rating (1500 = a debutant), not the
// 0-100 FightScore shown above -- that one is relative to the division's best
// fighter today, so it can't be recomputed for a past fight.
export default function FighterRatingHistory({ history }: { history: RatingHistoryPoint[] }) {
  if (history.length < 2) return null;

  return (
    <section className="rounded-lg bg-base-card p-4">
      <h2 className="mb-1 font-display text-sm uppercase tracking-wide text-ink-secondary">Évolution du rating</h2>
      <p className="mb-3 text-xs text-ink-secondary">
        Rating Glicko du moteur FightScore après chaque combat (échelle brute, 1500 = débutant). Le score sur 100
        affiché plus haut se calcule par rapport au meilleur de la catégorie aujourd’hui : il n’a pas d’historique.
      </p>
      <FighterRatingChart history={history} />
    </section>
  );
}
