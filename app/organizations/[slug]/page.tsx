import { notFound } from 'next/navigation';
import { fetchOrganizationById, fetchEventsByOrg } from '@/data/lib/data';
import { CoverImage } from '@/components/ui/shared/media';
import EventCard from '@/components/ui/events/event-card';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const organization = await fetchOrganizationById(params.slug);

  if (!organization) {
    notFound();
  }

  const events = await fetchEventsByOrg(params.slug);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
        <CoverImage src={organization.logo_link} alt={organization.name} className="h-16 w-16 rounded-full" />
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</p>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{organization.name}</h1>
        </div>
      </div>
      {events.length === 0 ? (
        <EmptyState
          title="Aucun événement programmé"
          description="Revenez plus tard pour les prochains events de cette organisation."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
