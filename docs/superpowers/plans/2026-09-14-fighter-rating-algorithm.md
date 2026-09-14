# Classement calculé (FightScore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a computed, stats-driven fighter rating ("FightScore") for UFC divisions — a point-flow rating engine (inspired by fight-minds' own published methodology, see spec section 0) plus a k-means style-archetype clustering — backed by two new tables (`fighter_ratings`, `fighter_rating_history`), and make it the site's primary ranking surface (nav + homepage), while keeping the existing official-rankings pages intact.

**Spec:** `docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md`

**Architecture:** Pure calculation functions (`computeDominanceScore`, the point-flow gain/loss update, the k-means clustering) live in `data/lib/rating/` and are unit-tested (TDD) against synthetic fixtures — same split as the existing scrapers between pure parsing logic (tested) and I/O orchestration (verified manually). A batch script (`data/scripts/compute-fighter-ratings.ts`) walks every finished UFC fight chronologically, applies the pure functions, and upserts `fighter_ratings`/`fighter_rating_history` into Neon. Two of UFCStats' own scraper files need a small extension first (weight_class + round-by-round + scheduled-rounds capture — see Task 1) since the rating engine groups by division and needs that data.

**Tech Stack:** Same as the rest of `data/scrapers`/`data/lib` — TypeScript via `tsx`, Node's built-in test runner (`node:test`), `@neondatabase/serverless`. No new dependency needed for k-means (hand-rolled, dataset is small — a few thousand fighter-rows per division at most).

**Testing approach:** TDD for every pure function (`computeDominanceScore`, the point-flow gain/loss update, weight-class normalization, k-means). The batch/sync scripts and the calibration step are verified manually against the real 17,744-row dataset already scraped — mocking that away would defeat the point, same rationale the earlier scraper plans used.

**Constants are starting points, not final.** Task 6 explicitly calibrates `floor`/`ceiling`/point-flow weights against the real dataset before anything ships to a page — don't treat the numbers in the spec as gospel; re-derive and update them there.

**Not yet in this plan:** the "style coverage" signal for the Pereira case (spec section 6) — the user raised it, but whether it should be a display-only caveat or an actual score discount is still an open question posed back to the user, unanswered as of this plan's last revision. No task below builds it; add one once that's settled.

---

### Task 1: Capture `weight_class` + round-by-round breakdown + scheduled rounds on UFCStats fight-stat rows

**Revised 2026-09-14**: originally this task only added `weight_class`. Now also un-skips UFCStats' per-round table (`parse-ufcstats.ts:135-137` currently skips it deliberately — that call is reversed, see the design spec's Task-3-formula revision: dominance for decisions needs round-by-round data, not just fight totals, so a fighter who sweeps every round — e.g. Khabib Nurmagomedov's decision wins — scores as dominant as a finish). **Re-revised 2026-09-14 (same session)**: also capture the fight's scheduled round format ("3 Rnd" vs "5 Rnd", shown on the same UFCStats page) — needed for the point-flow engine's `fiveRoundMultiplier` (spec section 2, adapted from fight-minds' own "5-Round Fight" bonus). All three additions are folded into this one task since they require the exact same full re-crawl (same pages already fetched, just parsing more of each page) — no point re-scraping three times.

**Files:**
- Modify: `data/scrapers/shared/ufcstats-types.ts` (add `weight_class`, `scheduledRounds: number`, and `rounds: UfcStatsRoundStats[]` to `UfcStatsFightRecord`)
- Modify: `data/scrapers/parse-ufcstats.ts` (+ `parse-ufcstats.test.ts`)
- Modify: `data/scrapers/sync-fighter-stats.ts` (add `weight_class` + `scheduled_rounds` columns; add a new `fighter_fight_round_stats` table, one row per fighter per fight per round)

- [ ] **Step 0: Confirm prerequisite state before touching anything**

Run `npm run sync:fighter-stats` (idempotent per its own header comment) to confirm `fighter_fight_stats` is actually populated in Neon — [[fighter-rating-ml-pivot]] notes the scrape finished 2026-09-08 but the sync-to-DB step's completion wasn't confirmed in that session. If it errors on `DATABASE_URL`, get `.env.local` sorted first; this entire plan is built on that table existing and being current.

