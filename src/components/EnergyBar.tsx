import { useGameStore } from '../store/gameStore';
import type { Player } from '../game/types';
import { ENERGY_MAX } from '../game/constants';

export function EnergyBar({ player }: { player: Player }) {
  const ps = useGameStore((s) => s.state.players[player]);
  const pct = (ps.energy / ENERGY_MAX) * 100;
  const label = player === 'white' ? 'White' : 'Black';

  return (
    <div className={`energy ${player}`} data-testid={`energy-${player}`}>
      <span className="energy-label">{label}</span>
      <div className="energy-track">
        <div className="energy-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="energy-value" data-testid={`energy-value-${player}`}>
        ⚡ {Math.floor(ps.energy)}/{ENERGY_MAX}
      </span>
      <span className="deck-count" data-testid={`deck-${player}`}>
        🂠 {ps.deck.length}
      </span>
    </div>
  );
}
