import Link from 'next/link';
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights, fetchNewsArticles, fetchTopPoundForPound } from '@/data/lib/data';
import { computeNextEventForHome, groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';
import FightCard from '@/components/ui/fights/fight-card';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';
import NewsSection from '@/components/ui/news/news-section';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const RECENT_RESULTS_COUNT = 4;
const HOME_NEWS_COUNT = 4;
// Fetched a bit deeper than the 3 actually shown so the true top 3 overall
// (men's + women's combined, re-sorted below) isn't accidentally missing a
// fighter who'd rank in the true top 3 but wasn't in the top 3 of their own
// gender's list alone (unlikely at this scale, but cheap to guard against).
const HOME_P4P_FETCH_COUNT = 5;
const HOME_P4P_SHOWN_COUNT = 3;

export default async function Page() {
  const events = await fetchAllEvents();
  const next = computeNextEventForHome(events);

  // Fetched unconditionally (not just when isUpcoming): the "Evenement de la
  // semaine" section below only shows a fight for an actually-upcoming hero
  // event — when there's no future event in DB, computeNextEventForHome
  // falls back to the last past event, which has no upcoming fight left to
  // show there.
  const [nextEventFights, recentResults, news, topP4P] = await Promise.all([
    next ? fetchFightsByEvent(String(next.event.id)) : Promise.resolve([]),
    fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
    fetchNewsArticles({ pageSize: HOME_NEWS_COUNT }),
    fetchTopPoundForPound(HOME_P4P_FETCH_COUNT),
  ]);
  // True top 3 overall (men's + women's combined) by display_score, not
  // "top 3 men's then top 3 women's" -- P4P is meant to cross divisions,
  // crossing gender lists too for this compact homepage teaser (the full
  // /classement-calcule page keeps them separate, matching fight-minds).
  const homeP4P = [...topP4P.men, ...topP4P.women]
    .sort((a, b) => Number(b.display_score) - Number(a.display_score))
    .slice(0, HOME_P4P_SHOWN_COUNT);

  const heroEvent = next && next.isUpcoming ? next.event : null;

  // is_main_event is never actually set to true anywhere in the
  // scrapers/seed, so there's no reliable flag to pick "the" main event out
  // of nextEventFights. fetchFightsByEvent orders by `is_main_event DESC,
  // id ASC` (see data/lib/data.ts), so the first fetched fight is the
  // closest thing to a main event the data supports today — used for the
  // "Evenement de la semaine" card below.
  const heroFight = nextEventFights[0] ?? null;

  const { upcoming } = splitEventsByStatus(events);
  const { thisWeek } = groupUpcomingByWeek(upcoming);
  // The hero's own event already gets its own spotlight above — don't list
  // it a second time here.
  const weeklyEvents = thisWeek.filter((event) => event.id !== heroEvent?.id);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      {!next && <EmptyState title="Aucun événement pour le moment" />}

      {heroFight && heroEvent && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Evenement de la semaine</h2>
            <Link href={`/events/${heroEvent.id}`} className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir l&apos;événement
            </Link>
          </div>
          <FightCard fight={heroFight} event={heroEvent} eventName={heroEvent.name} />
        </section>
      )}

      {homeP4P.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Classement</h2>
            <Link href="/classement-calcule" className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir le classement complet
            </Link>
          </div>
          <p className="mb-4 max-w-2xl text-sm text-ink-secondary">
            Un score calculé à partir des vraies statistiques de chaque combat — pas juste l&apos;avis d&apos;une
            organisation.{' '}
            <Link href="/classement-calcule/methodologie" className="text-accent hover:underline">
              Comment ça marche
            </Link>
            .
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {homeP4P.map((fighter) => (
              <Link
                key={fighter.id}
                href={`/fighters/${fighter.fighter_id}`}
                className="flex items-center justify-between rounded-lg border border-base-border bg-base-card px-4 py-3 hover:border-accent"
              >
                <div>
                  <p className="text-sm text-ink-primary">{fighter.fighter_name}</p>
                  <p className="text-xs text-ink-secondary">{fighter.weight_class}</p>
                </div>
                <span className="font-display text-sm text-accent">{Number(fighter.display_score).toFixed(1)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {weeklyEvents.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Cette semaine</h2>
            <Link href="/events" className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir tous les événements
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {weeklyEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {recentResults.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-ink-primary">Derniers résultats</h2>
          <div className="flex flex-col gap-3">
            {recentResults.map((result) => (
              <FightResultRow key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}

      {news.articles.length > 0 && <NewsSection articles={news.articles} />}
    </main>
  );
}
