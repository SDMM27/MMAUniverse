import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page introuvable',
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: '/fighters', label: 'Combattants' },
  { href: '/events', label: 'Événements' },
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-center sm:p-6">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent-strong">Page introuvable</p>
      <h1 className="fx-punch font-display text-[clamp(7rem,30vw,16rem)] uppercase leading-[0.8] text-ink">
        4<span className="text-accent">0</span>4
      </h1>
      <p className="max-w-md text-sm text-muted">
        Cette page n&apos;existe pas ou a été déplacée. Retournez à l&apos;accueil ou explorez les combattants et les
        événements.
      </p>
      <Link
        href="/"
        className="fx-cut inline-flex min-h-11 items-center bg-accent px-6 font-display text-lg uppercase text-accent-ink"
      >
        Retour à l&apos;accueil
      </Link>
      <nav className="flex flex-wrap items-center justify-center gap-3">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center border-2 border-ink px-5 font-display uppercase text-ink hover:border-accent hover:text-accent-strong"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
