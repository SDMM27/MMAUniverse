import type { Metadata } from 'next';
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
import { CoverImage } from '@/components/ui/shared/media';
import EventOrgTabs from '@/components/ui/events/event-org-tabs';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import FightPickSection from '@/components/ui/picks/fight-pick-section';
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
    <main className="flex min-h-screen flex-col gap-6 p-6">
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
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
        <CoverImage src={event.event_poster} alt={event.name} className="h-20 w-20 rounded-md" />
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{displayEventName(event.name)}</h1>
          <p className="text-sm text-ink-secondary">
            {formatEventDate(event.date, { weekday: true })}
            {eventTime && ` · ${eventTime}`} · {event.event_location}
          </p>
          {prelimsTime && (
            <p className="mt-1 text-xs text-ink-secondary">
              Préliminaires à {prelimsTime}
            </p>
          )}
        </div>
      </div>
      {fights.length === 0 ? (
        <EmptyState
          title="Aucun combat annoncé"
          description="La card de cet événement n'a pas encore été communiquée."
        />
      ) : (
        <>
          {mainEvent && (
            <div className="flex flex-col gap-3">
              <FightCard fight={mainEvent} event={event} />
              <FightPickSection
                fight={mainEvent}
                locked={locked}
                signedIn={Boolean(userId)}
                pick={userPicks.get(mainEvent.id) ?? null}
              />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {rest.map((fight) => (
              <div key={fight.id} className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-3 border-t border-base-border pt-6">
          <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Classement de cet événement</h2>
          {leaderboard.length === 0 ? (
            <EmptyState title="Aucun pronostic" description="Personne n'a pronostiqué cet événement." />
          ) : (
            <ol className="flex flex-col gap-2">
              {leaderboard.map((entry, index) => (
                <li
                  key={entry.userId}
                  className="flex items-center justify-between rounded-lg border border-base-border bg-base-card px-4 py-2"
                >
                  <span className="text-sm text-ink-primary">
                    #{index + 1} {entry.displayName}
                  </span>
                  <span className="font-display text-sm text-accent">{entry.points} pts</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </main>
  );
}
