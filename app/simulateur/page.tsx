// app/simulateur/page.tsx
import Link from 'next/link';
import { fetchSimulatorFighters } from '@/data/lib/data';
import FightSimulator from '@/components/ui/ratings/fight-simulator';
import EmptyState from '@/components/ui/shared/empty-state';

// Queries the DB on every request instead of at build time (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Simulateur de combat · FightScore' };

export default async function Page() {
  const fighters = await fetchSimulatorFighters();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-8">
      <header className="border-b border-base-border pb-8">
        <p className="font-display text-xs uppercase tracking-widest text-accent">FightScore · UFC</p>
        <h1 className="mt-2 font-display text-4xl uppercase leading-none text-ink-primary md:text-5xl">Simulateur de combat</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-secondary">
          Choisis deux combattants : la simulation compare leur niveau FightScore (et l&apos;incertitude sur ce niveau), corrigé
          de leur âge, pour estimer les chances de victoire de chacun, puis la méthode et le round à partir de la façon dont leurs combats passés
          se sont terminés (KO, soumission, décision) et de la moyenne de leur catégorie. C&apos;est une estimation
          statistique, pas une prédiction de la forme du jour.{' '}
          <Link href="/classement-calcule/methodologie" className="text-accent hover:underline">
            Comment ça marche
          </Link>
          .
        </p>
      </header>

      {fighters.length === 0 ? (
        <EmptyState title="Simulateur indisponible" description="Le FightScore n'a pas encore été calculé." />
      ) : (
        <FightSimulator fighters={fighters} />
      )}
    </main>
  );
}
