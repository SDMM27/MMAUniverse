// data/scripts/check-ratings.ts
//
// Judges the FightScore v2 method on its two metrics (docs/superpowers/specs/
// 2026-09-22-fightscore-glicko-design.md): held-out log-loss, and the sanity
// checks of data/lib/rating/sanity-checks.ts. Prints the simulated P4P and
// per-division tops exactly as compute-fighter-ratings.ts would store them --
// WITHOUT writing anything. Read-only against Neon (fights + current
// champions). Run with `npm run check:ratings` (`--refresh` to re-fetch the
// fights, `--params '{"rdPerMonth":30}'` to try other constants, `--top 15`
// for longer per-division lists, `--prospect` to start debutants from their
// pre-UFC record, see data/lib/rating/prospect-rating.ts).
import { neon } from '@neondatabase/serverless';
import { DEFAULT_GLICKO_PARAMS, conservativeRating, type GlickoParams } from '../lib/rating/glicko-rating';
import { simulateCareerRatings, ratingAsOf } from '../lib/rating/simulate-career';
import { collectCareerRatingDiffs } from '../lib/rating/glicko-tuning';
import { evaluateLogRatios, fitScale } from '../lib/rating/point-flow-tuning';
import { homeDivision, isEligibleInDivision, divisionDisplayScores, poundForPoundScores, capChallengersBelowChampion } from '../lib/rating/display-scores';
import {
  winsOverTopTen,
  titleFightWins,
  checkCarryOver,
  checkThinNumberOne,
  checkDefendingChampions,
  checkPoundForPoundNumberOne,
  type RankedFighter,
  type CheckResult,
} from '../lib/rating/sanity-checks';
import { sortWeightClassGroups } from '../lib/rating/order-division';
import { loadData, loadEnvLocal, toCareerInputs } from './tuning-data';
import { loadExternalHistory } from './matchup-tuning';
import { PROSPECT_PARAMS, prospectInitialRatings } from '../lib/rating/prospect-rating';

const TEST_SHARE = 0.2;
const POINT_FLOW_REFERENCE_LOG_LOSS = 0.6767;

// Expert expectations: REPORTED, never used by the method or to tune it.
const EXPERT_EXPECTATIONS: { description: string; holds: (p4pMen: string[]) => boolean }[] = [
  { description: 'Islam Makhachev dans le top 3 P4P hommes', holds: (p4p) => p4p.slice(0, 3).includes('Islam Makhachev') },
  { description: 'Islam Makhachev n°1 P4P hommes', holds: (p4p) => p4p[0] === 'Islam Makhachev' },
];

function parseTopCount(): number {
  const index = process.argv.indexOf('--top');
  return index === -1 ? 5 : Number(process.argv[index + 1]);
}

function parseParams(): GlickoParams {
  const index = process.argv.indexOf('--params');
  if (index === -1) return DEFAULT_GLICKO_PARAMS;
  return { ...DEFAULT_GLICKO_PARAMS, ...JSON.parse(process.argv[index + 1]) };
}

function printCheck(check: CheckResult) {
  console.log(`  ${check.passed ? 'OK    ' : 'ÉCHEC '} ${check.name}`);
  for (const line of check.details.slice(0, 8)) console.log(`           - ${line}`);
  if (check.details.length > 8) console.log(`           … et ${check.details.length - 8} autre(s)`);
}

