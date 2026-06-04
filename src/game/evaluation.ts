// Expert move evaluation for the autonomous combat AI.
//
// Every candidate move is scored by Static Exchange Evaluation (SEE) — the true
// material outcome after all recaptures on the destination square — plus a small
// positional term. A piece therefore never hangs itself or makes a losing trade,
// takes favourable captures, and otherwise advances safely toward the enemy king.
import type { Move, Piece, Player } from './types';
import { BOARD_SIZE, PIECE_VALUE } from './constants';
import { attackersOf } from './movement';

function enemyOf(owner: Player): Player {
  return owner === 'white' ? 'black' : 'white';
}

/**
 * Static Exchange Evaluation: net material (in piece-value units) of `piece`
 * making `move`, assuming both sides then recapture optimally with their least
 * valuable attacker. Positive = good for the moving side. (No x-ray reveal — a
 * fast approximation that is correct for the vast majority of positions.)
 */
export function see(pieces: Piece[], piece: Piece, move: Move): number {
  const captured = move.capturedId ? pieces.find((p) => p.id === move.capturedId) : undefined;
  const capturedValue = captured ? PIECE_VALUE[captured.type] : 0;

  // Board as it stands once the mover has left its square (reveals attackers
  // behind it) and the captured piece is gone.
  const board = pieces.filter((p) => p.id !== piece.id && p.id !== move.capturedId);
  const { file: f, rank: r } = move.to;

  const theirs = attackersOf(board, f, r, enemyOf(piece.owner))
    .map((p) => PIECE_VALUE[p.type])
    .sort((a, b) => a - b);
  const ours = attackersOf(board, f, r, piece.owner)
    .map((p) => PIECE_VALUE[p.type])
    .sort((a, b) => a - b);

  const gain: number[] = [capturedValue];
  let onSquare = PIECE_VALUE[piece.type]; // value now sitting on the square
  const lists = [theirs, ours]; // opponent recaptures first
  let side = 0;
  let depth = 0;
  while (lists[side].length > 0) {
    depth++;
    gain[depth] = onSquare - gain[depth - 1];
    onSquare = lists[side].shift()!;
    side ^= 1;
  }
  for (let i = depth; i > 0; i--) {
    gain[i - 1] = -Math.max(-gain[i - 1], gain[i]);
  }
  return gain[0];
}

/** Material the side would lose by leaving `piece` where it stands (>= 0). */
export function threatLoss(pieces: Piece[], piece: Piece): number {
  const attackers = attackersOf(pieces, piece.file, piece.rank, enemyOf(piece.owner));
  if (attackers.length === 0) return 0;
  const cheapest = attackers.reduce((a, b) => (PIECE_VALUE[a.type] <= PIECE_VALUE[b.type] ? a : b));
  const enemyCapture: Move = {
    from: { file: cheapest.file, rank: cheapest.rank },
    to: { file: piece.file, rank: piece.rank },
    capture: true,
    capturedId: piece.id,
  };
  return Math.max(0, see(pieces, cheapest, enemyCapture));
}

function chebyshev(af: number, ar: number, bf: number, br: number): number {
  return Math.max(Math.abs(af - bf), Math.abs(ar - br));
}

/**
 * Score a move from the moving side's perspective: material (SEE) dominates, a
 * small positional term breaks ties and guides safe, purposeful play.
 */
export function scoreMove(
  pieces: Piece[],
  piece: Piece,
  move: Move,
  enemyKing: Piece | undefined,
): number {
  const material = see(pieces, piece, move);

  let positional = 0;
  if (enemyKing) {
    const before = chebyshev(piece.file, piece.rank, enemyKing.file, enemyKing.rank);
    const after = chebyshev(move.to.file, move.to.rank, enemyKing.file, enemyKing.rank);
    positional += (before - after) * 0.08; // pressure the enemy king
  }
  // mild preference for the centre
  positional += (7 - (Math.abs(move.to.file - 3.5) + Math.abs(move.to.rank - 3.5))) * 0.01;
  // promotion is worth a queen
  if (piece.type === 'pawn') {
    const lastRank = piece.owner === 'white' ? BOARD_SIZE - 1 : 0;
    if (move.to.rank === lastRank) positional += PIECE_VALUE.queen - PIECE_VALUE.pawn;
  }
  return material + positional;
}
