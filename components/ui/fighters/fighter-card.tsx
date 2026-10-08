import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { FighterWithOrganization } from '@/data/lib/definitions';
import { fighterHref } from '@/data/lib/slug';

export default function FighterCard({ fighter }: { fighter: FighterWithOrganization }) {
  return (
    <Link
      href={fighterHref(fighter)}
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="aspect-square w-full"
        objectPosition="top"
      />
      <div className="flex flex-col gap-1 p-3">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {fighter.organization_abbreviation}
        </span>
        <div className="flex items-center gap-1.5">
          <CountryFlag code={fighter.nationality} className="shrink-0 text-sm" />
          <p className="truncate font-display text-sm uppercase tracking-wide text-ink-primary">{fighter.name}</p>
        </div>
        <p className="text-xs text-ink-secondary">
          {fighter.weight_class} · {fighter.record}
        </p>
      </div>
    </Link>
  );
}
