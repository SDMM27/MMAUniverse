import Link from 'next/link';
import { FightHistoryEntry } from '@/data/lib/definitions';

const resultLabel: Record<FightHistoryEntry['result'], string> = {
  win: 'Victoire',
  loss: 'Défaite',
  draw: 'Nul',
  upcoming: 'À venir',
};

export default function FighterHistoryList({ fights }: { fights: FightHistoryEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {fights.map((fight) => (
        <li key={fight.id}>
          <Link
            href={`/events/${fight.event_id}`}
            className="flex items-center justify-between rounded-lg border border-base-border bg-base-card p-3 hover:border-accent"
          >
            <div>
              <p className="text-sm text-ink-primary">vs {fight.opponent_name ?? 'Adversaire inconnu'}</p>
              <p className="text-xs text-ink-secondary">
                {fight.event_name} · {fight.event_date}
              </p>
            </div>
            <span className="font-display text-xs uppercase tracking-wide text-accent">
              {resultLabel[fight.result]}
              {fight.result === 'win' && fight.method ? ` · ${fight.method}` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
