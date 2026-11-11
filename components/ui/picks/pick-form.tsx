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
      <p className="border border-line bg-surface p-4 text-center text-xs text-muted">
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
    <div className="flex flex-col gap-3 border border-line bg-surface p-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Ton pronostic</p>
      <div className="grid grid-cols-2 gap-2">
        {[fight.fighter1, fight.fighter2].map((fighter) => (
          <button
            key={fighter.id}
            type="button"
            aria-pressed={winnerId === fighter.id}
            onClick={() => setWinnerId(fighter.id)}
            className={`min-h-11 w-full min-w-0 break-words border-2 px-3 py-2 font-display uppercase transition-colors ${winnerId === fighter.id ? 'border-ink bg-ink text-bg' : 'border-ink text-ink hover:bg-surface-2'}`}
          >
            {fighter.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(methodLabels) as MethodCategory[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={method === option}
            onClick={() => setMethod(option)}
            className={`min-h-11 border-2 px-2 py-2 font-mono text-[11px] font-bold uppercase transition-colors ${method === option ? 'border-ink bg-ink text-bg' : 'border-line text-ink hover:border-ink hover:bg-surface-2'}`}
          >
            {methodLabels[option]}
          </button>
        ))}
      </div>
      {method && method !== 'decision' && (
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: getScheduledRounds(fight) }, (_, i) => i + 1).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={round === r}
              aria-label={`Round ${r}`}
              onClick={() => setRound(r)}
              className={`h-11 w-11 border-2 font-mono text-xs font-bold transition-colors ${round === r ? 'border-ink bg-ink text-bg' : 'border-line text-ink hover:border-ink hover:bg-surface-2'}`}
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
        className="fx-cut min-h-11 bg-accent px-6 py-2 font-display text-lg uppercase text-accent-ink disabled:opacity-40"
      >
        {status === 'saving' ? 'Enregistrement...' : 'Valider le pronostic'}
      </button>
      {status === 'error' && <p role="alert" className="text-center text-xs text-danger">Erreur réseau, réessaie.</p>}
    </div>
  );
}