async function main() {
  const params = parseParams();
  const todayIso = new Date().toISOString().slice(0, 10);
  const data = await loadData();
  const names = data.fighterNames;
  const label = (id: number) => names[id] ?? String(id);
  const { fights, noResults } = toCareerInputs(data);

  loadEnvLocal();
  const sql = neon(process.env.DATABASE_URL!);
  const rankingRows = (await sql`
    SELECT weight_class, rank, fighter_id FROM rankings
    WHERE organization_id = 1 AND fighter_id IS NOT NULL AND weight_class NOT ILIKE '%pound-for-pound%'
  `) as { weight_class: string; rank: number; fighter_id: number }[];
  const championIdByDivision = new Map(rankingRows.filter((r) => r.rank === 0).map((r) => [r.weight_class, r.fighter_id]));
  const officialDivisionByFighter = new Map(rankingRows.map((r) => [r.fighter_id, r.weight_class]));
  let initialRatingOf: ((fighterId: number, debutDateIso: string) => number) | undefined;
  if (process.argv.includes('--prospect')) {
    const { rows, sherdogUrlOf } = await loadExternalHistory();
    initialRatingOf = prospectInitialRatings(rows, sherdogUrlOf, params.initialRating);
    console.log(`Niveau de départ des débutants d'après leur palmarès hors UFC : ${JSON.stringify(PROSPECT_PARAMS)}`);
  }

  // Metric 1: held-out log-loss.
  const dates = fights.map((f) => f.eventDate);
  const testFromDate = dates[Math.floor(dates.length * (1 - TEST_SHARE))];
  const split = collectCareerRatingDiffs(fights, noResults, params, testFromDate, initialRatingOf);
  const scale = fitScale(split.train);
  const test = evaluateLogRatios(split.test, scale);
  console.log(`Paramètres : ${JSON.stringify(params)}`);
  console.log(`Log-loss holdout (${test.count} combats depuis ${testFromDate}) : ${test.logLoss.toFixed(4)} (référence flux de points ${POINT_FLOW_REFERENCE_LOG_LOSS}), précision ${(test.accuracy * 100).toFixed(1)} %`);

  // The ranking, as compute-fighter-ratings.ts stores it.
  const { fighterStates, history } = simulateCareerRatings(fights, noResults, params, initialRatingOf);
  const ufcFightsInDivision = new Map<string, number>();
  for (const e of history) for (const id of [e.winnerId, e.loserId]) ufcFightsInDivision.set(`${id}|${e.division}`, (ufcFightsInDivision.get(`${id}|${e.division}`) ?? 0) + 1);

  type Row = RankedFighter & { eligible: boolean; rating: number; rd: number };
  const rowsByDivision = new Map<string, Row[]>();
  for (const [fighterId, state] of Array.from(fighterStates.entries())) {
    const now = ratingAsOf(state, todayIso, params);
    for (const [division, lastDate] of Array.from(state.lastFightDateByDivision.entries())) {
      if (!ufcFightsInDivision.has(`${fighterId}|${division}`)) continue; // no-contest-only division
      const isChampion = championIdByDivision.get(division) === fighterId;
      const row: Row = {
        fighterId,
        division,
        conservative: conservativeRating(now.rating, now.rd, params),
        rating: now.rating,
        rd: now.rd,
        isChampion,
        ufcFights: state.ufcFights,
        eligible: isEligibleInDivision({ lastFightDateInDivision: lastDate, isChampion, isHomeDivision: homeDivision(state, officialDivisionByFighter.get(fighterId), todayIso) === division }, todayIso),
      };
      const list = rowsByDivision.get(division) ?? [];
      list.push(row);
      rowsByDivision.set(division, list);
    }
  }

  const rankedDivisions = new Map<string, Row[]>();
  for (const [division, rows] of Array.from(rowsByDivision.entries())) {
    rankedDivisions.set(division, rows.filter((r) => r.eligible).sort((a, b) => b.conservative - a.conservative));
  }

  const p4pFor = (women: boolean) => {
    const best = new Map<number, Row>();
    for (const [division, rows] of Array.from(rankedDivisions.entries())) {
      if (division.startsWith("Women's") !== women) continue;
      for (const r of rows) if (!best.has(r.fighterId) || r.isChampion) best.set(r.fighterId, r);
    }
    const list = Array.from(best.values()).sort((a, b) => b.conservative - a.conservative);
    const raw = poundForPoundScores(list.map((r) => ({ fighterId: r.fighterId, conservative: r.conservative, eligible: true })));
    const divisions = Array.from(rankedDivisions.entries())
      .filter(([division]) => division.startsWith("Women's") === women)
      .map(([division, rows]) => ({ championId: championIdByDivision.get(division), eligibleIds: rows.map((r) => r.fighterId) }));
    const scores = capChallengersBelowChampion(raw, divisions);
    // `list` stays in rating order for the sanity checks; `shown` is the displayed order.
    const shown = list.slice().sort((a, b) => scores.get(b.fighterId)! - scores.get(a.fighterId)!);
    return { list, shown, scores };
  };

  for (const [title, women] of [['hommes', false], ['femmes', true]] as const) {
    const { shown, scores } = p4pFor(women);
    console.log(`\n=== Top 10 P4P ${title} ===`);
    shown.slice(0, 10).forEach((r, i) =>
      console.log(`  ${String(i + 1).padStart(2)}. ${label(r.fighterId).padEnd(24)} ${r.division.padEnd(20)} ${scores.get(r.fighterId)!.toFixed(1).padStart(5)}  (R ${r.rating.toFixed(0)} ± ${r.rd.toFixed(0)}, ${r.ufcFights} combats UFC)${r.isChampion ? '  CHAMPION' : ''}`),
    );
  }

  const topCount = parseTopCount();
  console.log(`\n=== Top ${topCount} par catégorie (règle du champion appliquée) ===`);
  const groups = sortWeightClassGroups(Array.from(rowsByDivision.keys()).map((weightClass) => ({ weightClass })));
  for (const { weightClass } of groups) {
    const all = rowsByDivision.get(weightClass)!;
    const scores = divisionDisplayScores(all);
    const shown = all.filter((r) => r.eligible).sort((a, b) => scores.get(b.fighterId)! - scores.get(a.fighterId)! || b.conservative - a.conservative);
    if (shown.length === 0) continue;
    const championRank = rankedDivisions.get(weightClass)!.findIndex((r) => r.isChampion);
    console.log(`  ${weightClass}${championRank > 0 ? `  (champion ${championRank + 1}e sur la note seule)` : ''}`);
    shown.slice(0, topCount).forEach((r, i) => console.log(`    ${i + 1}. ${label(r.fighterId).padEnd(24)} ${scores.get(r.fighterId)!.toFixed(1).padStart(5)}  (${r.ufcFights} combats UFC)${r.isChampion ? '  CHAMPION' : ''}`));
  }

  // Metric 2: sanity checks (on the rating order, BEFORE the champion display rule).
  const titles = titleFightWins(history);
  console.log('\n=== Contrôles de bon sens ===');
  printCheck(checkCarryOver(history, params.initialRating, label));
  printCheck(checkThinNumberOne(rankedDivisions, winsOverTopTen(history), label));
  printCheck(checkDefendingChampions(rankedDivisions, titles, label));
  printCheck(checkPoundForPoundNumberOne(p4pFor(false).list, titles, label));
  printCheck(checkPoundForPoundNumberOne(p4pFor(true).list, titles, label));
  console.log('\n=== Attentes d\'experts (rapportées, jamais utilisées pour régler) ===');
  const p4pMenNames = p4pFor(false).list.map((r) => label(r.fighterId));
  for (const e of EXPERT_EXPECTATIONS) console.log(`  ${e.holds(p4pMenNames) ? 'OK    ' : 'NON   '} ${e.description}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
