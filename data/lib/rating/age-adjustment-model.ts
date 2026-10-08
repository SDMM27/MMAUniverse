// data/lib/rating/age-adjustment-model.ts
//
// The shipped age layer, as written by `npm run tune:age`. A few numbers,
// shipped to the browser with the simulator.
import type { AgeAdjustmentModel } from './age-adjustment';
import tuned from '../../ml-models/fight-age-model.json';

export const AGE_ADJUSTMENT_MODEL = tuned.model as AgeAdjustmentModel;
