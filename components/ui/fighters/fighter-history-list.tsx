import Link from 'next/link';
import { FightHistoryEntry } from '@/data/lib/definitions';
import { displayEventName, formatEventDate } from '@/data/lib/event-utils';
import { fighterHref } from '@/data/lib/slug';

// Only completed fights reach this component — the caller (app/fighters/[slug]/page.tsx)
// filters out 'upcoming' entries and spotlights the soonest one in the page header instead,
// so it isn't shown twice.
const resultLabel: Record<Exclude<FightHistoryEntry['result'], 'upcoming'>, string> = {
  win: 'Victoire',
  loss: 'Défaite',
  draw: 'Nul',
  nc: 'Sans décision',
};

const resultBadgeColor: Record<Exclude<FightHistoryEntry['result'], 'upcoming'>, string> = {
  win: 'bg-win/15 text-win',
  loss: 'bg-accent/15 text-accent',
  draw: 'bg-ink-secondary/15 text-ink-secondary',
  nc: 'bg-ink-secondary/15 text-ink-secondary',
};

type HistoryResult = Exclude<FightHistoryEntry['result'], 'upcoming'>;

function ResultBadge({ result }: { result: FightHistoryEntry['result'] }) {
  return (
    <span
      className={`inline-block rounded px-2 py-1 font-display text-xs uppercase tracking-wide ${resultBadgeColor[result as HistoryResult]}`}
    >
      {resultLabel[result as HistoryResult]}
    </span>
  );
}

// Internal fighter page when we know the opponent, Sherdog otherwise, plain text as a last resort.
function OpponentLink({ fight }: { fight: FightHistoryEntry }) {
  const name = fight.opponent_name ?? 'Adversaire inconnu';
  if (fight.opponent_id) {
    return (
      <Link href={fighterHref({ id: fight.opponent_id, name: fight.opponent_name })} className="text-accent hover:underline">
        {name}
      </Link>
    );
  }
  if (fight.opponent_sherdog_url) {
    return (
      <a href={fight.opponent_sherdog_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
        {name}
      </a>
    );
  }
  return <>{name}</>;
}

function EventLink({ fight }: { fight: FightHistoryEntry }) {
  const name = displayEventName(fight.event_name);
  if (fight.event_id) {
    return (
      <Link href={`/events/${fight.event_id}`} className="text-accent hover:underline">
        {name}
      </Link>
    );
  }
  if (fight.event_sherdog_url) {
    return (
      <a href={fight.event_sherdog_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
        {name}
      </a>
    );
  }
  return <span className="text-ink-primary">{name}</span>;
}

export default function FighterHistoryList({ fights }: { fights: FightHistoryEntry[] }) {
  return (
    <>
      {/* Phones: one card per fight — the 6-column table below needs a horizontal scroll. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {fights.map((fight) => {
          const outcome = [fight.method || null, fight.round ? `R${fight.round}` : null, fight.time || null].filter(Boolean);
          return (
            <li key={fight.id} className="flex flex-col gap-1 rounded-lg border border-base-border bg-base-card p-3">
              <div className="flex items-center justify-between gap-2">
                <ResultBadge result={fight.result} />
                <span className="text-xs text-ink-secondary">{formatEventDate(fight.event_date)}</span>
              </div>
              <p className="font-display text-base uppercase tracking-wide text-ink-primary">
                <OpponentLink fight={fight} />
              </p>
              <p className="text-sm">
                <EventLink fight={fight} />
              </p>
              {outcome.length > 0 && <p className="text-xs text-ink-secondary">{outcome.join(' · ')}</p>}
              {fight.referee && <p className="text-xs text-ink-secondary">Arbitre : {fight.referee}</p>}
            </li>
          );
        })}
      </ul>
      {/* Sherdog-style history table (Résultat / Adversaire / Événement / Méthode·Arbitre / R / Temps) —
          this is the fighter's complete career record, sourced from fighter_fight_history (see
          data/lib/data.ts's fetchFighterFightHistory), not just the fights we happened to scrape. */}
      <div className="hidden overflow-x-auto rounded-lg border border-base-border sm:block">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-base-border bg-base-card text-xs uppercase tracking-wide text-ink-secondary">
              <th className="p-3 font-display font-normal">Résultat</th>
              <th className="p-3 font-display font-normal">Adversaire</th>
              <th className="p-3 font-display font-normal">Événement</th>
              <th className="p-3 font-display font-normal">Méthode / Arbitre</th>
              <th className="p-3 font-display font-normal">R</th>
              <th className="p-3 font-display font-normal">Temps</th>
            </tr>
          </thead>
          <tbody>
            {fights.map((fight, i) => (
              <tr key={fight.id} className={i % 2 === 1 ? 'bg-base-card/50' : undefined}>
                <td className="p-3 align-top">
                  <ResultBadge result={fight.result} />
                </td>
                <td className="p-3 align-top text-ink-primary">
                  <OpponentLink fight={fight} />
                </td>
                <td className="p-3 align-top">
                  <EventLink fight={fight} />
                  <p className="text-xs text-ink-secondary">{formatEventDate(fight.event_date)}</p>
                </td>
                <td className="p-3 align-top text-ink-primary">
                  {fight.method || '—'}
                  {fight.referee && <p className="text-xs text-ink-secondary">{fight.referee}</p>}
                </td>
                <td className="p-3 align-top text-ink-primary">{fight.round ?? '—'}</td>
                <td className="p-3 align-top text-ink-primary">{fight.time || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
