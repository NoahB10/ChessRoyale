// Pure, framework-free state machine for an online game room.
//
// The Durable Object wraps this; keeping the rules here (not in the DO) means
// the authoritative server logic is unit-testable with plain Vitest and reuses
// the exact same engine the local game uses — no second implementation.
import type { GameState, Player } from '../game/types';
import {
  canDeploy,
  createInitialState,
  cycleHand,
  deployCard,
  deployReady,
  tick,
} from '../game/gameEngine';
import { DEFAULT_SPEED, MAX_SPEED, MIN_SPEED } from '../game/constants';
import type { PendingState, RoomPhase } from './protocol';

export interface RoomState {
  game: GameState;
  phase: RoomPhase;
  /** authoritative virtual clock (ms). */
  simNow: number;
  /** game-speed multiplier chosen at room creation; sim advances at real*speed. */
  speed: number;
  /** placements each side is holding until their deploy cooldown clears. */
  pending: PendingState;
}

const NO_PENDING: PendingState = { white: null, black: null };

function clampSpeed(s: number): number {
  if (!Number.isFinite(s) || s <= 0) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
}

/** A room that exists but has not started (waiting for both seats to fill). */
export function createRoom(now: number, speed: number = DEFAULT_SPEED): RoomState {
  return {
    game: createInitialState(now),
    phase: 'waiting',
    simNow: now,
    speed: clampSpeed(speed),
    pending: { ...NO_PENDING },
  };
}

/** Start (or restart, for a rematch) a fresh game at the room's speed. */
export function startGame(now: number, speed: number = DEFAULT_SPEED): RoomState {
  return {
    game: createInitialState(now),
    phase: 'playing',
    simNow: now,
    speed: clampSpeed(speed),
    pending: { ...NO_PENDING },
  };
}

/** Commit held placements whose cooldown cleared; drop ones no longer legal. */
function commitPending(room: RoomState): RoomState {
  let game = room.game;
  let pending = room.pending;
  for (const side of ['white', 'black'] as Player[]) {
    const p = pending[side];
    if (!p) continue;
    if (!canDeploy(game, side, p.handIndex, p.file, p.rank)) {
      pending = { ...pending, [side]: null };
      continue;
    }
    if (deployReady(game, side, room.simNow)) {
      const after = deployCard(game, side, p.handIndex, p.file, p.rank, room.simNow);
      if (after !== game) {
        game = after;
        pending = { ...pending, [side]: null };
      }
    }
  }
  return game === room.game && pending === room.pending ? room : { ...room, game, pending };
}

/** Advance the authoritative simulation by `dtMs` of real time, scaled by speed. */
export function advanceRoom(room: RoomState, dtMs: number): RoomState {
  if (room.phase !== 'playing') return room;
  const simNow = room.simNow + Math.max(0, dtMs) * (room.speed ?? DEFAULT_SPEED);
  const game = tick(room.game, simNow);
  const advanced: RoomState = {
    ...room,
    game,
    simNow,
    phase: game.status === 'playing' ? 'playing' : 'over',
  };
  return commitPending(advanced);
}

/**
 * Queue (or immediately apply, if the cooldown is clear) a player's deploy
 * intent. Validation runs through the engine's `deployCard`, so an illegal
 * intent is impossible to apply; an on-cooldown intent is held as `pending`.
 */
export function queueIntent(
  room: RoomState,
  side: Player,
  handIndex: number,
  file: number,
  rank: number,
): RoomState {
  if (room.phase !== 'playing') return room;
  if (!canDeploy(room.game, side, handIndex, file, rank)) return room;
  if (deployReady(room.game, side, room.simNow)) {
    const game = deployCard(room.game, side, handIndex, file, rank, room.simNow);
    if (game === room.game) return room;
    return {
      ...room,
      game,
      pending: { ...room.pending, [side]: null },
      phase: game.status === 'playing' ? 'playing' : 'over',
    };
  }
  return { ...room, pending: { ...room.pending, [side]: { handIndex, file, rank } } };
}

/** Spend energy to draw a fresh hand for a side. */
export function cycleRoom(room: RoomState, side: Player): RoomState {
  if (room.phase !== 'playing') return room;
  const game = cycleHand(room.game, side);
  return game === room.game ? room : { ...room, game };
}

/**
 * Immediately apply a deploy intent (ignores cooldown queuing). Kept for direct
 * unit testing of validation; the live server uses queueIntent.
 */
export function applyIntent(
  room: RoomState,
  side: Player,
  handIndex: number,
  file: number,
  rank: number,
): RoomState {
  if (room.phase !== 'playing') return room;
  const game = deployCard(room.game, side, handIndex, file, rank, room.simNow);
  if (game === room.game) return room;
  return { ...room, game, phase: game.status === 'playing' ? 'playing' : 'over' };
}
