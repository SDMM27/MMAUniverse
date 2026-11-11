// app/classement-calcule/page.tsx
import Link from 'next/link';
import { fetchAllFighterRatings, fetchFightScoreSummary, fetchTopPoundForPound } from '@/data/lib/data';
import FightScoreList from '@/components/ui/ratings/fightscore-list';
import PoundForPoundList from '@/components/ui/ratings/pound-for-pound-list';
import { formatUpdatedAt } from '@/components/ui/ratings/fightscore-parts';
import SectionHeading from '@/components/ui/fx/section-heading';
import CountUp from '@/components/ui/fx/count-up';
import RecomputeCountdown from '@/components/ui/fx/recompute-countdown';
import EmptyState from '@/components/ui/shared/empty-state';
import type { Metadata } from 'next';
import { staticPageMetadata } from '@/data/lib/seo-utils';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = staticPageMetadata({
  title: "FightScore : classement calculé de l'UFC",
  description: "Le classement FightScore de l'UFC : un score sur 100 par catégorie, calculé à partir des statistiques réelles de chaque combat.",
  path: '/classement-calcule',
});

const P4P_COUNT = 10;

export default async function Page() {
  const [ratings, p4p, summary] = await Promise.all([fetchAllFighterRatings(), fetchTopPoundForPound(P4P_COUNT), fetchFightScoreSummary()]);

  if (ratings.length === 0) {
    return (
      <main className="flex min-h-screen flex-col gap-8 p-4 sm:p-6">
        <EmptyState
          title="Classement pas encore calculé"
          description="Le classement calculé n'est disponible que pour l'UFC pour l'instant."
        />
      </main>
    );
  }

  const updatedAt = formatUpdatedAt(summary?.updated_at ?? null);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-4 sm:px-6 py-8">
      <header className="flex flex-col gap-5 border-b-2 border-ink pb-8">
        <p className="inline-flex items-center gap-2.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live h-2.5 w-2.5 rounded-full bg-accent" />
          FightScore · UFC
        </p>
        <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] uppercase leading-[0.9] text-ink">Classement calculé</h1>
        <p className="max-w-2xl text-base text-muted">
          Un score sur 100 par catégorie, calculé à partir des statistiques réelles de chaque combat — dominance,
          qualité des adversaires battus, activité — pas seulement l&apos;avis d&apos;une organisation.{' '}
          <Link href="/classement-calcule/methodologie" className="text-accent-strong hover:underline">
            Comment ça marche
          </Link>
          .
        </p>
        {summary && (
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="font-mono text-[11px] uppercase text-muted">Combattants classés</dt>
              <dd className="font-display text-4xl leading-none text-ink">
                <CountUp value={String(Number(summary.ranked_count))} />
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase text-muted">Catégories</dt>
              <dd className="font-display text-4xl leading-none text-ink">
                <CountUp value={String(Number(summary.division_count))} />
              </dd>
            </div>
            {updatedAt && (
              <div>
                <dt className="font-mono text-[11px] uppercase text-muted">Mis à jour</dt>
                <dd className="font-display text-4xl uppercase leading-none text-ink">{updatedAt}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/classement-calcule/methodologie"
            className="fx-cut inline-flex min-h-11 items-center bg-accent px-6 font-display text-lg uppercase text-accent-ink"
          >
            Méthodologie
          </Link>
          <Link
            href="/simulateur"
            className="inline-flex min-h-11 items-center border-2 border-ink px-6 font-display text-lg uppercase text-ink hover:border-accent hover:text-accent-strong"
          >
            Simulateur
          </Link>
        </div>
        <RecomputeCountdown />
      </header>

      <section>
        <SectionHeading title="Par catégorie" />
        <FightScoreList ratings={ratings} />
      </section>

      {(p4p.men.length > 0 || p4p.women.length > 0) && (
        <section>
          <SectionHeading title="Pound-for-Pound" caption="Les meilleurs FightScores, toutes catégories confondues" />
          <div className="grid gap-6 md:grid-cols-2">
            {p4p.men.length > 0 && <PoundForPoundList fighters={p4p.men} title="Hommes" />}
            {p4p.women.length > 0 && <PoundForPoundList fighters={p4p.women} title="Femmes" />}
          </div>
        </section>
      )}
    </main>
  );
}
