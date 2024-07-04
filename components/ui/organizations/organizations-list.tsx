import { Organization } from '@/components/lib/definitions';
import Link from 'next/link';

export default async function OrganizationsList({
    organizations,
  }: {
    organizations: Organization[];
  }) {
    return (
      <ul role="list" className="divide-y divide-gray-100">
        {organizations.map((org) => (
          <li key={org.id} className="flex justify-between gap-x-6 py-5">
            <Link href={`/organizations/${org.id}`} passHref>
            <div className="flex min-w-0 gap-x-4">
              <img
              className="h-12 w-12 flex-none rounded-full bg-gray-50" 
              src={org.logo_link} 
              alt="Org Logo" />
              <div className="min-w-0 flex-auto">
                <p className="text-sm font-semibold leading-6 text-white-900">{org.abbreviation}</p>
                <p className="mt-1 truncate text-xs leading-5 text-white-500">{org.name}</p>
              </div>
            </div>
            </Link>
          </li>
        ))}
      </ul>
    )
  }
  