- [ ] **Step 1: Inspect the real UFCStats fight-details page for the weight-class markup and the round-by-round table**

`scrape-ufcstats.ts`/`parse-ufcstats.ts` already fetch each fight-details page (that's where sig-strike/takedown/control-time totals come from) — confirm via a live fetch (Playwright, same pattern as the rest of that scraper):
- exactly where the weight class string sits (UFCStats shows it in the page's fight-card header, e.g. "UFC Lightweight Bout")
- the round-by-round toggle's actual markup (the `js-fight-table` class marker noted in the existing skip-comment) — it's the same two stat tables (totals + strike breakdown) UFCStats already renders for the fight-level totals, just once per round instead of once for the whole fight; confirm the per-round table structure matches (same columns, one row per round) before writing the parser change.
- the scheduled-rounds/time-format text (UFCStats typically shows something like "Time format: 3 Rnd (5-5-5)" or "5 Rnd (5-5-5-5-5)" in the fight details) — confirm the exact real string before parsing it.

Don't guess selectors — capture real markup first, same discipline the original scraper plans used.

- [ ] **Step 2: Add the fields, TDD**

Add `weight_class: string`, `scheduledRounds: number` (parsed from the time-format text, e.g. `"5 Rnd (5-5-5-5-5)"` → `5`), and `rounds: UfcStatsRoundStats[]` to `UfcStatsFightRecord`, where each `UfcStatsRoundStats` mirrors `UfcStatsFightTotals` (knockdowns, sig/total strikes landed+attempted, takedowns landed+attempted, submission attempts, reversals, control time) plus a `round: number`. Add test cases to `parse-ufcstats.test.ts` using the real fixture HTML (extend the existing fixture with a real 3-round and a real 5-round example) asserting: (a) weight class extraction, (b) scheduled-rounds extraction for both a 3-round and a 5-round fight, (c) the parser returns one `UfcStatsRoundStats` entry per round actually fought, with the right per-round numbers, for both a fight that goes the distance and one that ends early (fewer round entries than scheduled). Run `npm test`, confirm it fails, implement, confirm it passes.

- [ ] **Step 3: Extend the DB schema and sync script**

In `sync-fighter-stats.ts`'s `ensureSchema()`, add:
```sql
ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS weight_class VARCHAR(100);
ALTER TABLE fighter_fight_stats ADD COLUMN IF NOT EXISTS scheduled_rounds INT;
CREATE TABLE IF NOT EXISTS fighter_fight_round_stats (
  id SERIAL PRIMARY KEY,
  fighter_fight_stats_id INT NOT NULL REFERENCES fighter_fight_stats(id) ON DELETE CASCADE,
  round INT NOT NULL,
  knockdowns INT NOT NULL DEFAULT 0,
  sig_strikes_landed INT NOT NULL DEFAULT 0,
  sig_strikes_attempted INT NOT NULL DEFAULT 0,
  total_strikes_landed INT NOT NULL DEFAULT 0,
  total_strikes_attempted INT NOT NULL DEFAULT 0,
  takedowns_landed INT NOT NULL DEFAULT 0,
  takedowns_attempted INT NOT NULL DEFAULT 0,
  submission_attempts INT NOT NULL DEFAULT 0,
  reversals INT NOT NULL DEFAULT 0,
  control_time_seconds INT,
  UNIQUE (fighter_fight_stats_id, round)
);
```
Add `weight_class` + `scheduled_rounds` to the fight-level `INSERT`/`ON CONFLICT DO UPDATE`. After each fight-level upsert, upsert its `rounds` array into `fighter_fight_round_stats` keyed by the returned/looked-up `fighter_fight_stats.id`.

- [ ] **Step 4: Re-scrape to backfill all new fields**

The existing checkpoint (`data/scraped/.cache/ufcstats-progress.json`) marks every event as already processed, so a plain re-run of `npm run scrape:ufcstats` would no-op. Either (a) delete/rename that checkpoint file to force a full re-crawl (~hours, same order of magnitude as the original backfill — run in background, checkpointed so it's resumable if it dies), or (b) if time-constrained, write a small one-off script that re-fetches only the fight-details pages (not the full event/fighter graph) to patch `weight_class`+`scheduledRounds`+`rounds` into the existing `data/scraped/ufcstats-fight-stats.json` in place. Decide based on how long a full re-crawl actually takes in practice — try (a) first since it reuses fully-tested code paths, fall back to (b) only if that proves too slow.

Then re-run `npm run sync:fighter-stats` to push all backfilled fields into Neon.

- [ ] **Step 5: Commit**

```bash
git add data/scrapers/shared/ufcstats-types.ts data/scrapers/parse-ufcstats.ts data/scrapers/parse-ufcstats.test.ts data/scrapers/sync-fighter-stats.ts data/scraped/ufcstats-fight-stats.json
git commit -m "feat(scrape): capture weight_class + round-by-round breakdown + scheduled rounds from UFCStats

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Weight-class normalization — `data/lib/rating/normalize-weight-class.ts`

**Files:**
- Create: `data/lib/rating/normalize-weight-class.ts` + `.test.ts`

Maps a UFCStats-sourced weight class string (from Task 1) onto the canonical division labels already used by `rankings.weight_class` (scraped verbatim from ufc.com by `sync-ufc-rankings.ts`) — needed so a fighter's computed rating groups into the *same* division buckets the official rankings/UI already use. Pull the actual canonical list from a real query against the `rankings` table (or `sync-ufc-rankings.ts`'s own source) before writing this — don't invent the list from memory.

- [ ] **Step 1: Write failing tests** covering exact matches, a "Women's" prefix case, and an unrecognized/catchweight string (should return `null`, caller skips that fight rather than crash — mirrors `matchFighterByName`'s "never throws, tolerate null" convention in `ranking-name-match.ts`).
- [ ] **Step 2: Implement, run tests green.**
- [ ] **Step 3: Commit.**

---

### Task 3: Dominance score — `data/lib/rating/dominance-score.ts`

**Files:**
- Create: `data/lib/rating/dominance-score.ts` + `.test.ts`

Pure function per the spec's **revised** (2026-09-14) formula — round-by-round-driven, not method-weight-driven:

```ts
export type RoundStatsSide = {
  round: number;
  sigStrikesLanded: number;
  controlTimeSeconds: number | null;
  knockdowns: number;
};

export type FightStatsSide = {
  method: string; // raw method string, normalized via existing normalizeMethodCategory
  finishRound: number | null; // null for a decision
  sigStrikesLandedTotal: number;
  controlTimeSecondsTotal: number | null;
  rounds: RoundStatsSide[]; // one entry per round actually fought, in order
};

export type DominanceResult = { score: number; estimated: boolean };

export function computeDominanceScore(winner: FightStatsSide, loser: FightStatsSide): DominanceResult
```

`roundsWonShare` internals: for each round index present on both sides *except* the finish round (if any), compute `roundScore = sigStrikesLanded + 0.5 * (controlTimeSeconds ?? 0) / 60 + 5 * knockdowns` for each fighter; the higher `roundScore` wins that round (a ±5% margin counts as a 0.5/0.5 split). The finish round (if `finishRound` is set) is always awarded to the winner without going through `roundScore` — they ended the fight in it. `roundsWonShare = roundsWonByWinner / roundsFought`.

**Re-revised 2026-09-14 (same session):** weights changed again after user feedback — method needs to carry real weight too, not just round-sweeping: a fighter who finishes opponents outright is also clearly dominant (denies the opponent any chance to recover), independent of whether the earlier rounds were already won on the cards. `bonus_finish` goes from 0.15 back up to 0.30 (now the *second*-heaviest term, `roundsWonShare` still the heaviest at 0.35) — `bonus_finish` stays 0 for any decision, so a maximally-dominant decision (Khabib case) now scores clearly below an equally-dominant finish (indicative numbers in the spec: ≈0.66 vs ≈0.94), while still scoring clearly above an ordinary/close decision (≈0.30) — both the "method matters" fix and the original "round-sweeping decisions aren't undervalued" fix hold at once, they're not in tension once `bonus_finish` is 0-only-for-decisions rather than a flat per-method multiplier.

- [ ] **Step 1: Write failing tests** — at minimum:
  - a round-1 KO/TKO (single round, that round auto-awarded via the finish rule → `roundsWonShare = 1.0`, plus `bonus_finish = 1.0`) → expect the highest score of the test set, roughly in the 0.85-1.0 range
  - **a 3-round unanimous-style decision where the winner's `roundScore` is clearly higher in all 3 rounds** (the Khabib case, `bonus_finish = 0`) → expect a score clearly above an ordinary decision but clearly *below* the round-1-KO case above — verifies both fixes hold simultaneously: round-sweeping is rewarded relative to other decisions, without decisions matching finishes outright
  - a split-style decision (winner's `roundScore` higher in only 1 of 3 rounds, e.g. `roundsWonShare ≈ 0.33`) → expect a distinctly lower score than both cases above
  - **a submission finish vs a KO/TKO finish, same round-sweep and stat differentials otherwise** → expect the submission to score slightly lower (`bonus_finish` 0.9 vs 1.0), not identical — a small but real distinction between finish types
  - a lopsided decision on aggregate strikes but genuinely close per round (tests that `roundsWonShare` and the aggregate strike-differential term can disagree, and the blend behaves sensibly rather than one term masking the other)
  - the fallback path (`rounds: []` on both sides — round-by-round unavailable) → `estimated: true`, score falls back to `bonus_finish` alone (KO/Sub) or the flat 0.4 (decision), matching the pre-round-by-round behavior for that fallback case only
- [ ] **Step 2: Implement per the spec's current formula** (`bonus_finish` 0.30, `roundsWonShare` 0.35, strike differential 0.20, control-time share 0.15), run tests green.
- [ ] **Step 3: Commit.**

---

### Task 4: Point-flow rating engine — `data/lib/rating/point-flow.ts`

**Revised 2026-09-14 (twice)**: this task originally built a classic Elo engine. After the user shared fight-minds' own published methodology (spec section 0), the engine was redesigned around that structure instead — a point-flow system (winner takes a share of the loser's points, not a probability-based rating delta) — because it answers the user's "credit the opponent's own standing" feedback more directly than Elo's implicit mechanism does.

**Files:**
- Create: `data/lib/rating/point-flow.ts` + `.test.ts`

```ts
export const BASE_POINTS = 0.01;

export type FighterPointState = {
  points: number;
  currentStreak: number; // positive = win streak, negative = loss streak
  isFormerChampion: boolean;
  monthsSinceLastFight: number;
};

export type FightContext = {
  dominanceScore: number; // from Task 3
  isTitleFight: boolean;
  isFiveRounds: boolean;
  divisionAveragePoints: number; // caller-maintained running average, see Task 7
};

export function erodePoints(points: number, monthsInactive: number): number;

export type PointFlowResult = { winnerPoints: number; loserPoints: number };

export function applyPointFlow(winner: FighterPointState, loser: FighterPointState, context: FightContext): PointFlowResult;
```

`applyPointFlow` internals, per the spec's section 2 formula:
1. Erode both `winner.points` and `loser.points` via `erodePoints` using each fighter's own `monthsSinceLastFight` (already-eroded values are what the rest of the formula uses).
2. Winner gain: `(0.5 * loserErodedPoints * (0.8 + 0.9 * dominanceScore) + 0.5 * divisionAveragePoints) * streakMultiplier(winner.currentStreak) * (isTitleFight ? 1.5 : 1.0) * (isFiveRounds ? 1.10 : 1.0) * (winner.isFormerChampion ? 1.5 : 1.0)`.
3. **Floor rule** (kept verbatim from fight-minds): if `winnerErodedPoints + gain <= loserErodedPoints`, set `winnerPoints = loserErodedPoints + 0.01` instead of `winnerErodedPoints + gain`.
4. Loser loss: `(0.10 * divisionAveragePoints * (0.6 + 0.8 * dominanceScore) * streakMultiplier(loser.currentStreak)) / (isTitleFight ? 1.3 : 1.0)`, floored so `loserPoints` never drops below a small positive constant (e.g. `0.001`).
5. `streakMultiplier(n) = 1 + 0.005 * min(Math.abs(n), STREAK_CAP)` (e.g. `STREAK_CAP = 20`, matches fight-minds' formula shape for both win and loss streaks).

- [ ] **Step 1: Write failing tests** for `erodePoints` — no erosion under 12 months inactive, decays beyond that, never drops below the 40%-of-original floor, 0 months = no-op.
- [ ] **Step 2: Write failing tests** for `applyPointFlow` — at minimum:
  - beating a much-higher-points opponent yields a much bigger gain than beating a much-lower-points opponent, dominance score held equal (the direct "adversaire bien classé" check from user feedback)
  - the floor rule actually triggers: a big point gap + low dominance score still results in `winnerPoints > loserPoints` (never ranks below someone just beaten) — construct a case where the raw formula alone would *not* clear the opponent's points, confirm the floor kicks in
  - higher `dominanceScore` (all else equal) produces both a bigger winner gain and a bigger loser loss
  - `isTitleFight: true` increases winner gain and *decreases* loser loss (verify the division, not multiplication, on the loss side — matches fight-minds' stated behavior)
  - a longer win streak produces a (slightly) bigger gain than a 0-streak win, all else equal
- [ ] **Step 3: Implement per the spec's point-flow formula**, run tests green.
- [ ] **Step 4: Commit.**

---

### Task 5: Style feature extraction + k-means — `data/lib/rating/style-clustering.ts`

**Files:**
- Create: `data/lib/rating/style-clustering.ts` + `.test.ts`

```ts
export type StyleFeatures = {
  sigStrikesHeadRate: number;  // per 15 min
  sigStrikesBodyRate: number;
  sigStrikesLegRate: number;
  sigStrikesDistanceRate: number;
  sigStrikesClinchRate: number;
  sigStrikesGroundRate: number;
  takedownRate: number;
  takedownAccuracy: number;
  controlTimeRate: number; // seconds per 15 min
  submissionAttemptRate: number;
};

export function normalizeFeatures(features: StyleFeatures[]): number[][]; // z-score per column
export function kMeans(points: number[][], k: number, seed?: number): { assignments: number[]; centroids: number[][] };
export function labelCluster(centroid: number[]): string; // rule-based label from dominant centroid dimensions
```

- [ ] **Step 1: Write failing tests** for `normalizeFeatures` (mean 0, unit variance per column on a synthetic set), for `kMeans` (a deterministic seed on well-separated synthetic clusters converges to the expected assignment — the classic "two obviously separate blobs" test), and for `labelCluster` (a centroid dominated by ground-strike-rate + control-time-rate labels as a grappler/wrestler archetype; one dominated by distance-strike-rate labels as a striker archetype — exact label set/thresholds to be finalized once real centroids from Task 8 are visible, don't over-fit the test to guessed numbers before that).
- [ ] **Step 2: Implement.** k-means: standard Lloyd's algorithm, k-means++ initialization for stability, fixed iteration cap (e.g. 100) with early exit on no reassignment. Run tests green.
- [ ] **Step 3: Commit.**

---

### Task 6: Calibration against real data (manual, not TDD) — ✅ done 2026-09-14

**Files:**
- Created: `data/scripts/calibrate-ratings.ts`, wired as `npm run calibrate:ratings` (kept, not throwaway — useful for re-calibrating after future formula changes)
- Also created ahead of schedule: `data/lib/rating/simulate-division.ts` (+ tests) — the chronological per-division walk this script needs turned out to be exactly what Task 7's batch script also needs, so it was extracted as its own tested function rather than written twice.

- [x] **Step 1:** Ran `computeDominanceScore` over all 7,574 real paired fights. Distribution came out exactly as intended: KO/TKO avg 0.863/median 0.901, Submission avg 0.802/median 0.840, Decision avg 0.500/median 0.506 (capped at 0.70 by design, `bonus_finish = 0` for any decision). Named checks both passed: Khabib Nurmagomedov's 5 UFC decision wins averaged 0.577 — above the overall decision median (0.506), confirming the round-sweep case is rewarded, but not maxed out, since not every one of his fights was an equal career-best domination (a real, not synthetic, result). Jalin Turner (100% finish rate among fighters with ≥8 UFC wins) averaged 0.901 across his finishes — clearly above Khabib's decision average, confirming a prolific finisher outranks even a dominant decision-heavy fighter. **No changes needed to Task 3's formula or weights** — validates as-is against real data.
- [x] **Step 2:** Ran the full point-flow pipeline per division. **Found a real problem, not just a tuning nit**: the spec's original `opponentShare`/`categoryAvgTerm` = 0.5/0.5 (straight from fight-minds' text) produced runaway exponential growth — both terms scale with ever-growing state (opponent points, division average), compounding every fight. Division maxima reached ~13,000 after a few hundred fights (Heavyweight), wildly inconsistent with fight-minds' own observed scale (~0.01-250) and internally inconsistent across divisions (a thin division like Women's Featherweight, 25 fights, topped out at 0.04).
- [x] **Step 3:** Reduced `opponentShare` to 0.15 and `categoryAvgTerm` to 0.10 (`data/lib/rating/point-flow.ts`'s `OPPONENT_SHARE`/`ACTIVITY_CREDIT_SHARE`), re-ran — division maxima now top out around 3.8, and the resulting per-division rankings look qualitatively right (Featherweight top 5: Topuria/Volkanovski/Holloway/Lopes/Sterling — the real current elite; Middleweight: Strickland/Du Plessis/Chimaev nearly tied — matches a genuinely close division). `floor`/`ceiling` for the display rescale: calibrated **per division** (not globally — see spec section 3 for why), `floor = 0`, `ceiling = that division's own max raw points`. The 10%-vs-20% loss-penalty ambiguity was left at 10% — losses didn't look obviously too cheap in this run, revisit if Task 9's UI review says otherwise.
- [x] **Step 4:** Committed the constant changes (`point-flow.ts`) with a note referencing this calibration pass, and committed `calibrate-ratings.ts` itself (decided to keep it, not throw it away) plus `simulate-division.ts`.

**Re-run 2026-09-14 with real `is_title_fight` data** (see Task 1's "revised again" note — a 3rd re-crawl was needed, `isTitleFight` had been stubbed `false` for this task's first pass). Results improved further, no further constant changes needed: division maxima rose from ~3.8 to ~30 (title fights now correctly get their 1.5x/÷1.3 treatment), and top-5s got noticeably more accurate — Heavyweight went from a plausible-but-slightly-off list to Ngannou/Aspinall/Gane/Jones/Pavlovich (the real division legends, previously undervalued without title credit). `OPPONENT_SHARE`/`ACTIVITY_CREDIT_SHARE` left at 0.15/0.10 -- the larger maxima reflect legitimate title-fight bonuses, not renewed runaway growth.

---

### Task 7: Batch computation + DB schema — `data/scripts/compute-fighter-ratings.ts` — ✅ done 2026-09-14

**Files:**
- Created: `data/scripts/compute-fighter-ratings.ts`
- Modified: `package.json` (`"compute:ratings"`)

Built simpler than originally planned since `simulateDivisionRatings` (extracted during Task 6) already owns the entire chronological-walk/state-tracking logic (streak, former-champion, erosion, division average, dominance, point-flow) — this script is now a thin I/O wrapper: load from Neon, group into divisions, call `simulateDivisionRatings`, run the style clustering, write results back. Also: `is_title_fight` now comes straight off `fighter_fight_stats` (captured directly from UFCStats this session, see Task 1's "revised again" note) — no `fights`/`events` join needed, simpler than the step below originally assumed.

- [x] **Step 1:** `ensureSchema()` — done.
- [x] **Step 2:** Load + group by division via `normalizeWeightClass` — done. 236 fights skipped (unmatched weight class — tournament brackets/catchweight/open-weight, expected).
- [x] **Step 3:** Per-division chronological walk — done, via `simulateDivisionRatings` rather than reimplementing it here.
- [x] **Step 4:** `is_champion` join against `rankings` — done, but **every division currently comes back `champion matched: false`**: `rankings` has zero rank=0 rows for any real division right now (the separate, already-flagged `sync-ufc-rankings.ts` bug — see [[fighter-rating-ml-pivot]]). Re-running this script (idempotent) once that's fixed picks up champions correctly, no code change needed.
- [x] **Step 5:** Style clustering (k=4) per division, feature vectors built from per-fighter aggregated `fighter_fight_stats` (attempted-strike rates by target/position, takedown rate+accuracy, control-time rate, submission-attempt rate, all per 15 minutes of *actual cage time* computed from round+time) across every fight (win or loss) a fighter had in that division.
- [x] **Step 6:** Summary logged per division + overall totals.
- [x] **Step 7: Ran it for real** against Neon: 3,126 `fighter_ratings` rows, 14,676 `fighter_rating_history` rows, 7,574 fights processed. Spot-checked Lightweight's top 10 — Gaethje/Oliveira/Makhachev/Topuria/Tsarukyan/Holloway/Khabib/Ruffy/Poirier/Pimblett, a genuinely plausible order matching real current UFC lightweight standing. Khabib (undefeated, retired) correctly pulled down to #7 (45.1/100) by years of inactivity erosion — confirms `erodePoints` behaves as intended on a real former-champion case, exactly the check this step called for. Style archetypes matched real known styles too (Gaethje/Poirier/Holloway = distance strikers; Makhachev/Oliveira/Tsarukyan/Khabib = wrestlers/controllers; Ruffy = submission finisher). Archetype distribution across all 3,126 ratings reasonably balanced (642/503/912/1069 across the 4 clusters) — no degenerate collapse.
- [x] **Step 8: Committed** (`a4e9a12`).

```bash
git add data/scripts/compute-fighter-ratings.ts package.json
git commit -m "feat(ratings): add FightScore batch computation (point-flow + dominance + style clustering)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Not done in this task, flagged for a follow-up decision:** wiring `compute:ratings` into `.github/workflows/daily-sync.yml` for ongoing freshness after each UFC event — ask before adding, same deferral `sync:fighter-stats`/Playwright already got in [[fighter-rating-ml-pivot]], since this one also needs the full `fighter_fight_stats` sync to have already run that day.

---

### Task 8: Data layer — types + fetchers

**Files:**
- Modify: `data/lib/definitions.ts` (add `FighterRating` type mirroring `fighter_ratings`, `FighterRatingWithFighter` joined variant like the existing `RankingWithFighter` pattern, `FighterRatingHistoryEntry` mirroring `fighter_rating_history`)
- Modify: `data/lib/data.ts` (add `fetchFighterRatingsByDivision`, `fetchTopPoundForPound`, `fetchQualityWinsByFighterId`, extend the existing fighter-detail fetcher to include the fighter's own rating row)

`fetchQualityWinsByFighterId` surfaces the "adversaire bien classé" signal explicitly rather than leaving it implicit in the point-flow math (per user feedback) — reads `fighter_rating_history` rows where this fighter was the winner, ordered by `opponent_points_before DESC`, so the fighter/methodology page can show something like "3 victoires contre des adversaires classés dans le top de la division au moment du combat".

Follow the exact patterns already in `data.ts` for `fetchRankingsByOrg`/`fetchRankedOrganizations` (same file) — LEFT JOIN fighters, group client-side the same way `ranking-utils.ts`'s `groupRankingsByWeightClass` already does (reuse or mirror that function for `fighter_ratings`, don't duplicate the grouping logic if it can be generalized).

**Display ordering (revised 2026-09-14 — champion pinned to #1, asterisk if unearned):** the query orders by `display_score DESC` as a baseline, but a small pure function — `orderDivisionWithChampionPinned(fighters: FighterRatingWithFighter[]): { fighters: FighterRatingWithFighter[]; championOutranked: boolean }` in `data/lib/rating/` (TDD, alongside Tasks 2-5) — re-sorts so `is_champion` is always index 0 regardless of its score, with the rest following by `display_score DESC`. `championOutranked` is true when the champion's `display_score` is lower than the highest score among the rest — the page uses that flag to render the asterisk + tooltip text from the spec ("Porte la ceinture, mais [Nom] a le FightScore le plus élevé..."). When no fighter in the division has `is_champion` true (not yet matched/rated), it's a no-op re-sort (plain score order). Write this function's tests alongside Task 2-5's before wiring it into the page in Task 9.

- [ ] **Step 1:** Add types (`FighterRating`, `FighterRatingWithFighter`).
- [ ] **Step 2:** Add fetchers.
- [ ] **Step 3:** Add + TDD `orderDivisionWithChampionPinned`.
- [ ] **Step 4:** Commit.

---

### Task 9: Classement calculé page

**Files:**
- Decide at implementation time: new route (e.g. `app/classement-calcule/`) vs. repurposing one of the existing `/rankings`/`/classement` routes — see spec's "Impact pages/navigation" section for the open question on naming/redundancy between those two existing (currently identical-content) routes. Resolve that redundancy as part of this task rather than adding a third confusingly-named route.
- Create: `components/ui/ratings/fightscore-list.tsx` (mirrors `components/ui/rankings/rankings-list.tsx` structure — continuous score + style archetype badge instead of a plain rank number)
- Create: a short methodology page/section (the spec's "expertise apportée" editorial asset) — plain-language explanation of what feeds the score, linked from the ranking page itself

- [ ] **Step 1:** Build the page against Task 8's fetchers, per-division sections like the existing `/rankings/page.tsx` pattern.
- [ ] **Step 2:** Order each division through Task 8's `orderDivisionWithChampionPinned`. Champion badge from `is_champion` at position 1; when `championOutranked` is true, render the asterisk next to their name/score with the tooltip/footnote text from the spec, linking to the methodology blurb (Step 3). Style archetype badge from `style_archetype` on every row.
- [ ] **Step 3:** Methodology blurb/page — must explicitly explain both revised mechanics in plain language: (a) round-by-round is an *estimate* from raw stats, not official judges' scorecards, and (b) why the champion can carry an asterisk (ceinture ≠ toujours le score le plus haut).
- [ ] **Step 4:** Commit.

---

### Task 10: Nav + homepage reorg

**Files:**
- Modify: `components/ui/nav.tsx` — computed ranking gets top billing among the ranking-related nav entries; resolve the `/rankings` vs `/classement` naming redundancy noted in Task 9 at the same time.
- Modify: `app/page.tsx` (and whatever homepage components it composes) — feature the computed P4P top-3 (or similar) with a link into the methodology blurb.

- [ ] **Step 1:** Nav changes.
- [ ] **Step 2:** Homepage feature section.
- [ ] **Step 3:** Commit.

---

### Task 11: Fighter page integration

**Files:**
- Modify: `app/fighters/[slug]/page.tsx` and/or its child components — surface the fighter's `display_score`, division rank, style archetype, and quality wins (Task 8's `fetchQualityWinsByFighterId`) next to the existing W-L-D record.

- [ ] **Step 1:** Wire in Task 8's per-fighter rating fetch + quality-wins fetch.
- [ ] **Step 2:** UI placement next to existing record display — quality wins as a short list/badges ("battu [Nom], classé #X au moment du combat"), not buried.
- [ ] **Step 3:** Commit.

---

### Manual verification checklist

1. `npm test` — all new pure-function suites (Tasks 2-5) green alongside the existing suite.
2. `npm run compute:ratings` against a real (or scratch) Neon DB — completes without crashing, summary log looks sane (low `estimated`/skip counts).
3. New ranking page — every UFC division renders, the champion is always position 1 with an asterisk shown exactly when their score isn't actually the division's highest, the rest of the division is in descending score order from position 2, style archetype badges present for fighters with enough rated fights.
4. Fighter page — a well-known fighter's card shows a plausible score + archetype.
5. Nav + homepage — computed ranking is now the prominent entry point; official rankings still reachable, not broken.
6. Existing pages (events, fighters list, actualités, pick'em, organizations, profil) — spot-check unaffected.
