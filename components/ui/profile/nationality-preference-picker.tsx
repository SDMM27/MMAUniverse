// components/ui/profile/nationality-preference-picker.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CountryFlag } from '@/components/ui/shared/country-flag';

export default function NationalityPreferencePicker({
  availableCodes,
  preferredCodes,
}: {
  availableCodes: string[];
  preferredCodes: string[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const preferredSet = new Set(preferredCodes);

  async function toggle(code: string) {
    setStatus('saving');
    try {
      const response = await fetch('/api/profile/nationalities', {
        method: preferredSet.has(code) ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error('toggle failed');
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-primary">Nationalités préférées</h2>
      <div className="flex flex-wrap gap-2">
        {availableCodes.map((code) => {
          const selected = preferredSet.has(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              disabled={status === 'saving'}
              aria-pressed={selected}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs uppercase tracking-wide disabled:opacity-40 ${
                selected ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'
              }`}
            >
              <CountryFlag code={code} className="text-sm" />
              {code}
            </button>
          );
        })}
      </div>
      {status === 'error' && <p className="text-xs text-accent">Erreur réseau, réessaie.</p>}
    </div>
  );
}
