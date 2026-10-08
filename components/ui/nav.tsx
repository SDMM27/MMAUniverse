'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import MMAUniverseLogo from '@/components/ui/mma-universe-logo';

// "FightScore" (the calculated ranking, the site's flagship
// feature — see docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md)
// sits right after Accueil, ahead of everything else that used to come
// first. The pick'em leaderboard's own entry, previously also labeled
// "Classement" (a naming collision with an unrelated feature, never
// resolved before this — see that spec's correction note), is relabeled
// "Pronostics" to free the name up, matching the existing "Mes pronostics"
// family rather than inventing a new name for the calculated ranking.
const links = [
  { href: '/', label: 'Accueil' },
  { href: '/classement-calcule', label: 'FightScore' },
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/analyses', label: 'Analyses' },
  { href: '/actualites', label: 'Actualités' },
  { href: '/events', label: 'Événements' },
  { href: '/fighters', label: 'Fighters' },
  { href: '/organizations', label: 'Organisations' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/classement', label: 'Pronostics' },
];

function isActive(pathname: string, href: string) {
  // '/' would otherwise match every path as a prefix. Exact match or a '/'-
  // bounded prefix (for subroutes, e.g. /classement-calcule/methodologie)
  // -- a plain `startsWith` would wrongly mark '/classement' active while
  // viewing '/classement-calcule' (or vice versa), two distinct routes that
  // happen to share a string prefix.
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Account links live in the avatar's menu on wide screens: as two more nav
// entries they pushed the bar past the window (it needed ~1,530px signed in).
function AccountButton() {
  return (
    <UserButton afterSignOutUrl="/">
      <UserButton.MenuItems>
        <UserButton.Link label="Mes pronostics" href="/mes-pronostics" labelIcon={<MenuIcon d="M9 12l2 2 4-4M5 4h14v16H5z" />} />
        <UserButton.Link label="Mon profil" href="/profil" labelIcon={<MenuIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />} />
      </UserButton.MenuItems>
    </UserButton>
  );
}

function MenuIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`font-display text-sm uppercase tracking-wide transition-colors ${
        active ? 'text-accent' : 'text-ink-secondary hover:text-accent'
      }`}
    >
      {label}
    </Link>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu once the route actually changes, rather than on
  // each link's onClick — a click that doesn't end up navigating (e.g. the
  // already-active link) shouldn't dismiss it early.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav className="border-b border-base-border bg-base-bg px-6 py-3 sm:px-10 2xl:px-16">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0">
          <MMAUniverseLogo />
        </Link>

        <ul className="hidden items-center gap-4 xl:flex 2xl:gap-6">
          {links.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href} label={link.label} active={isActive(pathname, link.href)} />
            </li>
          ))}
          <li className="flex items-center">
            <SignedOut>
              <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
                Connexion
              </Link>
            </SignedOut>
            <SignedIn>
              <AccountButton />
            </SignedIn>
          </li>
        </ul>

        {/* Below xl, links collapse into the toggled menu (the full bar needs
            ~1,200px); the account avatar stays visible next to the toggle
            rather than hiding inside it. */}
        <div className="flex items-center gap-3 xl:hidden">
          <SignedIn>
            <AccountButton />
          </SignedIn>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav-menu"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-base-border text-ink-primary"
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <ul id="mobile-nav-menu" className="mt-4 flex flex-col gap-4 border-t border-base-border pt-4 xl:hidden">
          {links.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href} label={link.label} active={isActive(pathname, link.href)} />
            </li>
          ))}
          {/* Inside the auth guards, so the hidden ones don't leave empty gaps. */}
          <SignedIn>
            <li>
              <NavLink href="/mes-pronostics" label="Mes pronostics" active={isActive(pathname, '/mes-pronostics')} />
            </li>
            <li>
              <NavLink href="/profil" label="Mon profil" active={isActive(pathname, '/profil')} />
            </li>
          </SignedIn>
          <SignedOut>
            <li>
              <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
                Connexion
              </Link>
            </li>
          </SignedOut>
        </ul>
      )}
    </nav>
  );
}
