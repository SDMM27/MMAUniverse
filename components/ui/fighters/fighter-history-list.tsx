import Link from 'next/link';
import { FightHistoryEntry } from '@/data/lib/definitions';

const resultLabel: Record<FightHistoryEntry['result'], string> = {
  win: 'Victoire',
  loss: 'Défaite',
  draw: 'Nul',
  nc: 'Sans décision',
  upcoming: 'À venir',
};

const resultBadgeColor: Record<FightHistoryEntry['result'], string> = {
  win: 'bg-win/15 text-win',
  loss: 'bg-accent/15 text-accent',
  draw: 'bg-ink-secondary/15 text-ink-secondary',
  nc: 'bg-ink-secondary/15 text-ink-secondary',
  upcoming: 'bg-ink-secondary/15 text-ink-secondary',
};

export default function FighterHistoryList({ fights }: { fights: FightHistoryEntry[] }) {
  const upcoming = fights.filter((f) => f.result === 'upcoming');
  const history = fights.filter((f) => f.result !== 'upcoming');

  return (
    <div className="flex flex-col gap-4">
      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-2">
          {upcoming.map((fight) => (
            <li key={fight.id}>
              <Link
                href={`/events/${fight.event_id}`}
                className="flex items-center justify-between rounded-lg border border-accent bg-base-card p-3 hover:border-accent"
              >
                <div>
                  <p className="text-sm text-ink-primary">vs {fight.opponent_name ?? 'Adversaire inconnu'}</p>
                  <p className="text-xs text-ink-secondary">
                    {fight.event_name} · {fight.event_date}
                  </p>
                </div>
                <span className="font-display text-xs uppercase tracking-wide text-accent">À venir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
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
              {history.map((fight, i) => (
                <tr key={fight.id} className={i % 2 === 1 ? 'bg-base-card/50' : undefined}>
                  <td className="p-3 align-top">
                    <span
                      className={`inline-block rounded px-2 py-1 font-display text-xs uppercase tracking-wide ${resultBadgeColor[fight.result]}`}
                    >
                      {resultLabel[fight.result]}
                    </span>
                  </td>
                  <td className="p-3 align-top text-ink-primary">{fight.opponent_name ?? 'Adversaire inconnu'}</td>
                  <td className="p-3 align-top">
                    {fight.event_id ? (
                      <Link href={`/events/${fight.event_id}`} className="text-accent hover:underline">
                        {fight.event_name}
                      </Link>
                    ) : fight.event_sherdog_url ? (
                      <a href={fight.event_sherdog_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        {fight.event_name}
                      </a>
                    ) : (
                      <span className="text-ink-primary">{fight.event_name}</span>
                    )}
                    <p className="text-xs text-ink-secondary">{fight.event_date}</p>
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
      )}
    </div>
  );
}
