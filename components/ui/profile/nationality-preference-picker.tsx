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
      <h2 className="font-display text-2xl uppercase leading-none text-ink">Nationalités préférées</h2>
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
              className={`flex min-h-11 items-center gap-1.5 border-2 px-3 font-mono text-xs uppercase disabled:opacity-40 ${
                selected ? 'border-accent bg-accent/10 text-accent-strong' : 'border-ink text-ink hover:bg-surface-2'
              }`}
            >
              <CountryFlag code={code} className="text-sm" />
              {code}
            </button>
          );
        })}
      </div>
      {status === 'error' && <p className="text-xs text-accent-strong">Erreur réseau, réessaie.</p>}
    </div>
  );
}
