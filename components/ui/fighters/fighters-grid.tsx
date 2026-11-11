import FighterCard from './fighter-card';
import { FighterWithOrganization } from '@/data/lib/definitions';

export default function FightersGrid({ fighters }: { fighters: FighterWithOrganization[] }) {
  return (
    <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
      {fighters.map((fighter) => (
        <FighterCard key={fighter.id} fighter={fighter} />
      ))}
    </div>
  );
}
