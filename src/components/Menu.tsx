import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import type { ControllerConfig, Difficulty } from '../game/bot/types';
import { makeRoomCode, parseRoomCode } from '../online/protocol';

const CONTROL_OPTIONS: { value: string; label: string }[] = [
  { value: 'human', label: 'Human' },
  { value: 'easy', label: 'Easy bot' },
  { value: 'medium', label: 'Medium bot' },
  { value: 'hard', label: 'Hard bot' },
];

const SPEED_OPTIONS: { value: number; label: string }[] = [
  { value: 0.4, label: 'Slow' },
  { value: 0.6, label: 'Normal' },
  { value: 0.8, label: 'Brisk' },
  { value: 1.0, label: 'Fast' },
];

function toConfig(value: string): ControllerConfig {
  return value === 'human' ? { kind: 'human' } : { kind: 'bot', difficulty: value as Difficulty };
}

export function Menu() {
  const startLocal = useAppStore((s) => s.startLocal);
  const startOnline = useAppStore((s) => s.startOnline);
  const setController = useGameStore((s) => s.setController);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const reset = useGameStore((s) => s.reset);

  const [white, setWhite] = useState('human');
  const [black, setBlack] = useState('easy');
  // default to the player's saved speed so starting a game never resets it
  const [speed, setSpeedChoice] = useState(() => useGameStore.getState().speed);
  const [joinCode, setJoinCode] = useState('');

  function playLocal() {
    setController('white', toConfig(white));
    setController('black', toConfig(black));
    setSpeed(speed); // initial speed (still adjustable live in-game)
    reset(); // fresh board for the chosen matchup
    startLocal();
  }

  function createOnline() {
    startOnline(makeRoomCode(), speed);
  }

  function joinOnline() {
    const code = parseRoomCode(joinCode);
    if (code) startOnline(code);
  }

  return (
    <div className="menu" data-testid="menu">
      <h1 className="title menu-title">Chess Royale</h1>
      <p className="menu-tag">
        Real-time chess. Spend energy to deploy pieces from your hand — they fight on their own.
        Capture the enemy king to win.
      </p>

      <div className="menu-speed">
        <span className="control-label">Game speed</span>
        <select
          data-testid="menu-speed"
          value={String(speed)}
          onChange={(e) => setSpeedChoice(Number(e.target.value))}
        >
          {SPEED_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <section className="menu-card">
        <h2 className="menu-h">Local</h2>
        <p className="menu-sub">Play on this device — against a friend or the bots.</p>
        <div className="menu-row">
          <label className="control-select">
            <span className="control-label">White</span>
            <select data-testid="menu-white" value={white} onChange={(e) => setWhite(e.target.value)}>
              {CONTROL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span className="control-label">Black</span>
            <select data-testid="menu-black" value={black} onChange={(e) => setBlack(e.target.value)}>
              {CONTROL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn primary" data-testid="play-local" onClick={playLocal}>
          ▶ Start local game
        </button>
      </section>

      <section className="menu-card">
        <h2 className="menu-h">Online</h2>
        <p className="menu-sub">
          Play a friend on another device. Create a game and share the link, or join with a code.
        </p>
        <button className="btn primary" data-testid="create-online" onClick={createOnline}>
          🔗 Create online game
        </button>
        <div className="menu-join">
          <input
            data-testid="join-code"
            placeholder="Enter code or paste link"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') joinOnline();
            }}
          />
          <button
            className="btn"
            data-testid="join-online"
            onClick={joinOnline}
            disabled={!parseRoomCode(joinCode)}
          >
            Join
          </button>
        </div>
      </section>
    </div>
  );
}
