import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { FightWithFighters } from '@/data/lib/definitions';

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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-base-border bg-base-card p-4">
      <FighterSide
        id={fight.fighter1.id}
        name={fight.fighter1.name}
        record={fight.fighter1.record}
        image={fight.fighter1.image_url}
        align="left"
      />
      <div className="flex shrink-0 flex-col items-center gap-1 text-center">
        <span className="font-display text-xs uppercase tracking-wide text-accent">{fight.weight_class}</span>
        <span className="text-xs text-ink-secondary">{formatFightResult(fight)}</span>
      </div>
      <FighterSide
        id={fight.fighter2.id}
        name={fight.fighter2.name}
        record={fight.fighter2.record}
        image={fight.fighter2.image_url}
        align="right"
      />
    </div>
  );
}

function FighterSide({
  id,
  name,
  record,
  image,
  align,
}: {
  id: number;
  name: string;
  record: string;
  image: string;
  align: 'left' | 'right';
}) {
  return (
    // min-w-0 on both this Link and the div below: a flex item's default
    // min-width is the width of its content — without it at *every* nested
    // flex level between the row and the actual text, a long fighter name
    // refuses to shrink and pushes the row (and the page, on narrow screens)
    // wider than its container. Setting it only on the innermost div isn't
    // enough; this Link is itself the flex item FightRow needs to shrink.
    <Link
      href={`/fighters/${id}`}
      className={`flex min-w-0 flex-1 items-center gap-3 rounded-md transition-colors hover:text-accent ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}
    >
      <CoverImage src={image} alt={name} className="h-12 w-12 shrink-0 rounded-md" />
      <div className="min-w-0">
        <p className="truncate font-display text-sm uppercase tracking-wide text-ink-primary">{name}</p>
        <p className="text-xs text-ink-secondary">{record}</p>
      </div>
    </Link>
  );
}
