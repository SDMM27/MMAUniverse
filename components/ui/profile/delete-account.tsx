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
    <div className="flex flex-col gap-3 border-t border-base-border pt-6">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-primary">Supprimer mon compte</h2>
      <p className="text-xs leading-relaxed text-ink-secondary">
        Supprime définitivement ton compte, tes pronostics et tes préférences. Cette action est irréversible.
      </p>
      {status === 'idle' || status === 'error' ? (
        <button
          type="button"
          onClick={() => setStatus('confirm')}
          className="self-start rounded-md border border-red-500/60 px-3 py-1.5 text-xs uppercase tracking-wide text-red-400 hover:bg-red-500/10"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-primary">Confirmer la suppression définitive ?</span>
          <button
            type="button"
            onClick={remove}
            disabled={status === 'deleting'}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs uppercase tracking-wide text-white disabled:opacity-40"
          >
            {status === 'deleting' ? 'Suppression…' : 'Oui, supprimer'}
          </button>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            disabled={status === 'deleting'}
            className="rounded-md border border-base-border px-3 py-1.5 text-xs uppercase tracking-wide text-ink-secondary disabled:opacity-40"
          >
            Annuler
          </button>
        </div>
      )}
      {status === 'error' && <p className="text-xs text-red-400">La suppression a échoué, réessaie.</p>}
    </div>
  );
}
