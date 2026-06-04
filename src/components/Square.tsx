import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { Piece } from '../game/types';
import { PIECE_SYMBOL, squareName } from '../game/constants';

interface Props {
  file: number;
  rank: number;
  piece?: Piece;
  isDeployTarget: boolean;
  dragging: boolean;
}

export function Square({ file, rank, piece, isDeployTarget, dragging }: Props) {
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
      })}
    >
      {piece && (
        <span className={clsx('piece', piece.owner)} aria-label={`${piece.owner} ${piece.type}`}>
          {PIECE_SYMBOL[piece.type]}
        </span>
      )}
    </div>
  );
}
