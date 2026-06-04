import type { Move, Piece, Position } from './types';
import { BOARD_SIZE, FORWARD } from './constants';

type Delta = readonly [number, number];

const ORTHO: Delta[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAG: Delta[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const KNIGHT: Delta[] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

export function inBounds(file: number, rank: number): boolean {
  return file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;
}

export function pieceAt(pieces: Piece[], file: number, rank: number): Piece | undefined {
  return pieces.find((p) => p.file === file && p.rank === rank);
}

function at(p: Piece): Position {
  return { file: p.file, rank: p.rank };
}

/** Sliding pieces: walk each ray until the board edge or a blocker. */
function slideMoves(pieces: Piece[], piece: Piece, dirs: Delta[]): Move[] {
  const moves: Move[] = [];
  for (const [df, dr] of dirs) {
    let f = piece.file + df;
    let r = piece.rank + dr;
    while (inBounds(f, r)) {
      const occ = pieceAt(pieces, f, r);
      if (!occ) {
        moves.push({ from: at(piece), to: { file: f, rank: r }, capture: false });
      } else {
        if (occ.owner !== piece.owner) {
          moves.push({ from: at(piece), to: { file: f, rank: r }, capture: true, capturedId: occ.id });
        }
        break; // blocked: cannot move through an occupied square
      }
      f += df;
      r += dr;
    }
  }
  return moves;
}

/** Knight: jumps, ignoring blockers. */
function jumpMoves(pieces: Piece[], piece: Piece, deltas: Delta[]): Move[] {
  const moves: Move[] = [];
  for (const [df, dr] of deltas) {
    const f = piece.file + df;
    const r = piece.rank + dr;
    if (!inBounds(f, r)) continue;
    const occ = pieceAt(pieces, f, r);
    if (!occ) {
      moves.push({ from: at(piece), to: { file: f, rank: r }, capture: false });
    } else if (occ.owner !== piece.owner) {
      moves.push({ from: at(piece), to: { file: f, rank: r }, capture: true, capturedId: occ.id });
    }
  }
  return moves;
}

/** Pawn: forward one (only if empty); captures one square diagonally forward. */
function pawnMoves(pieces: Piece[], piece: Piece): Move[] {
  const moves: Move[] = [];
  const dir = FORWARD[piece.owner];
  const fr = piece.rank + dir;
  if (inBounds(piece.file, fr) && !pieceAt(pieces, piece.file, fr)) {
    moves.push({ from: at(piece), to: { file: piece.file, rank: fr }, capture: false });
  }
  for (const df of [-1, 1]) {
    const f = piece.file + df;
    if (!inBounds(f, fr)) continue;
    const occ = pieceAt(pieces, f, fr);
    if (occ && occ.owner !== piece.owner) {
      moves.push({ from: at(piece), to: { file: f, rank: fr }, capture: true, capturedId: occ.id });
    }
  }
  return moves;
}

/**
 * Full normal-chess moves for a piece (used to detect legal captures).
 * Kings are stationary in this game, so they have no moves.
 */
export function legalMoves(pieces: Piece[], piece: Piece): Move[] {
  switch (piece.type) {
    case 'king':
      return [];
    case 'pawn':
      return pawnMoves(pieces, piece);
    case 'knight':
      return jumpMoves(pieces, piece, KNIGHT);
    case 'rook':
      return slideMoves(pieces, piece, ORTHO);
    case 'bishop':
      return slideMoves(pieces, piece, DIAG);
    case 'queen':
      return slideMoves(pieces, piece, [...ORTHO, ...DIAG]);
  }
}

/**
 * One-square repositioning candidates toward a target (empty destinations only).
 * Sliding pieces move a single square so animation stays readable and blocking
 * stays meaningful; knights take one jump; pawns step one square forward.
 */
export function stepMoves(pieces: Piece[], piece: Piece): Move[] {
  let dirs: Delta[];
  switch (piece.type) {
    case 'king':
      return [];
    case 'pawn': {
      const dir = FORWARD[piece.owner];
      const fr = piece.rank + dir;
      if (inBounds(piece.file, fr) && !pieceAt(pieces, piece.file, fr)) {
        return [{ from: at(piece), to: { file: piece.file, rank: fr }, capture: false }];
      }
      return [];
    }
    case 'knight':
      dirs = KNIGHT;
      break;
    case 'rook':
      dirs = ORTHO;
      break;
    case 'bishop':
      dirs = DIAG;
      break;
    case 'queen':
      dirs = [...ORTHO, ...DIAG];
      break;
  }
  const moves: Move[] = [];
  for (const [df, dr] of dirs) {
    const f = piece.file + df;
    const r = piece.rank + dr;
    if (!inBounds(f, r)) continue;
    if (!pieceAt(pieces, f, r)) {
      moves.push({ from: at(piece), to: { file: f, rank: r }, capture: false });
    }
  }
  return moves;
}

/** Squared euclidean distance between two positions. */
export function dist2(a: Position, b: Position): number {
  const df = a.file - b.file;
  const dr = a.rank - b.rank;
  return df * df + dr * dr;
}
