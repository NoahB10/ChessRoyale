import { create } from 'zustand';
import type { GameState, Player } from '../game/types';
import { createInitialState, deployCard, tick } from '../game/gameEngine';

export interface ActiveDrag {
  player: Player;
  handIndex: number;
}

interface GameStore {
  state: GameState;
  activeDrag: ActiveDrag | null;
  /** advance the simulation to `now` (ms). */
  tick: (now: number) => void;
  /** attempt to deploy a hand card; returns true if it succeeded. */
  deploy: (player: Player, handIndex: number, file: number, rank: number, now: number) => boolean;
  setActiveDrag: (drag: ActiveDrag | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(Date.now()),
  activeDrag: null,

  tick: (now) => set((s) => ({ state: tick(s.state, now) })),

  deploy: (player, handIndex, file, rank, now) => {
    const before = get().state;
    const after = deployCard(before, player, handIndex, file, rank, now);
    if (after === before) return false;
    set({ state: after });
    return true;
  },

  setActiveDrag: (drag) => set({ activeDrag: drag }),

  reset: () => set({ state: createInitialState(Date.now()), activeDrag: null }),
}));
