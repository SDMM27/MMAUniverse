import { sql } from '@vercel/postgres';
import {
    Organization,
    Event,
    Fighter,
    FightHistoryEntry,
    FightWithFighters,
  } from './definitions';

export async function fetchOrganizations() {
    try {
      // Artificially delay a response for demo purposes.
      // Don't do this in production :)
  
      // console.log('Fetching revenue data...');
      // await new Promise((resolve) => setTimeout(resolve, 3000));
  
      const data = await sql<Organization>`SELECT * FROM organizations`;
  
      // console.log('Data fetch completed after 3 seconds.');
  
      return data.rows;
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to fetch revenue data.');
    }
  }

  export async function fetchEventsByOrg(orgId: string) {
    try {
      // Artificially delay a response for demo purposes.
      // Don't do this in production :)
  
      // console.log('Fetching revenue data...');
      // await new Promise((resolve) => setTimeout(resolve, 3000));
  
      const data = await sql<Event>`SELECT * FROM Events WHERE organization_id = ${orgId}`;

      // console.log('Data fetch completed after 3 seconds.');

      return data.rows;
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to fetch revenue data.');
    }
  }

export async function fetchAllEvents() {
  try {
    const data = await sql<Event & { organization_abbreviation: string }>`
      SELECT e.*, o.abbreviation AS organization_abbreviation
      FROM events e
      JOIN organizations o ON e.organization_id = o.id
      ORDER BY e.date ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch events.');
  }
}

export async function fetchOrganizationById(id: string) {
  try {
    const data = await sql<Organization>`SELECT * FROM organizations WHERE id = ${id}`;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch organization.');
  }
}

export async function fetchEventById(id: string) {
  try {
    const data = await sql<Event>`SELECT * FROM events WHERE id = ${id}`;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch event.');
  }
}

export async function fetchFightsByEvent(eventId: string) {
  try {
    const data = await sql<{
      id: number;
      event_id: number;
      fighter1_id: number;
      fighter2_id: number;
      fight_finished: boolean;
      winner_id: number | null;
      method: string;
      round: number;
      time: string;
      weight_class: string;
      f1_id: number | null;
      f1_name: string | null;
      f1_image_url: string | null;
      f1_weight_class: string | null;
      f1_organization_id: number | null;
      f1_record: string | null;
      f1_ranking: number | null;
      f2_id: number | null;
      f2_name: string | null;
      f2_image_url: string | null;
      f2_weight_class: string | null;
      f2_organization_id: number | null;
      f2_record: string | null;
      f2_ranking: number | null;
    }>`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class,
        f1.id AS f1_id, f1.name AS f1_name, f1.image_url AS f1_image_url, f1.weight_class AS f1_weight_class, f1.organization_id AS f1_organization_id, f1.record AS f1_record, f1.ranking AS f1_ranking,
        f2.id AS f2_id, f2.name AS f2_name, f2.image_url AS f2_image_url, f2.weight_class AS f2_weight_class, f2.organization_id AS f2_organization_id, f2.record AS f2_record, f2.ranking AS f2_ranking
      FROM fights f
      LEFT JOIN fighters f1 ON f.fighter1_id = f1.id
      LEFT JOIN fighters f2 ON f.fighter2_id = f2.id
      WHERE f.event_id = ${eventId}
    `;

    return data.rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      fighter1_id: row.fighter1_id,
      fighter2_id: row.fighter2_id,
      fight_finished: row.fight_finished,
      winner_id: row.winner_id,
      method: row.method,
      round: row.round,
      time: row.time,
      weight_class: row.weight_class,
      fighter1: row.f1_id
        ? {
            id: row.f1_id,
            name: row.f1_name,
            image_url: row.f1_image_url,
            weight_class: row.f1_weight_class,
            organization_id: row.f1_organization_id,
            record: row.f1_record,
            ranking: row.f1_ranking,
          }
        : null,
      fighter2: row.f2_id
        ? {
            id: row.f2_id,
            name: row.f2_name,
            image_url: row.f2_image_url,
            weight_class: row.f2_weight_class,
            organization_id: row.f2_organization_id,
            record: row.f2_record,
            ranking: row.f2_ranking,
          }
        : null,
    })) as FightWithFighters[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fights for event.');
  }
}

export async function fetchAllFighters() {
  try {
    const data = await sql<Fighter & { organization_abbreviation: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      ORDER BY f.name ASC
    `;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighters.');
  }
}

export async function fetchFighterById(id: string) {
  try {
    const data = await sql<Fighter & { organization_abbreviation: string }>`
      SELECT f.*, o.abbreviation AS organization_abbreviation
      FROM fighters f
      JOIN organizations o ON f.organization_id = o.id
      WHERE f.id = ${id}
    `;
    return data.rows[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fighter.');
  }
}

export async function fetchFightsByFighterId(fighterId: string) {
  try {
    const data = await sql<{
      id: number;
      event_id: number;
      fighter1_id: number;
      fighter2_id: number;
      fight_finished: boolean;
      winner_id: number | null;
      method: string;
      round: number;
      time: string;
      weight_class: string;
      event_name: string;
      event_date: string;
      opponent_name: string | null;
      opponent_image_url: string | null;
    }>`
      SELECT
        f.id, f.event_id, f.fighter1_id, f.fighter2_id, f.fight_finished, f.winner_id, f.method, f.round, f.time, f.weight_class,
        e.name AS event_name, e.date AS event_date,
        opponent.name AS opponent_name, opponent.image_url AS opponent_image_url
      FROM fights f
      JOIN events e ON f.event_id = e.id
      LEFT JOIN fighters opponent ON opponent.id = (
        CASE WHEN f.fighter1_id = ${fighterId} THEN f.fighter2_id ELSE f.fighter1_id END
      )
      WHERE f.fighter1_id = ${fighterId} OR f.fighter2_id = ${fighterId}
      ORDER BY e.date DESC
    `;

    return data.rows.map((row) => ({
      ...row,
      result: !row.fight_finished
        ? 'upcoming'
        : row.winner_id === null
          ? 'draw'
          : String(row.winner_id) === String(fighterId)
            ? 'win'
            : 'loss',
    })) as FightHistoryEntry[];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch fight history.');
  }
}