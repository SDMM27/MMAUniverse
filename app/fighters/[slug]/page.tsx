import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  fetchFighterById,
  fetchFighterFightHistory,
  fetchFighterRankings,
  fetchFighterRatingsByFighterId,
  fetchQualityWinsByFighterId,
} from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';
import { formatPhysique } from '@/data/lib/fighter-physique';
import { displayEventName, formatEventDate } from '@/data/lib/event-utils';
import { ageFromBirthDate } from '@/data/lib/fighter-age';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import FighterHistoryList from '@/components/ui/fighters/fighter-history-list';
import FighterRecordCard from '@/components/ui/fighters/fighter-record-card';
import FighterScoreCard from '@/components/ui/ratings/fighter-score-card';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const fighter = await fetchFighterById(params.slug);

  if (!fighter) {
    notFound();
  }

  const fights = await fetchFighterFightHistory(params.slug);
  const rankings = await fetchFighterRankings(params.slug);
  const ratings = await fetchFighterRatingsByFighterId(params.slug);
  // Quality wins only make sense for a fighter we actually rated -- skip the
  // extra query for one who isn't (not yet matched, or all draws/no-contests).
  const qualityWins = ratings.length > 0 ? await fetchQualityWinsByFighterId(params.slug) : [];
  // Prefer a weight-class ranking over Pound-for-Pound for the header pill --
  // P4P is a bonus distinction, the weight-class rank is the primary one.
  const primaryRanking = rankings.find((r) => !r.weight_class.includes('Pound-for-Pound')) ?? rankings[0];
  const stats = computeFighterStats(fights);
  const physique = formatPhysique(fighter.height_cm, fighter.reach_cm);
  const age = ageFromBirthDate(fighter.birth_date);
  // Soonest booked bout, if any — spotlighted in the header. Excluded from the
  // Historique table below (that's completed fights only) so it isn't shown twice.
  const nextFight = fights.find((fight) => fight.result === 'upcoming');
  const pastFights = fights.filter((fight) => fight.result !== 'upcoming');

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="rounded-lg bg-base-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <CoverImage
            src={fighter.image_url}
            alt={fighter.name}
            sizes="(max-width: 640px) 60vw, 280px"
            className="aspect-[3/4] w-40 shrink-0 rounded-lg border-2 border-base-bg sm:w-56"
            objectPosition="top"
          />
          <div className="flex flex-1 flex-col gap-4 sm:justify-between">
            <div>
              <p className="font-display text-xs uppercase tracking-wide text-accent">
                {fighter.organization_abbreviation} · {fighter.weight_class}
              </p>
              <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary sm:text-3xl">
                {fighter.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
                {primaryRanking && (
                  <span className="rounded bg-accent/15 px-2 py-0.5 font-display text-xs uppercase tracking-wide text-accent">
                    {primaryRanking.rank === 0 ? 'Champion' : `#${primaryRanking.rank}`}
                  </span>
                )}
                <CountryFlag code={fighter.nationality} className="text-lg" />
                {fighter.record && <span className="font-display text-ink-primary">{fighter.record}</span>}
                {age !== null && <span>{age} ans</span>}
                {physique && <span>{physique}</span>}
              </div>
            </div>
            {nextFight && (
              <Link
                href={`/events/${nextFight.event_id}`}
                className="flex items-center justify-between rounded-lg border border-accent bg-base-bg/40 p-3 hover:border-accent"
              >
                <div>
                  <p className="text-sm text-ink-primary">
                    Prochain combat vs {nextFight.opponent_name ?? 'Adversaire inconnu'}
                  </p>
                  <p className="text-xs text-ink-secondary">
                    {displayEventName(nextFight.event_name)} · {formatEventDate(nextFight.event_date, { weekday: true })}
                  </p>
                </div>
                <span className="font-display text-xs uppercase tracking-wide text-accent">À venir</span>
              </Link>
            )}
          </div>
        </div>
        <div className="mt-6 border-t border-base-border pt-4">
          <FighterRecordCard stats={stats} />
        </div>
        <FighterScoreCard ratings={ratings} qualityWins={qualityWins} />
      </div>
      <div>
        <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-ink-secondary">Historique</h2>
        {pastFights.length === 0 ? (
          <EmptyState title="Aucun combat enregistré" />
        ) : (
          <FighterHistoryList fights={pastFights} />
        )}
      </div>
    </main>
  );
}
