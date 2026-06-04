import { describe, it, expect } from 'vitest';
import { legalMoves } from './movement';
import type { Piece, PieceType, Player } from './types';

let seq = 0;
function p(type: PieceType, owner: Player, file: number, rank: number): Piece {
  return { id: `${type}-${seq++}`, type, owner, file, rank, nextActionAt: 0 };
}

/** set of "file,rank" destination strings for easy assertions */
function dests(pieces: Piece[], piece: Piece): Set<string> {
  return new Set(legalMoves(pieces, piece).map((m) => `${m.to.file},${m.to.rank}`));
}

describe('knight movement', () => {
  it('jumps in an L and ignores blockers', () => {
    const knight = p('knight', 'white', 3, 3); // d4
    // surround it with friendly pawns; knight should still jump over them
    const blockers = [p('pawn', 'white', 3, 4), p('pawn', 'white', 4, 3), p('pawn', 'white', 2, 3)];
    const board = [knight, ...blockers];
    const d = dests(board, knight);
    expect(d).toContain('1,2');
    expect(d).toContain('5,4');
    expect(d).toContain('4,5');
    expect(d.size).toBe(8); // all 8 jumps are on-board and empty
  });
});

describe('rook movement', () => {
  it('slides orthogonally and stops at the first blocker', () => {
    const rook = p('rook', 'white', 0, 0); // a1
    const friend = p('pawn', 'white', 0, 3); // a4 friendly -> blocks the file beyond a3
    const enemy = p('pawn', 'black', 3, 0); // d1 enemy -> capturable
    const board = [rook, friend, enemy];
    const moves = legalMoves(board, rook);
    const d = new Set(moves.map((m) => `${m.to.file},${m.to.rank}`));
    // up the file: a2, a3 reachable, a4 (friend) blocked and not included
    expect(d).toContain('0,1');
    expect(d).toContain('0,2');
    expect(d).not.toContain('0,3');
    expect(d).not.toContain('0,4');
    // along the rank: b1, c1 then capture d1
    expect(d).toContain('1,0');
    expect(d).toContain('2,0');
    expect(d).toContain('3,0');
    const capture = moves.find((m) => m.to.file === 3 && m.to.rank === 0);
    expect(capture?.capture).toBe(true);
    expect(capture?.capturedId).toBe(enemy.id);
  });
});

describe('bishop movement', () => {
  it('slides diagonally only', () => {
    const bishop = p('bishop', 'white', 2, 0); // c1
    const d = dests([bishop], bishop);
    expect(d).toContain('3,1');
    expect(d).toContain('1,1');
    expect(d).toContain('0,2'); // a3 along the long diagonal
    expect(d).not.toContain('2,1'); // straight ahead is not a bishop move
  });
});

describe('queen movement', () => {
  it('combines rook and bishop rays', () => {
    const queen = p('queen', 'white', 0, 0); // a1
    const d = dests([queen], queen);
    expect(d).toContain('0,5'); // straight up the file
    expect(d).toContain('5,0'); // straight along the rank
    expect(d).toContain('5,5'); // diagonal
  });
});

describe('pawn movement and direction', () => {
  it('white pawns move toward rank 8 and capture diagonally forward', () => {
    const pawn = p('pawn', 'white', 3, 1); // d2
    const enemy = p('pawn', 'black', 4, 2); // e3 capturable diagonally
    const d = dests([pawn, enemy], pawn);
    expect(d).toContain('3,2'); // forward one
    expect(d).toContain('4,2'); // diagonal capture
    expect(d).not.toContain('2,2'); // empty diagonal is not a legal move
  });

  it('black pawns move toward rank 1', () => {
    const pawn = p('pawn', 'black', 3, 6); // d7
    const d = dests([pawn], pawn);
    expect(d).toContain('3,5'); // forward one (toward rank 1)
    expect(d).not.toContain('3,7'); // never moves backward
  });

  it('cannot move forward onto an occupied square', () => {
    const pawn = p('pawn', 'white', 3, 1);
    const blocker = p('pawn', 'black', 3, 2); // directly ahead
    const d = dests([pawn, blocker], pawn);
    expect(d).not.toContain('3,2'); // blocked straight ahead (no forward capture)
  });
});

describe('king movement', () => {
  it('is stationary (no legal moves)', () => {
    const king = p('king', 'white', 4, 0);
    expect(legalMoves([king], king)).toEqual([]);
  });
});
