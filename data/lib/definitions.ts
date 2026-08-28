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

// Merges two sources — see fetchFighterFightHistory in data/lib/data.ts:
// upcoming (not-yet-fought) bouts still come from our own `fights`/`events`
// tables (event_id set, event_sherdog_url null); every completed fight comes
// from `fighter_fight_history`, scraped straight off the fighter's own
// Sherdog page (event_id null, event_sherdog_url set — Sherdog is the source
// of truth there, not necessarily one of the orgs/events we track).
export type FightHistoryEntry = {
  id: string;
  event_id: number | null;
  event_name: string;
  event_date: string;
  event_sherdog_url: string | null;
  opponent_name: string | null;
  opponent_image_url: string | null;
  result: 'win' | 'loss' | 'draw' | 'nc' | 'upcoming';
  method: string | null;
  referee: string | null;
  round: number | null;
  time: string | null;
};

export type MethodBreakdown = {
  koTko: number;
  submission: number;
  decision: number;
};

export type FighterStats = {
  wins: number;
  losses: number;
  draws: number;
  winMethods: MethodBreakdown;
  lossMethods: MethodBreakdown;
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
