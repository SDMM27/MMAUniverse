'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center shell py-4 sm:py-6">
      <ErrorState title="Impossible de charger les combattants" />
      <button
        onClick={reset}
        className="mt-4 min-h-11 border-2 border-ink px-6 font-display uppercase text-ink hover:border-accent hover:text-accent-strong"
      >
        Réessayer
      </button>
    </main>
  );
}
