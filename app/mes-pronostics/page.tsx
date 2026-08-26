// app/mes-pronostics/page.tsx
import Link from 'next/link';
import { getOrCreateCurrentUser, fetchUserPickHistory } from '@/data/lib/picks-data';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB (and Clerk, for the current user) on every request instead
// of at build time — Vercel's build step doesn't reliably have DATABASE_URL /
// Clerk keys available yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const userId = await getOrCreateCurrentUser();

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-ink-secondary">Connecte-toi pour voir tes pronostics.</p>
        <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
          Connexion
        </Link>
      </main>
    );
  }

  const history = await fetchUserPickHistory(userId);
  const totalPoints = history.reduce((sum, entry) => sum + (entry.points ?? 0), 0);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-base-border pb-6">
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Mes pronostics</h1>
        <span className="font-display text-lg text-accent">{totalPoints} pts</span>
      </div>
      {history.length === 0 ? (
        <EmptyState title="Aucun pronostic" description="Va sur un événement à venir pour pronostiquer un combat." />
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((entry, index) => (
            <Link
              key={index}
              href={`/events/${entry.eventId}`}
              className="flex items-center justify-between rounded-lg border border-base-border bg-base-card p-4 transition-colors hover:border-accent"
            >
              <div>
                <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{entry.eventName}</p>
                <p className="text-xs text-ink-secondary">
                  {entry.fighter1Name} vs {entry.fighter2Name} · pronostic : {entry.predictedWinnerName}
                </p>
              </div>
              <span className="font-display text-sm text-accent">
                {entry.points === null ? 'À venir' : `${entry.points} pts`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
