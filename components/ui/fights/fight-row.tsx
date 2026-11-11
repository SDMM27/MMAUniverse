import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { Fighter, FightWithFighters } from '@/data/lib/definitions';
import TitleFightBadge from '@/components/ui/fights/title-fight-badge';
import { fighterHref } from '@/data/lib/slug';

type FightOutcome = 'win' | 'loss' | 'draw';

function formatFightResult(fight: FightWithFighters): string {
  if (!fight.fight_finished) return 'À venir';
  const parts = [fight.method, fight.round ? `Round ${fight.round}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Résultat non précisé';
}

export default function FightRow({ fight }: { fight: FightWithFighters }) {
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <div className="border border-line bg-surface p-4 text-sm text-muted">
        Données des combattants indisponibles pour ce combat.
      </div>
    );
  }

  return (
    // < sm: a 2-column grid with the centre block as a full-width header on
    // top (order-first, DOM order stays fighter1 / centre / fighter2); sm+: the
    // original single flex row.
    <div className="fx-row grid grid-cols-2 gap-x-3 gap-y-3 border border-line bg-surface p-3 sm:flex sm:items-center sm:justify-between">
      <FighterSide
        fighter={fight.fighter1}
        align="left"
        outcome={fight.fight_finished ? (fight.winner_id === null ? 'draw' : fight.winner_id === fight.fighter1.id ? 'win' : 'loss') : null}
      />
      <div className="order-first col-span-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center sm:order-none sm:col-auto sm:w-36 sm:shrink-0 sm:flex-col sm:gap-1.5">
        {fight.weight_class && (
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent-strong">{fight.weight_class}</span>
        )}
        {fight.is_title_fight && <TitleFightBadge />}
        <span className="font-mono text-[11px] uppercase text-muted">{formatFightResult(fight)}</span>
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
      href={fighterHref(fighter)}
      className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center transition-colors hover:text-accent-strong sm:flex-row sm:gap-3 ${align === 'right' ? 'sm:flex-row-reverse sm:text-right' : 'sm:text-left'}`}
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="h-16 w-16 shrink-0"
        objectPosition="top"
      />
      <div className="w-full min-w-0 sm:w-auto">
        <div className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:flex-nowrap sm:justify-start ${align === 'right' ? 'sm:flex-row-reverse' : ''}`}>
          {outcome === 'win' && (
            <span className="shrink-0 bg-live px-1.5 font-display text-sm font-bold leading-5 text-[#04140a]" aria-hidden="true">
              V
            </span>
          )}
          {(outcome === 'loss' || outcome === 'draw') && (
            <span className="shrink-0 font-mono text-xs font-bold text-muted" aria-hidden="true">
              {outcome === 'loss' ? 'D' : 'N'}
            </span>
          )}
          <CountryFlag code={fighter.nationality} className="shrink-0 text-lg" />
          <p
            className={`line-clamp-2 w-full break-words font-display text-lg uppercase leading-none sm:line-clamp-none sm:w-auto sm:truncate ${outcome === 'loss' ? 'text-muted' : 'text-ink'}`}
          >
            {fighter.name}
          </p>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase text-muted">
          <span className="whitespace-nowrap">{fighter.record}</span>
          {outcome === 'win' && <span className="block text-win-strong sm:ml-1.5 sm:inline">Vainqueur</span>}
        </p>
      </div>
    </Link>
  );
}
