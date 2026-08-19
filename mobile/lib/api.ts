import type {
  Organization,
  EventWithOrganization,
  FighterWithOrganization,
  HomeResponse,
  OrgDetailResponse,
  EventDetailResponse,
  FighterDetailResponse,
} from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set — add it to mobile/.env');
  }
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getHome() {
  return apiFetch<HomeResponse>('/api/mobile/home');
}

export function getOrgs() {
  return apiFetch<Organization[]>('/api/mobile/orgs');
}

export function getOrg(id: string) {
  return apiFetch<OrgDetailResponse>(`/api/mobile/orgs/${id}`);
}

export function getEvents() {
  return apiFetch<EventWithOrganization[]>('/api/mobile/events');
}

export function getEvent(id: string) {
  return apiFetch<EventDetailResponse>(`/api/mobile/events/${id}`);
}

export function getFighters() {
  return apiFetch<FighterWithOrganization[]>('/api/mobile/fighters');
}

export function getFighter(id: string) {
  return apiFetch<FighterDetailResponse>(`/api/mobile/fighters/${id}`);
}
