import Link from 'next/link';
import {
  fetchAllEvents,
  fetchAllFighterRatings,
  fetchFightScoreSummary,
  fetchFightsByEvent,
  fetchRecentFinishedFights,
  fetchNewsArticles,
  fetchOrganizations,
  fetchSimulatorFighters,
  fetchTopPoundForPound,
} from '@/data/lib/data';
import { fetchNextMainEventPrefill } from '@/data/lib/simulator-data';
import { computeNextEventForHome, displayEventName, groupUpcomingByWeek, splitEventsByStatus } from '@/data/lib/event-utils';
import FightCard from '@/components/ui/fights/fight-card';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';
import NewsSection from '@/components/ui/news/news-section';
import FightScoreHero, { FightScoreStats } from '@/components/ui/ratings/fightscore-hero';
import P4PBoard from '@/components/ui/ratings/p4p-board';
import ChampionsGrid from '@/components/ui/ratings/champions-grid';
import MatchupFaceOff from '@/components/ui/ratings/matchup-face-off';
import Marquee from '@/components/ui/fx/marquee';
import SectionHeading from '@/components/ui/fx/section-heading';
import JsonLd from '@/components/ui/shared/json-ld';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { getSiteUrl } from '@/data/lib/site-url';
import { websiteJsonLd } from '@/data/lib/structured-data';
import type { Metadata } from 'next';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const HOME_DESCRIPTION =
  "Les prochains événements MMA, les derniers résultats, le classement FightScore et les actualités de l'UFC, du PFL, du Bellator et de bien d'autres organisations.";

export const metadata: Metadata = {
  title: { absolute: 'MMA Universe : événements, classements et FightScore' },
  description: HOME_DESCRIPTION,
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
  const [nextEventFights, recentResults, news, p4p, divisionRatings, summary, organizations, simulatorFighters] = await Promise.all([
    next ? fetchFightsByEvent(String(next.event.id)) : Promise.resolve([]),
    fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
    fetchNewsArticles({ pageSize: HOME_NEWS_COUNT }),
    fetchTopPoundForPound(HOME_P4P_COUNT),
    fetchAllFighterRatings(HOME_DIVISION_DEPTH),
    fetchFightScoreSummary(),
    // Only counted, for the ticker and the headline numbers.
    fetchOrganizations().catch(() => []),
    // For the main event face-off: the simulator's own fighter list and odds.
    fetchSimulatorFighters().catch(() => []),
  ]);
  // Same main event as /simulateur's prefill (next UFC event), when both
  // fighters are rated; otherwise the face-off section is left out.
  const prefill = simulatorFighters.length > 0 ? await fetchNextMainEventPrefill(simulatorFighters) : null;
  const faceOff = prefill
    ? {
        a: simulatorFighters.find((f) => f.fighter_id === prefill.a)!,
        b: simulatorFighters.find((f) => f.fighter_id === prefill.b)!,
        prefill,
      }
    : null;
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

  const ticker = [
    'FightScore recalculé chaque lundi',
    ...(summary ? [`${Number(summary.ranked_count)} combattants classés`, `${Number(summary.division_count)} catégories`] : []),
    ...(organizations.length > 0 ? [`${organizations.length} organisations suivies`] : []),
    'Simulateur de combat',
  ];

  return (
    <main className="flex min-h-screen flex-col overflow-x-clip">
      <JsonLd data={websiteJsonLd(getSiteUrl(), HOME_DESCRIPTION)} />
      <Marquee items={ticker} label="Infos du FightScore" />

      <div className="shell flex flex-col gap-16 pb-16 sm:gap-[72px]">
        <div>
          <FightScoreHero leader={p4pLeader} />
          <FightScoreStats summary={summary} organizationCount={organizations.length} />
        </div>

        {faceOff && (
          <section aria-labelledby="home-face-off">
            <SectionHeading
              id="home-face-off"
              title="Face-à-face"
              caption={
                <>
                  Main event ·{' '}
                  <Link href={`/events/${faceOff.prefill.eventId}`} className="hover:text-ink hover:underline">
                    {faceOff.prefill.eventName}
                  </Link>
                  {faceOff.prefill.eventDate && ` · ${faceOff.prefill.eventDate}`}
                </>
              }
            />
            <MatchupFaceOff a={faceOff.a} b={faceOff.b} />
          </section>
        )}

        {(p4p.men.length > 0 || p4p.women.length > 0) && (
          <section aria-labelledby="home-p4p">
            <P4PBoard
              men={p4p.men}
              women={p4p.women}
              heading={
                <h2 id="home-p4p" className="font-display text-[clamp(2.25rem,5.5vw,3.5rem)] uppercase leading-[0.9] text-ink">
                  Pound-for-pound
                </h2>
              }
            />
            <Link href="/classement-calcule" className="mt-3 inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase text-accent-strong hover:underline">
              Classement complet →
            </Link>
          </section>
        )}

        {divisionRatings.length > 0 && (
          <section aria-labelledby="home-champions">
            <SectionHeading id="home-champions" title="Champions par catégorie" href="/classement-calcule" linkLabel="Toutes les catégories" />
            <ChampionsGrid ratings={divisionRatings} />
          </section>
        )}

        {!next && <EmptyState title="Aucun événement pour le moment" />}

        {heroFight && heroEvent && !faceOff && (
          <section>
            <SectionHeading title="Événement de la semaine" href={`/events/${heroEvent.id}`} linkLabel="Voir l'événement" />
            <FightCard fight={heroFight} event={heroEvent} eventName={displayEventName(heroEvent.name)} />
          </section>
        )}

        {weeklyEvents.length > 0 && (
          <section>
            <SectionHeading title="Cette semaine" href="/events" linkLabel="Tous les événements" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {weeklyEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}

        {recentResults.length > 0 && (
          <section>
            <SectionHeading title="Derniers résultats" />
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
