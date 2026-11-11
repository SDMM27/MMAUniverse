// app/mes-pronostics/page.tsx
import Link from 'next/link';
import { getOrCreateCurrentUser, fetchUserPickHistory } from '@/data/lib/picks-data';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';

// Queries the DB (and Clerk, for the current user) on every request instead
// of at build time — Vercel's build step doesn't reliably have DATABASE_URL /
// Clerk keys available yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mes pronostics',
  description: 'Votre historique de pronostics et vos points.',
  robots: { index: false, follow: false },
};

export default async function Page() {
  const userId = await getOrCreateCurrentUser();

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 sm:p-6 text-center">
        <p className="text-sm text-muted">Connecte-toi pour voir tes pronostics.</p>
        <Link href="/sign-in" className="fx-cut inline-flex min-h-11 items-center bg-accent px-6 font-display text-lg uppercase text-accent-ink">
          Connexion
        </Link>
      </main>
    );
  }

  const history = await fetchUserPickHistory(userId);
  const totalPoints = history.reduce((sum, entry) => sum + (entry.points ?? 0), 0);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
          Mon historique
        </p>
        <h1 className="font-display uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] text-ink">Mes pronostics</h1>
      </header>
        <span className="sd-stamp border-2 border-accent bg-accent/10 px-4 py-1 font-display text-3xl uppercase text-accent-strong">{totalPoints} pts</span>
      </div>
      {history.length === 0 ? (
        <EmptyState title="Aucun pronostic" description="Va sur un événement à venir pour pronostiquer un combat." />
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((entry, index) => (
            <Link
              key={index}
              href={`/events/${entry.eventId}`}
              className="fx-card flex min-h-11 items-center justify-between gap-3 border border-line bg-surface p-4 hover:border-accent"
            >
              <div className="min-w-0">
                <p className="font-display text-base uppercase text-ink">{entry.eventName}</p>
                <p className="font-mono text-[11px] uppercase text-muted [overflow-wrap:anywhere]">
                  {entry.fighter1Name} vs {entry.fighter2Name} · pronostic : {entry.predictedWinnerName}
                </p>
              </div>
              <span className="shrink-0 font-display text-lg uppercase text-accent-strong">
                {entry.points === null ? 'À venir' : `${entry.points} pts`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
