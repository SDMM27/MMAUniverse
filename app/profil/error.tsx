// app/profil/error.tsx
'use client';

import ErrorState from '@/components/ui/shared/error-state';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <ErrorState title="Impossible de charger ton profil" />
      <button
        onClick={reset}
        className="mt-4 rounded-md border border-base-border px-4 py-2 text-sm text-ink-secondary hover:border-accent hover:text-accent"
      >
        Réessayer
      </button>
    </main>
  );
}
