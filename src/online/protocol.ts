// Wire protocol shared between the browser client and the GameRoom Durable Object.
import type { GameState, Player } from '../game/types';

export type OnlineRole = Player | 'spectator';
export type RoomPhase = 'waiting' | 'playing' | 'over';

// ---- client -> server ----
export interface DeployIntent {
  t: 'deploy';
  handIndex: number;
  file: number;
  rank: number;
}
export interface RematchMsg {
  t: 'rematch';
}
export type ClientMsg = DeployIntent | RematchMsg;

// ---- server -> client ----
export interface AssignedMsg {
  t: 'assigned';
  side: OnlineRole;
  code: string;
}
export interface PresenceMsg {
  t: 'presence';
  white: boolean;
  black: boolean;
  spectators: number;
}
export interface StateMsg {
  t: 'state';
  game: GameState;
  phase: RoomPhase;
}
export interface OpponentLeftMsg {
  t: 'opponent_left';
}
export interface ServerErrorMsg {
  t: 'error';
  message: string;
}
export type ServerMsg = AssignedMsg | PresenceMsg | StateMsg | OpponentLeftMsg | ServerErrorMsg;

/** Generate a short, unambiguous room code (no easily-confused characters). */
export function makeRoomCode(rand: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(rand() * alphabet.length)];
  return code;
}

/** Normalize a user-entered code or a pasted share link into a bare room code. */
export function parseRoomCode(input: string): string {
  const fromHash = input.match(/[#&?]r=([A-Za-z0-9]+)/);
  const raw = fromHash ? fromHash[1] : input;
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
