// Small building blocks shared by every FightScore ranking view (homepage
// hero/board, /classement-calcule): a ranked fighter row, the score bar,
// the streak badge. No hooks here, so both server and client components can
// render them.
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { rankTrend } from '@/data/lib/rating/weekly-trend';
import { fighterHref } from '@/data/lib/slug';

// display_score is NUMERIC -> string at runtime (see FighterRating's type comment).
export function formatScore(score: FighterRatingWithFighter['display_score']) {
  return Number(score).toFixed(1);
}

/** URL-hash-friendly id for a weight class, e.g. "Women's Flyweight" -> "womens-flyweight". */
export function weightClassSlug(weightClass: string) {
  return weightClass
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function formatUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(updatedAt));
}

/** Horizontal bar, 0-100 -- display_score is already rescaled to that range per division. Grows in on first paint. */
export function ScoreBar({ score, className = '', delayMs = 0 }: { score: FighterRatingWithFighter['display_score']; className?: string; delayMs?: number }) {
  const width = Math.max(0, Math.min(100, Number(score)));
  return (
    <div className={`h-1.5 overflow-hidden bg-surface-2 ${className}`} aria-hidden="true">
      <div className="fx-bar h-full bg-accent" style={{ width: `${width}%`, animationDelay: `${delayMs}ms` }} />
    </div>
  );
}

/** "4 V" / "2 D" -- current_streak is positive for a win streak, negative for a losing one. Nothing under 2. */
export function StreakBadge({ streak }: { streak: number }) {
  if (Math.abs(streak) < 2) return null;
  const winning = streak > 0;
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
        winning ? 'bg-live text-[#04140a]' : 'bg-surface-2 text-ink'
      }`}
      title={winning ? `${streak} victoires consécutives` : `${-streak} défaites consécutives`}
    >
      {Math.abs(streak)} {winning ? 'V' : 'D'}
    </span>
  );
}

/**
 * Week-over-week movement on a ranking list: "▲ 2" / "▼ 1" / "NEW", nothing
 * when unchanged or before the first comparable week. `rank` is the fighter's
 * position on the list as shown (a division's champion is 0).
 */
export function TrendBadge({ fighter, rank }: { fighter: FighterRatingWithFighter; rank: number }) {
  const trend = rankTrend(rank, fighter.previous_rank, Boolean(fighter.previous_week));
  if (trend.kind === 'none' || trend.kind === 'same') return null;
  const since = `depuis le classement du ${formatUpdatedAt(fighter.previous_week!)}`;
  if (trend.kind === 'new') {
    return (
      <span className="shrink-0 font-mono text-[11px] font-bold uppercase text-win-strong" title={`Nouveau dans ce classement ${since}`}>
        New
      </span>
    );
  }
  const up = trend.kind === 'up';
  const label = `${up ? 'Gagne' : 'Perd'} ${trend.places} place${trend.places > 1 ? 's' : ''} ${since}`;
  return (
    <span className={`shrink-0 font-mono text-[11px] font-bold tabular-nums ${up ? 'text-win-strong' : 'text-accent-strong'}`} title={label} aria-label={label}>
      {up ? '▲' : '▼'}
      {trend.places}
    </span>
  );
}

/**
 * One ranked fighter, "fight night" style: octagon rank, photo, name in
 * condensed capitals, a secondary line (division, style...), and the score
 * with its bar. Rows cascade in (`index` staggers them); `highlight` frames
 * #1 / the champion in red. Lay rows out in a `flex flex-col gap-2` list.
 */
export function FighterRankRow({
  fighter,
  rankLabel,
  rank,
  subtitle,
  highlight = false,
  index = 0,
}: {
  fighter: FighterRatingWithFighter;
  rankLabel: string;
  rank?: number; // position on the list, for the week-over-week TrendBadge (omit to show none)
  subtitle?: React.ReactNode;
  highlight?: boolean;
  index?: number; // position in the rendered list, for the cascade delay
}) {
  const delay = Math.min(index, 12) * 90;
  return (
    <Link
      href={fighterHref({ id: fighter.fighter_id, name: fighter.fighter_name })}
      style={{ animationDelay: `${delay}ms` }}
      className={`fx-row fx-in-left group flex min-h-[64px] items-center gap-3 border px-3 py-2 ${
        highlight ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-ink/40'
      }`}
    >
      <span
        className={`fx-oct grid h-10 w-10 shrink-0 place-items-center font-display text-lg leading-none sm:h-11 sm:w-11 sm:text-xl ${
          highlight ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'
        }`}
      >
        {rankLabel}
      </span>
      <CoverImage
        src={fighter.fighter_image_url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full"
        sizes="40px"
        objectPosition="top"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-display text-lg uppercase leading-none text-ink group-hover:text-accent-strong sm:text-xl">
          <CountryFlag code={fighter.fighter_nationality} className="shrink-0 text-xs" />
          <span className="truncate">{fighter.fighter_name}</span>
        </p>
        {/* The streak sits under the name rather than in its own column: on a phone that column
            left the name a handful of characters ("Manel Ka..."). */}
        <p className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase text-muted">
          {subtitle && <span className="truncate">{subtitle}</span>}
          <StreakBadge streak={fighter.current_streak} />
        </p>
      </div>
      {rank !== undefined && <TrendBadge fighter={fighter} rank={rank} />}
      <div className="w-16 shrink-0 text-right sm:w-28">
        <span className="font-display text-xl leading-none text-ink sm:text-2xl">{formatScore(fighter.display_score)}</span>
        <ScoreBar score={fighter.display_score} className="mt-1.5" delayMs={delay} />
      </div>
    </Link>
  );
}
