import Link from 'next/link';
import FightRow from '@/components/ui/fights/fight-row';
import { FightResultWithContext } from '@/data/lib/definitions';
import { displayEventName, formatEventDate } from '@/data/lib/event-utils';

export default function FightResultRow({ result }: { result: FightResultWithContext }) {
  return (
    <Link
      href={`/events/${result.event_id}`}
      className="flex flex-col gap-1 hover:[&>div]:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="font-mono text-[11px] font-bold uppercase text-accent-strong">
        {result.organization_abbreviation} · {displayEventName(result.event_name)} · {formatEventDate(result.event_date)}
      </span>
      <FightRow fight={result} linkFighters={false} />
    </Link>
  );
}
