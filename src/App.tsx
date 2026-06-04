import { useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useGameStore } from './store/gameStore';
import { useBotRunner } from './store/useBotRunner';
import { Board } from './components/Board';
import { Hand } from './components/Hand';
import { EnergyBar } from './components/EnergyBar';
import { Controls, ControllerBadge } from './components/Controls';
import { SpeedSlider } from './components/SpeedSlider';
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
  const status = useGameStore((s) => s.state.status);
  const winner = useGameStore((s) => s.state.winner);
  const deploy = useGameStore((s) => s.deploy);
  const setActiveDrag = useGameStore((s) => s.setActiveDrag);
  const reset = useGameStore((s) => s.reset);

  // real-time game loop; `advance` scales wall-clock by the speed multiplier
  // and respects pause inside the store.
  useEffect(() => {
    const id = setInterval(() => useGameStore.getState().advance(Date.now()), GAME_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // bot players run off their own interval, never per render
  useBotRunner();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current as CardDragData | undefined;
    // ignore drags from a bot-controlled side
    if (data && useGameStore.getState().controllers[data.player].kind === 'human') {
      setActiveDrag({ player: data.player, handIndex: data.handIndex });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as CardDragData | undefined;
    const over = e.over?.data.current as SquareDropData | undefined;
    if (data && over && useGameStore.getState().controllers[data.player].kind === 'human') {
      deploy(data.player, data.handIndex, over.file, over.rank);
    }
    setActiveDrag(null);
  }

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
          <Controls />
        </header>

        <div className="side-row">
          <EnergyBar player="black" />
          <ControllerBadge player="black" />
        </div>
        <Hand player="black" />

        <div className="board-wrap">
          <Board />
          <SpeedSlider />
          {status !== 'playing' && (
            <div className="overlay" data-testid="winner-overlay">
              <div className="overlay-card">
                <div className="overlay-title">{winner === 'white' ? 'White' : 'Black'} wins!</div>
                <div className="overlay-sub">The enemy king was captured.</div>
                <button className="btn primary" onClick={reset}>
                  Play again
                </button>
              </div>
            </div>
          )}
        </div>

        <Hand player="white" />
        <div className="side-row">
          <EnergyBar player="white" />
          <ControllerBadge player="white" />
        </div>

        <p className="hint">
          Pick who controls each side above, then drag a card onto your highlighted zone to deploy.
          White holds ranks 1–2, Black holds ranks 7–8. Pieces fight automatically — capture the
          enemy king to win.
        </p>
      </div>
    </DndContext>
  );
}
