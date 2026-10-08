import { cache } from 'react';
import { fetchEventById, fetchFightsByEvent, fetchOrganizationById } from '@/data/lib/data';

// React cache() wrappers so a page and its generateMetadata share one query per request.

/** Events and organizations are addressed by their INT id; anything else is a 404 (not a SQL error). */
export function isValidDbId(value: string): boolean {
  return /^\d{1,9}$/.test(value);
}

export const getEvent = cache((id: string) => (isValidDbId(id) ? fetchEventById(id) : Promise.resolve(null)));
export const getEventFights = cache((id: string) => fetchFightsByEvent(id));
export const getOrganization = cache((id: string) =>
  isValidDbId(id) ? fetchOrganizationById(id) : Promise.resolve(null),
);
