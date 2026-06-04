import type { CardType, PieceType, Player, Position } from './types';

export const BOARD_SIZE = 8;
export const HAND_SIZE = 4;

export const ENERGY_START = 5;
export const ENERGY_MAX = 10;
/** milliseconds required to regenerate 1 energy (1 energy / 1.5s). */
export const ENERGY_REGEN_MS = 1500;

/** simulation granularity. */
export const GAME_TICK_MS = 250;
/** minimum time between a single piece's actions. */
export const PIECE_COOLDOWN_MS = 900;

/** Energy cost to deploy a card (standard chess values). */
export const PIECE_COST: Record<CardType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
};

/** Value used by targeting to pick the highest-value capture; king dominates. */
export const PIECE_VALUE: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 1000,
};

export const KING_START: Record<Player, Position> = {
  white: { file: 4, rank: 0 }, // e1
  black: { file: 4, rank: 7 }, // e8
};

/** Rank indices each player may deploy onto. */
export const DEPLOY_RANKS: Record<Player, number[]> = {
  white: [0, 1], // ranks 1 & 2
  black: [6, 7], // ranks 7 & 8
};

/** Pawn forward direction as a rank delta. */
export const FORWARD: Record<Player, number> = {
  white: 1, // toward rank 8
  black: -1, // toward rank 1
};

/** Unicode glyphs (solid set, colored per owner via CSS). */
export const PIECE_SYMBOL: Record<PieceType, string> = {
  king: '♚',
  queen: '♛',
  rook: '♜',
  bishop: '♝',
  knight: '♞',
  pawn: '♟',
};

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export function squareName(file: number, rank: number): string {
  return `${FILES[file]}${rank + 1}`;
}
