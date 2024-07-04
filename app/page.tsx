import Link from 'next/link';
import { lusitana } from '@/app/ui/fonts';
import MMAUniverseLogo from '@/app/ui/mma-universe-logo';
import OrganizationsList from './ui/organizations/organizations-list';
import Image from 'next/image';
import { fetchOrganizations } from '@/app/lib/data';

export default async function Page() {
  const organizations = await fetchOrganizations();
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-red-600 p-4 md:h-52">
        <MMAUniverseLogo />
      </div>
        <div className="flex items-center justify-center p-6 md:w-3/5 md:px-28 md:py-12">
          <OrganizationsList organizations={organizations} />
        </div>
    </main>
  );
}
