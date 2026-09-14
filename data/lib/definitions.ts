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
    // UFC-only, scraped from ufc.com's own broadcast schedule (see
    // data/scrapers/sync-ufc-broadcast-times.ts) — null for every other
    // organization and for any UFC event not yet published there.
    prelims_start: string | null;
    main_card_start: string | null;
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

export type Ranking = {
    id: number;
    organization_id: number;
    // Verbatim division label as published by the org's own source (UFC.com
    // for now), e.g. "Flyweight", "Women's Strawweight", "Men's Pound-for-
    // Pound Top Rank". Deliberately NOT matched or foreign-keyed against
    // Fighter.weight_class -- that field is freeform Sherdog text (see
    // data/scrapers/parse.ts) that doesn't even distinguish women's
    // divisions. Grouping/display for rankings always uses this field.
    weight_class: string;
    rank: number; // 0 = champion, 1-15 = ranked contenders
    fighter_name: string;
    fighter_id: number | null;
    updated_at: string;
  };

// LEFT JOINed with fighters in fetchRankingsByOrg so a row with an unmatched
// fighter_id (NULL) still renders using fighter_name alone.
export type RankingWithFighter = Ranking & {
  fighter_image_url: string | null;
  fighter_record: string | null;
};

// The computed FightScore ranking -- see docs/superpowers/specs/
// 2026-09-14-fighter-rating-algorithm-design.md. One row per (fighter,
// division); `points` is the raw point-flow total (data/lib/rating/point-flow.ts),
// `display_score` the 0-100 rescale shown in the UI. `is_champion` is
// copied from Ranking.rank === 0 for this division at compute time --
// independent of `display_score`/rank order, see order-division.ts's
// orderDivisionWithChampionPinned for how the two interact on screen.
// `is_former_champion` is a *different* fact (has ever won a title fight in
// this division per our own tracked history, feeds the point-flow engine's
// former-champion bonus) -- both booleans can be true, false, or differ.
export type FighterRating = {
  id: number;
  fighter_id: number;
  weight_class: string;
  points: number;
  display_score: number;
  current_streak: number;
  is_former_champion: boolean;
  style_archetype: string | null;
  fights_rated: number;
  last_fight_date: string | null;
  is_champion: boolean;
  updated_at: string;
};

export type FighterRatingWithFighter = FighterRating & {
  fighter_name: string;
  fighter_image_url: string | null;
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
// Sherdog page (event_sherdog_url always set — Sherdog is the source of
// truth there, not necessarily one of the orgs/events we track). event_id is
// only populated when that row's event_name also matches one of our own
// `events` rows (e.g. it was synced in while upcoming and has since
// happened) — the UI prefers that internal link and falls back to
// event_sherdog_url otherwise.
//
// opponent_id follows the same pattern: for upcoming bouts it's the opposing
// fighter's own id, taken directly from the `fighters` join (the opponent is
// always one of our tracked fighters there). For history rows it's resolved
// by matching this row's opponent_sherdog_url against `fighters.sherdog_url`
// — a stronger key than opponent name, which can collide between two
// fighters who share a name. It's null when no internal fighter matches;
// the UI then falls back to opponent_sherdog_url, and to plain text if
// neither is set.
export type FightHistoryEntry = {
  id: string;
  event_id: number | null;
  event_name: string;
  event_date: string;
  event_sherdog_url: string | null;
  opponent_id: number | null;
  opponent_name: string | null;
  opponent_image_url: string | null;
  opponent_sherdog_url: string | null;
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

// News aggregation (RSS -> news_articles) — see data/news/sources.config.ts
// and docs/superpowers/specs/2026-09-04-mma-news-aggregation-design.md.
export type NewsArticle = {
  id: number;
  source_id: string;
  org_id: number | null;
  title: string;
  excerpt: string;
  url: string;
  image_url: string | null;
  language: 'fr' | 'en';
  published_at: string;
  fetched_at: string;
};
