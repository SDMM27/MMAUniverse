import type { OutcomeProfile } from './rating/fight-outcome';

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
    height_cm: number | null;
    reach_cm: number | null;
    // The DB driver returns a DATE column as a Date; read it via ageFromBirthDate (data/lib/fighter-age.ts).
    birth_date: Date | null;
    // Inferred from the fight graph (data/scrapers/sync-fighter-gender.ts); null = unknown.
    is_women: boolean | null;
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
  // Both NUMERIC columns in Postgres -- the neon driver returns those as
  // strings at runtime (avoids float-precision loss), not actual numbers,
  // despite this type. Always coerce with Number(...) before arithmetic or
  // `<`/`>` comparison -- `-` happens to coerce both operands on its own,
  // which let a real bug (order-division.ts's championOutranked comparing
  // two of these with plain `>`, silently doing string comparison) ship
  // unnoticed until caught live on /classement-calcule 2026-09-15.
  // Since FightScore v2 (2026-09-22): the fighter's Glicko rating R, the
  // same on every one of their rows (one rating across all divisions).
  points: number;
  rating_deviation: number | null; // Glicko RD as of the last recompute; NUMERIC -> string at runtime
  display_score: number; // 0-100 within the division; the champion is always 100
  p4p_score: number | null; // 0-100 on the common pound-for-pound scale (per gender); NUMERIC -> string at runtime
  // Also NUMERIC -> string at runtime (see above), and null for a row not yet recomputed. Number(...) before comparing.
  ml_win_probability: number | null;
  current_streak: number;
  is_former_champion: boolean;
  style_archetype: string | null;
  fights_rated: number;
  last_fight_date: string | null;
  is_champion: boolean;
  // false = inactive in this division for more than 18 months and not the
  // champion: kept out of the ranking lists, score still shown on the
  // fighter page (data/lib/rating/ranking-eligibility.ts).
  is_ranking_eligible: boolean;
  updated_at: string;
};

export type FighterRatingWithFighter = FighterRating & {
  fighter_name: string;
  fighter_image_url: string | null;
  fighter_nationality: string | null; // fighters.nationality -- a 2-letter Sherdog flag code, see CountryFlag
  // Week-over-week movement, only on the ranking-list queries (fetchAllFighterRatings,
  // fetchTopPoundForPound): position on the same list at the previous weekly snapshot
  // (null = not on it), and that snapshot's Monday (null = no earlier snapshot yet).
  previous_rank?: number | null;
  previous_week?: string | null;
};

// fetchFightScoreSummary's row -- the headline numbers shown next to the
// ranking (homepage hero, /classement-calcule header). COUNT(*) comes back
// from the neon driver as a string, hence the string types.
export type FightScoreSummary = {
  ranked_count: string;
  division_count: string;
  updated_at: string | null;
};

// One row per fighter per fight (each fighter_fight_stats_id's fight
// produces two of these, one per corner) -- see compute-fighter-ratings.ts.
export type FighterRatingHistoryEntry = {
  id: number;
  fighter_id: number;
  weight_class: string;
  fighter_fight_stats_id: number | null;
  points_before: number;
  points_after: number;
  // The *opponent's* points going into this fight -- the "adversaire bien
  // classé" signal made explicit/visible rather than left implicit in the
  // point-flow math, per user feedback (see [[fighter-rating-ml-pivot]]).
  opponent_points_before: number | null;
  dominance_score: number;
  dominance_estimated: boolean;
  computed_at: string;
};

// fetchQualityWinsByFighterId's row shape -- a win-only history entry joined
// back to fighter_fight_stats for the opponent's name and the event it
// happened at, so the fighter/methodology page can show something like "3
// victoires contre des adversaires classés dans le top de la division".
export type QualityWin = FighterRatingHistoryEntry & {
  opponent_name: string;
  event_name: string;
  event_date: string | null;
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

// One row per rated fighter for the fight simulator (fetchSimulatorFighters):
// the Glicko rating and deviation as real numbers, ready for predictFight.
export type SimulatorFighter = {
  fighter_id: number;
  fighter_name: string;
  fighter_image_url: string | null;
  fighter_nationality: string | null;
  weight_class: string;
  rating: number;
  rd: number;
  is_champion: boolean;
  current_streak: number;
  age: number | null; // in years, today; null without a known birth date (the age layer then stays off)
  outcome_profile: OutcomeProfile; // how their past fights ended, for the method/round model
};
