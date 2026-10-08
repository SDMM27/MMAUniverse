// app/api/picks/route.ts
import { sql } from '@/data/lib/db';
import { isEventLocked } from '@/data/lib/pick-lock';
import { getOrCreateCurrentUser, upsertPick } from '@/data/lib/picks-data';
import { getScheduledRounds } from '@/data/lib/fight-utils';
import type { MethodCategory } from '@/data/lib/definitions';

// Without this (see data/lib/db.ts), @neondatabase/serverless's
// underlying fetch() calls can get swept into Next's Data Cache.
export const dynamic = 'force-dynamic';

const VALID_METHOD_CATEGORIES: MethodCategory[] = ['ko_tko', 'submission', 'decision'];

export async function POST(request: Request) {
  const userId = await getOrCreateCurrentUser();
  if (!userId) {
    return Response.json({ error: 'Vous devez être connecté pour pronostiquer.' }, { status: 401 });
  }

  const body = await request.json();
  const { fightId, predictedWinnerId, predictedMethodCategory, predictedRound } = body;

  if (!VALID_METHOD_CATEGORIES.includes(predictedMethodCategory)) {
    return Response.json({ error: 'Catégorie de méthode invalide.' }, { status: 400 });
  }

  const fightRows = await sql<{ id: number; event_id: number; is_main_event: boolean; is_title_fight: boolean }>`
    SELECT id, event_id, is_main_event, is_title_fight FROM fights WHERE id = ${fightId}
  `;
  const fight = fightRows.rows[0];
  if (!fight) {
    return Response.json({ error: 'Combat introuvable.' }, { status: 404 });
  }

  const scheduledRounds = getScheduledRounds(fight);
  if (
    predictedMethodCategory !== 'decision' &&
    (!Number.isInteger(predictedRound) || predictedRound < 1 || predictedRound > scheduledRounds)
  ) {
    return Response.json({ error: 'Round invalide pour ce combat.' }, { status: 400 });
  }

  const eventRows = await sql<{ prelims_start: string | null; start_time: string | null; date: string }>`
    SELECT prelims_start, start_time, date FROM events WHERE id = ${fight.event_id}
  `;
  const event = eventRows.rows[0];
  if (!event || isEventLocked(event, new Date())) {
    return Response.json({ error: 'Cet événement a démarré, les pronostics sont clos.' }, { status: 403 });
  }

  await upsertPick({
    userId,
    fightId: fight.id,
    predictedWinnerId,
    predictedMethodCategory,
    predictedRound: predictedMethodCategory === 'decision' ? null : predictedRound,
  });

  return Response.json({ ok: true });
}
