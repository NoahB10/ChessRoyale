import { useGameStore } from '../store/gameStore';
import { MAX_SPEED, MIN_SPEED, SPEED_STEP } from '../game/constants';

/**
 * Vertical game-speed control rendered on the side of the board. Dragging up
 * speeds the game up, down slows it down; changes apply live and persist.
 */
export function SpeedSlider() {
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);

  return (
    <div className="speed-slider" data-testid="speed-slider">
      <span className="speed-caption">Fast</span>
      <input
        className="speed-range"
        type="range"
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={SPEED_STEP}
        value={speed}
        aria-label="Game speed"
        data-testid="speed-input"
        onChange={(e) => setSpeed(Number(e.target.value))}
      />
      <span className="speed-caption">Slow</span>
      <span className="speed-value" data-testid="speed-value">
        {speed.toFixed(2)}×
      </span>
    </div>
  );
}
