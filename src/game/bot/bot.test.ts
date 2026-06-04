import { describe, it, expect } from 'vitest';
import type { CardType, GameState, Piece, PieceType, Player, PlayerState } from '../types';
import { canDeploy, createInitialState, deployCard, tick } from '../gameEngine';
import { dist2 } from '../movement';
import type { ControllerConfig, Deployment, Difficulty } from './types';
import { makeRng, randInt, pick } from './rng';
import { legalDeployments } from './legalDeployments';
import { scoreDeployment, MEDIUM_WEIGHTS } from './evaluate';
import { easyBot } from './easyBot';
import { mediumBot } from './mediumBot';
import { hardBot } from './hardBot';
import { BotScheduler, REACTION_DELAYS, reactionDelay, type SchedulerContext } from './botController';

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

const kings = () => [piece('king', 'white', 4, 0), piece('king', 'black', 4, 7)];

// ---- rng ------------------------------------------------------------------

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a(), a(), a()]).toEqual([b(), b(), b(), b(), b()]);
  });

  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)());
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
    for (let i = 0; i < 50; i++) expect(items).toContain(pick(r, items));
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
    const moves = legalDeployments(s, 'white');
    expect(moves).toHaveLength(15 * 2); // two affordable cards
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

// ---- evaluate -------------------------------------------------------------

describe('scoreDeployment', () => {
  it('scores an immediate capture above a passive placement', () => {
    const s = state(
      [
        piece('king', 'white', 0, 0), // a1, out of b1's way
        piece('king', 'black', 7, 7),
        piece('queen', 'black', 3, 1), // d2 — a knight on b1 attacks (3,1)
      ],
      {
        players: {
          white: player({ energy: 3, hand: ['knight'] as CardType[] }),
          black: player(),
        },
      },
    );
    const capture = { handIndex: 0, card: 'knight' as CardType, file: 1, rank: 0 }; // b1
    const passive = { handIndex: 0, card: 'knight' as CardType, file: 7, rank: 0 }; // h1
    expect(scoreDeployment(s, 'white', capture)).toBeGreaterThan(
      scoreDeployment(s, 'white', passive),
    );
  });

  it('prefers a cheaper piece for an equivalent position (medium weights)', () => {
    const s = state(
      [
        piece('king', 'white', 0, 0), // a1
        piece('king', 'black', 7, 4), // h5 — not reachable from a2 in one slide
      ],
      {
        players: {
          white: player({ energy: 10, hand: ['pawn', 'queen'] as CardType[] }),
          black: player(),
        },
      },
    );
    const pawnAt = { handIndex: 0, card: 'pawn' as CardType, file: 0, rank: 1 }; // a2
    const queenAt = { handIndex: 1, card: 'queen' as CardType, file: 0, rank: 1 }; // a2
    expect(scoreDeployment(s, 'white', pawnAt, MEDIUM_WEIGHTS)).toBeGreaterThan(
      scoreDeployment(s, 'white', queenAt, MEDIUM_WEIGHTS),
    );
  });
});

// ---- easy bot -------------------------------------------------------------

describe('easy bot', () => {
  it('only ever chooses legal deployments across many seeds', () => {
    const s = state(kings(), {
      players: {
        white: player({ energy: 9, hand: ['pawn', 'knight', 'queen', 'rook'] as CardType[] }),
        black: player(),
      },
    });
    for (let seed = 0; seed < 50; seed++) {
      const c = easyBot(s, 'white', makeRng(seed));
      expect(c).not.toBeNull();
      expect(canDeploy(s, 'white', c!.handIndex, c!.file, c!.rank)).toBe(true);
    }
  });

  it('returns null when no card is affordable', () => {
    const s = state(kings(), {
      players: { white: player({ energy: 0, hand: ['queen'] as CardType[] }), black: player() },
    });
    expect(easyBot(s, 'white', makeRng(1))).toBeNull();
  });

  it('returns null with an empty hand', () => {
    const s = state(kings(), {
      players: { white: player({ energy: 9, hand: [] }), black: player() },
    });
    expect(easyBot(s, 'white', makeRng(1))).toBeNull();
  });
});

// ---- medium bot -----------------------------------------------------------

describe('medium bot', () => {
  const whiteKing = { file: 0, rank: 0 };

  it('hugs its king when an enemy threatens it', () => {
    const s = state(
      [
        piece('king', 'white', 0, 0), // a1
        piece('king', 'black', 7, 7), // h8
        piece('knight', 'black', 0, 2), // a3 — bearing down on the white king
      ],
      {
        players: {
          white: player({ energy: 5, hand: ['pawn', 'pawn'] as CardType[] }),
          black: player(),
        },
      },
    );
    const c = mediumBot(s, 'white', makeRng(3));
    expect(c).not.toBeNull();
    expect(dist2(c!, whiteKing)).toBeLessThanOrEqual(2); // deploys right beside the king
  });

  it('pushes forward when its king is safe', () => {
    const s = state(
      [piece('king', 'white', 0, 0), piece('king', 'black', 7, 7)],
      {
        players: {
          white: player({ energy: 5, hand: ['pawn', 'pawn'] as CardType[] }),
          black: player(),
        },
      },
    );
    const c = mediumBot(s, 'white', makeRng(3));
    expect(c).not.toBeNull();
    expect(dist2(c!, whiteKing)).toBeGreaterThan(2); // not hugging the king
  });
});

// ---- hard bot -------------------------------------------------------------

