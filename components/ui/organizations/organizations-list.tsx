import { Organization } from '@/data/lib/definitions';
import OrganizationCard from './organization-card';

export default function OrganizationsList({
  organizations,
}: {
  organizations: Organization[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {organizations.map((organization) => (
        <OrganizationCard key={organization.id} organization={organization} />
      ))}
    </div>
  );
}
