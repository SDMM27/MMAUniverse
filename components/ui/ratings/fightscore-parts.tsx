// Small building blocks shared by every FightScore ranking view (homepage
// hero/board, /classement-calcule): a ranked fighter row, the score bar,
// the streak badge. No hooks here, so both server and client components can
// render them.
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { FighterRatingWithFighter } from '@/data/lib/definitions';

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

/** Horizontal bar, 0-100 -- display_score is already rescaled to that range per division. */
export function ScoreBar({ score, className = '' }: { score: FighterRatingWithFighter['display_score']; className?: string }) {
  const width = Math.max(0, Math.min(100, Number(score)));
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-base-border ${className}`} aria-hidden="true">
      <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
    </div>
  );
}

/** "4 V" / "2 D" -- current_streak is positive for a win streak, negative for a losing one. Nothing under 2. */
export function StreakBadge({ streak }: { streak: number }) {
  if (Math.abs(streak) < 2) return null;
  const winning = streak > 0;
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 font-display text-[11px] uppercase tracking-wide ${
        winning ? 'bg-win/15 text-win' : 'bg-ink-secondary/15 text-ink-secondary'
      }`}
      title={winning ? `${streak} victoires consécutives` : `${-streak} défaites consécutives`}
    >
      {Math.abs(streak)} {winning ? 'V' : 'D'}
    </span>
  );
}

/**
 * One ranked fighter: position, photo, flag + name, a secondary line
 * (division, style...), and the score with its bar. `highlight` gives the
 * row the accent treatment used for #1 / the champion.
 */
export function FighterRankRow({
  fighter,
  rankLabel,
  subtitle,
  highlight = false,
}: {
  fighter: FighterRatingWithFighter;
  rankLabel: string;
  subtitle?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={`/fighters/${fighter.fighter_id}`}
      className={`group flex items-center gap-3 border-b border-base-border px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.03] ${
        highlight ? 'bg-accent/[0.06]' : ''
      }`}
    >
      <span
        className={`w-7 shrink-0 text-center font-display text-base ${highlight ? 'text-accent' : 'text-ink-secondary'}`}
      >
        {rankLabel}
      </span>
      <CoverImage
        src={fighter.fighter_image_url}
        alt={fighter.fighter_name}
        className="h-10 w-10 shrink-0 rounded-full"
        sizes="40px"
        objectPosition="top"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm text-ink-primary group-hover:text-accent">
          <CountryFlag code={fighter.fighter_nationality} className="shrink-0 text-xs" />
          <span className="truncate">{fighter.fighter_name}</span>
        </p>
        {subtitle && <p className="truncate text-xs text-ink-secondary">{subtitle}</p>}
      </div>
      <StreakBadge streak={fighter.current_streak} />
      <div className="w-16 shrink-0 text-right sm:w-24">
        <span className="font-display text-base text-ink-primary">{formatScore(fighter.display_score)}</span>
        <ScoreBar score={fighter.display_score} className="mt-1" />
      </div>
    </Link>
  );
}
