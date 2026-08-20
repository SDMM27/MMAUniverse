import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Event, Organization } from '@/data/lib/definitions';

export type OrganizationWithActivity = Organization & {
  nextEvent?: Event & { isUpcoming: boolean };
  eventCount?: number;
};

export default function OrganizationCard({ organization }: { organization: OrganizationWithActivity }) {
  const { nextEvent, eventCount } = organization;

  return (
    <Link
      href={`/organizations/${organization.id}`}
      className="flex flex-col items-center gap-3 rounded-lg border border-base-border bg-base-card p-4 text-center transition-colors hover:border-accent"
    >
      <CoverImage
        src={organization.logo_link}
        alt={organization.name}
        className="h-16 w-16 rounded-full"
      />
      <div>
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{organization.abbreviation}</p>
        <p className="text-xs text-ink-secondary">{organization.name}</p>
      </div>
      <div className="mt-auto flex flex-col items-center gap-0.5 border-t border-base-border pt-2 w-full">
        {nextEvent ? (
          <>
            <span className="font-display text-[11px] uppercase tracking-wide text-accent">
              {nextEvent.isUpcoming ? 'Prochain' : 'Dernier'}
            </span>
            <p className="line-clamp-1 text-xs text-ink-primary">{nextEvent.name}</p>
            <p className="text-[11px] text-ink-secondary">{nextEvent.date}</p>
          </>
        ) : (
          <p className="text-[11px] text-ink-secondary">Aucun événement</p>
        )}
        {typeof eventCount === 'number' && eventCount > 0 && (
          <p className="mt-1 text-[11px] text-ink-secondary">
            {eventCount} événement{eventCount > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
