import Link from 'next/link';
import MMAUniverseLogo from '@/components/ui/mma-universe-logo';

const links = [
  { href: '/', label: 'Organisations' },
  { href: '/events', label: 'Events' },
  { href: '/fighters', label: 'Fighters' },
];

export default function Nav() {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-base-border bg-base-bg px-6 py-4">
      <Link href="/" className="shrink-0">
        <MMAUniverseLogo />
      </Link>
      <ul className="flex gap-6">
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
      </ul>
    </nav>
  );
}
