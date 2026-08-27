export type Organization = {
    id: number;
    name: string;
    abbreviation: string;
    logo_link: string;
  };

export type Event = {
    id: number;
    name: string;
    date: string;
    start_time: string | null;
    event_location: string;
    event_poster: string;
    organization_id: number;
  };

export type Fight = {
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
    is_main_event: boolean;
    is_title_fight: boolean;
  };

export type Fighter = {
    id: number;
    name: string;
    image_url: string;
    weight_class: string;
    organization_id: number;
    record: string;
    ranking: number;
    nationality: string | null;
  };

export type EventWithOrganization = Event & {
  organization_abbreviation: string;
};

export type FighterWithOrganization = Fighter & {
  organization_abbreviation: string;
};

export type FightWithFighters = Fight & {
  fighter1: Fighter | null;
  fighter2: Fighter | null;
};

export type FightResultWithContext = FightWithFighters & {
  event_name: string;
  event_date: string;
  organization_abbreviation: string;
};

export type FightHistoryEntry = Omit<Fight, 'winner_id'> & {
  winner_id: number | null;
  event_name: string;
  event_date: string;
  opponent_name: string | null;
  opponent_image_url: string | null;
  result: 'win' | 'loss' | 'draw' | 'upcoming';
};

export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  submission: number;
  decision: number;
};

export type MethodCategory = 'ko_tko' | 'submission' | 'decision';

// id is BIGSERIAL: the Neon driver (no type parser override, see data/lib/db.ts)
// returns int8 columns as JS strings, not numbers -- unlike the INT-typed ids
// elsewhere in this file (see the same note on fight_id/predicted_winner_id
// below, and app/seed/route.ts's picks table DDL for the full explanation).
export type PickemUser = {
  id: string;
  external_auth_id: string;
  display_name: string;
  created_at: string;
};

// Named PickRecord, not Pick, to avoid shadowing TypeScript's built-in
// Pick<T, K> utility type in any file that imports this one.
export type PickRecord = {
  id: string; // BIGSERIAL -- see the note on PickemUser.id above
  user_id: string; // BIGINT, references users.id -- same reason
  fight_id: number; // INT, references fights.id (int4, comes back as a number)
  predicted_winner_id: number; // INT, references fighters.id (int4, comes back as a number)
  predicted_method_category: MethodCategory;
  predicted_round: number | null;
  created_at: string;
  updated_at: string;
};
