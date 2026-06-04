import type { CardType } from './types';

/**
 * The non-king pieces every player starts with:
 * 8 pawns, 2 knights, 2 bishops, 2 rooks, 1 queen = 15 cards.
 */
export const DECK_TEMPLATE: readonly CardType[] = [
  ...Array<CardType>(8).fill('pawn'),
  ...Array<CardType>(2).fill('knight'),
  ...Array<CardType>(2).fill('bishop'),
  ...Array<CardType>(2).fill('rook'),
  'queen',
];

export function createDeck(): CardType[] {
  return [...DECK_TEMPLATE];
}

/** Fisher–Yates shuffle, returns a new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
