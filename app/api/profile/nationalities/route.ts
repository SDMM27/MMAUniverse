// app/api/profile/nationalities/route.ts
import { getOrCreateCurrentUser } from '@/data/lib/picks-data';
import {
  addPreferredNationality,
  removePreferredNationality,
  fetchAvailableNationalities,
} from '@/data/lib/profile-data';

// Without this (see data/lib/db.ts), @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;

  const available = await fetchAvailableNationalities();
  if (typeof code !== 'string' || !available.includes(code)) {
    return Response.json({ error: 'Nationalité invalide.' }, { status: 400 });
  }

  await addPreferredNationality(userId, code);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body;

  if (typeof code !== 'string') {
    return Response.json({ error: 'Nationalité invalide.' }, { status: 400 });
  }

  await removePreferredNationality(userId, code);
  return Response.json({ ok: true });
}
