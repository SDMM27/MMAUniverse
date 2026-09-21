# FightScore win predictor (trained model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a trained binary classifier (hand-rolled logistic regression, no new dependency) that estimates a UFC fighter's current win probability against an average opponent in their division, as a **complementary** metric next to the existing FightScore point-flow score — not a replacement. Surfaced on the fighter page and explained on the methodology page, with its real, modest accuracy stated honestly rather than oversold.

**Spec:** `docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md`, section 7 ("Modèle entraîné (win predictor)").

**Why this scope, not more:** a prototype (`data/scripts/prototype-ml-rating.ts`, already run against real production data, see the spec section 7 for the full numbers) validated the feature set empirically before this plan was written — accuracy 57.6% / log-loss 0.6855 on a chronological held-out test set (fights after 2023-03-11), vs. 53.1%/0.6931 for the existing point-flow score alone. That is a real but modest lift, not a breakthrough — the production scope below matches that: one complementary number, not a rebuilt ranking system.

**Architecture:** Same split as the rest of `data/lib/rating/` vs `data/scripts/` — pure, TDD'd feature-engineering + the existing hand-rolled `logistic-regression.ts` (already built + tested during the prototype phase, 5/5 tests green) live in `data/lib/rating/`; the training script and the batch computation that writes to Neon are untested I/O orchestration, verified manually against real data, same rationale as `compute-fighter-ratings.ts`.

**Tech stack:** No new dependency (same "hand-rolled, dataset is small enough" rationale as k-means/point-flow). The trained model itself is small enough (16 numbers: 15 weights + bias, plus 15 means + 15 stds for standardization) to commit as a JSON file in the repo, same convention as committing `data/scraped/ufcstats-fight-stats.json`.

**Testing approach:** TDD for the feature-engineering functions extracted from the prototype script (Task 1). `logistic-regression.ts` is already tested (pre-existing, from the prototype phase). The training script and batch computation are verified manually against real Neon data (re-running `npm run explore:ml-rating`-style accuracy checks), same as every other batch script in this codebase.

**Not in this plan (explicitly deferred, see spec section 7 point 6):** physical attributes (age/height/reach — not scraped), common-opponent graph features, alternate window sizes beyond the validated 5-fight window, multi-org support (still UFC-only, same v1 constraint as the rest of FightScore), wiring retraining into `daily-sync.yml` (see the note after Task 4 — ask before adding, same pattern this project already follows for CI changes).

---

### Task 1: Extract feature-engineering into a tested lib module — `data/lib/rating/win-predictor-features.ts`

**Files:**
- Create: `data/lib/rating/win-predictor-features.ts` + `.test.ts`
- Modify: `data/scripts/prototype-ml-rating.ts` (replace its inline `RunningFighterState`/`styleRates`/`averageRecentPerformance`/`monthsSinceLastFight` logic with imports from the new module — keeps the prototype as a thin, still-runnable I/O script instead of two copies of the same math)

The prototype script (`data/scripts/prototype-ml-rating.ts`) has this logic inline and untested (acceptable for a throwaway exploration, not for production). Pull it out as pure functions:

```ts
export const STYLE_WINDOW = 5;
export const PERFORMANCE_WINDOW = 3;

export type FightStyleSample = {
  minutes: number;
  head: number; body: number; leg: number; distance: number; clinch: number; ground: number;
  tdLanded: number; tdAttempted: number; control: number; subAttempts: number;
};

export type RunningFighterState = {
  points: number;
  currentStreak: number;
  isFormerChampion: boolean;
  lastFightDate: string | null;
  recentFights: FightStyleSample[];       // capped at STYLE_WINDOW, most recent last
  recentPerformance: number[];            // own-perspective dominance, capped at PERFORMANCE_WINDOW
};

export function newRunningFighterState(): RunningFighterState;
export function styleRates(state: RunningFighterState): number[];               // 10 values, FEATURE order below
export function averageRecentPerformance(state: RunningFighterState): number;   // 0.5 neutral prior if empty
export function monthsSinceLastFight(lastFightDate: string | null, eventDate: string): number;

// The 15-length diff vector fed to the model, in a fixed, exported order --
// both the training script and the batch-computation script must use this
// same function so the feature order can never drift between training and
// inference.
export const WIN_PREDICTOR_FEATURE_NAMES: string[]; // 15 names, same order as buildMatchupFeatures' output

export function buildMatchupFeatures(a: RunningFighterState, b: RunningFighterState, eventDate: string): number[];

// Applies one fight's result to a fighter's state -- mutates and returns the
// same object for convenience, mirrors the update half of the prototype's
// per-fight loop (sliding-window push+shift, streak flip, former-champion
// latch, own-perspective performance push).
export function recordFightResult(
  state: RunningFighterState,
  sample: FightStyleSample,
  won: boolean,
  dominanceScore: number, // from computeDominanceScore -- 1 - score is used internally when won is false
  isTitleFight: boolean,
  eventDate: string,
): void;
```

