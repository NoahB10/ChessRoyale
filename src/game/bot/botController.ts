import type { ControllerConfig, Deployment, Difficulty, Rng } from './types';
import type { GameState, Player } from '../types';
import { randRange } from './rng';
import { easyBot } from './easyBot';
import { mediumBot } from './mediumBot';
import { hardBot } from './hardBot';

/** Reaction time window per difficulty, in milliseconds. */
export const REACTION_DELAYS: Record<Difficulty, [number, number]> = {
  easy: [2500, 4000],
  medium: [1500, 2500],
  hard: [600, 1200],
};

/** When a bot has nothing affordable yet, re-check this soon (energy regenerates). */
const RETRY_MS = 500;

const PLAYERS: Player[] = ['white', 'black'];

/** A random reaction delay within the difficulty's configured window. */
export function reactionDelay(difficulty: Difficulty, rng: Rng): number {
  const [lo, hi] = REACTION_DELAYS[difficulty];
  return randRange(rng, lo, hi);
}

/** Dispatch to the right strategy for a difficulty. */
export function chooseForDifficulty(
  difficulty: Difficulty,
  state: GameState,
  player: Player,
  rng: Rng,
): Deployment | null {
  switch (difficulty) {
    case 'easy':
      return easyBot(state, player, rng);
    case 'medium':
      return mediumBot(state, player, rng);
    case 'hard':
      return hardBot(state, player, rng);
  }
}

/**
 * Everything the scheduler needs from the outside world. Keeping these as
 * callbacks lets the React layer wire in the live store while tests wire in a
 * plain object — the scheduler itself stays pure and framework-free.
 */
export interface SchedulerContext {
  getState: () => GameState;
  getController: (player: Player) => ControllerConfig;
  isPaused: () => boolean;
  deploy: (player: Player, d: Deployment) => void;
  rng: Rng;
}

/**
 * Drives bot deployments off a single clock. The React layer calls `step(now)`
 * on a setInterval; the scheduler tracks, per side, when that bot may next act
 * and fires at most one deployment per side per due tick. It never moves
 * pieces — it only feeds Deployments to `ctx.deploy`, which routes through the
 * engine's deployCard.
 */
export class BotScheduler {
  private nextAt: Partial<Record<Player, number>> = {};

  /** Forget all schedules — call on restart so reaction timing starts fresh. */
  reset(): void {
    this.nextAt = {};
  }

  step(now: number, ctx: SchedulerContext): void {
    if (ctx.getState().status !== 'playing') return; // never act once the game is over
    if (ctx.isPaused()) return; // frozen while paused

    for (const player of PLAYERS) {
      const ctrl = ctx.getController(player);
      if (ctrl.kind !== 'bot') {
        delete this.nextAt[player]; // a human controls this side now
        continue;
      }

      // First time we see this bot: give it an initial reaction delay so it
      // does not fire the instant it is switched on.
      if (this.nextAt[player] === undefined) {
        this.nextAt[player] = now + reactionDelay(ctrl.difficulty, ctx.rng);
        continue;
      }
      if (now < this.nextAt[player]!) continue;

      const choice = chooseForDifficulty(ctrl.difficulty, ctx.getState(), player, ctx.rng);
      if (choice) {
        ctx.deploy(player, choice);
        this.nextAt[player] = now + reactionDelay(ctrl.difficulty, ctx.rng);
      } else {
        this.nextAt[player] = now + RETRY_MS; // nothing affordable yet; retry soon
      }
    }
  }
}
