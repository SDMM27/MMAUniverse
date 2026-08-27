// components/ui/picks/pick-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FightWithFighters, MethodCategory } from '@/data/lib/definitions';
import type { StoredPick } from '@/data/lib/picks-data';
import { getScheduledRounds } from '@/data/lib/fight-utils';

const methodLabels: Record<MethodCategory, string> = {
  ko_tko: 'KO / TKO',
  submission: 'Soumission',
  decision: 'Décision',
};

export default function PickForm({
  fight,
  initialPick,
}: {
  fight: FightWithFighters;
  initialPick: StoredPick | null;
}) {
  const router = useRouter();
  const [winnerId, setWinnerId] = useState<number | null>(initialPick?.predicted_winner_id ?? null);
  const [method, setMethod] = useState<MethodCategory | null>(initialPick?.predicted_method_category ?? null);
  const [round, setRound] = useState<number | null>(initialPick?.predicted_round ?? null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Matches FightRow's own message above this component for the same fight —
  // silently rendering nothing here left the pronostic UI looking simply
  // missing, with no indication of why.
  if (!fight.fighter1 || !fight.fighter2) {
    return (
      <p className="rounded-lg border border-base-border bg-base-card p-4 text-center text-xs text-ink-secondary">
        Pronostic indisponible : données des combattants manquantes.
      </p>
    );
  }

  async function handleSubmit() {
    if (!winnerId || !method) return;
    setStatus('saving');
    try {
      const response = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fightId: fight.id,
          predictedWinnerId: winnerId,
          predictedMethodCategory: method,
          predictedRound: method === 'decision' ? null : round,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-base-border bg-base-card p-4">
      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={() => setWinnerId(fight.fighter1!.id)}
          className={`rounded-md border px-4 py-2 font-display text-sm uppercase tracking-wide ${winnerId === fight.fighter1!.id ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
        >
          {fight.fighter1.name}
        </button>
        <button
          type="button"
          onClick={() => setWinnerId(fight.fighter2!.id)}
          className={`rounded-md border px-4 py-2 font-display text-sm uppercase tracking-wide ${winnerId === fight.fighter2!.id ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
        >
          {fight.fighter2.name}
        </button>
      </div>
      <div className="flex justify-center gap-2">
        {(Object.keys(methodLabels) as MethodCategory[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMethod(option)}
            className={`rounded-md border px-3 py-1 text-xs uppercase tracking-wide ${method === option ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
          >
            {methodLabels[option]}
          </button>
        ))}
      </div>
      {method && method !== 'decision' && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: getScheduledRounds(fight) }, (_, i) => i + 1).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRound(r)}
              className={`h-8 w-8 rounded-md border text-xs ${round === r ? 'border-accent text-accent' : 'border-base-border text-ink-secondary'}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!winnerId || !method || status === 'saving'}
        className="rounded-md bg-accent px-4 py-2 font-display text-sm uppercase tracking-wide text-white disabled:opacity-40"
      >
        {status === 'saving' ? 'Enregistrement...' : 'Valider le pronostic'}
      </button>
      {status === 'error' && <p className="text-center text-xs text-accent">Erreur réseau, réessaie.</p>}
    </div>
  );
}
