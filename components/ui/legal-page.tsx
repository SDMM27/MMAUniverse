// components/ui/legal-page.tsx
// Shared shell + small building blocks for the plain-text legal pages.
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/data/lib/legal';

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 p-6">
      <header className="border-b border-base-border pb-6">
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{title}</h1>
        <p className="mt-2 text-xs text-ink-secondary">Dernière mise à jour : {LEGAL_LAST_UPDATED}</p>
      </header>
      {children}
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-sm leading-relaxed text-ink-secondary">
      <h2 className="font-display text-sm uppercase tracking-wide text-ink-primary">{title}</h2>
      {children}
    </section>
  );
}

export function ContactLine() {
  if (!CONTACT_EMAIL) return <>via l’adresse de contact indiquée dans les mentions légales</>;
  return (
    <>
      par e-mail à{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline-offset-2 hover:underline">
        {CONTACT_EMAIL}
      </a>
    </>
  );
}
