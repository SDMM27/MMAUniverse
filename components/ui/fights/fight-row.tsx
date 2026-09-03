import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { Fighter, FightWithFighters } from '@/data/lib/definitions';

type FightOutcome = 'win' | 'loss' | 'draw';

const outcomeLabel: Record<FightOutcome, string> = { win: 'V', loss: 'D', draw: 'N' };
const outcomeColor: Record<FightOutcome, string> = {
  win: 'text-win',
  loss: 'text-ink-secondary',
  draw: 'text-ink-secondary',
};

function formatFightResult(fight: FightWithFighters): string {
  if (!fight.fight_finished) return 'À venir';
  const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé';
}

export default function FightRow({ fight }: { fight: FightWithFighters }) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <div className="rounded-lg border border-base-border bg-base-card p-4 text-sm text-ink-secondary">
        Données des combattants indisponibles pour ce combat.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-base-border bg-base-card p-3">
      <FighterSide
        fighter={fight.fighter1}
        align="left"
        outcome={fight.fight_finished ? (fight.winner_id === null ? 'draw' : fight.winner_id === fight.fighter1.id ? 'win' : 'loss') : null}
      />
      <div className="flex w-36 shrink-0 flex-col items-center gap-1.5 text-center">
        <span className="font-display text-sm uppercase tracking-wide text-accent">{fight.weight_class}</span>
        <span className="text-sm text-ink-secondary">{formatFightResult(fight)}</span>
      </div>
      <FighterSide
        fighter={fight.fighter2}
        align="right"
        outcome={fight.fight_finished ? (fight.winner_id === null ? 'draw' : fight.winner_id === fight.fighter2.id ? 'win' : 'loss') : null}
      />
    </div>
  );
}

function FighterSide({
  fighter,
  align,
  outcome,
}: {
  fighter: Fighter;
  align: 'left' | 'right';
  outcome: FightOutcome | null;
}) {
  return (
    // min-w-0 on both this Link and the div below: a flex item's default
    // min-width is the width of its content — without it at *every* nested
    // flex level between the row and the actual text, a long fighter name
    // refuses to shrink and pushes the row (and the page, on narrow screens)
    // wider than its container. Setting it only on the innermost div isn't
    // enough; this Link is itself the flex item FightRow needs to shrink.
    <Link
      href={`/fighters/${fighter.id}`}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-md transition-colors hover:text-accent ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="h-16 w-16 shrink-0 rounded-md"
        objectPosition="top"
      />
      <div className="min-w-0">
        <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          {outcome && (
            <span className={`shrink-0 font-display text-sm font-bold ${outcomeColor[outcome]}`} aria-hidden="true">
              {outcomeLabel[outcome]}
            </span>
          )}
          <CountryFlag code={fighter.nationality} className="shrink-0 text-lg" />
          <p
            className={`truncate font-display text-base uppercase tracking-wide ${outcome === 'loss' ? 'text-ink-secondary' : 'text-ink-primary'}`}
          >
            {fighter.name}
          </p>
        </div>
        <p className="text-sm text-ink-secondary">
          {fighter.record}
          {outcome === 'win' && <span className="ml-1.5 text-win">Vainqueur</span>}
        </p>
      </div>
    </Link>
  );
}
