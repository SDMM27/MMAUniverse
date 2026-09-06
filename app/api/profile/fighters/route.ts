// app/api/profile/fighters/route.ts
import { sql } from '@/data/lib/db';
import { getOrCreateCurrentUser } from '@/data/lib/picks-data';
import { addPreferredFighter, removePreferredFighter } from '@/data/lib/profile-data';

// Same reasoning as app/seed/route.ts: without this, @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { fighterId } = body;

  if (!Number.isInteger(fighterId)) {
    return Response.json({ error: 'Combattant invalide.' }, { status: 400 });
  }

  const fighterRows = await sql<{ id: number }>`SELECT id FROM fighters WHERE id = ${fighterId}`;
  if (!fighterRows.rows[0]) {
    return Response.json({ error: 'Combattant introuvable.' }, { status: 404 });
  }

  await addPreferredFighter(userId, fighterId);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour gérer vos préférences.' }, { status: 401 });
  }

  const body = await request.json();
  const { fighterId } = body;

  if (!Number.isInteger(fighterId)) {
    return Response.json({ error: 'Combattant invalide.' }, { status: 400 });
  }

  await removePreferredFighter(userId, fighterId);
  return Response.json({ ok: true });
}
