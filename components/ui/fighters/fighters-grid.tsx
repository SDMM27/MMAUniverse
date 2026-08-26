import FighterCard from './fighter-card';
import { FighterWithOrganization } from '@/data/lib/definitions';

export default function FightersGrid({ fighters }: { fighters: FighterWithOrganization[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {fighters.map((fighter) => (
        <FighterCard key={fighter.id} fighter={fighter} />
      ))}
    </div>
  );
}
