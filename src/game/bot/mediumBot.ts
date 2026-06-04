import type { ChooseDeployment } from './types';
import { bestDeployment, MEDIUM_WEIGHTS } from './evaluate';

/**
 * Medium: spends energy efficiently. The MEDIUM weights make it place
 * defensive pieces when enemies approach its king, otherwise deploy toward the
 * enemy king, while never valuing raw piece strength and paying a steep cost
 * penalty — so it avoids wasting expensive pieces when a cheaper one suffices.
 */
export const mediumBot: ChooseDeployment = (state, player, rng) =>
  bestDeployment(state, player, MEDIUM_WEIGHTS, rng);
