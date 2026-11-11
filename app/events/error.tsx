'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <ErrorState title="Impossible de charger les events" />
      <button
        onClick={reset}
        className="mt-4 inline-flex min-h-11 items-center border-2 border-ink px-6 font-display uppercase text-ink hover:border-accent hover:text-accent-strong"
      >
        Réessayer
      </button>
    </main>
  );
}
