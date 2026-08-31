import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Fighter, FightWithFighters } from '@/data/lib/definitions';
import { countryCodeToFlag } from '@/data/lib/flag-utils';

type FightStatus = 'upcoming' | 'live' | 'finished';

export type FightCardProps = {
  fight: FightWithFighters;
  event: { id: number; date: string; organization_abbreviation: string };
  live?: { round: number };
};

const resultLabel: Record<'win' | 'loss' | 'draw', string> = { win: 'V', loss: 'D', draw: 'N' };
const resultColor: Record<'win' | 'loss' | 'draw', string> = {
  win: 'text-win',
  loss: 'text-accent',
  draw: 'text-ink-secondary',
};

export default function FightCard({ fight, event, live }: FightCardProps) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <div className="rounded-lg border border-base-border bg-base-card p-4 text-sm text-ink-secondary">
        Données des combattants indisponibles pour ce combat.
      </div>
    );
  }

  const status: FightStatus = fight.fight_finished ? 'finished' : live ? 'live' : 'upcoming';

  return (
    <div className="flex flex-col gap-5 rounded-xl border-2 border-accent bg-base-card p-6 shadow-lg transition-shadow hover:shadow-accent/20 sm:p-8">
      <Link href={`/events/${event.id}`} className="flex flex-col gap-5">
        <p className="text-center font-display text-sm font-bold uppercase tracking-[0.2em] text-accent">
          Événement principal
        </p>
        <FightCardHeader status={status} event={event} liveRound={live?.round} />
      </Link>
      <div className="flex items-center justify-between gap-4 sm:gap-6">
        <FighterColumn fighter={fight.fighter1} status={status} winnerId={fight.winner_id} />
        <FightCardCenter status={status} fight={fight} />
        <FighterColumn fighter={fight.fighter2} status={status} winnerId={fight.winner_id} />
      </div>
    </div>
  );
}

function FightCardHeader({
  status,
  event,
  liveRound,
}: {
  status: FightStatus;
  event: { date: string; organization_abbreviation: string };
  liveRound?: number;
}) {
  if (status === 'live') {
    return (
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 rounded bg-accent px-2 py-0.5 font-display text-[10px] uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
          En direct
        </span>
        <span className="text-xs text-ink-secondary">Round {liveRound}</span>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="flex items-center justify-between">
        <span className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</span>
        <span className="rounded border border-base-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-secondary">
          Terminé
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="font-display text-xs uppercase tracking-wide text-accent">{event.organization_abbreviation}</span>
      <span className="text-xs text-ink-secondary">{event.date}</span>
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
  const flag = countryCodeToFlag(fighter.nationality);
  const result = winnerId === null ? 'draw' : winnerId === fighter.id ? 'win' : 'loss';

  return (
    // min-w-0: this column sits in a flex row alongside the other fighter's
    // column — without it, a long name refuses to shrink below its own
    // content width and pushes the card wider than its container.
    <Link
      href={`/fighters/${fighter.id}`}
      className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center transition-colors hover:text-accent"
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="h-20 w-20 rounded-md sm:h-28 sm:w-28"
        objectPosition="top"
      />
      {flag && (
        <span className="text-xl" aria-hidden="true">
          {flag}
        </span>
      )}
      <span className="w-full truncate font-display text-base uppercase tracking-wide text-ink-primary sm:text-xl">
        {fighter.name}
      </span>
      <span className="text-xs text-ink-secondary sm:text-sm">{fighter.record}</span>
      {status === 'finished' ? (
        <span className={`font-display text-2xl font-bold ${resultColor[result]}`}>{resultLabel[result]}</span>
      ) : (
        fighter.ranking > 0 && (
          <span className="text-xs font-bold uppercase tracking-wide text-accent">#{fighter.ranking}</span>
        )
      )}
    </Link>
  );
}

function FightCardCenter({ status, fight }: { status: FightStatus; fight: FightWithFighters }) {
  if (status === 'live') {
    return <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />;
  }

  if (status === 'finished') {
    const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
    return (
      <span className="w-16 shrink-0 text-center text-xs text-ink-secondary sm:w-24 sm:text-sm">
        {parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé'}
      </span>
    );
  }

  return <span className="shrink-0 font-display text-xl font-bold text-ink-secondary sm:text-2xl">VS</span>;
}
