// app/classement/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <ErrorState title="Impossible de charger le classement" />
      <button
        onClick={reset}
        className="mt-4 min-h-11 border-2 border-ink px-5 font-display text-sm uppercase text-ink hover:border-accent hover:text-accent-strong"
      >
        Réessayer
      </button>
    </main>
  );
}
