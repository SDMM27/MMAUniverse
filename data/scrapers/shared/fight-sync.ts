//
// Decides how to reconcile a freshly-scraped card against the fight rows
// already in the DB for that event, matched by fighter pair rather than
// blind delete+recreate. This keeps `fights.id` stable across syncs so
// `picks.fight_id` foreign keys survive routine result syncs — see
// docs/superpowers/specs/2026-08-21-pickem-fantasy-design.md, "Risques".
export type ExistingFightRow = {
  id: number;
  fighter1_id: number;
  fighter2_id: number;
};

export type FreshFight = {
  fighter1_id: number;
  fighter2_id: number;
  fight_finished: boolean;
  winner_id: number | null;
  method: string;
  round: number;
  time: string;
  weight_class: string;
};

export type FightSyncPlan = {
  toUpdate: { id: number; fight: FreshFight }[];
  toInsert: FreshFight[];
  toDeleteIds: number[];
};

function fightKey(fighter1Id: number, fighter2Id: number): string {
  const [a, b] = [fighter1Id, fighter2Id].sort((x, y) => x - y);
  return `${a}-${b}`;
}

export function planFightSync(existing: ExistingFightRow[], fresh: FreshFight[]): FightSyncPlan {
  const existingByKey = new Map(existing.map((row) => [fightKey(row.fighter1_id, row.fighter2_id), row]));
  const freshKeys = new Set(fresh.map((f) => fightKey(f.fighter1_id, f.fighter2_id)));

  const toUpdate: FightSyncPlan['toUpdate'] = [];
  const toInsert: FreshFight[] = [];
  for (const fight of fresh) {
    const match = existingByKey.get(fightKey(fight.fighter1_id, fight.fighter2_id));
    if (match) {
      toUpdate.push({ id: match.id, fight });
    } else {
      toInsert.push(fight);
    }
  }

  const toDeleteIds = existing
    .filter((row) => !freshKeys.has(fightKey(row.fighter1_id, row.fighter2_id)))
    .map((row) => row.id);

  return { toUpdate, toInsert, toDeleteIds };
}
