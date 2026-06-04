// Types for the bot layer. Bots only ever produce Deployments, which are fed
// through the engine's canDeploy/deployCard — they never move pieces directly.

import type { CardType, GameState, Player } from '../types';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** A single legal placement of a hand card onto a board square. */
export interface Deployment {
  handIndex: number;
  card: CardType;
  file: number;
  rank: number;
}

/** Who controls a side. */
export type ControllerConfig =
  | { kind: 'human' }
  | { kind: 'bot'; difficulty: Difficulty };

/** Injectable randomness: returns a float in [0, 1). */
export type Rng = () => number;

/** A bot's decision function: choose a deployment, or null when none is sensible. */
export type ChooseDeployment = (
  state: GameState,
  player: Player,
  rng: Rng,
) => Deployment | null;
