// components/ui/picks/fight-pick-section.tsx
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
  // Signed-out visitors get a single sign-in banner at the top of the card
  // (app/events/[slug]/page.tsx) instead of one prompt under every fight.
  if (!signedIn) return null;

  if (locked) {
    return <PickResult fight={fight} pick={pick} />;
  }

  return <PickForm fight={fight} initialPick={pick} />;
}
