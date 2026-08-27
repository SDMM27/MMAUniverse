import { notFound } from 'next/navigation';
import { fetchFighterById, fetchFighterFightHistory } from '@/data/lib/data';
import { computeFighterStats } from '@/data/lib/fighter-stats';
import { CoverImage } from '@/components/ui/shared/media';
import FighterHistoryList from '@/components/ui/fighters/fighter-history-list';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page({ params }: { params: { slug: string } }) {
  const fighter = await fetchFighterById(params.slug);

  if (!fighter) {
    notFound();
  }

  const fights = await fetchFighterFightHistory(params.slug);
  const stats = computeFighterStats(fights);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="relative h-24 rounded-t-lg bg-base-card">
        <CoverImage
          src={fighter.image_url}
          alt={fighter.name}
          className="absolute -bottom-6 left-4 h-16 w-16 rounded-lg border-2 border-base-bg"
        />
      </div>
      <div className="pl-4">
        <p className="font-display text-xs uppercase tracking-wide text-accent">
          {fighter.organization_abbreviation} · {fighter.weight_class}
        </p>
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{fighter.name}</h1>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Wins" value={stats.wins} />
        <StatBox label="Losses" value={stats.losses} />
        <StatBox label="KO" value={stats.ko} />
      </div>
      <div>
        <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-ink-secondary">Historique</h2>
        {fights.length === 0 ? (
          <EmptyState title="Aucun combat enregistré" />
        ) : (
          <FighterHistoryList fights={fights} />
        )}
      </div>
    </main>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-base-border bg-base-card p-3 text-center">
      <p className="font-display text-xl text-ink-primary">{value}</p>
      <p className="text-xs uppercase tracking-wide text-ink-secondary">{label}</p>
    </div>
  );
}
