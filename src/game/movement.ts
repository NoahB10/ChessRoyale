import type { Move, Piece, Player, Position } from './types';
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
const ALL8: Delta[] = [...ORTHO, ...DIAG];

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

/** King: one square in any direction, into an empty square or onto a capturable enemy. */
export function kingMoves(pieces: Piece[], piece: Piece): Move[] {
  return jumpMoves(pieces, piece, ALL8);
}

/**
 * Full normal-chess moves for a piece (used to detect legal captures).
 * The king moves one square in any direction (it is no longer stationary).
 */
export function legalMoves(pieces: Piece[], piece: Piece): Move[] {
  switch (piece.type) {
    case 'king':
      return kingMoves(pieces, piece);
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
      dirs = ALL8;
      break;
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

/** True if every square strictly between two collinear points is empty. */
function clearBetween(pieces: Piece[], f0: number, r0: number, f1: number, r1: number): boolean {
  const df = Math.sign(f1 - f0);
  const dr = Math.sign(r1 - r0);
  let f = f0 + df;
  let r = r0 + dr;
  while (f !== f1 || r !== r1) {
    if (pieceAt(pieces, f, r)) return false;
    f += df;
    r += dr;
  }
  return true;
}

/** Whether piece `p` attacks square (f,r), using full chess range for sliders. */
function pieceAttacks(pieces: Piece[], p: Piece, f: number, r: number): boolean {
  const df = f - p.file;
  const dr = r - p.rank;
  if (df === 0 && dr === 0) return false;
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  switch (p.type) {
    case 'pawn':
      return dr === FORWARD[p.owner] && adf === 1;
    case 'knight':
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case 'king':
      return adf <= 1 && adr <= 1;
    case 'rook':
      return (df === 0 || dr === 0) && clearBetween(pieces, p.file, p.rank, f, r);
    case 'bishop':
      return adf === adr && clearBetween(pieces, p.file, p.rank, f, r);
    case 'queen':
      return (df === 0 || dr === 0 || adf === adr) && clearBetween(pieces, p.file, p.rank, f, r);
  }
}

/**
 * Whether square (f,r) is attacked by any piece owned by `attacker` (full range,
 * so the king flees squares a rook/bishop/queen could capture into; pawns attack
 * their two forward diagonals; the king attacks adjacent squares).
 */
export function isSquareAttacked(pieces: Piece[], f: number, r: number, attacker: Player): boolean {
  return pieces.some((p) => p.owner === attacker && pieceAttacks(pieces, p, f, r));
}

/** Every piece owned by `owner` that attacks square (f,r). */
export function attackersOf(pieces: Piece[], f: number, r: number, owner: Player): Piece[] {
  return pieces.filter((p) => p.owner === owner && pieceAttacks(pieces, p, f, r));
}
