// data/scripts/compare-bonus-effect.ts
//
// Dry run for the 2026-09-29 dominance change (split/majority decision penalty +
// Performance/Fight of the Night credit): replays every UFC fight twice -- as
// before, and with the new rules -- and prints how the rankings move. Writes
// NOTHING: fights come from tuning-data.ts (read-only Neon, or its local cache),
// bonuses from data/scraped/ufcstats-bonuses.json. Run with `npx tsx data/scripts/compare-bonus-effect.ts`
// (`--refresh` to re-fetch the fights, `--top 15`).
import { conservativeRating } from '../lib/rating/glicko-rating';
import { simulateCareerRatings, ratingAsOf, type CareerFightInput } from '../lib/rating/simulate-career';
import { loadUfcStatsBonuses } from '../scrapers/shared/ufcstats-bonuses';
import { neon } from '@neondatabase/serverless';
import { homeDivision, isEligibleInDivision, divisionDisplayScores, poundForPoundScores, capChallengersBelowChampion } from '../lib/rating/display-scores';
import { loadData, loadEnvLocal, toCareerInputs } from './tuning-data';

const topIndex = process.argv.indexOf('--top');
const TOP = topIndex === -1 ? 10 : Number(process.argv[topIndex + 1]);

/** The pre-change dominance inputs: every decision reads as unanimous, no bonuses. */
function withoutNewRules(fight: CareerFightInput): CareerFightInput {
  const method = fight.winnerSide.method.toLowerCase().startsWith('decision') ? 'Decision - Unanimous' : fight.winnerSide.method;
  return { ...fight, winnerSide: { ...fight.winnerSide, method, bonusFightOfTheNight: false, bonusPerformanceOfTheNight: false } };
}

function withNewRules(fight: CareerFightInput, bonuses: ReturnType<typeof loadUfcStatsBonuses>['fights']): CareerFightInput {
  const bonus = bonuses[fight.fightUrl];
  return { ...fight, winnerSide: { ...fight.winnerSide, bonusFightOfTheNight: bonus?.fightOfTheNight ?? false, bonusPerformanceOfTheNight: bonus?.performanceOfTheNight ?? false } };
}

type Sim = ReturnType<typeof simulateCareerRatings>;

/** Per-division display scores and the P4P scores, mirroring compute-fighter-ratings.ts. */
function buildRankings(sim: Sim, divisions: { name: string; ids: number[] }[], championByDivision: Map<string, number>, officialDivision: Map<number, string>, todayIso: string) {
  const conservative = (id: number) => {
    const r = ratingAsOf(sim.fighterStates.get(id)!, todayIso);
    return conservativeRating(r.rating, r.rd);
  };
  const eligibleByDivision = new Map<string, Set<number>>();
  const divisionScores = new Map<string, Map<number, number>>();
  for (const { name, ids } of divisions) {
    const rows = ids.map((fighterId) => {
      const state = sim.fighterStates.get(fighterId)!;
      const isChampion = championByDivision.get(name) === fighterId;
      const eligible = isEligibleInDivision(
        { lastFightDateInDivision: state.lastFightDateByDivision.get(name) ?? null, isChampion, isHomeDivision: homeDivision(state, officialDivision.get(fighterId), todayIso) === name },
        todayIso,
      );
      return { fighterId, conservative: conservative(fighterId), isChampion, eligible };
    });
    eligibleByDivision.set(name, new Set(rows.filter((r) => r.eligible).map((r) => r.fighterId)));
    divisionScores.set(name, divisionDisplayScores(rows));
  }
  const p4p = new Map<boolean, Map<number, number>>();
  for (const women of [false, true]) {
    const inGender = divisions.filter((d) => d.name.startsWith("Women's") === women);
    const all = new Set(inGender.flatMap((d) => d.ids));
    const eligible = new Set(inGender.flatMap((d) => Array.from(eligibleByDivision.get(d.name)!)));
    const scores = poundForPoundScores(Array.from(all, (fighterId) => ({ fighterId, conservative: conservative(fighterId), eligible: eligible.has(fighterId) })));
    p4p.set(women, capChallengersBelowChampion(scores, inGender.map((d) => ({ championId: championByDivision.get(d.name), eligibleIds: eligibleByDivision.get(d.name)! }))));
  }
  return { eligibleByDivision, divisionScores, p4p };
}

