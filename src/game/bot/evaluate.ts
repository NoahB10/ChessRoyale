import type { Deployment, Rng } from './types';
import type { GameState, Piece, Player, Position } from '../types';
import { BOARD_SIZE, PIECE_COST, PIECE_VALUE } from '../constants';
import { dist2, legalMoves } from '../movement';
import { legalDeployments } from './legalDeployments';
import { pick } from './rng';

/** Relative importance of each positional factor. */
export interface Weights {
  /** guarding the king + blocking attack paths (only bites when threatened) */
  defense: number;
  /** can capture an enemy now (or is closing on one) */
  capture: number;
  /** advancing toward the enemy king */
  pressure: number;
  /** holding squares near the board center */
  center: number;
  /** reward for fielding a strong piece (set 0 to ignore raw strength) */
  value: number;
  /** penalty per unit of energy spent (drives cheaper choices) */
  cost: number;
}

/** Hard bot: balances every factor, including piece value vs cost. */
export const HARD_WEIGHTS: Weights = {
  defense: 2,
  capture: 4,
  pressure: 0.4,
  center: 0.5,
  value: 1.5,
  cost: 1,
};

/**
 * Medium bot: cares about defending and attacking but never about raw piece
 * strength, and pays a steeper cost penalty — so it spends efficiently and
 * does not waste expensive pieces when a cheaper one does the job.
 */
export const MEDIUM_WEIGHTS: Weights = {
  defense: 3,
  capture: 3,
  pressure: 0.3,
  center: 0.4,
  value: 0,
  cost: 1.5,
};

/** An enemy piece is "near" the king if within ~3 squares (dist² ≤ 9). */
const KING_DANGER_R2 = 9;
/** Bonus added to a capture's score on top of the captured piece's value. */
const CAPTURE_BASE = 10;
/** Bonus for a placement that sits on an attacker's approach to our king. */
const BLOCK_BONUS = 8;
const CENTER = (BOARD_SIZE - 1) / 2; // 3.5 on an 8×8 board

export function ownKing(state: GameState, player: Player): Piece | undefined {
  return state.pieces.find((p) => p.type === 'king' && p.owner === player);
}

export function enemyKing(state: GameState, player: Player): Piece | undefined {
  return state.pieces.find((p) => p.type === 'king' && p.owner !== player);
}

/** Enemy non-king pieces sitting close to our king. */
export function threatsNearKing(state: GameState, player: Player): Piece[] {
  const k = ownKing(state, player);
  if (!k) return [];
  return state.pieces.filter(
    (p) => p.owner !== player && p.type !== 'king' && dist2(p, k) <= KING_DANGER_R2,
  );
}

/** How dangerous the current threats are: bigger and closer attackers weigh more. */
function threatSeverity(threats: Piece[], king: Position): number {
  return threats.reduce((sum, t) => sum + PIECE_VALUE[t.type] / (dist2(t, king) + 1), 0);
}

/** True if `pos` lies on the (roughly straight) approach between an attacker and the king. */
function blocksApproach(pos: Position, attacker: Position, king: Position): boolean {
  const dx = king.file - attacker.file;
  const dy = king.rank - attacker.rank;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;
  const t = ((pos.file - attacker.file) * dx + (pos.rank - attacker.rank) * dy) / len2;
  if (t <= 0 || t >= 1) return false; // must be strictly between attacker and king
  const projFile = attacker.file + t * dx;
  const projRank = attacker.rank + t * dy;
  const perp2 = (pos.file - projFile) ** 2 + (pos.rank - projRank) ** 2;
  return perp2 <= 1.5; // within ~1.2 squares of the line
}

/** Build the board as it would look with `card` placed at (file,rank) for `player`. */
function withHypotheticalPiece(
  state: GameState,
  player: Player,
  d: Deployment,
): { pieces: Piece[]; piece: Piece } {
  const piece: Piece = {
    id: '__hypo__',
    type: d.card,
    owner: player,
    file: d.file,
    rank: d.rank,
    nextActionAt: 0,
  };
  return { pieces: [...state.pieces, piece], piece };
}

/** Score the placed piece's offensive prospects: a capture now is worth a lot. */
function captureProspect(pieces: Piece[], piece: Piece): number {
  const captures = legalMoves(pieces, piece).filter((m) => m.capture);
  if (captures.length > 0) {
    let best = 0;
    for (const c of captures) {
      const target = pieces.find((p) => p.id === c.capturedId);
      if (target) best = Math.max(best, PIECE_VALUE[target.type]);
    }
    return CAPTURE_BASE + best;
  }
  // no capture yet: small reward for being close to an enemy it can chase
  let nearest = Infinity;
  for (const p of pieces) {
    if (p.owner === piece.owner || p.type === 'king') continue;
    nearest = Math.min(nearest, dist2(piece, p));
  }
  return nearest === Infinity ? 0 : -nearest * 0.05;
}

/**
 * Score a single legal deployment. Higher is better. Uses only the current
 * state and the real movement rules — never mutates the game.
 */
export function scoreDeployment(
  state: GameState,
  player: Player,
  d: Deployment,
  weights: Weights = HARD_WEIGHTS,
): number {
  const { pieces, piece } = withHypotheticalPiece(state, player, d);
  const myKing = ownKing(state, player);
  const foeKing = enemyKing(state, player);
  const threats = threatsNearKing(state, player);

  // defense: hug the king and block attackers, scaled by how real the danger is
  let defense = 0;
  if (myKing && threats.length > 0) {
    const severity = threatSeverity(threats, myKing);
    let d2 = -dist2(piece, myKing);
    for (const t of threats) if (blocksApproach(piece, t, myKing)) d2 += BLOCK_BONUS;
    defense = d2 * severity;
  }

  const capture = captureProspect(pieces, piece);
  const pressure = foeKing ? -dist2(piece, foeKing) : 0;
  const center = -((piece.file - CENTER) ** 2 + (piece.rank - CENTER) ** 2);
  const value = PIECE_VALUE[piece.type];
  const cost = PIECE_COST[d.card];

  return (
    weights.defense * defense +
    weights.capture * capture +
    weights.pressure * pressure +
    weights.center * center +
    weights.value * value -
    weights.cost * cost
  );
}

const EPSILON = 1e-9;

/**
 * Pick the highest-scoring legal deployment under `weights`. Ties on score are
 * broken toward the cheaper piece, and any remaining ties broken with `rng` so
 * behavior stays varied but reproducible. Returns null when nothing is legal.
 */
export function bestDeployment(
  state: GameState,
  player: Player,
  weights: Weights,
  rng: Rng,
): Deployment | null {
  const moves = legalDeployments(state, player);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreDeployment(state, player, m, weights);
    if (s > bestScore) bestScore = s;
  }
  const top = moves.filter(
    (m) => scoreDeployment(state, player, m, weights) >= bestScore - EPSILON,
  );

  const cheapest = Math.min(...top.map((m) => PIECE_COST[m.card]));
  const finalists = top.filter((m) => PIECE_COST[m.card] === cheapest);
  return pick(rng, finalists);
}
