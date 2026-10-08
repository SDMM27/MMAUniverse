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

export default function FighterHistoryList({ fights }: { fights: FightHistoryEntry[] }) {
  return (
    // Sherdog-style history table (Résultat / Adversaire / Événement / Méthode·Arbitre / R / Temps) —
    // this is the fighter's complete career record, sourced from fighter_fight_history (see
    // data/lib/data.ts's fetchFighterFightHistory), not just the fights we happened to scrape.
    <div className="overflow-x-auto rounded-lg border border-base-border">
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
                <span
                  className={`inline-block rounded px-2 py-1 font-display text-xs uppercase tracking-wide ${resultBadgeColor[fight.result as Exclude<FightHistoryEntry['result'], 'upcoming'>]}`}
                >
                  {resultLabel[fight.result as Exclude<FightHistoryEntry['result'], 'upcoming'>]}
                </span>
              </td>
              <td className="p-3 align-top text-ink-primary">
                {fight.opponent_id ? (
                  <Link href={fighterHref({ id: fight.opponent_id, name: fight.opponent_name })} className="text-accent hover:underline">
                    {fight.opponent_name ?? 'Adversaire inconnu'}
                  </Link>
                ) : fight.opponent_sherdog_url ? (
                  <a
                    href={fight.opponent_sherdog_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {fight.opponent_name ?? 'Adversaire inconnu'}
                  </a>
                ) : (
                  (fight.opponent_name ?? 'Adversaire inconnu')
                )}
              </td>
              <td className="p-3 align-top">
                {fight.event_id ? (
                  <Link href={`/events/${fight.event_id}`} className="text-accent hover:underline">
                    {displayEventName(fight.event_name)}
                  </Link>
                ) : fight.event_sherdog_url ? (
                  <a href={fight.event_sherdog_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {displayEventName(fight.event_name)}
                  </a>
                ) : (
                  <span className="text-ink-primary">{displayEventName(fight.event_name)}</span>
                )}
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
  );
}
