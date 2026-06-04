import { useGameStore } from '../store/gameStore';
import { canDeploy } from '../game/gameEngine';
import { BOARD_SIZE } from '../game/constants';
import type { CardType, Player } from '../game/types';
import { Square } from './Square';

/**
 * 8x8 board. By default White is at the bottom (rank 8 on top). When `flip` is
 * set the board is shown from Black's side (rank 1 on top, files reversed) so an
 * online Black player sees the game from their own perspective. Square drop
 * coordinates always use true file/rank, so flipping is purely presentational.
 */
export function Board({ flip = false }: { flip?: boolean }) {
  const state = useGameStore((s) => s.state);
  const activeDrag = useGameStore((s) => s.activeDrag);
  const pending = useGameStore((s) => s.pending);

  const ghostAt = (file: number, rank: number): { owner: Player; type: CardType } | undefined => {
    for (const player of ['white', 'black'] as Player[]) {
      const p = pending[player];
      if (p && p.file === file && p.rank === rank) {
        const type = state.players[player].hand[p.handIndex];
        if (type) return { owner: player, type };
      }
    }
    return undefined;
  };

  const ranks = Array.from({ length: BOARD_SIZE }, (_, i) => (flip ? i : BOARD_SIZE - 1 - i));
  const files = Array.from({ length: BOARD_SIZE }, (_, i) => (flip ? BOARD_SIZE - 1 - i : i));

  return (
    <div className="board" data-testid="board">
      {ranks.map((rank) => (
        <div className="board-row" key={rank}>
          {files.map((file) => {
            const piece = state.pieces.find((p) => p.file === file && p.rank === rank);
            const isDeployTarget =
              !!activeDrag && canDeploy(state, activeDrag.player, activeDrag.handIndex, file, rank);
            return (
              <Square
                key={`${file}-${rank}`}
                file={file}
                rank={rank}
                piece={piece}
                ghost={piece ? undefined : ghostAt(file, rank)}
                isDeployTarget={isDeployTarget}
                dragging={!!activeDrag}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
