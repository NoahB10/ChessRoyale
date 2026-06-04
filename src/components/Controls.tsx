import { useGameStore } from '../store/gameStore';
import type { Player } from '../game/types';
import type { ControllerConfig, Difficulty } from '../game/bot/types';

const OPTIONS: { value: string; label: string }[] = [
  { value: 'human', label: 'Human' },
  { value: 'easy', label: 'Easy bot' },
  { value: 'medium', label: 'Medium bot' },
  { value: 'hard', label: 'Hard bot' },
];

function toConfig(value: string): ControllerConfig {
  return value === 'human' ? { kind: 'human' } : { kind: 'bot', difficulty: value as Difficulty };
}
function toValue(c: ControllerConfig): string {
  return c.kind === 'human' ? 'human' : c.difficulty;
}

function SideSelect({ player }: { player: Player }) {
  const config = useGameStore((s) => s.controllers[player]);
  const setController = useGameStore((s) => s.setController);
  const label = player === 'white' ? 'White' : 'Black';

  return (
    <label className="control-select">
      <span className="control-label">{label}</span>
      <select
        data-testid={`controller-${player}`}
        value={toValue(config)}
        onChange={(e) => setController(player, toConfig(e.target.value))}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Compact mode controls: who plays each side, plus pause/resume and restart. */
export function Controls() {
  const paused = useGameStore((s) => s.paused);
  const togglePause = useGameStore((s) => s.togglePause);
  const reset = useGameStore((s) => s.reset);

  return (
    <div className="controls" data-testid="controls">
      <SideSelect player="white" />
      <SideSelect player="black" />
      <button
        className="btn"
        data-testid="pause"
        aria-pressed={paused}
        onClick={togglePause}
      >
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>
      <button className="btn reset" data-testid="reset" onClick={reset}>
        ↻ Restart
      </button>
    </div>
  );
}

/** A small badge shown beside a side when a bot controls it. */
export function ControllerBadge({ player }: { player: Player }) {
  const config = useGameStore((s) => s.controllers[player]);
  if (config.kind !== 'bot') return null;
  const name = config.difficulty[0].toUpperCase() + config.difficulty.slice(1);
  return (
    <span className={`bot-badge ${player}`} data-testid={`bot-badge-${player}`}>
      🤖 {name} bot
    </span>
  );
}
