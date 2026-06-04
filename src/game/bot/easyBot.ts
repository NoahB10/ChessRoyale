import type { ChooseDeployment } from './types';
import { legalDeployments } from './legalDeployments';
import { pick } from './rng';

/**
 * Easy: plays a random affordable card on a random legal square. No notion of
 * defense or attack — it just picks uniformly from whatever is legal. (Its slow
 * reaction time is applied by the controller, not here.)
 */
export const easyBot: ChooseDeployment = (state, player, rng) =>
  pick(rng, legalDeployments(state, player));
