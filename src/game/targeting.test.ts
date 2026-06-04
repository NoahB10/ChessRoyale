import { describe, it, expect } from 'vitest';
import { decideAction } from './targeting';
import { isSquareAttacked } from './movement';
import type { Piece, PieceType, Player } from './types';

let seq = 0;
function p(type: PieceType, owner: Player, file: number, rank: number): Piece {
  return { id: `${type}-${owner}-${seq++}`, type, owner, file, rank, nextActionAt: 0 };
}

describe('king defence', () => {
  it('holds position when it is not under threat', () => {
    const wk = p('king', 'white', 4, 0);
    const bk = p('king', 'black', 4, 7);
    expect(decideAction([wk, bk], wk)).toBeNull();
  });

  it('flees off the attack line to a safe square when threatened', () => {
    const wk = p('king', 'white', 4, 0); // e1
    const rook = p('rook', 'black', 4, 6); // e7 — attacks straight down the e-file
    const bk = p('king', 'black', 0, 7);
    const board = [wk, rook, bk];

    expect(isSquareAttacked(board, 4, 0, 'black')).toBe(true); // e1 is threatened

    const move = decideAction(board, wk);
    expect(move).not.toBeNull();
    expect(move!.to.file).not.toBe(4); // stepped off the rook's file
    // the chosen square is genuinely safe (king has vacated e1)
    expect(isSquareAttacked([rook, bk], move!.to.file, move!.to.rank, 'black')).toBe(false);
  });

  it('captures an adjacent attacker when doing so is safe', () => {
    const wk = p('king', 'white', 4, 0); // e1
    const pawn = p('pawn', 'black', 5, 1); // f2 — a black pawn attacks e1 diagonally
    const bk = p('king', 'black', 0, 7);

    const move = decideAction([wk, pawn, bk], wk);
    expect(move?.capture).toBe(true);
    expect(move?.capturedId).toBe(pawn.id);
    expect(move?.to).toEqual({ file: 5, rank: 1 });
  });

  it('stays put when cornered with no safe escape (a real mate still resolves)', () => {
    const wk = p('king', 'white', 0, 0); // a1 corner
    const aRook = p('rook', 'black', 0, 7); // a8 — covers a1 and a2 down the a-file
    const bRook = p('rook', 'black', 1, 7); // b8 — covers b1 and b2 down the b-file
    const bk = p('king', 'black', 5, 5);
    // a1 is attacked and every escape (a2, b1, b2) is covered: no safe move.
    const board = [wk, aRook, bRook, bk];
    expect(isSquareAttacked([aRook, bRook, bk], 0, 0, 'black')).toBe(true);
    expect(decideAction(board, wk)).toBeNull();
  });
});
