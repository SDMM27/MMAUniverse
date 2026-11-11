// components/ui/profile/delete-account.tsx
'use client';

import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';

export default function DeleteAccount() {
  const { signOut } = useClerk();
  const [status, setStatus] = useState<'idle' | 'confirm' | 'deleting' | 'error'>('idle');

  async function remove() {
    setStatus('deleting');
    try {
      const response = await fetch('/api/profile/account', { method: 'DELETE' });
      if (!response.ok) throw new Error('delete failed');
      await signOut({ redirectUrl: '/' });
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 className="font-display text-2xl uppercase leading-none text-ink">Supprimer mon compte</h2>
      <p className="text-xs leading-relaxed text-muted">
        Supprime définitivement ton compte, tes pronostics et tes préférences. Cette action est irréversible.
      </p>
      {status === 'idle' || status === 'error' ? (
        <button
          type="button"
          onClick={() => setStatus('confirm')}
          className="self-start min-h-11 border-2 border-danger px-4 font-display text-sm uppercase text-danger hover:bg-danger/10"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink">Confirmer la suppression définitive ?</span>
          <button
            type="button"
            onClick={remove}
            disabled={status === 'deleting'}
            className="min-h-11 bg-danger px-4 font-display text-sm uppercase text-accent-ink disabled:opacity-40"
          >
            {status === 'deleting' ? 'Suppression…' : 'Oui, supprimer'}
          </button>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            disabled={status === 'deleting'}
            className="min-h-11 border-2 border-ink px-4 font-display text-sm uppercase text-ink disabled:opacity-40"
          >
            Annuler
          </button>
        </div>
      )}
      {status === 'error' && <p className="text-xs text-danger">La suppression a échoué, réessaie.</p>}
    </div>
  );
}
