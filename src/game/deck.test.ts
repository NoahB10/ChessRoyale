import { describe, it, expect } from 'vitest';
import { createDeck, shuffle } from './deck';
import { PIECE_COST } from './constants';
import type { CardType } from './types';

describe('deck creation', () => {
  it('contains 15 non-king cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(15);
    expect(deck).not.toContain('king');
  });

  it('has the correct composition (8P 2N 2B 2R 1Q)', () => {
    const deck = createDeck();
    const count = (t: CardType) => deck.filter((c) => c === t).length;
    expect(count('pawn')).toBe(8);
    expect(count('knight')).toBe(2);
    expect(count('bishop')).toBe(2);
    expect(count('rook')).toBe(2);
    expect(count('queen')).toBe(1);
  });

  it('shuffle keeps the same multiset of cards', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(15);
    expect([...shuffled].sort()).toEqual([...deck].sort());
    // original is not mutated
    expect(deck).toHaveLength(15);
  });
});

describe('card costs', () => {
  it('uses standard chess values', () => {
    expect(PIECE_COST).toEqual({ pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 });
  });
});
