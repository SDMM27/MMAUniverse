// app/onboarding/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
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
    redirect('/sign-in');
  }

  const [preferredFighters, preferredNationalities, availableNationalities] = await Promise.all([
    fetchPreferredFighters(userId),
    fetchPreferredNationalities(userId),
    fetchAvailableNationalities(),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <div className="flex flex-col gap-2 border-b border-base-border pb-6">
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Bienvenue !</h1>
        <p className="text-sm text-ink-secondary">
          Choisis tes combattants et nationalités préférés — tu pourras toujours les modifier plus tard depuis &quot;Mon profil&quot;.
        </p>
      </div>

      <FighterPreferencePicker preferredFighters={preferredFighters} />
      <NationalityPreferencePicker availableCodes={availableNationalities} preferredCodes={preferredNationalities} />

      <div className="flex justify-end gap-4 border-t border-base-border pt-6">
        <Link href="/" className="font-display text-sm uppercase tracking-wide text-ink-secondary hover:text-accent">
          Plus tard
        </Link>
        <Link href="/" className="rounded-md bg-accent px-4 py-2 font-display text-sm uppercase tracking-wide text-white">
          Terminer
        </Link>
      </div>
    </main>
  );
}
