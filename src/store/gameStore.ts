import { create } from 'zustand';
import type { GameState, Player } from '../game/types';
import type { ControllerConfig } from '../game/bot/types';
import {
  canDeploy,
  createInitialState,
  cycleHand,
  deployCard,
  deployReady,
  tick,
} from '../game/gameEngine';
import { DEFAULT_SPEED, MAX_SPEED, MIN_SPEED } from '../game/constants';

export interface ActiveDrag {
  player: Player;
  handIndex: number;
}

/** A placement waiting for the player's deploy cooldown to clear (held ghost). */
export interface PendingPlace {
  handIndex: number;
  file: number;
  rank: number;
}

export type PendingMap = Record<Player, PendingPlace | null>;

const HUMAN: ControllerConfig = { kind: 'human' };
const SPEED_KEY = 'chessRoyale.speed';
const NO_PENDING: PendingMap = { white: null, black: null };

function clampSpeed(s: number): number {
  if (!Number.isFinite(s)) return DEFAULT_SPEED;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
}
function loadSpeed(): number {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SPEED_KEY) : null;
    return raw == null ? DEFAULT_SPEED : clampSpeed(Number(raw));
  } catch {
    return DEFAULT_SPEED;
  }
}
function saveSpeed(s: number): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SPEED_KEY, String(s));
  } catch {
    /* storage unavailable */
  }
}

/** Commit any held placements whose deploy cooldown has cleared; drop ones that
 *  are no longer legal (square taken, etc.). Pure — used by the local loop. */
function commitPending(
  state: GameState,
  pending: PendingMap,
  now: number,
): { state: GameState; pending: PendingMap } {
  let s = state;
  let next = pending;
  for (const player of ['white', 'black'] as Player[]) {
    const p = next[player];
    if (!p) continue;
    if (!canDeploy(s, player, p.handIndex, p.file, p.rank)) {
      next = { ...next, [player]: null };
      continue;
    }
    if (deployReady(s, player, now)) {
      const after = deployCard(s, player, p.handIndex, p.file, p.rank, now);
      if (after !== s) {
        s = after;
        next = { ...next, [player]: null };
      }
    }
  }
  return { state: s, pending: next };
}

interface GameStore {
  state: GameState;
  activeDrag: ActiveDrag | null;
  /** placements held until their deploy cooldown clears. */
  pending: PendingMap;
  controllers: Record<Player, ControllerConfig>;
  paused: boolean;
  gameSeq: number;
  speed: number;
  simNow: number;
  realAt: number;
  tick: (now: number) => void;
  advance: (realNow: number) => void;
  /** deploy immediately if off cooldown; returns true if it placed a piece. */
  deploy: (player: Player, handIndex: number, file: number, rank: number) => boolean;
  /** hold a placement (ghost) until the cooldown clears. */
  setPending: (player: Player, place: PendingPlace | null) => void;
  /** spend energy to draw a fresh hand (local). */
  cycle: (player: Player) => void;
  /** replace board + held placements with authoritative server state (online). */
  applyServerState: (game: GameState, pending?: PendingMap) => void;
  setActiveDrag: (drag: ActiveDrag | null) => void;
  setController: (player: Player, config: ControllerConfig) => void;
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const now0 = Date.now();
  return {
    state: createInitialState(now0),
    activeDrag: null,
    pending: NO_PENDING,
    controllers: { white: HUMAN, black: HUMAN },
    paused: false,
    gameSeq: 0,
    speed: loadSpeed(),
    simNow: now0,
    realAt: now0,

    tick: (now) =>
      set((s) => {
        if (s.paused) return { state: { ...s.state, lastTickAt: now } };
        return { state: tick(s.state, now) };
      }),

    advance: (realNow) =>
      set((s) => {
        const dtReal = realNow > s.realAt ? realNow - s.realAt : 0;
        const simNow = s.simNow + dtReal * s.speed;
        if (s.paused) {
          return { simNow, realAt: realNow, state: { ...s.state, lastTickAt: simNow } };
        }
        const ticked = tick(s.state, simNow);
        const committed = commitPending(ticked, s.pending, simNow);
        return { simNow, realAt: realNow, state: committed.state, pending: committed.pending };
      }),

    deploy: (player, handIndex, file, rank) => {
      const before = get().state;
      const after = deployCard(before, player, handIndex, file, rank, get().simNow);
      if (after === before) return false;
      set({ state: after });
      return true;
    },

    setPending: (player, place) => set((s) => ({ pending: { ...s.pending, [player]: place } })),

    cycle: (player) => set((s) => ({ state: cycleHand(s.state, player) })),

    applyServerState: (game, pending) => set({ state: game, pending: pending ?? NO_PENDING }),

    setActiveDrag: (drag) => set({ activeDrag: drag }),

    setController: (player, config) =>
      set((s) => ({ controllers: { ...s.controllers, [player]: config } })),

    setPaused: (paused) => set({ paused }),
    togglePause: () => set((s) => ({ paused: !s.paused })),

    setSpeed: (speed) => {
      const next = clampSpeed(speed);
      saveSpeed(next);
      set({ speed: next });
    },

    reset: () =>
      set((s) => {
        const t = Date.now();
        return {
          state: createInitialState(t),
          activeDrag: null,
          pending: NO_PENDING,
          paused: false,
          gameSeq: s.gameSeq + 1,
          simNow: t,
          realAt: t,
        };
      }),
  };
});
