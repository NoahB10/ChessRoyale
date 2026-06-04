// Pure, framework-free state machine for an online game room.
//
// The Durable Object wraps this; keeping the rules here (not in the DO) means
// the authoritative server logic is unit-testable with plain Vitest and reuses
// the exact same engine the local game uses — no second implementation.
import type { GameState, Player } from '../game/types';
import { createInitialState, deployCard, tick } from '../game/gameEngine';
import type { RoomPhase } from './protocol';

export interface RoomState {
  game: GameState;
  phase: RoomPhase;
  /** authoritative virtual clock (ms). */
  simNow: number;
}

/** A room that exists but has not started (waiting for both seats to fill). */
export function createRoom(now: number): RoomState {
  return { game: createInitialState(now), phase: 'waiting', simNow: now };
}

/** Start (or restart, for a rematch) a fresh game. */
export function startGame(now: number): RoomState {
  return { game: createInitialState(now), phase: 'playing', simNow: now };
}

/** Advance the authoritative simulation by `dtMs` of game time. */
export function advanceRoom(room: RoomState, dtMs: number): RoomState {
  if (room.phase !== 'playing') return room;
  const simNow = room.simNow + Math.max(0, dtMs);
  const game = tick(room.game, simNow);
  return { game, simNow, phase: game.status === 'playing' ? 'playing' : 'over' };
}

/**
 * Apply a player's deploy intent. Validation runs through the engine's
 * `deployCard`, so an illegal intent (wrong zone, no energy, occupied square,
 * game over, or wrong side) is structurally impossible to apply — the room is
 * returned unchanged.
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
  return { game, simNow: room.simNow, phase: game.status === 'playing' ? 'playing' : 'over' };
}
