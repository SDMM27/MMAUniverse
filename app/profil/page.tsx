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

// Queries the DB (and Clerk, for the current user) on every request instead
// of at build time — Vercel's build step doesn't reliably have DATABASE_URL /
// Clerk keys available yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const userId = await getOrCreateCurrentUser();

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-ink-secondary">Connecte-toi pour voir ton profil.</p>
        <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
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
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <h1 className="border-b border-base-border pb-6 font-display text-2xl uppercase tracking-wide text-ink-primary">
        Mon profil
      </h1>

      <FighterPreferencePicker preferredFighters={preferredFighters} />
      <NationalityPreferencePicker availableCodes={availableNationalities} preferredCodes={preferredNationalities} />
    </main>
  );
}
