import { create } from 'zustand';
import type { GameState, Player } from '../game/types';
import type { ControllerConfig } from '../game/bot/types';
import { createInitialState, deployCard, tick } from '../game/gameEngine';

export interface ActiveDrag {
  player: Player;
  handIndex: number;
}

const HUMAN: ControllerConfig = { kind: 'human' };

interface GameStore {
  state: GameState;
  activeDrag: ActiveDrag | null;
  /** who controls each side */
  controllers: Record<Player, ControllerConfig>;
  /** when true, the simulation and bots are frozen */
  paused: boolean;
  /** increments on each restart; lets the bot runner reset its reaction timers */
  gameSeq: number;
  /** advance the simulation to `now` (ms). */
  tick: (now: number) => void;
  /** attempt to deploy a hand card; returns true if it succeeded. */
  deploy: (player: Player, handIndex: number, file: number, rank: number, now: number) => boolean;
  setActiveDrag: (drag: ActiveDrag | null) => void;
  setController: (player: Player, config: ControllerConfig) => void;
  setPaused: (paused: boolean) => void;
  togglePause: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(Date.now()),
  activeDrag: null,
  controllers: { white: HUMAN, black: HUMAN },
  paused: false,
  gameSeq: 0,

  tick: (now) =>
    set((s) => {
      // While paused, freeze the world but keep the clock current so resuming
      // does not replay the elapsed time in one burst.
      if (s.paused) return { state: { ...s.state, lastTickAt: now } };
      return { state: tick(s.state, now) };
    }),

  deploy: (player, handIndex, file, rank, now) => {
    const before = get().state;
    const after = deployCard(before, player, handIndex, file, rank, now);
    if (after === before) return false;
    set({ state: after });
    return true;
  },

  setActiveDrag: (drag) => set({ activeDrag: drag }),

  setController: (player, config) =>
    set((s) => ({ controllers: { ...s.controllers, [player]: config } })),

  setPaused: (paused) => set({ paused }),
  togglePause: () => set((s) => ({ paused: !s.paused })),

  // Restart the board but keep the chosen game mode, and resume play.
  reset: () =>
    set((s) => ({
      state: createInitialState(Date.now()),
      activeDrag: null,
      paused: false,
      gameSeq: s.gameSeq + 1,
    })),
}));
