// data/lib/rating/fight-outcome-model.ts
//
// The shipped method/round model, as written by `npm run tune:outcome`. Small
// enough (a few KB) to ship to the browser with the simulator.
import type { FightOutcomeModel } from './fight-outcome';
import tuned from '../../ml-models/fight-outcome-model.json';

export const FIGHT_OUTCOME_MODEL = tuned.model as FightOutcomeModel;
