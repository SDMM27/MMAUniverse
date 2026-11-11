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
                className={`flex min-h-11 flex-col justify-center border-2 px-3 py-1 transition-colors ${
                  isActive ? 'border-ink bg-ink text-bg' : 'border-ink text-ink hover:bg-surface-2'
                }`}
              >
                <span className="font-display text-sm uppercase">{option.label}</span>
                <span className={`font-mono text-[10px] uppercase tabular-nums ${isActive ? 'text-bg/70' : 'text-muted'}`}>{formatInteger(option.fights)} combats</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
