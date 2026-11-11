// app/profil/page.tsx
import Link from 'next/link';
import { getOrCreateCurrentUser } from '@/data/lib/picks-data';
import {
  fetchPreferredFighters,
  fetchPreferredNationalities,
  fetchAvailableNationalities,
} from '@/data/lib/profile-data';
import FighterPreferencePicker from '@/components/ui/profile/fighter-preference-picker';
import NationalityPreferencePicker from '@/components/ui/profile/nationality-preference-picker';
import DeleteAccount from '@/components/ui/profile/delete-account';
import type { Metadata } from 'next';

// Queries the DB (and Clerk, for the current user) on every request instead
// of at build time — Vercel's build step doesn't reliably have DATABASE_URL /
// Clerk keys available yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mon profil',
  description: 'Vos préférences : combattants favoris et nationalités suivies.',
  robots: { index: false, follow: false },
};

export default async function Page() {
  const userId = await getOrCreateCurrentUser();

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 shell py-4 sm:py-6 text-center">
        <p className="text-sm text-muted">Connecte-toi pour voir ton profil.</p>
        <Link href="/sign-in" className="fx-cut inline-flex min-h-11 items-center bg-accent px-6 font-display text-lg uppercase text-accent-ink">
          Connexion
        </Link>
      </main>
    );
  }

  const [preferredFighters, preferredNationalities, availableNationalities] = await Promise.all([
    fetchPreferredFighters(userId),
    fetchPreferredNationalities(userId),
    fetchAvailableNationalities(),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-8 shell py-4 sm:py-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">
          <span className="fx-live mr-2 inline-block h-2.5 w-2.5 rounded-full bg-accent align-middle" />
          Préférences
        </p>
        <h1 className="font-display uppercase leading-[0.9] text-[clamp(2.5rem,7vw,5rem)] text-ink">Mon profil</h1>
      </header>

      <FighterPreferencePicker preferredFighters={preferredFighters} />
      <NationalityPreferencePicker availableCodes={availableNationalities} preferredCodes={preferredNationalities} />
      <DeleteAccount />
    </main>
  );
}
