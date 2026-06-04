import { useGameStore } from '../store/gameStore';
import { canDeploy } from '../game/gameEngine';
import { BOARD_SIZE } from '../game/constants';
import { Square } from './Square';

export function Board() {
  const state = useGameStore((s) => s.state);
  const activeDrag = useGameStore((s) => s.activeDrag);

  const rows = [];
  // render rank 8 (index 7) at the top down to rank 1 (index 0) at the bottom
  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    const cells = [];
    for (let file = 0; file < BOARD_SIZE; file++) {
      const piece = state.pieces.find((p) => p.file === file && p.rank === rank);
      const isDeployTarget =
        !!activeDrag && canDeploy(state, activeDrag.player, activeDrag.handIndex, file, rank);
      cells.push(
        <Square
          key={`${file}-${rank}`}
          file={file}
          rank={rank}
          piece={piece}
          isDeployTarget={isDeployTarget}
          dragging={!!activeDrag}
        />,
      );
    }
    rows.push(
      <div className="board-row" key={rank}>
        {cells}
      </div>,
    );
  }

  return (
    <div className="board" data-testid="board">
      {rows}
    </div>
  );
}
