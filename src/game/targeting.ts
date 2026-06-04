import type { Move, Piece, Player } from './types';
import { PIECE_VALUE } from './constants';
import { dist2, isSquareAttacked, kingMoves, legalMoves, stepMoves } from './movement';
import { scoreMove, threatLoss } from './evaluation';

function enemyKing(pieces: Piece[], owner: Player): Piece | undefined {
  return pieces.find((p) => p.type === 'king' && p.owner !== owner);
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
 * Decide a single action for a piece each action tick. The king plays defence
 * (see kingAction). Every other piece plays the move a strong engine would: it
 * always takes a winning capture of the enemy king, otherwise it scores every
 * candidate (full-range captures + one-square quiet steps) by static exchange
 * evaluation plus a small positional term and plays the best — which is never
 * worse than holding. This means it does not hang itself, only makes favourable
 * trades, and advances safely toward the enemy king. Returns null to hold.
 */
export function decideAction(pieces: Piece[], piece: Piece): Move | null {
  if (piece.type === 'king') return kingAction(pieces, piece);

  const ek = enemyKing(pieces, piece.owner);
  const captures = legalMoves(pieces, piece).filter((m) => m.capture);

  // A winning capture of the enemy king is always taken.
  const kingCapture = captures.find((c) => {
    const t = pieces.find((p) => p.id === c.capturedId);
    return t?.type === 'king';
  });
  if (kingCapture) return kingCapture;

  const candidates = [...captures, ...stepMoves(pieces, piece)];
  let best: Move | null = null;
  let bestScore = -threatLoss(pieces, piece); // the value of staying put
  for (const m of candidates) {
    const score = scoreMove(pieces, piece, m, ek);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
