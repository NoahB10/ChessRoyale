import { useEffect, useRef } from 'react';
import { useGameStore } from './gameStore';
import { BotScheduler, type SchedulerContext } from '../game/bot/botController';
import { makeRng } from '../game/bot/rng';

/** How often the scheduler is polled. Reaction delays are far coarser than this. */
const BOT_TICK_MS = 150;

/**
 * Drives bot players off a single interval (never per render). It reads the
 * live store via getState() — it does not subscribe, so it never re-renders the
 * app — and routes every decision through the store's deploy action, which goes
 * through the engine's deployCard. When the game restarts (gameSeq changes) the
 * scheduler's reaction timers reset so a fresh game gets fresh delays.
 */
export function useBotRunner(): void {
  const seqRef = useRef(-1);

  useEffect(() => {
    const scheduler = new BotScheduler();
    const rng = makeRng(Date.now() >>> 0);
    const ctx: SchedulerContext = {
      getState: () => useGameStore.getState().state,
      getController: (p) => useGameStore.getState().controllers[p],
      isPaused: () => useGameStore.getState().paused,
      deploy: (p, d) => useGameStore.getState().deploy(p, d.handIndex, d.file, d.rank),
      rng,
    };

    const id = setInterval(() => {
      const seq = useGameStore.getState().gameSeq;
      if (seq !== seqRef.current) {
        scheduler.reset();
        seqRef.current = seq;
      }
      scheduler.step(Date.now(), ctx);
    }, BOT_TICK_MS);

    return () => clearInterval(id);
  }, []);
}
