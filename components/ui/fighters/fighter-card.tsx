import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { FighterWithOrganization } from '@/data/lib/definitions';

export default function FighterCard({ fighter }: { fighter: FighterWithOrganization }) {
  return (
    <Link
      href={`/fighters/${fighter.id}`}
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <CoverImage src={fighter.image_url} alt={fighter.name} className="aspect-square w-full" />
      <div className="flex flex-col gap-1 p-3">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {fighter.organization_abbreviation}
        </span>
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{fighter.name}</p>
        <p className="text-xs text-ink-secondary">
          {fighter.weight_class} · {fighter.record}
        </p>
      </div>
    </Link>
  );
}
