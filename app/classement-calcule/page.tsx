// app/classement-calcule/page.tsx
import Link from 'next/link';
import { fetchAllFighterRatings, fetchFightScoreSummary, fetchTopPoundForPound } from '@/data/lib/data';
import FightScoreList from '@/components/ui/ratings/fightscore-list';
import PoundForPoundList from '@/components/ui/ratings/pound-for-pound-list';
import { formatUpdatedAt } from '@/components/ui/ratings/fightscore-parts';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "FightScore : classement calculé de l'UFC",
  description: "Le classement FightScore de l'UFC : un score sur 100 par catégorie, calculé à partir des statistiques réelles de chaque combat.",
};

const P4P_COUNT = 10;

export default async function Page() {
  const [ratings, p4p, summary] = await Promise.all([fetchAllFighterRatings(), fetchTopPoundForPound(P4P_COUNT), fetchFightScoreSummary()]);

  if (ratings.length === 0) {
    return (
      <main className="flex min-h-screen flex-col gap-8 p-6">
        <EmptyState
          title="Classement pas encore calculé"
          description="Le classement calculé n'est disponible que pour l'UFC pour l'instant."
        />
      </main>
    );
  }

  const updatedAt = formatUpdatedAt(summary?.updated_at ?? null);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-8">
      <header className="flex flex-col gap-4 border-b border-base-border pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-widest text-accent">Classement calculé · UFC</p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none text-ink-primary md:text-5xl">FightScore</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-secondary">
            Un score sur 100 par catégorie, calculé à partir des statistiques réelles de chaque combat — dominance,
            qualité des adversaires battus, activité — pas seulement l&apos;avis d&apos;une organisation.{' '}
            <Link href="/classement-calcule/methodologie" className="text-accent hover:underline">
              Comment ça marche
            </Link>
            .
          </p>
        </div>
        {summary && (
          <p className="shrink-0 text-xs uppercase tracking-wide text-ink-secondary">
            {summary.ranked_count} combattants classés{updatedAt && ` · mis à jour le ${updatedAt}`}
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-4 font-display text-xl uppercase tracking-wide text-ink-primary">Par catégorie</h2>
        <FightScoreList ratings={ratings} />
      </section>

      {(p4p.men.length > 0 || p4p.women.length > 0) && (
        <section>
          <h2 className="mb-1 font-display text-xl uppercase tracking-wide text-ink-primary">Pound-for-Pound</h2>
          <p className="mb-4 text-sm text-ink-secondary">Les meilleurs FightScores, toutes catégories confondues.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {p4p.men.length > 0 && <PoundForPoundList fighters={p4p.men} title="Hommes" />}
            {p4p.women.length > 0 && <PoundForPoundList fighters={p4p.women} title="Femmes" />}
          </div>
        </section>
      )}
    </main>
  );
}
