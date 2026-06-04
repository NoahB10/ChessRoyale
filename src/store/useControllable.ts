import { useAppStore } from './appStore';
import { useGameStore } from './gameStore';
import type { Player } from '../game/types';

/**
 * Whether the local user may drag/deploy for a given side right now.
 * - Online: only the side this client was assigned.
 * - Local: any human-controlled side (bot sides are not draggable).
 */
export function useControllable(player: Player): boolean {
  const mode = useAppStore((s) => s.mode);
  const side = useAppStore((s) => s.online?.side ?? null);
  const human = useGameStore((s) => s.controllers[player].kind === 'human');
  return mode === 'online' ? side === player : human;
}

/** Non-reactive variant for event handlers. */
export function isControllable(player: Player): boolean {
  const app = useAppStore.getState();
  if (app.mode === 'online') return app.online?.side === player;
  return useGameStore.getState().controllers[player].kind === 'human';
}
