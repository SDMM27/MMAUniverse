// data/lib/rating/sanity-checks.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  winsOverTopTen,
  titleFightWins,
  checkCarryOver,
  checkThinNumberOne,
  checkDefendingChampions,
  checkPoundForPoundNumberOne,
  type RankedFighter,
} from './sanity-checks';
import type { CareerHistoryEntry } from './simulate-career';

function entry(o: Partial<CareerHistoryEntry> & { winnerId: number; loserId: number; eventDate: string }): CareerHistoryEntry {
  return {
    fightUrl: `${o.winnerId}-${o.loserId}-${o.eventDate}`,
    division: 'Lightweight',
    isTitleFight: false,
    dominanceScore: 0.5,
    dominanceEstimated: false,
    winnerBefore: { rating: 1500, rd: 100 },
    loserBefore: { rating: 1500, rd: 100 },
    winnerAfter: { rating: 1550, rd: 90 },
    loserAfter: { rating: 1450, rd: 90 },
    winnerChangedDivision: false,
    loserChangedDivision: false,
    winnerUfcFightsBefore: 1,
    loserUfcFightsBefore: 1,
    ...o,
  };
}

const ranked = (fighterId: number, o: Partial<RankedFighter> = {}): RankedFighter => ({ fighterId, division: 'Lightweight', conservative: 1500, isChampion: false, ufcFights: 10, ...o });

test('winsOverTopTen counts wins over an opponent ranked top 10 of the division (by conservative rating) at fight time', () => {
  // Twelve fighters build up ratings; fighter 99 then beats the best of them (1) and the worst (12).
  const history: CareerHistoryEntry[] = [];
  for (let id = 1; id <= 12; id++) {
    history.push(entry({ winnerId: id, loserId: 100 + id, eventDate: '2020-01-01', winnerAfter: { rating: 2000 - id * 20, rd: 50 } }));
  }
  history.push(entry({ winnerId: 99, loserId: 1, eventDate: '2020-06-01', loserBefore: { rating: 1980, rd: 50 } }));
  history.push(entry({ winnerId: 99, loserId: 12, eventDate: '2020-07-01', loserBefore: { rating: 1760, rd: 50 } }));
  assert.equal(winsOverTopTen(history).get(99), 1);
});

test('titleFightWins counts title-fight wins per fighter and division', () => {
  const wins = titleFightWins([
    entry({ winnerId: 1, loserId: 2, eventDate: '2020-01-01', isTitleFight: true }),
    entry({ winnerId: 1, loserId: 3, eventDate: '2020-06-01', isTitleFight: true }),
    entry({ winnerId: 1, loserId: 4, eventDate: '2021-01-01', isTitleFight: true, division: 'Welterweight' }),
    entry({ winnerId: 1, loserId: 5, eventDate: '2021-06-01' }),
  ]);
  assert.equal(wins.get(1)?.get('Lightweight'), 2);
  assert.equal(wins.get(1)?.get('Welterweight'), 1);
});

test('checkCarryOver fails when an experienced fighter enters a new division at the initial rating', () => {
  assert.equal(checkCarryOver([entry({ winnerId: 1, loserId: 2, eventDate: '2020-01-01', winnerChangedDivision: true, winnerUfcFightsBefore: 5, winnerBefore: { rating: 1800, rd: 100 } })], 1500).passed, true);
  assert.equal(checkCarryOver([entry({ winnerId: 1, loserId: 2, eventDate: '2020-01-01', winnerChangedDivision: true, winnerUfcFightsBefore: 5, winnerBefore: { rating: 1500, rd: 100 } })], 1500).passed, false);
});

test('checkThinNumberOne fails for a #1 with <= 6 UFC fights and no win over a top-10 opponent', () => {
  const divisions = new Map([['Lightweight', [ranked(1, { ufcFights: 6 }), ranked(2)]]]);
  assert.equal(checkThinNumberOne(divisions, new Map()).passed, false);
  assert.equal(checkThinNumberOne(divisions, new Map([[1, 1]])).passed, true);
  assert.equal(checkThinNumberOne(new Map([['Lightweight', [ranked(1, { ufcFights: 7 })]]]), new Map()).passed, true);
});

test('checkDefendingChampions fails when a champion with a successful defense is outside the top 3', () => {
  const division = [ranked(1), ranked(2), ranked(3), ranked(4, { isChampion: true })];
  const oneDefense = new Map([[4, new Map([['Lightweight', 2]])]]);
  const noDefense = new Map([[4, new Map([['Lightweight', 1]])]]);
  assert.equal(checkDefendingChampions(new Map([['Lightweight', division]]), oneDefense).passed, false);
  assert.equal(checkDefendingChampions(new Map([['Lightweight', division]]), noDefense).passed, true);
  const inTop3 = [ranked(1), ranked(4, { isChampion: true }), ranked(2)];
  assert.equal(checkDefendingChampions(new Map([['Lightweight', inTop3]]), oneDefense).passed, true);
});

test('checkPoundForPoundNumberOne requires the P4P #1 to have won a title fight', () => {
  assert.equal(checkPoundForPoundNumberOne([ranked(1), ranked(2)], new Map()).passed, false);
  assert.equal(checkPoundForPoundNumberOne([ranked(1), ranked(2)], new Map([[1, new Map([['Welterweight', 1]])]])).passed, true);
});
