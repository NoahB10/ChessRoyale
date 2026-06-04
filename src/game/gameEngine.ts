import type { CardType, GameState, Piece, Player, PlayerState } from './types';
import {
  BOARD_SIZE,
  DECK_CYCLE_COST,
  DEPLOY_COOLDOWN_MS_PER_COST,
  DEPLOY_RANKS,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  ENERGY_START,
  GAME_TICK_MS,
  HAND_SIZE,
  KING_START,
  OPPONENT_DEPLOY_COOLDOWN_FACTOR,
  PIECE_COOLDOWN_MS,
  PIECE_COST,
} from './constants';
import { createDeck, shuffle } from './deck';
import { pieceAt } from './movement';
import { decideAction } from './targeting';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${idCounter++}`;
}

/** Draw cards from the deck until the hand is full or the deck is empty. */
function drawHand(deck: CardType[], hand: CardType[]): void {
  while (hand.length < HAND_SIZE && deck.length > 0) {
    hand.push(deck.pop()!);
  }
}

function newPlayerState(): PlayerState {
  const deck = shuffle(createDeck());
  const hand: CardType[] = [];
  drawHand(deck, hand);
  return { energy: ENERGY_START, deck, hand, deployReadyAt: 0 };
}

export function createInitialState(now: number): GameState {
  const pieces: Piece[] = [
    {
      id: nextId('wK'),
      type: 'king',
      owner: 'white',
      file: KING_START.white.file,
      rank: KING_START.white.rank,
      nextActionAt: now,
    },
    {
      id: nextId('bK'),
      type: 'king',
      owner: 'black',
      file: KING_START.black.file,
      rank: KING_START.black.rank,
      nextActionAt: now,
    },
  ];
  return {
    pieces,
    players: { white: newPlayerState(), black: newPlayerState() },
    status: 'playing',
    winner: null,
    lastTickAt: now,
  };
}

export function resetGame(now: number): GameState {
  return createInitialState(now);
}

function clonePlayer(p: PlayerState): PlayerState {
  return { energy: p.energy, deck: [...p.deck], hand: [...p.hand], deployReadyAt: p.deployReadyAt };
}

function cloneState(s: GameState): GameState {
  return {
    pieces: s.pieces.map((p) => ({ ...p })),
    players: { white: clonePlayer(s.players.white), black: clonePlayer(s.players.black) },
    status: s.status,
    winner: s.winner,
    lastTickAt: s.lastTickAt,
  };
}

export function canDeploy(
  state: GameState,
  player: Player,
  handIndex: number,
  file: number,
  rank: number,
): boolean {
  if (state.status !== 'playing') return false;
  const ps = state.players[player];
  const card = ps.hand[handIndex];
  if (!card) return false;
  if (ps.energy < PIECE_COST[card]) return false;
  if (!DEPLOY_RANKS[player].includes(rank)) return false;
  if (file < 0 || file >= BOARD_SIZE) return false;
  if (pieceAt(state.pieces, file, rank)) return false;
  return true;
}

/** Whether `player`'s deploy cooldown has elapsed at time `now`. */
export function deployReady(state: GameState, player: Player, now: number): boolean {
  return now >= state.players[player].deployReadyAt;
}

/**
 * Deploy a card to a square. Returns the same reference unchanged if illegal or
 * if the player is still on deploy cooldown. Deploying starts a cooldown
 * proportional to the piece's cost, and shortens the opponent's remaining
 * cooldown (the back-and-forth that distinguishes this from flat mana).
 */
export function deployCard(
  state: GameState,
  player: Player,
  handIndex: number,
  file: number,
  rank: number,
  now: number,
): GameState {
  if (!canDeploy(state, player, handIndex, file, rank)) return state;
  if (now < state.players[player].deployReadyAt) return state; // still on cooldown
  const s = cloneState(state);
  const ps = s.players[player];
  const card = ps.hand[handIndex];
  ps.energy -= PIECE_COST[card];
  ps.hand.splice(handIndex, 1);
  s.pieces.push({
    id: nextId(`${player[0]}${card[0]}`),
    type: card,
    owner: player,
    file,
    rank,
    nextActionAt: now + PIECE_COOLDOWN_MS,
  });
  drawHand(ps.deck, ps.hand);

  // deploy cooldown scales with the piece's cost (intensity)
  ps.deployReadyAt = now + PIECE_COST[card] * DEPLOY_COOLDOWN_MS_PER_COST;
  // deploying shortens the opponent's remaining cooldown
  const opponent = s.players[player === 'white' ? 'black' : 'white'];
  if (opponent.deployReadyAt > now) {
    opponent.deployReadyAt = now + (opponent.deployReadyAt - now) * OPPONENT_DEPLOY_COOLDOWN_FACTOR;
  }
  return s;
}

/**
 * Spend energy to put the current hand back into the deck, reshuffle, and draw a
 * fresh hand. Returns the same reference unchanged if it cannot be afforded or
 * the game is over.
 */
export function cycleHand(state: GameState, player: Player): GameState {
  if (state.status !== 'playing') return state;
  const current = state.players[player];
  if (current.energy < DECK_CYCLE_COST || current.hand.length === 0) return state;
  const s = cloneState(state);
  const ps = s.players[player];
  ps.energy -= DECK_CYCLE_COST;
  ps.deck.push(...ps.hand);
  ps.hand = [];
  ps.deck = shuffle(ps.deck);
  drawHand(ps.deck, ps.hand);
  return s;
}

function regen(ps: PlayerState, dtMs: number): void {
  ps.energy = Math.min(ENERGY_MAX, ps.energy + dtMs / ENERGY_REGEN_MS);
}

/**
 * Advance the simulation to time `now`: regenerate energy and let every piece
 * whose cooldown has elapsed take one action, in deterministic insertion order.
 */
export function tick(state: GameState, now: number): GameState {
  if (state.status !== 'playing') {
    return { ...state, lastTickAt: now };
  }
  const s = cloneState(state);

  let dt = now - s.lastTickAt;
  if (dt < 0) dt = 0;
  if (dt > GAME_TICK_MS * 8) dt = GAME_TICK_MS * 8; // clamp big gaps (e.g. backgrounded tab)
  s.lastTickAt = now;
  regen(s.players.white, dt);
  regen(s.players.black, dt);

  const order = s.pieces.map((p) => p.id);
  const removed = new Set<string>();

  for (const id of order) {
    if (s.status !== 'playing') break;
    if (removed.has(id)) continue;
    const piece = s.pieces.find((p) => p.id === id);
    if (!piece) continue;
    if (piece.nextActionAt > now) continue;

    const move = decideAction(s.pieces, piece);
    piece.nextActionAt = now + PIECE_COOLDOWN_MS;
    if (!move) continue;

    if (move.capture && move.capturedId) {
      const captured = s.pieces.find((p) => p.id === move.capturedId);
      if (captured) {
        removed.add(captured.id);
        s.pieces = s.pieces.filter((p) => p.id !== captured.id);
        if (captured.type === 'king') {
          s.status = piece.owner === 'white' ? 'white_wins' : 'black_wins';
          s.winner = piece.owner;
        } else {
          // captured non-king piece returns to its owner's deck, reshuffled
          const owner = s.players[captured.owner];
          owner.deck.push(captured.type as CardType);
          owner.deck = shuffle(owner.deck);
          drawHand(owner.deck, owner.hand);
        }
      }
    }

    piece.file = move.to.file;
    piece.rank = move.to.rank;

    // promotion: a pawn reaching the final rank becomes a queen
    if (piece.type === 'pawn') {
      const lastRank = piece.owner === 'white' ? BOARD_SIZE - 1 : 0;
      if (piece.rank === lastRank) piece.type = 'queen';
    }
  }

  return s;
}
