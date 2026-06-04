import { useGameStore } from '../store/gameStore';
import type { Player } from '../game/types';
import { Card } from './Card';

export function Hand({ player }: { player: Player }) {
  const ps = useGameStore((s) => s.state.players[player]);
  const humanControlled = useGameStore((s) => s.controllers[player].kind === 'human');

  return (
    <div className={`hand hand-${player}`} data-testid={`hand-${player}`}>
      {ps.hand.map((card, i) => (
        <Card
          key={`${player}-${i}`}
          player={player}
          handIndex={i}
          card={card}
          energy={ps.energy}
          humanControlled={humanControlled}
        />
      ))}
      {ps.hand.length === 0 && <div className="hand-empty">deck empty — waiting for captures…</div>}
    </div>
  );
}
