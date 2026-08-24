// data/lib/picks-data.ts
import { currentUser } from '@clerk/nextjs/server';
import { sql } from '@/data/lib/db';
import { scorePick } from '@/data/lib/scoring';
import type { MethodCategory } from '@/data/lib/definitions';

export async function getOrCreateUser(externalAuthId: string, displayName: string): Promise<number> {
  try {
    const inserted = await sql<{ id: number }>`
      INSERT INTO users (external_auth_id, display_name)
      VALUES (${externalAuthId}, ${displayName})
      ON CONFLICT (external_auth_id) DO UPDATE SET display_name = EXCLUDED.display_name
      RETURNING id
    `;
    return inserted.rows[0].id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to get or create user.');
  }
}

/** Resolves the signed-in Clerk user (if any) to this app's internal users.id. */
export async function getOrCreateCurrentUser(): Promise<number | null> {
  const user = await currentUser();
  if (!user) return null;
  const displayName = user.username ?? user.firstName ?? 'Pronostiqueur';
  return getOrCreateUser(user.id, displayName);
}

export type SubmitPickInput = {
  userId: number;
  fightId: number;
  predictedWinnerId: number;
  predictedMethodCategory: MethodCategory;
  predictedRound: number | null;
};

export async function upsertPick(input: SubmitPickInput): Promise<void> {
  try {
    await sql`
      INSERT INTO picks (user_id, fight_id, predicted_winner_id, predicted_method_category, predicted_round, updated_at)
      VALUES (${input.userId}, ${input.fightId}, ${input.predictedWinnerId}, ${input.predictedMethodCategory}, ${input.predictedRound}, now())
      ON CONFLICT (user_id, fight_id) DO UPDATE SET
        predicted_winner_id = EXCLUDED.predicted_winner_id,
        predicted_method_category = EXCLUDED.predicted_method_category,
        predicted_round = EXCLUDED.predicted_round,
        updated_at = now()
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to save pick.');
  }
}

export type StoredPick = {
  predicted_winner_id: number;
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
};

export async function fetchPicksForEvent(userId: number, eventId: string): Promise<Map<number, StoredPick>> {
  try {
    const rows = await sql<{ fight_id: number } & StoredPick>`
      SELECT p.fight_id, p.predicted_winner_id, p.predicted_method_category, p.predicted_round
      FROM picks p
      JOIN fights f ON p.fight_id = f.id
      WHERE p.user_id = ${userId} AND f.event_id = ${eventId}
    `;
    return new Map(rows.rows.map((row) => [row.fight_id, row]));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch picks for event.');
  }
}

type ScoredPickRow = {
  user_id: number;
  display_name: string;
  predicted_winner_id: number;
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
  winner_id: number | null;
  method: string;
  round: number;
};

function aggregateLeaderboard(rows: ScoredPickRow[]): { userId: number; displayName: string; points: number }[] {
  const byUser = new Map<number, { displayName: string; points: number }>();
  for (const row of rows) {
    const points = scorePick(
      { predicted_winner_id: row.predicted_winner_id, predicted_method_category: row.predicted_method_category, predicted_round: row.predicted_round },
      { winner_id: row.winner_id, method: row.method, round: row.round },
    );
    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.points += points;
    } else {
      byUser.set(row.user_id, { displayName: row.display_name, points });
    }
  }
  return Array.from(byUser.entries())
    .map(([userId, entry]) => ({ userId, ...entry }))
    .sort((a, b) => b.points - a.points);
}

export async function fetchEventLeaderboard(eventId: string) {
  try {
    const rows = await sql<ScoredPickRow>`
      SELECT u.id AS user_id, u.display_name, p.predicted_winner_id, p.predicted_method_category, p.predicted_round,
             f.winner_id, f.method, f.round
      FROM picks p
      JOIN users u ON p.user_id = u.id
      JOIN fights f ON p.fight_id = f.id
      WHERE f.event_id = ${eventId}
    `;
    return aggregateLeaderboard(rows.rows);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch event leaderboard.');
  }
}

export async function fetchAllTimeLeaderboard() {
  try {
    const rows = await sql<ScoredPickRow>`
      SELECT u.id AS user_id, u.display_name, p.predicted_winner_id, p.predicted_method_category, p.predicted_round,
             f.winner_id, f.method, f.round
      FROM picks p
      JOIN users u ON p.user_id = u.id
      JOIN fights f ON p.fight_id = f.id
    `;
    return aggregateLeaderboard(rows.rows);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch all-time leaderboard.');
  }
}

export type PickHistoryEntry = {
  eventId: number;
  eventName: string;
  eventDate: string;
  fighter1Name: string;
  fighter2Name: string;
  predictedWinnerName: string;
  points: number | null;
};

export async function fetchUserPickHistory(userId: number): Promise<PickHistoryEntry[]> {
  try {
    const rows = await sql<{
      event_id: number;
      event_name: string;
      event_date: string;
      fighter1_name: string;
      fighter2_name: string;
      predicted_winner_id: number;
      predicted_winner_name: string;
      predicted_method_category: MethodCategory;
      predicted_round: number | null;
      fight_finished: boolean;
      winner_id: number | null;
      method: string;
      round: number;
    }>`
      SELECT
        e.id AS event_id, e.name AS event_name, e.date AS event_date,
        f1.name AS fighter1_name, f2.name AS fighter2_name,
        p.predicted_winner_id, pw.name AS predicted_winner_name,
        p.predicted_method_category, p.predicted_round,
        f.fight_finished, f.winner_id, f.method, f.round
      FROM picks p
      JOIN fights f ON p.fight_id = f.id
      JOIN events e ON f.event_id = e.id
      JOIN fighters f1 ON f.fighter1_id = f1.id
      JOIN fighters f2 ON f.fighter2_id = f2.id
      JOIN fighters pw ON p.predicted_winner_id = pw.id
      WHERE p.user_id = ${userId}
      ORDER BY e.date DESC
    `;

    return rows.rows.map((row) => ({
      eventId: row.event_id,
      eventName: row.event_name,
      eventDate: row.event_date,
      fighter1Name: row.fighter1_name,
      fighter2Name: row.fighter2_name,
      predictedWinnerName: row.predicted_winner_name,
      points: row.fight_finished
        ? scorePick(
            { predicted_winner_id: row.predicted_winner_id, predicted_method_category: row.predicted_method_category, predicted_round: row.predicted_round },
            { winner_id: row.winner_id, method: row.method, round: row.round },
          )
        : null,
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch pick history.');
  }
}
