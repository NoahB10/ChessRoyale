// Core domain types for Chess Royale.

export type Player = 'white' | 'black';

export type PieceType = 'king' | 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen';

/** Cards / deck pieces are every piece type except the king. */
export type CardType = Exclude<PieceType, 'king'>;

export type GameStatus = 'playing' | 'white_wins' | 'black_wins';

export interface Position {
  file: number; // 0..7  -> a..h
  rank: number; // 0..7  -> rank 1..8
}

export interface Piece extends Position {
  id: string;
  type: PieceType;
  owner: Player;
  /** ms timestamp; the piece may take its next action at or after this time. */
  nextActionAt: number;
}

export interface PlayerState {
  energy: number; // 0..ENERGY_MAX (kept as a float, regenerates over time)
  deck: CardType[]; // remaining shuffled cards
  hand: CardType[]; // up to HAND_SIZE cards currently held
}

export interface GameState {
  pieces: Piece[];
  players: Record<Player, PlayerState>;
  status: GameStatus;
  winner: Player | null;
  /** last time energy/loop was advanced (ms). */
  lastTickAt: number;
}

export interface Move {
  from: Position;
  to: Position;
  capture: boolean;
  capturedId?: string;
}
