import { useEffect, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useGameStore } from './store/gameStore';
import { useAppStore } from './store/appStore';
import { useBotRunner } from './store/useBotRunner';
import { isControllable } from './store/useControllable';
import { useOnlineRoom } from './online/useOnlineRoom';
import { sendDeploy, sendRematch } from './online/connection';
import { Board } from './components/Board';
import { Hand } from './components/Hand';
import { EnergyBar } from './components/EnergyBar';
import { Controls, ControllerBadge } from './components/Controls';
import { OnlineBar } from './components/OnlineBar';
import { SpeedSlider } from './components/SpeedSlider';
import { Menu } from './components/Menu';
import { GAME_TICK_MS } from './game/constants';
import type { Player } from './game/types';
import './App.css';

interface CardDragData {
  player: Player;
  handIndex: number;
}
interface SquareDropData {
  file: number;
  rank: number;
}

export default function App() {
  const screen = useAppStore((s) => s.screen);
  return screen === 'menu' ? <Menu /> : <Game />;
}

function Game() {
  const mode = useAppStore((s) => s.mode);
  const onlineStatus = useAppStore((s) => s.online?.status ?? null);
  const goMenu = useAppStore((s) => s.goMenu);
  const status = useGameStore((s) => s.state.status);
  const winner = useGameStore((s) => s.state.winner);
  const deploy = useGameStore((s) => s.deploy);
  const reset = useGameStore((s) => s.reset);
  const setActiveDrag = useGameStore((s) => s.setActiveDrag);

  // Local real-time loop. Online games are advanced by the authoritative server.
  useEffect(() => {
    if (mode !== 'local') return;
    const id = setInterval(() => useGameStore.getState().advance(Date.now()), GAME_TICK_MS);
    return () => clearInterval(id);
  }, [mode]);

  useBotRunner(); // no-ops while online
  useOnlineRoom(); // opens/closes the room socket while online

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as CardDragData | undefined;
    if (data && isControllable(data.player)) {
      setActiveDrag({ player: data.player, handIndex: data.handIndex });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as CardDragData | undefined;
    const over = e.over?.data.current as SquareDropData | undefined;
    if (data && over && isControllable(data.player)) {
      if (useAppStore.getState().mode === 'online') {
        sendDeploy(data.handIndex, over.file, over.rank);
      } else {
        deploy(data.player, data.handIndex, over.file, over.rank);
      }
    }
    setActiveDrag(null);
  }

  const online = mode === 'online';
  const gameOver = status !== 'playing';
  const showWaiting = online && (onlineStatus === 'connecting' || onlineStatus === 'waiting');
  const showDisconnect = online && (onlineStatus === 'opponent_left' || onlineStatus === 'error');

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="game">
        <header className="topbar">
          <h1 className="title">Chess Royale</h1>
          {online ? <OnlineBar /> : <Controls />}
        </header>

        <div className="side-row">
          <EnergyBar player="black" />
          {!online && <ControllerBadge player="black" />}
        </div>
        <Hand player="black" />

        <div className="board-wrap">
          <Board />
          {!online && <SpeedSlider />}

          {showWaiting && <WaitingOverlay />}

          {showDisconnect && (
            <div className="overlay" data-testid="online-overlay">
              <div className="overlay-card">
                <div className="overlay-title">
                  {onlineStatus === 'opponent_left' ? 'Opponent left' : 'Connection lost'}
                </div>
                <div className="overlay-sub">
                  {onlineStatus === 'opponent_left'
                    ? 'Your opponent disconnected.'
                    : 'Could not stay connected to the room.'}
                </div>
                <button className="btn primary" onClick={goMenu}>
                  ← Back to menu
                </button>
              </div>
            </div>
          )}

          {!showWaiting && !showDisconnect && gameOver && (
            <div className="overlay" data-testid="winner-overlay">
              <div className="overlay-card">
                <div className="overlay-title">{winner === 'white' ? 'White' : 'Black'} wins!</div>
                <div className="overlay-sub">The enemy king was captured.</div>
                {online ? (
                  <div className="overlay-actions">
                    <button className="btn primary" onClick={() => sendRematch()}>
                      ↻ Rematch
                    </button>
                    <button className="btn" onClick={goMenu}>
                      ← Menu
                    </button>
                  </div>
                ) : (
                  <button className="btn primary" onClick={reset}>
                    Play again
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <Hand player="white" />
        <div className="side-row">
          <EnergyBar player="white" />
          {!online && <ControllerBadge player="white" />}
        </div>

        <p className="hint">
          Drag a card onto your highlighted zone to deploy. White holds ranks 1–2, Black holds ranks
          7–8. Pieces fight automatically — capture the enemy king to win.
        </p>
      </div>
    </DndContext>
  );
}

function WaitingOverlay() {
  const online = useAppStore((s) => s.online);
  const goMenu = useAppStore((s) => s.goMenu);
  const [copied, setCopied] = useState(false);

  if (!online) return null;
  const link = `${location.origin}${location.pathname}#r=${online.code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="overlay" data-testid="waiting-overlay">
      <div className="overlay-card">
        <div className="overlay-title">
          {online.status === 'connecting' ? 'Connecting…' : 'Waiting for opponent'}
        </div>
        <div className="overlay-sub">Share this link or code so a friend can join:</div>
        <div className="share-code">{online.code}</div>
        <input
          className="share-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="overlay-actions">
          <button className="btn primary" data-testid="waiting-copy" onClick={copy}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
          <button className="btn" onClick={goMenu}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
