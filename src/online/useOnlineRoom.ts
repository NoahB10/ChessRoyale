import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { connect, disconnect } from './connection';

/**
 * Drives the online session: opens the room WebSocket when in online mode, maps
 * incoming server messages into the app + game stores, and tears the socket down
 * on leave. The game board simply renders whatever authoritative state arrives.
 */
export function useOnlineRoom(): void {
  const mode = useAppStore((s) => s.mode);
  const code = useAppStore((s) => s.online?.code ?? null);

  useEffect(() => {
    if (mode !== 'online' || !code) return;

    const setOnline = useAppStore.getState().setOnline;
    const applyServerState = useGameStore.getState().applyServerState;
    const speed = useAppStore.getState().online?.speed;

    setOnline({ status: 'connecting' });

    connect(
      code,
      {
      onMessage: (msg) => {
        switch (msg.t) {
          case 'assigned':
            setOnline({ side: msg.side });
            break;
          case 'presence':
            setOnline({ presence: { white: msg.white, black: msg.black } });
            break;
          case 'state':
            applyServerState(msg.game);
            setOnline({
              status: msg.phase === 'over' ? 'over' : msg.phase === 'playing' ? 'playing' : 'waiting',
            });
            break;
          case 'opponent_left':
            setOnline({ status: 'opponent_left' });
            break;
          case 'error':
            setOnline({ status: 'error', error: msg.message });
            break;
        }
      },
      onClose: () => {
        const status = useAppStore.getState().online?.status;
        if (status && status !== 'over' && status !== 'opponent_left') {
          setOnline({ status: 'error', error: 'Disconnected from room' });
        }
      },
        onError: () => setOnline({ status: 'error', error: 'Connection failed' }),
      },
      speed,
    );

    return () => disconnect();
  }, [mode, code]);
}
