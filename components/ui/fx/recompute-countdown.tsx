'use client';

import { useEffect, useState } from 'react';

// The FightScore is recomputed by .github/workflows/weekly-fightscore.yml,
// cron `0 12 * * 1`: every Monday at 12:00 UTC. Keep the two in sync.
const RECOMPUTE_DAY = 1; // Monday (getUTCDay)
const RECOMPUTE_HOUR_UTC = 12;

export function nextRecompute(now: Date): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RECOMPUTE_HOUR_UTC));
  let days = (RECOMPUTE_DAY - now.getUTCDay() + 7) % 7;
  if (days === 0 && next.getTime() <= now.getTime()) days = 7;
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

const pad = (n: number) => String(n).padStart(2, '0');

function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 86400)} J ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// Live countdown to the next Monday recompute. Rendered empty on the server
// (the time is the visitor's) and filled on mount, then once a second.
export default function RecomputeCountdown({ className = '' }: { className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const target = now === null ? null : nextRecompute(new Date(now));
  return (
    <p className={`font-mono text-xs uppercase tracking-wider text-muted ${className}`}>
      Prochain recalcul dans{' '}
      <time
        dateTime={target?.toISOString()}
        className="inline-block min-w-[11ch] text-sm font-bold text-ink tabular-nums"
        title={target ? target.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }) : undefined}
      >
        {now === null || target === null ? '— J --:--:--' : format(target.getTime() - now)}
      </time>
    </p>
  );
}
