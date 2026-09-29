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
    <nav className="border-b border-base-border bg-base-bg px-6 py-3 sm:px-10 lg:px-16">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0">
          <MMAUniverseLogo />
        </Link>

        <ul className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href} label={link.label} active={isActive(pathname, link.href)} />
            </li>
          ))}
          <li>
            <SignedIn>
              <NavLink href="/mes-pronostics" label="Mes pronostics" active={isActive(pathname, '/mes-pronostics')} />
            </SignedIn>
          </li>
          <li>
            <SignedIn>
              <NavLink href="/profil" label="Mon profil" active={isActive(pathname, '/profil')} />
            </SignedIn>
          </li>
          <li className="flex items-center">
            <SignedOut>
              <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
                Connexion
              </Link>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </li>
        </ul>

        {/* Below lg, links collapse into the toggled menu; the account avatar
            stays visible next to the toggle rather than hiding inside it. */}
        <div className="flex items-center gap-3 lg:hidden">
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
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
        <ul id="mobile-nav-menu" className="mt-4 flex flex-col gap-4 border-t border-base-border pt-4 lg:hidden">
          {links.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href} label={link.label} active={isActive(pathname, link.href)} />
            </li>
          ))}
          <li>
            <SignedIn>
              <NavLink href="/mes-pronostics" label="Mes pronostics" active={isActive(pathname, '/mes-pronostics')} />
            </SignedIn>
          </li>
          <li>
            <SignedIn>
              <NavLink href="/profil" label="Mon profil" active={isActive(pathname, '/profil')} />
            </SignedIn>
          </li>
          <li>
            <SignedOut>
              <Link href="/sign-in" className="font-display text-sm uppercase tracking-wide text-accent">
                Connexion
              </Link>
            </SignedOut>
          </li>
        </ul>
      )}
    </nav>
  );
}
