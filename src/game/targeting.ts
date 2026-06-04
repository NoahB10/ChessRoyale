import type { Move, Piece, Player, Position } from './types';
import { PIECE_VALUE } from './constants';
import { dist2, legalMoves, stepMoves } from './movement';

function enemyKing(pieces: Piece[], owner: Player): Piece | undefined {
  return pieces.find((p) => p.type === 'king' && p.owner !== owner);
}

function nearestEnemy(pieces: Piece[], piece: Piece): Piece | undefined {
  let best: Piece | undefined;
  let bestD = Infinity;
  for (const e of pieces) {
    if (e.owner === piece.owner) continue;
    const d = dist2(piece, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Pick the one-step move that most reduces distance to target; must strictly reduce. */
function bestStepToward(steps: Move[], piece: Piece, target: Position): Move | null {
  const current = dist2(piece, target);
  let best: Move | null = null;
  let bestD = current;
  for (const s of steps) {
    const d = dist2(s.to, target);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * Decide a single action for a piece each action tick:
 *  1. capture the enemy king if legally possible
 *  2. else capture the highest-value reachable enemy piece
 *  3. else step one square toward the enemy king (reducing distance)
 *  4. else step one square toward the nearest enemy piece
 * Returns null if the piece should stay put.
 */
export function decideAction(pieces: Piece[], piece: Piece): Move | null {
  if (piece.type === 'king') return null;

  const moves = legalMoves(pieces, piece);
  const captures = moves.filter((m) => m.capture);
  const ek = enemyKing(pieces, piece.owner);

  // 1. capture enemy king
  if (ek) {
    const kingCapture = captures.find((c) => c.to.file === ek.file && c.to.rank === ek.rank);
    if (kingCapture) return kingCapture;
  }

  // 2. capture highest-value enemy piece
  if (captures.length > 0) {
    let best = captures[0];
    let bestVal = -1;
    for (const c of captures) {
      const target = pieces.find((p) => p.id === c.capturedId);
      const v = target ? PIECE_VALUE[target.type] : 0;
      if (v > bestVal) {
        bestVal = v;
        best = c;
      }
    }
    return best;
  }

  const steps = stepMoves(pieces, piece);

  // 3. step toward enemy king
  if (ek) {
    const toward = bestStepToward(steps, piece, ek);
    if (toward) return toward;
  }

  // 4. step toward nearest enemy piece
  const near = nearestEnemy(pieces, piece);
  if (near) {
    const toward = bestStepToward(steps, piece, near);
    if (toward) return toward;
  }

  return null;
}
