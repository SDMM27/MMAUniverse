import Link from 'next/link';
import { formatInteger } from './format';

/**
 * The page-level organization filter. Plain links (`?org=`) rather than client
 * state: the page is server-rendered from one cached dataset, and a filtered
 * view stays shareable.
 */
export default function OrgFilter({ options, active }: { options: { key: string; label: string; fights: number }[]; active: string }) {
  return (
    <nav aria-label="Organisation" className="scrollbar-none -mx-6 overflow-x-auto px-6">
      <ul className="flex w-max gap-2">
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
