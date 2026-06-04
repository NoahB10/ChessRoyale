import type { ChooseDeployment } from './types';
import { bestDeployment, HARD_WEIGHTS } from './evaluate';

/**
 * Hard: scores every legal deployment across all factors (threats near its
 * king, blocking attack paths, imminent captures, piece value vs cost, center
 * control, pressure toward the enemy king) and picks the highest. Its faster
 * reaction time is applied by the controller.
 */
export const hardBot: ChooseDeployment = (state, player, rng) =>
  bestDeployment(state, player, HARD_WEIGHTS, rng);
