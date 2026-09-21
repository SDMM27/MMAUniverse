// app/classement-calcule/page.tsx
import Link from 'next/link';
import { fetchAllFighterRatings, fetchTopPoundForPound } from '@/data/lib/data';
import FightScoreList from '@/components/ui/ratings/fightscore-list';
import PoundForPoundList from '@/components/ui/ratings/pound-for-pound-list';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

const P4P_COUNT = 10;

export default async function Page() {
  const [ratings, p4p] = await Promise.all([fetchAllFighterRatings(), fetchTopPoundForPound(P4P_COUNT)]);

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

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Classement</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
          Un score calculé à partir des statistiques réelles de chaque combat — dominance, qualité des adversaires
          battus, activité — pas seulement l&apos;avis d&apos;une organisation.{' '}
          <Link href="/classement-calcule/methodologie" className="text-accent hover:underline">
            Comment ça marche
          </Link>
          .
        </p>
      </div>

      {(p4p.men.length > 0 || p4p.women.length > 0) && (
        <section>
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-ink-primary">Pound-for-Pound</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {p4p.men.length > 0 && <PoundForPoundList fighters={p4p.men} title="Hommes" />}
            {p4p.women.length > 0 && <PoundForPoundList fighters={p4p.women} title="Femmes" />}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-ink-primary">Par catégorie</h2>
        <FightScoreList ratings={ratings} />
      </section>
    </main>
  );
}
