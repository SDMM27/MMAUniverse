// components/ui/footer.tsx
import Link from 'next/link';

const LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/credits-photos', label: 'Crédits photos' },
];

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink px-4 py-8 sm:px-6">
      <p className="font-display text-[clamp(2.5rem,9vw,5rem)] uppercase leading-[0.9] text-ink">
        MMA<span className="text-accent">/</span>Universe
      </p>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl font-mono text-[11px] uppercase leading-relaxed text-muted">
          Site de fan indépendant, non affilié à l’UFC ni aux autres organisations citées.
        </p>
        <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="fx-underline flex min-h-11 items-center font-mono text-[11px] uppercase text-ink hover:text-accent-strong"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
