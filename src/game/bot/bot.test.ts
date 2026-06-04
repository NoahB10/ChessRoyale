import { describe, it, expect } from 'vitest';
import type { CardType, GameState, Piece, PieceType, Player, PlayerState } from '../types';
import { canDeploy } from '../gameEngine';
import { makeRng, randInt, pick } from './rng';
import { legalDeployments } from './legalDeployments';

// ---- shared test fixtures -------------------------------------------------

let seq = 0;
function piece(
  type: PieceType,
  owner: Player,
  file: number,
  rank: number,
  nextActionAt = Infinity,
): Piece {
  return { id: `${type}-${owner}-${seq++}`, type, owner, file, rank, nextActionAt };
}

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return { energy: 5, deck: [], hand: [], ...overrides };
}

function state(pieces: Piece[], overrides: Partial<GameState> = {}): GameState {
  return {
    pieces,
    players: { white: player(), black: player() },
    status: 'playing',
    winner: null,
    lastTickAt: 0,
    ...overrides,
  };
}

const kings = () => [piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)];

// ---- rng ------------------------------------------------------------------

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toEqual(b());
  });

  it('produces floats in [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt stays within inclusive bounds', () => {
    const r = makeRng(123);
    for (let i = 0; i < 200; i++) {
      const v = randInt(r, 3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('pick returns null for empty and a member otherwise', () => {
    const r = makeRng(9);
    expect(pick(r, [])).toBeNull();
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(pick(r, items));
    }
  });
});

// ---- legalDeployments -----------------------------------------------------

describe('legalDeployments', () => {
  it('returns only squares that pass canDeploy', () => {
    const s = state(kings(), {
      players: {
        white: player({ energy: 5, hand: ['pawn', 'rook'] as CardType[] }),
        black: player({ energy: 5, hand: ['pawn'] as CardType[] }),
      },
    });

    const moves = legalDeployments(s, 'white');
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(canDeploy(s, 'white', m.handIndex, m.file, m.rank)).toBe(true);
    }
  });

  it('covers every empty square in the zone for each affordable card', () => {
    const s = state(kings(), {
      players: {
        white: player({ energy: 5, hand: ['pawn', 'rook'] as CardType[] }),
        black: player(),
      },
    });

    // zone = ranks 0,1 across 8 files = 16 squares, minus white king on e1.
    const emptyInZone = 15;
    const moves = legalDeployments(s, 'white');
    expect(moves).toHaveLength(emptyInZone * 2); // two affordable cards

    // never the occupied king square, never outside the zone
    expect(moves.some((m) => m.file === 4 && m.rank === 0)).toBe(false);
    expect(moves.every((m) => m.rank === 0 || m.rank === 1)).toBe(true);
  });

  it('excludes cards the player cannot afford', () => {
    const s = state(kings(), {
      players: {
        white: player({ energy: 4, hand: ['pawn', 'rook'] as CardType[] }), // rook costs 5
        black: player(),
      },
    });

    const moves = legalDeployments(s, 'white');
    expect(moves.every((m) => m.card === 'pawn')).toBe(true);
    expect(moves).toHaveLength(15);
  });

  it('returns nothing once the game is over', () => {
    const s = state(kings(), {
      status: 'white_wins',
      players: {
        white: player({ energy: 10, hand: ['pawn', 'queen'] as CardType[] }),
        black: player(),
      },
    });
    expect(legalDeployments(s, 'white')).toHaveLength(0);
  });
});
