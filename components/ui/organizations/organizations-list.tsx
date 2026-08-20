import OrganizationCard, { OrganizationWithActivity } from './organization-card';

export default function OrganizationsList({
  organizations,
}: {
  organizations: OrganizationWithActivity[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {organizations.map((organization) => (
        <OrganizationCard key={organization.id} organization={organization} />
      ))}
    </div>
  );
}
