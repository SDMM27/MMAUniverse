// data/lib/rating/matchup-model-tuned.ts
//
// The shipped matchup layer, as written by `npm run tune:matchup`. A few
// numbers, shipped to the browser with the simulator.
import type { MatchupModel } from './matchup-model';
import tuned from '../../ml-models/fight-matchup-model.json';

export const MATCHUP_MODEL = tuned.model as MatchupModel;