`buildMatchupFeatures` must produce **exactly** the same 15 values, in the same order, as the prototype's `winnerFeatures` array (see `docs/superpowers/specs/2026-09-14-fighter-rating-algorithm-design.md` section 7 point 3 for the feature list) -- `pointsDiff, streakDiff, formerChampionDiff, monthsSinceLastFightDiff, recentPerformanceDiff`, then the 10 style-rate diffs in `styleRates`' fixed order (head/body/leg/distance/clinch/ground attempted rates, takedown rate, takedown accuracy, control-time rate, submission-attempt rate). `state.points` needs to be tracked here too (the prototype read it straight from `simulateDivisionRatings`' history instead of tracking it itself) -- this module owns it now so Task 2/3 don't need to re-run the full point-flow simulation just to get a fighter's current points; the batch script (Task 3) can seed it from the already-computed `fighter_ratings.points`.

- [ ] **Step 1: Write failing tests.** At minimum:
  - `styleRates` on a state with 2 fights in the window matches hand-computed per-15-minute rates; a state with 0 fights returns all zeros (not NaN/division-by-zero).
  - `styleRates` only reflects the **last STYLE_WINDOW** fights -- push a 6th fight into a state, assert the 1st fight's stats are no longer included in the rate.
  - `averageRecentPerformance` returns 0.5 for an empty state (neutral prior, not 0), and the correct mean once 1-3 values are pushed; only the last PERFORMANCE_WINDOW are kept.
  - `monthsSinceLastFight` returns 0 for `null` (first-ever fight), and a plausible value (assert against a hand-computed number, tolerance for the 30.44-day-month approximation) for two real ISO dates.
  - `buildMatchupFeatures` on two hand-constructed `RunningFighterState`s produces the exact expected 15-value array (assert each value, not just the length) -- this is the single most important test in this task, since a silent ordering bug here would silently corrupt every downstream prediction.
  - `recordFightResult`: winning flips/extends a positive streak, losing flips/extends a negative streak (alternating win-loss-win produces `+1, -1, +1`, not an accumulating counter); a title-fight win latches `isFormerChampion` true and it stays true after a subsequent loss; `recentFights`/`recentPerformance` respect their window caps after repeated calls; the loser's `recentPerformance` push is `1 - dominanceScore`, the winner's is `dominanceScore` verbatim.
- [ ] **Step 2: Implement**, porting the logic from `prototype-ml-rating.ts` rather than rewriting from scratch (it's already been run against real data once). Run `npm test`, confirm green.
- [ ] **Step 3: Rewire `prototype-ml-rating.ts`** to import from this module instead of its own inline copies. Re-run `npm run explore:ml-rating` and confirm the printed accuracy/log-loss numbers are **identical** to the pre-refactor run (57.6% / 0.6855 on the same chronological split) -- if they differ, the extraction introduced a behavior change, find it before moving on.
- [ ] **Step 4: Commit.**

```bash
git add data/lib/rating/win-predictor-features.ts data/lib/rating/win-predictor-features.test.ts data/scripts/prototype-ml-rating.ts
git commit -m "refactor(ratings): extract win-predictor feature engineering into a tested lib module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Training script — `data/scripts/train-win-predictor.ts`

**Files:**
- Create: `data/scripts/train-win-predictor.ts`
- Create: `data/ml-models/win-predictor.json` (committed artifact, same convention as `data/scraped/ufcstats-fight-stats.json`)
- Modify: `package.json` (`"train:win-predictor"`)

Loads the same `fighter_fight_stats`/`fighter_fight_round_stats` data as `compute-fighter-ratings.ts`, walks each division chronologically (reuse `simulateDivisionRatings` for points, `recordFightResult`/`buildMatchupFeatures` from Task 1 for everything else -- same example-construction approach as the prototype: 50/50 A/B coin flip per fight, seeded, so the label isn't always 1).

Unlike the prototype (which held out the most recent 20% purely to measure generalization), this script trains the **final production model on 100% of the available examples** -- more data, since there's no further decision left to validate, this is the artifact that actually ships. It still prints a chronological 80/20 holdout accuracy/log-loss purely as a logged sanity check (should land close to the prototype's 57.6%/0.6855 -- if it's wildly different, something about the full-dataset run diverged from the prototype, investigate before trusting the shipped model).

Serialized model shape:
```ts
type SerializedWinPredictor = {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
  featureNames: string[]; // WIN_PREDICTOR_FEATURE_NAMES, embedded so a future reader doesn't have to cross-reference the lib module
  trainedAt: string;      // ISO timestamp
  exampleCount: number;
  holdoutAccuracy: number;  // the logged sanity-check number above, kept for reference
  holdoutLogLoss: number;
};
```

- [ ] **Step 1: Write the script.** Load + pair + group fights (mirror `compute-fighter-ratings.ts`'s query/pairing/grouping exactly -- don't reinvent it, copy-adapt). Build examples via Task 1's functions. Split chronologically 80/20, train on the 80% first and log holdout metrics, then retrain on 100% for the artifact that actually gets serialized.
- [ ] **Step 2: Run it for real** against production Neon. Confirm the logged holdout accuracy/log-loss are close to the prototype's 57.6%/0.6855 (allow some noise -- the prototype's exact split boundary may shift slightly if new fights have synced since). Sanity-check `data/ml-models/win-predictor.json` -- 15 weights, plausible magnitudes (compare against the prototype's printed coefficient ranking in the spec section 7).
- [ ] **Step 3: Commit.**

```bash
git add data/scripts/train-win-predictor.ts data/ml-models/win-predictor.json package.json
git commit -m "feat(ratings): add win-predictor training script + first trained model artifact

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Batch computation — `ml_win_probability` on `fighter_ratings`

**Files:**
- Modify: `data/scripts/compute-fighter-ratings.ts`
- Modify: `data/lib/definitions.ts` (`FighterRating` gains `ml_win_probability: number | null`)

For each division already being walked by `compute-fighter-ratings.ts` (right where style clustering already happens, since both need the same per-fighter aggregated fight history), additionally:

1. Load `data/ml-models/win-predictor.json` once at the top of `main()` (fail loudly if missing -- run Task 2's training script first; don't silently skip and leave the column null for everyone).
2. Build each fighter's **current** `RunningFighterState` (Task 1's type) from their full fight history in this division (not point-in-time -- this is "how would this fighter do right now", using their most recent up-to-5 fights for style rates, their actual current `points`/`currentStreak`/`isFormerChampion` from the just-computed `fighterStates` map, and `monthsSinceLastFight` computed against **today's date**, not a past fight's date).
3. Compute the division's **average** fighter state the same way, across every rated fighter in that division (mean of each raw feature, not a diff) -- this is fighter B's role, a synthetic "average opponent."
4. `mlWinProbability = predictProbability(model, buildMatchupFeatures(fighterState, divisionAverageState, todayIso))` -- one number per fighter, 0-1, "this fighter's estimated win probability against a division-average opponent today." Requires a small adapter since `buildMatchupFeatures` takes two `RunningFighterState`s and averaging raw feature *states* (not already-computed feature vectors) needs its own helper -- add `averageFighterState(states: RunningFighterState[]): RunningFighterState`-shaped raw averages (or simpler: average the 15 already-diffed... no -- average must happen on raw per-fighter values before diffing, not after, otherwise the diffs don't compose. Decide the exact mechanics here against real code, not just this plan text, and add a test for whichever averaging helper gets written).
5. `ALTER TABLE fighter_ratings ADD COLUMN IF NOT EXISTS ml_win_probability NUMERIC;` in `ensureSchema()`, included in the upsert.

**NUMERIC gotcha reminder** (already bit this codebase once, see `order-division.ts`'s `championOutranked` fix, commit `2f240b5`): `@neondatabase/serverless` returns a `NUMERIC` column as a **string** at runtime. Any future code comparing `ml_win_probability` with `<`/`>` must `Number(...)` it first -- add a one-line warning comment on the new `FighterRating.ml_win_probability` field, matching the existing warning already on `display_score`.

- [ ] **Step 1: Add the averaging helper to `win-predictor-features.ts`** (Task 1's module) -- TDD it there, not inline in the script, since it's pure and easy to get subtly wrong (e.g. averaging `isFormerChampion` booleans needs to produce a fractional "share of the division that are former champions," not a boolean).
- [ ] **Step 2: Wire it into `compute-fighter-ratings.ts`**, add the column, run `npm run compute:ratings` for real against Neon.
- [ ] **Step 3: Spot-check** a handful of real fighters (e.g. current lightweight top 5) -- `ml_win_probability` should roughly track `display_score`'s ordering but need not match exactly (that's the point of it being a distinct signal, per the spec's `recentPerformanceDiff` finding that recent form outweighs cumulative points) -- if it's wildly uncorrelated or degenerate (e.g. every fighter near 0.5, or near 0/1), investigate before shipping the UI in Task 4.
- [ ] **Step 4: Commit.**

```bash
git add data/scripts/compute-fighter-ratings.ts data/lib/definitions.ts data/lib/rating/win-predictor-features.ts data/lib/rating/win-predictor-features.test.ts
git commit -m "feat(ratings): compute ml_win_probability as a complementary FightScore signal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: UI — surface the complementary metric

**Files:**
- Modify: `components/ui/ratings/fighter-score-card.tsx` (or wherever Task 11 of the original plan put it -- verify the actual current filename before editing)
- Modify: `app/classement-calcule/methodologie/page.tsx` (or equivalent)
- Modify: `data/lib/data.ts` fetchers that return `FighterRating`/`FighterRatingWithFighter` to include the new column (verify each SELECT explicitly lists columns vs `SELECT *` before assuming it's already included)

1. Fighter page: a small secondary line under the existing FightScore display, e.g. "Probabilité de victoire estimée face à un adversaire moyen de la division (modèle ML) : **62%**" -- visually secondary (smaller text/muted color) to the primary FightScore, matching the "complète, ne remplace pas" decision.
2. Methodology page: new paragraph explaining what feeds the model (points + forme récente + style, voir spec section 7) and stating the real accuracy honestly -- "Ce modèle prédit correctement l'issue d'un combat dans environ 58% des cas sur des combats qu'il n'a jamais vus à l'entraînement (contre 50% au hasard) -- un signal utile, mais pas une certitude." Don't round up to make it sound better than it is.
3. Decide (verify visually, don't assume) whether the ranking **list** page also needs this or whether fighter-page + methodology is enough for v1 -- the spec doesn't mandate it on the list, adding it there risks cluttering `FightScoreList` with a second number next to every row. Default to fighter-page-only unless it looks obviously incomplete once you see it rendered.

- [ ] **Step 1:** Wire the fetchers/column through.
- [ ] **Step 2:** Fighter page UI.
- [ ] **Step 3:** Methodology page copy.
- [ ] **Step 4: Verify live** in the browser (dev server, real Neon data) against a real fighter -- same discipline as Task 11 of the original plan (screenshot, not just "should work").
- [ ] **Step 5: Commit.**

---

**Deferred, not a task here:** retraining cadence. `fighter_fight_stats` only grows by a handful of fights per week (an ordinary UFC event weekend), so daily retraining (`npm run train:win-predictor` wired into `daily-sync.yml` right after `compute:ratings`) would mostly retrain on near-identical data -- unnecessary CI runtime for no real benefit. Recommend manual/periodic retraining (e.g. monthly, or after a visibly large data refresh) instead of full CI automation. **Ask the user before wiring anything into `daily-sync.yml`** -- same pattern this project already follows for every prior CI change (Playwright install, `compute:ratings` itself).
