import { sql } from '@/data/lib/db';
import type { FighterWithOrganization } from '@/data/lib/definitions';

export async function fetchPreferredFighters(userId: number): Promise<FighterWithOrganization[]> {
  try {
    const rows = await sql<FighterWithOrganization>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM user_fighter_preferences ufp
      JOIN fighters f ON ufp.fighter_id = f.id
      JOIN organizations o ON f.organization_id = o.id
      WHERE ufp.user_id = ${userId}
      ORDER BY ufp.created_at ASC
    `;
    return rows.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch preferred fighters.');
  }
}

export async function addPreferredFighter(userId: number, fighterId: number): Promise<void> {
  try {
    await sql`
      INSERT INTO user_fighter_preferences (user_id, fighter_id)
      VALUES (${userId}, ${fighterId})
      ON CONFLICT (user_id, fighter_id) DO NOTHING
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to add preferred fighter.');
  }
}

export async function removePreferredFighter(userId: number, fighterId: number): Promise<void> {
  try {
    await sql`
      DELETE FROM user_fighter_preferences WHERE user_id = ${userId} AND fighter_id = ${fighterId}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to remove preferred fighter.');
  }
}

export async function fetchAvailableNationalities(): Promise<string[]> {
  try {
    const rows = await sql<{ nationality: string }>`
      SELECT DISTINCT nationality FROM fighters WHERE nationality IS NOT NULL ORDER BY nationality ASC
    `;
    return rows.rows.map((row) => row.nationality);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch available nationalities.');
  }
}

export async function fetchPreferredNationalities(userId: number): Promise<string[]> {
  try {
    const rows = await sql<{ nationality_code: string }>`
      SELECT nationality_code FROM user_nationality_preferences WHERE user_id = ${userId} ORDER BY created_at ASC
    `;
    return rows.rows.map((row) => row.nationality_code);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch preferred nationalities.');
  }
}

export async function addPreferredNationality(userId: number, code: string): Promise<void> {
  try {
    await sql`
      INSERT INTO user_nationality_preferences (user_id, nationality_code)
      VALUES (${userId}, ${code})
      ON CONFLICT (user_id, nationality_code) DO NOTHING
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to add preferred nationality.');
  }
}

export async function removePreferredNationality(userId: number, code: string): Promise<void> {
  try {
    await sql`
      DELETE FROM user_nationality_preferences WHERE user_id = ${userId} AND nationality_code = ${code}
    `;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to remove preferred nationality.');
  }
}
