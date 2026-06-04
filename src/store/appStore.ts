import { create } from 'zustand';
import type { OnlineRole } from '../online/protocol';

export type Screen = 'menu' | 'game';
export type Mode = 'local' | 'online';
export type ConnStatus =
  | 'connecting'
  | 'waiting'
  | 'playing'
  | 'over'
  | 'opponent_left'
  | 'error';

export interface OnlineSession {
  code: string;
  side: OnlineRole | null;
  status: ConnStatus;
  presence: { white: boolean; black: boolean };
  /** speed chosen by the creator (only sent on the creating connection). */
  speed?: number;
  error?: string;
}

interface AppStore {
  screen: Screen;
  mode: Mode;
  online: OnlineSession | null;
  startLocal: () => void;
  startOnline: (code: string, speed?: number) => void;
  setOnline: (patch: Partial<OnlineSession>) => void;
  goMenu: () => void;
}

function freshOnline(code: string): OnlineSession {
  return { code, side: null, status: 'connecting', presence: { white: false, black: false } };
}

/** A shared link arrives as `#r=CODE`; auto-route straight into that online room. */
function initial(): Pick<AppStore, 'screen' | 'mode' | 'online'> {
  try {
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const m = hash.match(/[#&]r=([A-Za-z0-9]+)/i);
    if (m) {
      return { screen: 'game', mode: 'online', online: freshOnline(m[1].toUpperCase()) };
    }
  } catch {
    /* no location (SSR/tests) */
  }
  return { screen: 'menu', mode: 'local', online: null };
}

export const useAppStore = create<AppStore>((set) => ({
  ...initial(),

  startLocal: () => set({ screen: 'game', mode: 'local', online: null }),

  startOnline: (code, speed) =>
    set({ screen: 'game', mode: 'online', online: { ...freshOnline(code), speed } }),

  setOnline: (patch) => set((s) => (s.online ? { online: { ...s.online, ...patch } } : {})),

  goMenu: () => {
    try {
      if (typeof location !== 'undefined' && location.hash) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    } catch {
      /* ignore */
    }
    set({ screen: 'menu', mode: 'local', online: null });
  },
}));
