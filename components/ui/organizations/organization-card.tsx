import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { Organization } from '@/data/lib/definitions';

export default function OrganizationCard({ organization }: { organization: Organization }) {
  return (
    <Link
      href={`/organizations/${organization.id}`}
      className="flex flex-col items-center gap-3 rounded-lg border border-base-border bg-base-card p-4 transition-colors hover:border-accent"
    >
      <CoverImage
        src={organization.logo_link}
        alt={organization.name}
        className="h-16 w-16 rounded-full"
      />
      <div className="text-center">
        <p className="font-display text-sm uppercase tracking-wide text-ink-primary">{organization.abbreviation}</p>
        <p className="text-xs text-ink-secondary">{organization.name}</p>
      </div>
    </Link>
  );
}
