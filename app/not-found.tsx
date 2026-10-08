import type { Metadata } from 'next';
import Link from 'next/link';
import EmptyState from '@/components/ui/shared/empty-state';

export const metadata: Metadata = {
  title: 'Page introuvable',
  robots: { index: false, follow: false },
};

const LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/fighters', label: 'Combattants' },
  { href: '/events', label: 'Événements' },
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-xl">
        <EmptyState
          title="Page introuvable"
          description="Cette page n'existe pas ou a été déplacée. Retournez à l'accueil ou explorez les combattants et les événements."
        />
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-3">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-base-border px-4 py-2 text-sm text-ink-secondary transition-colors hover:border-accent hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
