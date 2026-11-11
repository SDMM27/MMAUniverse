import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Event, Organization } from '@/data/lib/definitions';
import { displayEventName, formatEventDate } from '@/data/lib/event-utils';

export type OrganizationWithActivity = Organization & {
  nextEvent?: Event & { isUpcoming: boolean };
  eventCount?: number;
};

export default function OrganizationCard({ organization }: { organization: OrganizationWithActivity }) {
  const { nextEvent, eventCount } = organization;

  return (
    <Link
      href={`/organizations/${organization.id}`}
      className="fx-card flex min-w-0 flex-col items-center gap-3 border border-line bg-surface p-4 text-center hover:border-accent"
    >
      <CoverImage
        src={organization.logo_link}
        alt={organization.name}
        className="fx-shake h-16 w-16 rounded-full"
      />
      <div className="min-w-0">
        <p className="font-display text-2xl uppercase leading-none text-ink">{organization.abbreviation}</p>
        <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">{organization.name}</p>
      </div>
      <div className="mt-auto flex w-full flex-col items-center gap-0.5 border-t border-line pt-2">
        {nextEvent ? (
          <>
            <span className="font-mono text-[11px] font-bold uppercase text-accent-strong">
              {nextEvent.isUpcoming ? 'Prochain' : 'Dernier'}
            </span>
            <p className="line-clamp-1 max-w-full text-xs text-ink">{displayEventName(nextEvent.name)}</p>
            <p className="font-mono text-[11px] uppercase text-muted">{formatEventDate(nextEvent.date)}</p>
          </>
        ) : (
          <p className="text-[11px] text-muted">Aucun événement</p>
        )}
        {typeof eventCount === 'number' && eventCount > 0 && (
          <p className="mt-1 font-mono text-[11px] uppercase text-muted">
            {eventCount} événement{eventCount > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
