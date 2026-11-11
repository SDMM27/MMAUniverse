// components/ui/legal-page.tsx
// Shared shell + small building blocks for the plain-text legal pages.
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/data/lib/legal';

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
      <header className="border-b-2 border-ink pb-6">
        <h1 className="font-display text-[clamp(2.25rem,7vw,4rem)] uppercase leading-[0.9] text-ink [overflow-wrap:anywhere]">
          {title}
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase text-muted">Dernière mise à jour : {LEGAL_LAST_UPDATED}</p>
      </header>
      {children}
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex max-w-[68ch] flex-col gap-3 text-base leading-relaxed text-muted [overflow-wrap:anywhere]">
      <h2 className="border-l-4 border-accent pl-3 font-display text-xl uppercase text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function ContactLine() {
  return (
    <>
      par e-mail à{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-strong underline-offset-2 hover:underline">
        {CONTACT_EMAIL}
      </a>
    </>
  );
}
