import type { Move, Piece, Player, Position } from './types';
import { PIECE_VALUE } from './constants';
import { dist2, isSquareAttacked, kingMoves, legalMoves, stepMoves } from './movement';

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

/** Highest-value capture among a set of capture moves. */
function bestCapture(pieces: Piece[], captures: Move[]): Move {
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

/**
 * The king plays defence: it holds position until an enemy can capture it, then
 * moves one square to safety (preferring to capture the attacker, else fleeing
 * to the safe square farthest from enemies). It still takes a winning capture of
 * the enemy king. Like every piece it acts only on its own cooldown — one move
 * at a time. Returns null to stay put (incl. when cornered with no safe square).
 */
function kingAction(pieces: Piece[], king: Piece): Move | null {
  const enemy: Player = king.owner === 'white' ? 'black' : 'white';
  const moves = kingMoves(pieces, king);

  // Winning move always wins: capture the enemy king if it is adjacent.
  const kill = moves.find((m) => {
    const t = m.capturedId ? pieces.find((p) => p.id === m.capturedId) : undefined;
    return t?.type === 'king';
  });
  if (kill) return kill;

  // Safe right now -> don't wander into danger.
  if (!isSquareAttacked(pieces, king.file, king.rank, enemy)) return null;

  // A destination is safe if the enemy can't attack it after the king moves
  // (king vacates its square; any captured attacker is removed too).
  const safe = moves.filter((m) => {
    const board = pieces.filter((p) => p.id !== king.id && p.id !== m.capturedId);
    return !isSquareAttacked(board, m.to.file, m.to.rank, enemy);
  });
  if (safe.length === 0) return null; // cornered

  const safeCaptures = safe.filter((m) => m.capture);
  if (safeCaptures.length > 0) return bestCapture(pieces, safeCaptures);

  // Flee to the safe square farthest from the nearest enemy.
  let best: Move | null = null;
  let bestScore = -1;
  for (const m of safe) {
    let nearest = Infinity;
    for (const p of pieces) {
      if (p.owner === king.owner) continue;
      nearest = Math.min(nearest, dist2(m.to, p));
    }
    if (nearest > bestScore) {
      bestScore = nearest;
      best = m;
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
  if (piece.type === 'king') return kingAction(pieces, piece);

  const moves = legalMoves(pieces, piece);
  const captures = moves.filter((m) => m.capture);
  const ek = enemyKing(pieces, piece.owner);

  // 1. capture enemy king
  if (ek) {
    const kingCapture = captures.find((c) => c.to.file === ek.file && c.to.rank === ek.rank);
    if (kingCapture) return kingCapture;
  }

  // 2. capture highest-value enemy piece
  if (captures.length > 0) return bestCapture(pieces, captures);

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
