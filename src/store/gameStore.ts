import { create } from 'zustand';
import type { GameState, Player } from '../game/types';
import type { ControllerConfig } from '../game/bot/types';
import { createInitialState, deployCard, tick } from '../game/gameEngine';
import { DEFAULT_SPEED, MAX_SPEED, MIN_SPEED } from '../game/constants';

export interface ActiveDrag {
  player: Player;
  handIndex: number;
}

const HUMAN: ControllerConfig = { kind: 'human' };

const SPEED_KEY = 'chessRoyale.speed';

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
    /* storage unavailable (private mode / SSR) — speed simply won't persist */
  }
}

interface GameStore {
  state: GameState;
  activeDrag: ActiveDrag | null;
  /** who controls each side */
  controllers: Record<Player, ControllerConfig>;
  /** when true, the simulation and bots are frozen */
  paused: boolean;
  /** increments on each restart; lets the bot runner reset its reaction timers */
  gameSeq: number;
  /** game-speed multiplier; the virtual clock advances at realElapsed * speed */
  speed: number;
  /** current virtual simulation time (ms); the board's clock, scaled by speed */
  simNow: number;
  /** real wall-clock time (ms) at the last `advance` — anchors the virtual clock */
  realAt: number;
  /** advance the simulation to a virtual time `now` (ms). */
  tick: (now: number) => void;
  /** advance the virtual clock by (realNow - realAt) * speed, then tick. */
  advance: (realNow: number) => void;
  /** attempt to deploy a hand card; returns true if it succeeded. */
  deploy: (player: Player, handIndex: number, file: number, rank: number) => boolean;
  /** replace the board with authoritative state from the server (online mode). */
  applyServerState: (game: GameState) => void;
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
    controllers: { white: HUMAN, black: HUMAN },
    paused: false,
    gameSeq: 0,
    speed: loadSpeed(),
    simNow: now0,
    realAt: now0,

    tick: (now) =>
      set((s) => {
        // While paused, freeze the world but keep the clock current so resuming
        // does not replay the elapsed time in one burst.
        if (s.paused) return { state: { ...s.state, lastTickAt: now } };
        return { state: tick(s.state, now) };
      }),

    // Driven by the render loop. Real elapsed time is scaled by `speed` into the
    // virtual clock, so the whole board slows down or speeds up uniformly.
    advance: (realNow) =>
      set((s) => {
        const dtReal = realNow > s.realAt ? realNow - s.realAt : 0;
        const simNow = s.simNow + dtReal * s.speed;
        const state = s.paused ? { ...s.state, lastTickAt: simNow } : tick(s.state, simNow);
        return { simNow, realAt: realNow, state };
      }),

    // Pieces are stamped with the current virtual time so their cooldowns line up
    // with the scaled clock — that is what makes deployed pieces obey the speed.
    deploy: (player, handIndex, file, rank) => {
      const before = get().state;
      const after = deployCard(before, player, handIndex, file, rank, get().simNow);
      if (after === before) return false;
      set({ state: after });
      return true;
    },

    applyServerState: (game) => set({ state: game }),

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

    // Restart the board but keep the chosen game mode and speed, and resume play.
    reset: () =>
      set((s) => {
        const t = Date.now();
        return {
          state: createInitialState(t),
          activeDrag: null,
          paused: false,
          gameSeq: s.gameSeq + 1,
          simNow: t,
          realAt: t,
        };
      }),
  };
});
