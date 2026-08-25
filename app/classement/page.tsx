// app/classement/page.tsx
import { fetchAllTimeLeaderboard } from '@/data/lib/picks-data';
import EmptyState from '@/components/ui/shared/empty-state';

export default async function Page() {
  const leaderboard = await fetchAllTimeLeaderboard();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Classement</h1>
      {leaderboard.length === 0 ? (
        <EmptyState title="Aucun pronostic" description="Personne n'a encore pronostiqué d'événement." />
      ) : (
        <ol className="flex flex-col gap-2">
          {leaderboard.map((entry, index) => (
            <li
              key={entry.userId}
              className="flex items-center justify-between rounded-lg border border-base-border bg-base-card px-4 py-2"
            >
              <span className="text-sm text-ink-primary">
                #{index + 1} {entry.displayName}
              </span>
              <span className="font-display text-sm text-accent">{entry.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
