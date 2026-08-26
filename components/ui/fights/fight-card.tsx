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
    <Link
      href={`/events/${event.id}`}
      className="flex flex-col gap-4 rounded-lg border border-base-border bg-base-card p-4 transition-colors hover:border-accent"
    >
      <FightCardHeader status={status} event={event} liveRound={live?.round} />
      <div className="flex items-center justify-between gap-3">
        <FighterColumn fighter={fight.fighter1} status={status} winnerId={fight.winner_id} />
        <FightCardCenter status={status} fight={fight} />
        <FighterColumn fighter={fight.fighter2} status={status} winnerId={fight.winner_id} />
      </div>
      <p className="border-t border-base-border pt-2 text-center font-display text-xs uppercase tracking-wide text-accent">
        Événement principal
      </p>
    </Link>
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
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <CoverImage src={fighter.image_url} alt={fighter.name} className="h-12 w-12 rounded-md" />
      {flag && (
        <span className="text-sm" aria-hidden="true">
          {flag}
        </span>
      )}
      <span className="w-full truncate font-display text-sm uppercase tracking-wide text-ink-primary">
        {fighter.name}
      </span>
      {status === 'finished' ? (
        <span className={`font-display text-lg font-bold ${resultColor[result]}`}>{resultLabel[result]}</span>
      ) : (
        fighter.ranking > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-accent">#{fighter.ranking}</span>
        )
      )}
    </div>
  );
}

function FightCardCenter({ status, fight }: { status: FightStatus; fight: FightWithFighters }) {
  if (status === 'live') {
    return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />;
  }

  if (status === 'finished') {
    const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
    return (
      <span className="shrink-0 text-center text-xs text-ink-secondary">
        {parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé'}
      </span>
    );
  }

  return <span className="shrink-0 text-xs font-bold text-ink-secondary">VS</span>;
}
