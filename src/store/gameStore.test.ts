import { describe, it, expect } from 'vitest';
import { useGameStore } from './gameStore';
import { createInitialState } from '../game/gameEngine';
import { DEFAULT_SPEED, MAX_SPEED, MIN_SPEED } from '../game/constants';

// Note: the store is a module singleton; vitest isolates modules per test file,
// so it starts fresh here. Tests run top-to-bottom — the defaults test runs
// before any mutation.

describe('game store: controllers and pause', () => {
  it('defaults both sides to human and starts unpaused', () => {
    const s = useGameStore.getState();
    expect(s.controllers.white).toEqual({ kind: 'human' });
    expect(s.controllers.black).toEqual({ kind: 'human' });
    expect(s.paused).toBe(false);
  });

  it('sets a controller for one side without touching the other', () => {
    useGameStore.getState().setController('black', { kind: 'bot', difficulty: 'hard' });
    expect(useGameStore.getState().controllers.black).toEqual({ kind: 'bot', difficulty: 'hard' });
    expect(useGameStore.getState().controllers.white).toEqual({ kind: 'human' });
  });

  it('toggles and sets pause', () => {
    useGameStore.setState({ paused: false });
    useGameStore.getState().togglePause();
    expect(useGameStore.getState().paused).toBe(true);
    useGameStore.getState().setPaused(false);
    expect(useGameStore.getState().paused).toBe(false);
  });

  it('keeps controllers but unpauses and rebuilds the board on reset', () => {
    useGameStore.getState().setController('white', { kind: 'bot', difficulty: 'easy' });
    useGameStore.setState({ paused: true });
    useGameStore.getState().reset();
    const s = useGameStore.getState();
    expect(s.controllers.white).toEqual({ kind: 'bot', difficulty: 'easy' }); // mode preserved
    expect(s.paused).toBe(false); // restart resumes play
    expect(s.state.status).toBe('playing');
    expect(s.state.pieces).toHaveLength(2); // two kings, fresh board
  });

  it('bumps gameSeq on reset so the bot runner can restart its timers', () => {
    const before = useGameStore.getState().gameSeq;
    useGameStore.getState().reset();
    expect(useGameStore.getState().gameSeq).toBe(before + 1);
  });
});

describe('game store: speed control', () => {
  it('defaults speed to DEFAULT_SPEED', () => {
    expect(useGameStore.getState().speed).toBe(DEFAULT_SPEED);
  });

  it('clamps speed to [MIN_SPEED, MAX_SPEED] and persists to localStorage', () => {
    useGameStore.getState().setSpeed(99);
    expect(useGameStore.getState().speed).toBe(MAX_SPEED);
    expect(Number(localStorage.getItem('chessRoyale.speed'))).toBe(MAX_SPEED);

    useGameStore.getState().setSpeed(0);
    expect(useGameStore.getState().speed).toBe(MIN_SPEED);
    expect(Number(localStorage.getItem('chessRoyale.speed'))).toBe(MIN_SPEED);
  });
});

describe('game store: advance scales the virtual clock by speed', () => {
  it('advances sim time by realElapsed * speed and regenerates accordingly', () => {
    const base = createInitialState(0);
    base.players.white.energy = 5;
    // 3000ms real * 0.5 speed = 1500ms sim = exactly 1 energy (1 / 1500ms)
    useGameStore.setState({ state: base, paused: false, simNow: 0, realAt: 0, speed: 0.5 });

    useGameStore.getState().advance(3_000);

    const s = useGameStore.getState();
    expect(s.simNow).toBe(1_500);
    expect(s.state.lastTickAt).toBe(1_500);
    expect(s.state.players.white.energy).toBeCloseTo(6, 5);
  });

  it('keeps the clock current while paused without simulating', () => {
    const base = createInitialState(0);
    base.players.white.energy = 5;
    useGameStore.setState({ state: base, paused: true, simNow: 0, realAt: 0, speed: 1 });

    useGameStore.getState().advance(2_000);

    const s = useGameStore.getState();
    expect(s.simNow).toBe(2_000); // virtual clock advances
    expect(s.realAt).toBe(2_000);
    expect(s.state.lastTickAt).toBe(2_000); // resume won't burst-simulate
    expect(s.state.players.white.energy).toBe(5); // frozen
  });
});

describe('game store: paused tick freezes the simulation', () => {
  it('does not regenerate energy while paused, but advances the clock', () => {
    const base = createInitialState(0);
    base.players.white.energy = 5;
    useGameStore.setState({ state: base, paused: true });

    useGameStore.getState().tick(10_000);

    const after = useGameStore.getState().state;
    expect(after.players.white.energy).toBe(5); // frozen
    expect(after.lastTickAt).toBe(10_000); // clock advances so resume doesn't burst-simulate
  });

  it('regenerates energy while running', () => {
    const base = createInitialState(0);
    base.players.white.energy = 5;
    useGameStore.setState({ state: base, paused: false });

    useGameStore.getState().tick(3_000); // 3s at 1 energy / 1.5s

    expect(useGameStore.getState().state.players.white.energy).toBeGreaterThan(5);
  });
});
