// components/ui/picks/fight-pick-section.tsx
import Link from 'next/link';
import type { FightWithFighters } from '@/data/lib/definitions';
import type { StoredPick } from '@/data/lib/picks-data';
import PickForm from './pick-form';
import PickResult from './pick-result';

export default function FightPickSection({
  fight,
  locked,
  signedIn,
  pick,
}: {
  fight: FightWithFighters;
  locked: boolean;
  signedIn: boolean;
  pick: StoredPick | null;
}) {
  if (!signedIn) {
    return (
      <p className="rounded-lg border border-base-border bg-base-card p-4 text-center text-xs text-ink-secondary">
        <Link href="/sign-in" className="text-accent hover:underline">
          Connecte-toi
        </Link>{' '}
        pour pronostiquer ce combat.
      </p>
    );
  }

  if (locked) {
    return <PickResult fight={fight} pick={pick} />;
  }

  return <PickForm fight={fight} initialPick={pick} />;
}
