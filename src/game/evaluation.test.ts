import { describe, it, expect } from 'vitest';
import { see, threatLoss } from './evaluation';
import { decideAction } from './targeting';
import { isSquareAttacked } from './movement';
import type { Move, Piece, PieceType, Player } from './types';

let seq = 0;
function p(type: PieceType, owner: Player, file: number, rank: number): Piece {
  return { id: `${type}-${owner}-${seq++}`, type, owner, file, rank, nextActionAt: 0 };
}
function capture(mover: Piece, target: Piece): Move {
  return {
    from: { file: mover.file, rank: mover.rank },
    to: { file: target.file, rank: target.rank },
    capture: true,
    capturedId: target.id,
  };
}

describe('static exchange evaluation', () => {
  it('rates winning a hanging rook with the queen as +5', () => {
    const queen = p('queen', 'white', 0, 0); // a1
    const rook = p('rook', 'black', 0, 5); // a6, undefended, on the queen's file
    expect(see([queen, rook], queen, capture(queen, rook))).toBe(5);
  });

  it('rates a knight taking a pawn defended by a pawn as -2', () => {
    const knight = p('knight', 'white', 3, 2); // d3
    const pawn = p('pawn', 'black', 4, 4); // e5 (knight target)
    const defender = p('pawn', 'black', 5, 5); // f6 defends e5
    expect(see([knight, pawn, defender], knight, capture(knight, pawn))).toBe(-2);
  });

  it('rates a rook taking a pawn defended by a knight as -4', () => {
    const rook = p('rook', 'white', 0, 0); // a1
    const pawn = p('pawn', 'black', 0, 4); // a5 (rook target up the file)
    const defender = p('knight', 'black', 2, 3); // c4 defends a5
    expect(see([rook, pawn, defender], rook, capture(rook, pawn))).toBe(-4);
  });
});

describe('threatLoss', () => {
  it('is the piece value when the piece hangs', () => {
    const knight = p('knight', 'white', 3, 3);
    const rook = p('rook', 'black', 3, 7); // attacks d4 down the file
    expect(threatLoss([knight, rook], knight)).toBe(3);
  });

  it('is zero when the piece is defended', () => {
    const knight = p('knight', 'white', 3, 3); // d4
    const rook = p('rook', 'black', 3, 7); // attacks d4
    const defender = p('pawn', 'white', 2, 2); // c3 defends d4
    expect(threatLoss([knight, rook, defender], knight)).toBe(0);
  });
});

describe('decideAction plays like an engine', () => {
  const wk = () => p('king', 'white', 4, 0);
  const bk = () => p('king', 'black', 4, 7);

  it('refuses a losing capture of a defended pawn', () => {
    const queen = p('queen', 'white', 0, 0); // a1
    const pawn = p('pawn', 'black', 0, 3); // a4, reachable up the file
    const defender = p('pawn', 'black', 1, 4); // b5 defends a4
    const move = decideAction([queen, pawn, defender, wk(), bk()], queen);
    expect(move?.capture).toBe(false); // does not throw the queen at the pawn
  });

  it('takes a hanging enemy piece', () => {
    const knight = p('knight', 'white', 3, 3); // d4
    const rook = p('rook', 'black', 4, 5); // e6, hanging, a knight-jump away
    const move = decideAction([knight, rook, wk(), bk()], knight);
    expect(move?.capture).toBe(true);
    expect(move?.capturedId).toBe(rook.id);
  });

  it('never steps a piece onto a square where it would hang', () => {
    const rook = p('rook', 'white', 0, 0); // a1
    const enemyRook = p('rook', 'black', 1, 7); // b8 controls the whole b-file
    const move = decideAction([rook, enemyRook, wk(), bk()], rook);
    expect(move).not.toBeNull();
    const after = [enemyRook, wk(), bk()]; // rook has moved off a1
    expect(isSquareAttacked(after, move!.to.file, move!.to.rank, 'black')).toBe(false);
  });
});
