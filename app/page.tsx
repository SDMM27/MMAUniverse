import Link from 'next/link';
import { fetchAllEvents, fetchFightsByEvent, fetchRecentFinishedFights } from '@/data/lib/data';
import { computeNextEventForHome } from '@/data/lib/event-utils';
import NextEventHero from '@/components/ui/events/next-event-hero';
import FightCard from '@/components/ui/fights/fight-card';
import FightResultRow from '@/components/ui/fights/fight-result-row';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const RECENT_RESULTS_COUNT = 4;

export default async function Page() {
  const events = await fetchAllEvents();
  const next = computeNextEventForHome(events);

  // Fetched unconditionally (not just when isUpcoming) because the hero now
  // builds its visual from the main-event fighters' photos rather than
  // Sherdog's event poster — see NextEventHero. The "Combat principal" section
  // below still only shows a fight for an actually-upcoming hero event: when
  // there's no future event in DB, computeNextEventForHome falls back to
  // the last past event, which has no upcoming fight left to show there.
  const [nextEventFights, recentResults] = await Promise.all([
    next ? fetchFightsByEvent(String(next.event.id)) : Promise.resolve([]),
    fetchRecentFinishedFights(RECENT_RESULTS_COUNT),
  ]);

  const heroEvent = next && next.isUpcoming ? next.event : null;

  // is_main_event is never actually set to true anywhere in the
  // scrapers/seed, so there's no reliable flag to pick "the" main event out
  // of nextEventFights. fetchFightsByEvent orders by `is_main_event DESC,
  // id ASC` (see data/lib/data.ts), so the first fetched fight is the
  // closest thing to a main event the data supports today — used both for
  // the hero's fighter photos and for the "Combat principal" card below.
  const heroFight = nextEventFights[0] ?? null;

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      {next ? (
        <NextEventHero
          event={next.event}
          isUpcoming={next.isUpcoming}
          fighter1={heroFight?.fighter1}
          fighter2={heroFight?.fighter2}
        />
      ) : (
        <EmptyState title="Aucun événement pour le moment" />
      )}

      {heroFight && heroEvent && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Combat principal</h2>
            <Link href={`/events/${heroEvent.id}`} className="text-xs uppercase tracking-wide text-accent hover:underline">
              Voir l&apos;événement
            </Link>
          </div>
          <FightCard fight={heroFight} event={heroEvent} />
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
    </main>
  );
}
