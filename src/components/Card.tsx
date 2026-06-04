import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { CardType, Player } from '../game/types';
import { PIECE_COST, PIECE_SYMBOL } from '../game/constants';

interface Props {
  player: Player;
  handIndex: number;
  card: CardType;
  energy: number;
  /** when false, this side is bot-controlled and its cards are not draggable */
  humanControlled?: boolean;
}

export function Card({ player, handIndex, card, energy, humanControlled = true }: Props) {
  const cost = PIECE_COST[card];
  const affordable = energy >= cost;
  const draggable = affordable && humanControlled;

  const { setNodeRef, listeners, attributes, isDragging, transform } = useDraggable({
    id: `card-${player}-${handIndex}`,
    data: { player, handIndex, type: card, cost },
    disabled: !draggable,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx('card', player, { dragging: isDragging, disabled: !draggable })}
      data-testid="card"
      data-card={card}
      {...listeners}
      {...attributes}
    >
      <span className={clsx('card-piece', player)}>{PIECE_SYMBOL[card]}</span>
      <span className="card-cost">{cost}</span>
    </div>
  );
}
