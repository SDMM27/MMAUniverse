import FightRow from '@/components/ui/fights/fight-row';
import { FightResultWithContext } from '@/data/lib/definitions';
import { displayEventName, formatEventDate } from '@/data/lib/event-utils';

export default function FightResultRow({ result }: { result: FightResultWithContext }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-xs uppercase tracking-wide text-accent">
        {result.organization_abbreviation} · {displayEventName(result.event_name)} · {formatEventDate(result.event_date)}
      </span>
      <FightRow fight={result} />
    </div>
  );
}
