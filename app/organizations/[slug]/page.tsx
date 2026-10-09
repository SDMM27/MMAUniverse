import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrganization } from '@/data/lib/page-data';
import { DEFAULT_OG_IMAGE, OPEN_GRAPH_BASE, organizationMetadataDescription } from '@/data/lib/seo-utils';
import { getSiteUrl } from '@/data/lib/site-url';
import { breadcrumbJsonLd, sportsOrganizationJsonLd } from '@/data/lib/structured-data';
import { fetchEventsByOrg, fetchFightersByOrg, fetchRankingsByOrg } from '@/data/lib/data';
import { CoverImage } from '@/components/ui/shared/media';
import OrganizationHubTabs from '@/components/ui/organizations/organization-hub-tabs';
import JsonLd from '@/components/ui/shared/json-ld';

// Queries the DB on every request instead of at build time — Vercel's build
// step doesn't reliably have DATABASE_URL / DB access yet (see data/lib/db.ts).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const organization = await getOrganization(params.slug);
  if (!organization) return { title: 'Organisation introuvable', robots: { index: false } };

  const title = `${organization.name} (${organization.abbreviation})`;
  const description = organizationMetadataDescription(organization);
  const canonical = `/organizations/${organization.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { ...OPEN_GRAPH_BASE, type: 'website', title, description, url: canonical, images: [DEFAULT_OG_IMAGE] },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Page({ params }: { params: { slug: string } }) {
  const organization = await getOrganization(params.slug);

  if (!organization) {
    notFound();
  }

  // Fetched eagerly (not lazily per-tab) since this is a single server
  // component render and all three queries are cheap/unpaginated -- avoids a
  // client-side waterfall or a route handler just to lazy-load a tab's data.
  const [events, fighters, rankings] = await Promise.all([
    fetchEventsByOrg(params.slug),
    fetchFightersByOrg(params.slug),
    fetchRankingsByOrg(params.slug),
  ]);
  const siteUrl = getSiteUrl();

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <JsonLd
        data={[
          sportsOrganizationJsonLd(siteUrl, organization, organizationMetadataDescription(organization)),
          breadcrumbJsonLd(siteUrl, [
            ['Organisations', '/organizations'],
            [organization.name, `/organizations/${organization.id}`],
          ]),
        ]}
      />
      <div className="flex items-center gap-4 border-b border-base-border pb-6">
        <CoverImage src={organization.logo_link} alt={organization.name} className="h-16 w-16 rounded-full" />
        <div>
          <p className="font-display text-xs uppercase tracking-wide text-accent">{organization.abbreviation}</p>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">{organization.name}</h1>
        </div>
      </div>
      <OrganizationHubTabs events={events} fighters={fighters} rankings={rankings} />
    </main>
  );
}
