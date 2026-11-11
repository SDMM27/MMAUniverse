'use client';

import { useEffect, useState } from 'react';
import { THEME_COLORS, THEME_STORAGE_KEY } from './theme-script';

type Scheme = 'dark' | 'light';

function readScheme(): Scheme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

// Dark/light switch. The initial theme is applied before paint by
// themeScript; this button only flips data-theme on <html> and remembers it.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  // null until mounted: the server can't know the stored choice, so both
  // icons stay hidden for that first frame instead of mismatching.
  const [scheme, setScheme] = useState<Scheme | null>(null);

  useEffect(() => {
    const current = readScheme();
    setScheme(current);
    // themeScript may run before Next inserts the theme-color meta: sync it here too.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[current]);
  }, []);

  function toggle() {
    const next: Scheme = readScheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[next]);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
    setScheme(next);
  }

  const dark = scheme !== 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-pressed={scheme === null ? undefined : dark}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-accent ${className}`}
    >
      {scheme !== null &&
        (dark ? (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="9" r="3.5" />
            <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" />
          </svg>
        ) : (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 10.5A6.5 6.5 0 017.5 3a6.5 6.5 0 107.5 7.5z" />
          </svg>
        ))}
    </button>
  );
}
