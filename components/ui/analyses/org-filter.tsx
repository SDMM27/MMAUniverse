import Link from 'next/link';
import { formatInteger } from './format';

/**
 * The page-level organization filter. Plain links (`?org=`) rather than client
 * state: the page is server-rendered from one cached dataset, and a filtered
 * view stays shareable.
 */
export default function OrgFilter({ options, active }: { options: { key: string; label: string; fights: number }[]; active: string }) {
  return (
    // Swipeable row on phones (faded right edge hints at more); wraps from sm up,
    // where a hidden horizontal scroll can't be reached with a mouse wheel.
    <nav
      aria-label="Organisation"
      className="scrollbar-none -mx-6 overflow-x-auto px-6 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] sm:mx-0 sm:overflow-visible sm:px-0 sm:[mask-image:none]"
    >
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {options.map((option) => {
          const isActive = option.key === active;
          return (
            <li key={option.key}>
              <Link
                href={`/analyses?org=${encodeURIComponent(option.key)}`}
                scroll={false}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col rounded-md border px-3 py-1.5 transition-colors ${
                  isActive ? 'border-accent bg-accent/10' : 'border-base-border hover:border-ink-secondary'
                }`}
              >
                <span className={`font-display text-sm uppercase tracking-wide ${isActive ? 'text-accent' : 'text-ink-primary'}`}>{option.label}</span>
                <span className="text-[11px] tabular-nums text-ink-secondary">{formatInteger(option.fights)} combats</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
