import SectionHeading from '@/components/ui/fx/section-heading';
import type { RatingHistoryPoint } from '@/data/lib/fighter-profile-data';
import FighterRatingChart from './fighter-rating-chart';

// Server wrapper around the client chart: hides the section below 2 rated
// fights. The curve is the raw Glicko rating (1500 = a debutant), not the
// 0-100 FightScore shown above -- that one is relative to the division's best
// fighter today, so it can't be recomputed for a past fight.
export default function FighterRatingHistory({ history }: { history: RatingHistoryPoint[] }) {
  if (history.length < 2) return null;

  return (
    <section className="border border-line bg-surface p-4 sm:p-6">
      <SectionHeading title="Évolution du rating" />
      <p className="mb-3 font-mono text-[11px] uppercase text-muted">
        Rating Glicko du moteur FightScore après chaque combat (échelle brute, 1500 = débutant). Le score sur 100
        affiché plus haut se calcule par rapport au meilleur de la catégorie aujourd’hui : il n’a pas d’historique.
      </p>
      <FighterRatingChart history={history} />
    </section>
  );
}
