import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchEventsByOrg } from '@/data/lib/data';
import { getEvent, getEventFights } from '@/data/lib/page-data';
import { DEFAULT_OG_IMAGE, OPEN_GRAPH_BASE, eventMetadataDescription } from '@/data/lib/seo-utils';
import { getSiteUrl } from '@/data/lib/site-url';
import { breadcrumbJsonLd, sportsEventJsonLd } from '@/data/lib/structured-data';
import { displayEventName, formatEventDate, formatEventTime } from '@/data/lib/event-utils';
import { splitMainEvent } from '@/data/lib/fight-utils';
import { isEventLocked } from '@/data/lib/pick-lock';
import { fetchPicksForEvent, fetchEventLeaderboard, getOrCreateCurrentUser, type StoredPick } from '@/data/lib/picks-data';
import EventOrgTabs from '@/components/ui/events/event-org-tabs';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import FightPickSection from '@/components/ui/picks/fight-pick-section';
import SectionHeading from '@/components/ui/fx/section-heading';
import EmptyState from '@/components/ui/shared/empty-state';
import JsonLd from '@/components/ui/shared/json-ld';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const event = await getEvent(params.slug);
  if (!event) return { title: 'Événement introuvable', robots: { index: false } };

  const fights = await getEventFights(params.slug);
  const title = `${displayEventName(event.name)} · ${event.organization_abbreviation}`;
  const description = eventMetadataDescription(event, splitMainEvent(fights).mainEvent);
  const canonical = `/events/${event.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      ...OPEN_GRAPH_BASE,
      type: 'website',
      title,
      description,
      url: canonical,
      // The event poster when there is one, else the site-wide share image.
      images: event.event_poster?.startsWith('http') ? [{ url: event.event_poster, alt: displayEventName(event.name) }] : [DEFAULT_OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Page({ params }: { params: { slug: string } }) {
  const event = await getEvent(params.slug);

  if (!event) {
    notFound();
  }

  const [fights, orgEvents] = await Promise.all([
    getEventFights(params.slug),
    fetchEventsByOrg(String(event.organization_id)),
  ]);
  const { mainEvent, rest } = splitMainEvent(fights);
  const locked = isEventLocked(event, new Date());
  const eventTime = formatEventTime(event.main_card_start) ?? formatEventTime(event.start_time);
  const prelimsTime = formatEventTime(event.prelims_start);

  const userId = await getOrCreateCurrentUser();
  const userPicks: Map<number, StoredPick> = userId ? await fetchPicksForEvent(userId, params.slug) : new Map();

  const leaderboard = locked ? await fetchEventLeaderboard(params.slug) : [];
  const siteUrl = getSiteUrl();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-4 sm:p-6">
      <JsonLd
        data={[
          sportsEventJsonLd(siteUrl, event, fights, eventMetadataDescription(event, mainEvent)),
          breadcrumbJsonLd(siteUrl, [
            ['Événements', '/events'],
            [displayEventName(event.name), `/events/${event.id}`],
          ]),
        ]}
      />
      <EventOrgTabs events={orgEvents} currentEventId={event.id} />
      <header className="flex flex-col gap-3 border-b-2 border-ink pb-6">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          {event.organization_abbreviation}
        </p>
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] uppercase leading-[0.9] text-ink [overflow-wrap:anywhere]">
          {displayEventName(event.name)}
        </h1>
        <p className="font-mono text-[11px] uppercase text-muted">
          {formatEventDate(event.date, { weekday: true })}
          {eventTime && ` · ${eventTime}`} · {event.event_location}
        </p>
        {prelimsTime && <p className="font-mono text-[11px] uppercase text-muted">Préliminaires à {prelimsTime}</p>}
      </header>
      {fights.length === 0 ? (
        <EmptyState
          title="Aucun combat annoncé"
          description="La card de cet événement n'a pas encore été communiquée."
        />
      ) : (
        <>
          {!userId && !locked && (
            <div className="flex flex-col items-center gap-3 border border-line bg-surface p-4 text-center">
              <p className="text-sm text-muted">
                Connecte-toi pour pronostiquer les combats de cette soirée et grimper au classement.
              </p>
              <Link
                href="/sign-in"
                className="fx-cut inline-flex min-h-11 w-full items-center justify-center bg-accent px-6 font-display text-lg uppercase text-accent-ink sm:w-auto"
              >
                Se connecter
              </Link>
            </div>
          )}
          {mainEvent && (
            <div className="flex flex-col gap-2">
              <FightCard fight={mainEvent} event={event} />
              <FightPickSection
                fight={mainEvent}
                locked={locked}
                signedIn={Boolean(userId)}
                pick={userPicks.get(mainEvent.id) ?? null}
              />
            </div>
          )}
          <div className="flex flex-col gap-4">
            {rest.map((fight, index) => (
              <div
                key={fight.id}
                className="fx-in-left flex flex-col gap-2"
                style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
              >
                <FightRow fight={fight} />
                <FightPickSection
                  fight={fight}
                  locked={locked}
                  signedIn={Boolean(userId)}
                  pick={userPicks.get(fight.id) ?? null}
                />
              </div>
            ))}
          </div>
        </>
      )}
      {locked && (
        <section className="flex flex-col border-t-2 border-ink pt-6">
          <SectionHeading title="Classement de cet événement" />
          {leaderboard.length === 0 ? (
            <EmptyState title="Aucun pronostic" description="Personne n'a pronostiqué cet événement." />
          ) : (
            <ol className="flex flex-col gap-2">
              {leaderboard.map((entry, index) => (
                <li
                  key={entry.userId}
                  className="fx-row flex items-center justify-between gap-3 border border-line bg-surface px-4 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-ink">
                    <span className="font-mono text-xs font-bold text-muted">#{index + 1}</span> {entry.displayName}
                  </span>
                  <span className="shrink-0 font-display text-lg text-accent-strong">{entry.points} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}
