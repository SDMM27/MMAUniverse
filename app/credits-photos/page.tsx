// app/credits-photos/page.tsx
// Attribution for every fighter photo on the site (and in the app), as the
// CC BY / BY-SA licenses require wherever a photo appears without its own
// caption (cards, lists, simulator...). Linked from the footer.
import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { sql } from '@/data/lib/db';
import { fighterHref } from '@/data/lib/slug';
import { LegalPage, LegalSection } from '@/components/ui/legal-page';
import { PhotoCredit } from '@/components/ui/shared/photo-credit';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Crédits photos',
  description: 'Auteurs et licences libres des photos de combattants affichées sur MMA Universe.',
};

type CreditRow = {
  id: number;
  name: string;
  photo_author: string | null;
  photo_author_url: string | null;
  photo_license: string | null;
  photo_license_url: string | null;
  photo_source_url: string | null;
};

const loadCredits = unstable_cache(
  async (): Promise<CreditRow[]> => {
    try {
      const data = await sql<CreditRow>`
        SELECT DISTINCT ON (photo_source_url) id, name, photo_author, photo_author_url,
          photo_license, photo_license_url, photo_source_url
        FROM fighters
        WHERE image_url IS NOT NULL AND photo_license IS NOT NULL
        ORDER BY photo_source_url, id
      `;
      return data.rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    } catch (error) {
      console.error('Database Error:', error);
      return [];
    }
  },
  ['photo-credits-v1'],
  { revalidate: 86400 },
);

export default async function Page() {
  const credits = await loadCredits();

  return (
    <LegalPage title="Crédits photos">
      <LegalSection title="Nos photos">
        <p>
          Les photos de combattants proviennent de Wikimedia Commons et sont publiées par leurs auteurs sous licence
          libre (domaine public, CC0, CC BY ou CC BY-SA). Elles sont recadrées et redimensionnées pour l’affichage.
          Chaque nom ci-dessous renvoie vers la page d’origine de la photo et sa licence.
        </p>
        <p>
          Vous êtes l’auteur d’une photo et souhaitez corriger un crédit, ou proposer les vôtres ? Écrivez-nous via
          l’adresse indiquée dans les{' '}
          <Link href="/mentions-legales" className="text-accent underline-offset-2 hover:underline">
            mentions légales
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title={`${credits.length} photos`}>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {credits.map((c) => (
            <li key={c.id} className="flex flex-col">
              <Link href={fighterHref(c)} className="text-xs text-ink-primary hover:text-accent">
                {c.name}
              </Link>
              <PhotoCredit fighter={c} />
            </li>
          ))}
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
