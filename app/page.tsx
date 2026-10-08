import Link from 'next/link';
import {
  fetchAllEvents,
  fetchAllFighterRatings,
  fetchFightScoreSummary,
  fetchFightsByEvent,
  fetchRecentFinishedFights,
  fetchNewsArticles,
  fetchTopPoundForPound,
} from '@/data/lib/data';
import { computeNextEventForHome, displayEventName, groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';
import FightCard from '@/components/ui/fights/fight-card';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';
import NewsSection from '@/components/ui/news/news-section';
import FightScoreHero from '@/components/ui/ratings/fightscore-hero';
import PoundForPoundList from '@/components/ui/ratings/pound-for-pound-list';
import DivisionLeadersGrid from '@/components/ui/ratings/division-leaders-grid';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import type { Metadata } from 'next';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'MMA Universe : événements, classements et FightScore' },
  description: "Les prochains événements MMA, les derniers résultats, le classement FightScore et les actualités de l'UFC, du PFL, du Bellator et de bien d'autres organisations.",
  alternates: { canonical: '/' },
};

const RECENT_RESULTS_COUNT = 4;
const HOME_NEWS_COUNT = 4;
const HOME_P4P_COUNT = 5;
// Top 3 per division for the division cards (the champion comes along
// regardless, see fetchAllFighterRatings) -- the full lists live on
// /classement-calcule.
const HOME_DIVISION_DEPTH = 3;

// Same order as fetchTopPoundForPound: P4P score (returned as display_score),
// then the ML win probability -- which settles the hero between the men's and
// women's #1, both at 100 on their own scale.
function byPoundForPound(a: FighterRatingWithFighter, b: FighterRatingWithFighter) {
  return Number(b.display_score) - Number(a.display_score) || Number(b.ml_win_probability ?? 0) - Number(a.ml_win_probability ?? 0);
}

export default async function Page() {
  const events = await fetchAllEvents();
  const next = computeNextEventForHome(events);

  // Fetched unconditionally (not just when isUpcoming): the "Evenement de la
  // semaine" section below only shows a fight for an actually-upcoming hero
  // event — when there's no future event in DB, computeNextEventForHome
  // falls back to the last past event, which has no upcoming fight left to
  // show there.
  const [nextEventFights, recentResults, news, p4p, divisionRatings, summary] = await Promise.all([
    next ? fetchFightsByEvent(String(next.event.id)) : Promise.resolve([]),
    fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
    fetchNewsArticles({ pageSize: HOME_NEWS_COUNT }),
    fetchTopPoundForPound(HOME_P4P_COUNT),
    fetchAllFighterRatings(HOME_DIVISION_DEPTH),
    fetchFightScoreSummary(),
  ]);
  // The hero spotlights the single best fighter overall, men's and women's
  // lists combined (the lists themselves stay split, matching fight-minds).
  const p4pLeader = [...p4p.men, ...p4p.women].sort(byPoundForPound)[0] ?? null;

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
    <main className="flex min-h-screen flex-col">
      <FightScoreHero leader={p4pLeader} summary={summary} />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
        {(p4p.men.length > 0 || p4p.women.length > 0) && (
          <section>
            <SectionHeader title="Pound-for-Pound" href="/classement-calcule" linkLabel="Classement complet" />
            <div className="grid gap-4 md:grid-cols-2">
              {p4p.men.length > 0 && <PoundForPoundList fighters={p4p.men} title="Hommes" />}
              {p4p.women.length > 0 && <PoundForPoundList fighters={p4p.women} title="Femmes" />}
            </div>
          </section>
        )}

        {divisionRatings.length > 0 && (
          <section>
            <SectionHeader title="Catégorie par catégorie" href="/classement-calcule" linkLabel="Toutes les catégories" />
            <DivisionLeadersGrid ratings={divisionRatings} shownPerDivision={HOME_DIVISION_DEPTH} />
          </section>
        )}

        {!next && <EmptyState title="Aucun événement pour le moment" />}

        {heroFight && heroEvent && (
          <section>
            <SectionHeader title="Événement de la semaine" href={`/events/${heroEvent.id}`} linkLabel="Voir l'événement" />
            <FightCard fight={heroFight} event={heroEvent} eventName={displayEventName(heroEvent.name)} />
          </section>
        )}

        {weeklyEvents.length > 0 && (
          <section>
            <SectionHeader title="Cette semaine" href="/events" linkLabel="Voir tous les événements" />
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
      </div>
    </main>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">{title}</h2>
      <Link href={href} className="shrink-0 text-xs uppercase tracking-wide text-accent hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}