describe('hard bot', () => {
  it('chooses the highest-scoring legal deployment', () => {
    const s = state(
      [
        piece('king', 'white', 4, 0),
        piece('king', 'black', 4, 7),
        piece('knight', 'black', 4, 2), // a threat near the white king
        piece('bishop', 'black', 2, 1), // a capturable piece in white's zone
      ],
      {
        players: {
          white: player({ energy: 6, hand: ['knight', 'pawn'] as CardType[] }),
          black: player(),
        },
      },
    );
    const moves = legalDeployments(s, 'white');
    const best = Math.max(...moves.map((m) => scoreDeployment(s, 'white', m)));
    const c = hardBot(s, 'white', makeRng(1));
    expect(c).not.toBeNull();
    expect(scoreDeployment(s, 'white', c!)).toBeCloseTo(best);
  });

  it('returns null when there is nothing to do', () => {
    const s = state(kings(), {
      players: { white: player({ energy: 0, hand: ['queen'] as CardType[] }), black: player() },
    });
    expect(hardBot(s, 'white', makeRng(1))).toBeNull();
  });
});

// ---- bot controller / scheduler -------------------------------------------

const human: ControllerConfig = { kind: 'human' };
const bot = (difficulty: Difficulty): ControllerConfig => ({ kind: 'bot', difficulty });

describe('bot controller', () => {
  it('reaction delays fall in the configured range per difficulty', () => {
    const r = makeRng(2);
    for (const diff of ['easy', 'medium', 'hard'] as Difficulty[]) {
      const [lo, hi] = REACTION_DELAYS[diff];
      for (let i = 0; i < 100; i++) {
        const d = reactionDelay(diff, r);
        expect(d).toBeGreaterThanOrEqual(lo);
        expect(d).toBeLessThan(hi);
      }
    }
  });

  it('deploys for a bot side once its reaction delay elapses, not before', () => {
    let gs = state(kings(), {
      players: {
        white: player({ energy: 9, hand: ['knight'] as CardType[] }),
        black: player(),
      },
    });
    const calls: { player: Player; d: Deployment }[] = [];
    const ctx: SchedulerContext = {
      getState: () => gs,
      getController: (p) => (p === 'white' ? bot('hard') : human),
      isPaused: () => false,
      deploy: (p, d) => {
        calls.push({ player: p, d });
        gs = deployCard(gs, p, d.handIndex, d.file, d.rank, 9999);
      },
      rng: makeRng(5),
    };
    const sch = new BotScheduler();

    sch.step(0, ctx); // first tick only schedules the reaction
    expect(calls).toHaveLength(0);
    sch.step(10_000, ctx); // well past any reaction delay
    expect(calls).toHaveLength(1);
    expect(calls[0].player).toBe('white');
  });

  it('never acts once the game is over', () => {
    const gs = state(kings(), {
      status: 'black_wins',
      players: {
        white: player({ energy: 9, hand: ['knight'] as CardType[] }),
        black: player({ energy: 9, hand: ['knight'] as CardType[] }),
      },
    });
    let deploys = 0;
    const ctx: SchedulerContext = {
      getState: () => gs,
      getController: () => bot('easy'),
      isPaused: () => false,
      deploy: () => { deploys++; },
      rng: makeRng(1),
    };
    const sch = new BotScheduler();
    for (const t of [0, 5_000, 10_000, 20_000]) sch.step(t, ctx);
    expect(deploys).toBe(0);
  });

  it('does not act while paused', () => {
    const gs = state(kings(), {
      players: { white: player({ energy: 9, hand: ['knight'] as CardType[] }), black: player() },
    });
    let deploys = 0;
    const ctx: SchedulerContext = {
      getState: () => gs,
      getController: (p) => (p === 'white' ? bot('hard') : human),
      isPaused: () => true,
      deploy: () => { deploys++; },
      rng: makeRng(1),
    };
    const sch = new BotScheduler();
    for (let t = 0; t <= 10_000; t += 500) sch.step(t, ctx);
    expect(deploys).toBe(0);
  });

  it('never deploys an unaffordable card', () => {
    const gs = state(kings(), {
      players: {
        white: player({ energy: 0, hand: ['queen'] as CardType[] }), // queen costs 9
        black: player(),
      },
    });
    let deploys = 0;
    const ctx: SchedulerContext = {
      getState: () => gs, // static: energy never regenerates
      getController: (p) => (p === 'white' ? bot('easy') : human),
      isPaused: () => false,
      deploy: () => { deploys++; },
      rng: makeRng(1),
    };
    const sch = new BotScheduler();
    for (let t = 0; t <= 10_000; t += 500) sch.step(t, ctx);
    expect(deploys).toBe(0);
  });

  it('runs a bot-vs-bot game for 30s of simulated time without crashing', () => {
    let now = 0;
    let gs = createInitialState(now);
    const ctx: SchedulerContext = {
      getState: () => gs,
      getController: (p) => (p === 'white' ? bot('hard') : bot('easy')),
      isPaused: () => false,
      deploy: (p, d) => {
        gs = deployCard(gs, p, d.handIndex, d.file, d.rank, now);
      },
      rng: makeRng(123),
    };
    const sch = new BotScheduler();

    let maxPieces = gs.pieces.length;
    const STEP = 100;
    const DURATION = 30_000;
    for (now = 0; now <= DURATION; now += STEP) {
      gs = tick(gs, now);
      if (gs.status !== 'playing') {
        maxPieces = Math.max(maxPieces, gs.pieces.length);
        gs = createInitialState(now); // a king fell — start a fresh game and keep going
        sch.reset();
        continue;
      }
      sch.step(now, ctx);
      expect(gs.pieces.length).toBeGreaterThanOrEqual(2); // board stays sane
      maxPieces = Math.max(maxPieces, gs.pieces.length);
    }

    expect(now).toBeGreaterThan(DURATION); // ran the full duration
    expect(maxPieces).toBeGreaterThan(2); // bots actually deployed and fought
  });
});
