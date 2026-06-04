import { describe, it, expect } from 'vitest';
import { canDeploy, cycleHand, deployCard, deployReady, tick } from './gameEngine';
import type { CardType, GameState, Piece, PieceType, Player, PlayerState } from './types';

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
  return { energy: 5, deck: [], hand: [], deployReadyAt: 0, ...overrides };
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

describe('deployment zone validation', () => {
  const base = () =>
    state([piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)], {
      players: {
        white: player({ energy: 5, hand: ['pawn', 'rook'] as CardType[] }),
        black: player({ energy: 5, hand: ['pawn'] as CardType[] }),
      },
    });

  it('allows white to deploy on ranks 1 and 2', () => {
    const s = base();
    expect(canDeploy(s, 'white', 0, 0, 0)).toBe(true); // a1
    expect(canDeploy(s, 'white', 0, 0, 1)).toBe(true); // a2
  });

  it('rejects white deploying outside its zone', () => {
    const s = base();
    expect(canDeploy(s, 'white', 0, 0, 2)).toBe(false); // rank 3
    expect(canDeploy(s, 'white', 0, 0, 7)).toBe(false); // black home rank
  });

  it('allows black only on ranks 7 and 8', () => {
    const s = base();
    expect(canDeploy(s, 'black', 0, 0, 6)).toBe(true);
    expect(canDeploy(s, 'black', 0, 0, 7)).toBe(true);
    expect(canDeploy(s, 'black', 0, 0, 0)).toBe(false);
  });

  it('rejects occupied squares', () => {
    const s = base();
    expect(canDeploy(s, 'white', 0, 4, 0)).toBe(false); // white king sits on e1 (file 4, rank 0)
  });

  it('rejects when energy is insufficient', () => {
    const s = base();
    s.players.white.energy = 4; // rook costs 5
    expect(canDeploy(s, 'white', 1, 0, 0)).toBe(false);
    s.players.white.energy = 5;
    expect(canDeploy(s, 'white', 1, 0, 0)).toBe(true);
  });

  it('rejects when the game is over', () => {
    const s = base();
    s.status = 'white_wins';
    expect(canDeploy(s, 'white', 0, 0, 0)).toBe(false);
  });
});

describe('capture cycles a non-king piece back to its owner deck', () => {
  it('returns the captured pawn to the black deck', () => {
    const rook = piece('rook', 'white', 0, 0, 0); // a1, ready to act
    const target = piece('pawn', 'black', 0, 1); // a2, directly above -> capturable
    const s = state([rook, target, piece('king', 'white', 4, 0), piece('king', 'black', 7, 7)], {
      players: {
        white: player({ energy: 5 }),
        // hand is full so the returned card stays in the deck (no auto-draw)
        black: player({ energy: 5, deck: [], hand: ['queen', 'queen', 'queen', 'queen'] as CardType[] }),
      },
    });

    const after = tick(s, 1000);

    // the pawn is gone from the board
    expect(after.pieces.find((p) => p.id === target.id)).toBeUndefined();
    // and it has been returned to black's deck
    expect(after.players.black.deck).toContain('pawn');
    expect(after.players.black.deck).toHaveLength(1);
    // the rook moved onto a2
    const movedRook = after.pieces.find((p) => p.id === rook.id)!;
    expect(movedRook.file).toBe(0);
    expect(movedRook.rank).toBe(1);
    expect(after.status).toBe('playing');
  });
});

describe('king capture ends the game', () => {
  it('white wins when it captures the black king', () => {
    const rook = piece('rook', 'white', 0, 0, 0); // a1
    const blackKing = piece('king', 'black', 0, 1); // a2, on the rook's file
    const s = state([rook, blackKing, piece('king', 'white', 4, 0)]);

    const after = tick(s, 1000);

    expect(after.status).toBe('white_wins');
    expect(after.winner).toBe('white');
    expect(after.pieces.find((p) => p.id === blackKing.id)).toBeUndefined();
  });
});

describe('deploy cooldown', () => {
  const base = (whiteHand: CardType[]) =>
    state([piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)], {
      players: {
        white: player({ energy: 10, hand: whiteHand }),
        black: player({ energy: 10, hand: ['pawn'] as CardType[] }),
      },
    });

  it('starts a cost-proportional cooldown that blocks an immediate second deploy', () => {
    const now = 1000;
    const s1 = deployCard(base(['rook', 'pawn'] as CardType[]), 'white', 0, 1, 0, now); // rook (cost 5)
    expect(s1.players.white.deployReadyAt).toBe(now + 5 * 500);
    expect(deployReady(s1, 'white', now)).toBe(false);

    // a second deploy during cooldown is rejected
    expect(deployCard(s1, 'white', 0, 2, 0, now)).toBe(s1);

    // once the cooldown elapses it works again
    const later = now + 5 * 500;
    expect(deployReady(s1, 'white', later)).toBe(true);
    expect(deployCard(s1, 'white', 0, 2, 0, later)).not.toBe(s1);
  });

  it('the opponent deploying halves your remaining cooldown', () => {
    const now = 1000;
    const s1 = deployCard(base(['rook'] as CardType[]), 'white', 0, 1, 0, now); // white cooldown -> 3500
    const t = now + 500;
    const remaining = s1.players.white.deployReadyAt - t; // 2000
    const s2 = deployCard(s1, 'black', 0, 0, 7, t); // black deploys at a8
    expect(s2.players.white.deployReadyAt - t).toBeCloseTo(remaining * 0.5); // 1000
  });
});

describe('cycleHand', () => {
  it('swaps the whole hand for fresh cards and costs energy', () => {
    const s0 = state([piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)], {
      players: {
        white: player({
          energy: 5,
          deck: ['rook', 'knight', 'bishop'] as CardType[],
          hand: ['pawn', 'pawn'] as CardType[],
        }),
        black: player(),
      },
    });
    const s1 = cycleHand(s0, 'white');
    expect(s1.players.white.energy).toBe(3); // 5 - 2
    expect(s1.players.white.hand.length).toBe(4); // refilled
    expect(s1.players.white.hand.length + s1.players.white.deck.length).toBe(5); // no cards lost
  });

  it('does nothing without enough energy', () => {
    const s0 = state([piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)], {
      players: { white: player({ energy: 1, hand: ['pawn'] as CardType[] }), black: player() },
    });
    expect(cycleHand(s0, 'white')).toBe(s0);
  });
});

describe('pawn promotion', () => {
  it('a white pawn reaching the last rank becomes a queen', () => {
    const pawn = piece('pawn', 'white', 0, 6, 0); // a7, ready to act
    const s = state([pawn, piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)]);

    const after = tick(s, 1000);

    const promoted = after.pieces.find((p) => p.id === pawn.id)!;
    expect(promoted.rank).toBe(7); // advanced to a8
    expect(promoted.type).toBe('queen');
  });
});
