// components/ui/footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-base-border px-6 py-6 text-xs text-ink-secondary">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>MMA Universe — site de fan indépendant, non affilié à l’UFC ni aux autres organisations citées.</p>
        <nav className="flex gap-4">
          <Link href="/mentions-legales" className="hover:text-ink-primary">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="hover:text-ink-primary">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
