import { describe, it, expect } from 'vitest';
import {
  advanceRoom,
  applyIntent,
  createRoom,
  queueIntent,
  startGame,
  type RoomState,
} from './roomLogic';
import { makeRoomCode, parseRoomCode } from './protocol';
import type { CardType, GameState, Piece, PieceType, Player } from '../game/types';

let seq = 0;
function piece(type: PieceType, owner: Player, file: number, rank: number, nextActionAt = Infinity): Piece {
  return { id: `${type}-${owner}-${seq++}`, type, owner, file, rank, nextActionAt };
}
function gameWith(pieces: Piece[], whiteHand: CardType[] = [], whiteEnergy = 5): GameState {
  return {
    pieces,
    players: {
      white: { energy: whiteEnergy, deck: [], hand: whiteHand, deployReadyAt: 0 },
      black: { energy: 5, deck: [], hand: [], deployReadyAt: 0 },
    },
    status: 'playing',
    winner: null,
    lastTickAt: 0,
  };
}

describe('room codes', () => {
  it('makeRoomCode produces 5 unambiguous chars', () => {
    const code = makeRoomCode(() => 0.5);
    expect(code).toHaveLength(5);
    expect(code).toMatch(/^[A-Z2-9]+$/);
    expect(code).not.toMatch(/[IO01]/);
  });

  it('parseRoomCode extracts a code from a share link or raw input', () => {
    expect(parseRoomCode('https://chessroyale.one10designs.com/#r=AB2CD')).toBe('AB2CD');
    expect(parseRoomCode('  ab2cd ')).toBe('AB2CD');
    expect(parseRoomCode('#r=XY9ZZ')).toBe('XY9ZZ');
    expect(parseRoomCode('ab2-cd')).toBe('AB2CD'); // raw input has junk stripped
  });
});

describe('room lifecycle', () => {
  it('createRoom waits with two kings on the board', () => {
    const room = createRoom(1000);
    expect(room.phase).toBe('waiting');
    expect(room.game.pieces.filter((p) => p.type === 'king')).toHaveLength(2);
  });

  it('startGame begins a fresh playing game', () => {
    const room = startGame(2000);
    expect(room.phase).toBe('playing');
    expect(room.simNow).toBe(2000);
    expect(room.game.status).toBe('playing');
  });

  it('advanceRoom does nothing while waiting', () => {
    const room = createRoom(0);
    expect(advanceRoom(room, 1000)).toBe(room);
  });
});

describe('applyIntent (authoritative validation)', () => {
  function playingRoom(): RoomState {
    const game = gameWith(
      [piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)],
      ['pawn', 'rook'] as CardType[],
      5,
    );
    return { game, phase: 'playing', simNow: 1000, speed: 1, pending: { white: null, black: null } };
  }

  it('applies a legal deploy in the player’s own zone', () => {
    const after = applyIntent(playingRoom(), 'white', 0, 3, 1); // d2, white zone
    expect(after.game.pieces.some((p) => p.file === 3 && p.rank === 1 && p.owner === 'white')).toBe(true);
    expect(after.game.players.white.energy).toBe(4); // pawn costs 1
  });

  it('rejects a deploy outside the player’s zone', () => {
    const room = playingRoom();
    expect(applyIntent(room, 'white', 0, 3, 5)).toBe(room); // rank 6 not white's zone
  });

  it('rejects an unaffordable deploy', () => {
    const game = gameWith([piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)], ['rook'] as CardType[], 4);
    const room: RoomState = {
      game,
      phase: 'playing',
      simNow: 1000,
      speed: 1,
      pending: { white: null, black: null },
    };
    expect(applyIntent(room, 'white', 0, 1, 0)).toBe(room); // rook costs 5, only 4 energy
  });

  it('ignores intents once the game is over', () => {
    const room: RoomState = { ...playingRoom(), phase: 'over' };
    expect(applyIntent(room, 'white', 0, 3, 1)).toBe(room);
  });
});

describe('queueIntent (deploy cooldown + held placements)', () => {
  function room(): RoomState {
    const game = gameWith(
      [piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)],
      ['pawn', 'pawn'] as CardType[],
      10,
    );
    return { game, phase: 'playing', simNow: 1000, speed: 1, pending: { white: null, black: null } };
  }

  it('applies a deploy immediately when off cooldown', () => {
    const after = queueIntent(room(), 'white', 0, 3, 1); // d2
    expect(after.game.pieces.some((p) => p.file === 3 && p.rank === 1 && p.owner === 'white')).toBe(
      true,
    );
    expect(after.pending.white).toBeNull();
  });

  it('holds a deploy made during cooldown, then commits it once it clears', () => {
    const r1 = queueIntent(room(), 'white', 0, 3, 1); // first pawn -> cooldown until 1500
    const r2 = queueIntent(r1, 'white', 0, 4, 1); // second pawn while on cooldown -> held
    expect(r2.pending.white).toEqual({ handIndex: 0, file: 4, rank: 1 });
    expect(r2.game.pieces.some((p) => p.file === 4 && p.rank === 1)).toBe(false);

    const r3 = advanceRoom(r2, 600); // simNow 1000 -> 1600, past the 1500 cooldown
    expect(r3.pending.white).toBeNull();
    expect(r3.game.pieces.some((p) => p.file === 4 && p.rank === 1 && p.owner === 'white')).toBe(
      true,
    );
  });
});

describe('advanceRoom (authoritative simulation)', () => {
  it('ends the room when a king is captured', () => {
    const rook = piece('rook', 'white', 0, 0, 0); // a1, ready to act
    const blackKing = piece('king', 'black', 0, 1); // a2, on the rook’s file
    const game = gameWith([rook, blackKing, piece('king', 'white', 4, 0)]);
    const room: RoomState = {
      game,
      phase: 'playing',
      simNow: 0,
      speed: 1,
      pending: { white: null, black: null },
    };

    const after = advanceRoom(room, 1000);

    expect(after.phase).toBe('over');
    expect(after.game.status).toBe('white_wins');
    expect(after.simNow).toBe(1000);
  });
});
