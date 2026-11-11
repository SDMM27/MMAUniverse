import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { FighterWithOrganization } from '@/data/lib/definitions';
import { fighterHref } from '@/data/lib/slug';

export default function FighterCard({ fighter }: { fighter: FighterWithOrganization }) {
  return (
    <Link
      href={fighterHref(fighter)}
      className="fx-card flex min-w-0 flex-col overflow-hidden border border-line bg-surface"
    >
      <CoverImage
        src={fighter.image_url}
        alt={fighter.name}
        className="aspect-square w-full"
        objectPosition="top"
      />
      <div className="flex min-w-0 flex-col gap-1 p-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent-strong">
          {fighter.organization_abbreviation}
        </span>
        <div className="flex items-start gap-1.5">
          <CountryFlag code={fighter.nationality} className="mt-0.5 shrink-0 text-sm" />
          <p className="line-clamp-2 min-w-0 font-display text-lg uppercase leading-[0.95] text-ink [overflow-wrap:anywhere]">{fighter.name}</p>
        </div>
        <p className="font-mono text-[11px] uppercase text-muted">
          {fighter.weight_class} · {fighter.record}
        </p>
      </div>
    </Link>
  );
}
