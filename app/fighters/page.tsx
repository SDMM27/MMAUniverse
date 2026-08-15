import { fetchAllFighters, fetchOrganizations } from '@/data/lib/data';
import FightersGrid from '@/components/ui/fighters/fighters-grid';

export default async function Page() {
  const [fighters, organizations] = await Promise.all([
    fetchAllFighters(),
    fetchOrganizations(),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink-primary">Fighters</h1>
      <FightersGrid fighters={fighters} organizations={organizations} />
    </main>
  );
}