async function main() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const data = await loadData();
  const names = data.fighterNames;
  const { fights, noResults } = toCareerInputs(data);
  const bonuses = loadUfcStatsBonuses().fights;

  loadEnvLocal();
  const sql = neon(process.env.DATABASE_URL!);
  const rankingRows = (await sql`
    SELECT weight_class, rank, fighter_id FROM rankings
    WHERE organization_id = 1 AND fighter_id IS NOT NULL AND weight_class NOT ILIKE '%pound-for-pound%'
  `) as { weight_class: string; rank: number; fighter_id: number }[];
  const championByDivision = new Map<string, number>();
  const officialDivision = new Map<number, string>();
  for (const r of rankingRows) {
    if (r.rank === 0) championByDivision.set(r.weight_class, r.fighter_id);
    officialDivision.set(r.fighter_id, r.weight_class);
  }

  const divisions = data.divisions.map((d) => ({
    name: d.name,
    ids: Array.from(new Set(d.fights.flatMap((f) => [f.winnerId, f.loserId]))),
  }));
  const before = simulateCareerRatings(fights.map(withoutNewRules), noResults);
  const after = simulateCareerRatings(fights.map((f) => withNewRules(f, bonuses)), noResults);
  const rankBefore = buildRankings(before, divisions, championByDivision, officialDivision, todayIso);
  const rankAfter = buildRankings(after, divisions, championByDivision, officialDivision, todayIso);

  const decisions = fights.filter((f) => /split|majority/i.test(f.winnerSide.method)).length;
  console.log(`${fights.length} fights replayed: ${decisions} split/majority decisions, ${fights.filter((f) => bonuses[f.fightUrl]).length} with a bonus.
`);

  const printList = (title: string, scoresBefore: Map<number, number>, scoresAfter: Map<number, number>, ids: Set<number>, championId?: number) => {
    const order = (scores: Map<number, number>) =>
      Array.from(ids).sort((a, b) => Number(b === championId) - Number(a === championId) || scores.get(b)! - scores.get(a)!);
    const posBefore = new Map(order(scoresBefore).map((id, i) => [id, i + 1]));
    const listAfter = order(scoresAfter);
    console.log(title);
    listAfter.slice(0, TOP).forEach((id, i) => {
      const move = posBefore.get(id)! - (i + 1);
      const arrow = move === 0 ? '=' : move > 0 ? `▲${move}` : `▼${-move}`;
      console.log(`  ${String(i + 1).padStart(2)}. ${(names[id] ?? `#${id}`).padEnd(26)} ${scoresAfter.get(id)!.toFixed(1).padStart(5)}  ${arrow.padEnd(3)} (avant ${String(posBefore.get(id)).padStart(2)}, ${scoresBefore.get(id)!.toFixed(1)})`);
    });
    console.log();
  };

  for (const women of [false, true]) {
    const inGender = divisions.filter((d) => d.name.startsWith("Women's") === women);
    const eligible = new Set(inGender.flatMap((d) => Array.from(rankAfter.eligibleByDivision.get(d.name)!)));
    const champions = new Set(inGender.map((d) => championByDivision.get(d.name)).filter((id): id is number => id !== undefined));
    // Same one-row-per-fighter P4P list as the site: champions first is NOT applied, the score decides.
    printList(women ? 'Pound-for-pound femmes' : 'Pound-for-pound hommes', rankBefore.p4p.get(women)!, rankAfter.p4p.get(women)!, new Set(Array.from(eligible)));
    void champions;
  }
  if (process.argv.includes('--divisions')) {
    for (const { name } of divisions) {
      const ids = rankAfter.eligibleByDivision.get(name)!;
      if (ids.size >= 5) printList(name, rankBefore.divisionScores.get(name)!, rankAfter.divisionScores.get(name)!, ids, championByDivision.get(name));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
