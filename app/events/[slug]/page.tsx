import { notFound } from 'next/navigation';
import { fetchEventById, fetchFightsByEvent } from '@/data/lib/data';
import { splitMainEvent } from '@/data/lib/fight-utils';
import { CoverImage } from '@/components/ui/shared/media';
import FightCard from '@/components/ui/fights/fight-card';
import FightRow from '@/components/ui/fights/fight-row';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const event = await fetchEventById(params.slug);

  if (!event) {
    notFound();
  }

  const fights = await fetchFightsByEvent(params.slug);
  const { mainEvent, rest } = splitMainEvent(fights);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
        <CoverImage src={event.event_poster} alt={event.name} className="h-20 w-20 rounded-md" />
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{event.name}</h1>
          <p className="text-sm text-ink-secondary">
            {event.date} · {event.event_location}
          </p>
        </div>
      </div>
      {fights.length === 0 ? (
        <EmptyState
          title="Aucun combat annoncé"
          description="La card de cet événement n'a pas encore été communiquée."
        />
      ) : (
        <>
          {mainEvent && (
            <div>
              <FightCard fight={mainEvent} event={event} />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {rest.map((fight) => (
              <FightRow key={fight.id} fight={fight} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
