import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import MMAUniverseLogo from '@/components/ui/mma-universe-logo';

const links = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
  { href: '/organizations', label: 'Organisations' },
  { href: '/classement', label: 'Classement' },
];

export default function Nav() {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-base-border bg-base-bg px-6 py-4">
      <Link href="/" className="shrink-0">
        <MMAUniverseLogo />
      </Link>
      <ul className="flex items-center gap-6">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-display text-sm uppercase tracking-wide text-ink-secondary hover:text-accent"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <SignedIn>
            <Link
              href="/mes-pronostics"
              className="font-display text-sm uppercase tracking-wide text-ink-secondary hover:text-accent"
            >
              Mes pronostics
            </Link>
          </SignedIn>
        </li>
        <li className="flex items-center">
          <SignedOut>
            <Link
              href="/sign-in"
              className="font-display text-sm uppercase tracking-wide text-accent"
            >
              Connexion
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </li>
      </ul>
    </nav>
  );
}
