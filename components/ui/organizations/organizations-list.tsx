import OrganizationCard, { OrganizationWithActivity } from './organization-card';

// Not currently rendered anywhere (home page was redesigned to remove organization
// cards). Reserved for a planned future `/organizations` list page.
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
