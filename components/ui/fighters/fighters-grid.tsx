'use client';

import { useMemo, useState } from 'react';
import FighterCard from './fighter-card';
import EmptyState from '@/components/ui/shared/empty-state';
import { FighterWithOrganization, Organization } from '@/data/lib/definitions';

export default function FightersGrid({
  fighters,
  organizations,
}: {
  fighters: FighterWithOrganization[];
  organizations: Organization[];
}) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');

  const filteredFighters = useMemo(() => {
    if (selectedOrgId === 'all') return fighters;
    return fighters.filter((fighter) => String(fighter.organization_id) === selectedOrgId);
  }, [fighters, selectedOrgId]);

  return (
    <div className="flex flex-col gap-4">
      <select
        value={selectedOrgId}
        onChange={(event) => setSelectedOrgId(event.target.value)}
        className="w-fit rounded-md border border-base-border bg-base-card px-3 py-2 text-sm text-ink-primary"
      >
        <option value="all">Toutes les organisations</option>
        {organizations.map((organization) => (
          <option key={organization.id} value={String(organization.id)}>
            {organization.abbreviation}
          </option>
        ))}
      </select>
      {filteredFighters.length === 0 ? (
        <EmptyState title="Aucun combattant dans cette catégorie" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredFighters.map((fighter) => (
            <FighterCard key={fighter.id} fighter={fighter} />
          ))}
        </div>
      )}
    </div>
  );
}
