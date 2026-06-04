import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { CardType, Piece, Player } from '../game/types';
import { PIECE_SYMBOL, squareName } from '../game/constants';

interface Props {
  file: number;
  rank: number;
  piece?: Piece;
  /** a held placement waiting for its deploy cooldown (shown faintly). */
  ghost?: { owner: Player; type: CardType };
  isDeployTarget: boolean;
  dragging: boolean;
}

export function Square({ file, rank, piece, ghost, isDeployTarget, dragging }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sq-${file}-${rank}`,
    data: { file, rank },
  });

  const light = (file + rank) % 2 === 1;
  const invalidHover = dragging && isOver && !isDeployTarget;

  return (
    <div
      ref={setNodeRef}
      data-testid="square"
      data-square={squareName(file, rank)}
      className={clsx('square', light ? 'light' : 'dark', {
        'deploy-ok': isDeployTarget,
        'deploy-hover': isDeployTarget && isOver,
        'deploy-bad': invalidHover,
        'has-ghost': !!ghost && !piece,
      })}
    >
      {piece && (
        <span className={clsx('piece', piece.owner)} aria-label={`${piece.owner} ${piece.type}`}>
          {PIECE_SYMBOL[piece.type]}
        </span>
      )}
      {!piece && ghost && (
        <span className={clsx('piece', 'ghost', ghost.owner)} data-testid="ghost">
          {PIECE_SYMBOL[ghost.type]}
        </span>
      )}
    </div>
  );
}
