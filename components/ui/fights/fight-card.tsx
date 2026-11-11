import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { Fighter, FightWithFighters } from '@/data/lib/definitions';
import { formatEventDate, formatEventTime } from '@/data/lib/event-utils';
import TitleFightBadge from '@/components/ui/fights/title-fight-badge';
import { fighterHref } from '@/data/lib/slug';

type FightStatus = 'upcoming' | 'live' | 'finished';

export type FightCardProps = {
  fight: FightWithFighters;
  event: {
    id: number;
    date: string;
    organization_abbreviation: string;
    main_card_start?: string | null;
    start_time?: string | null;
  };
  live?: { round: number };
  /** Event name shown under the "Combat principal" label — only passed where
   *  the event's own title isn't already displayed elsewhere on the page
   *  (e.g. the home page, which no longer has a hero banner for it). */
  eventName?: string;
};

export default function FightCard({ fight, event, live, eventName }: FightCardProps) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <div className="border border-line bg-surface p-4 text-sm text-muted">
        Données des combattants indisponibles pour ce combat.
      </div>
    );
  }

  const status: FightStatus = fight.fight_finished ? 'finished' : live ? 'live' : 'upcoming';

  return (
    // relative + the absolutely-positioned Link at the bottom make the whole
    // card clickable to the event page ("stretched link" pattern) without
    // nesting an <a> inside the fighters' own <a href="/fighters/...">
    // below — those get a higher z-index so they stay independently
    // clickable on top of the stretched one.
    <div className="fx-notch relative flex flex-col gap-5 border-2 border-accent bg-surface p-4 sm:p-8">
      <div className="flex flex-col gap-4">
        <p className="text-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent-strong">
          Combat principal
        </p>
        {eventName && (
          <p className="-mt-2 text-center font-display text-3xl uppercase leading-[0.95] text-ink sm:text-4xl">
            {eventName}
          </p>
        )}
        {(fight.weight_class || fight.is_title_fight) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {fight.weight_class && (
              <span className="font-mono text-xs font-bold uppercase text-ink">{fight.weight_class}</span>
            )}
            {fight.is_title_fight && <TitleFightBadge />}
          </div>
        )}
        <FightCardHeader status={status} event={event} liveRound={live?.round} />
      </div>
      <div className="flex items-center justify-between gap-3 sm:gap-6">
        <FighterColumn fighter={fight.fighter1} status={status} winnerId={fight.winner_id} />
        <FightCardCenter status={status} fight={fight} />
        <FighterColumn fighter={fight.fighter2} status={status} winnerId={fight.winner_id} />
      </div>
      <Link
        href={`/events/${event.id}`}
        aria-label={eventName ? `Voir l'événement ${eventName}` : "Voir l'événement"}
        className="absolute inset-0 z-[1]"
      />
    </div>
  );
}

function FightCardHeader({
  status,
  event,
  liveRound,
}: {
  status: FightStatus;
  event: {
    date: string;
    organization_abbreviation: string;
    main_card_start?: string | null;
    start_time?: string | null;
  };
  liveRound?: number;
}) {
  if (status === 'live') {
    return (
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 bg-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-ink">
          <span className="fx-live h-1.5 w-1.5 rounded-full bg-accent-ink" aria-hidden="true" />
          En direct
        </span>
        <span className="font-mono text-[11px] uppercase text-muted">Round {liveRound}</span>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">{event.organization_abbreviation}</span>
        <span className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
          Terminé
        </span>
      </div>
    );
  }

  const eventTime = formatEventTime(event.main_card_start ?? null) ?? formatEventTime(event.start_time ?? null);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">{event.organization_abbreviation}</span>
      <span className="font-mono text-[11px] uppercase text-muted">
        {formatEventDate(event.date, { weekday: true })}
        {eventTime && ` · ${eventTime}`}
      </span>
    </div>
  );
}

function FighterColumn({
  fighter,
  status,
  winnerId,
}: {
  fighter: Fighter;
  status: FightStatus;
  winnerId: number | null;
}) {
  const result = winnerId === null ? 'draw' : winnerId === fighter.id ? 'win' : 'loss';

  return (
    // min-w-0: this column sits in a flex row alongside the other fighter's
    // column — without it, a long name refuses to shrink below its own
    // content width and pushes the card wider than its container.
    <Link
      href={fighterHref(fighter)}
      className="relative z-[2] flex min-w-0 flex-1 flex-col items-center gap-2 text-center transition-colors hover:text-accent-strong"
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="h-20 w-20 sm:h-28 sm:w-28"
        objectPosition="top"
      />
      <CountryFlag code={fighter.nationality} />
      <span
        className={`w-full line-clamp-2 break-words font-display text-xl uppercase leading-none sm:line-clamp-none sm:truncate sm:text-3xl ${
          status === 'finished' && result === 'loss' ? 'text-muted' : 'text-ink'
        }`}
      >
        {fighter.name}
      </span>
      <span className="whitespace-nowrap font-mono text-[11px] uppercase text-muted">{fighter.record}</span>
      {status === 'finished' ? (
        result === 'win' ? (
          <span className="bg-live px-2 font-display text-lg font-bold leading-6 text-[#04140a]">V</span>
        ) : (
          <span className="font-mono text-xs font-bold text-muted">{result === 'loss' ? 'D' : 'N'}</span>
        )
      ) : (
        fighter.ranking > 0 && (
          <span className="font-mono text-xs font-bold uppercase text-accent-strong">#{fighter.ranking}</span>
        )
      )}
    </Link>
  );
}

function FightCardCenter({ status, fight }: { status: FightStatus; fight: FightWithFighters }) {
  if (status === 'live') {
    return <span className="fx-live h-3 w-3 shrink-0 rounded-full bg-accent" aria-hidden="true" />;
  }

  if (status === 'finished') {
    const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
    return (
      <span className="w-16 shrink-0 text-center font-mono text-[11px] uppercase text-muted sm:w-24">
        {parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé'}
      </span>
    );
  }

  return <span className="fx-punch shrink-0 font-display text-4xl leading-none text-accent-strong sm:text-6xl">VS</span>;
}
