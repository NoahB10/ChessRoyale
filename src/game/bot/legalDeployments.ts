import type { Deployment } from './types';
import type { GameState, Player } from '../types';
import { BOARD_SIZE, DEPLOY_RANKS } from '../constants';
import { canDeploy } from '../gameEngine';

/**
 * Every legal placement available to `player` right now: each hand card crossed
 * with every square in that player's deploy zone, filtered by canDeploy. This
 * is the bots' single source of truth for what is allowed — a bot that only
 * ever returns one of these can never cheat (energy, zone, occupancy and
 * game-over are all enforced by canDeploy).
 */
export function legalDeployments(state: GameState, player: Player): Deployment[] {
  if (state.status !== 'playing') return [];
  const hand = state.players[player].hand;
  const ranks = DEPLOY_RANKS[player];
  const out: Deployment[] = [];

  for (let handIndex = 0; handIndex < hand.length; handIndex++) {
    const card = hand[handIndex];
    for (const rank of ranks) {
      for (let file = 0; file < BOARD_SIZE; file++) {
        if (canDeploy(state, player, handIndex, file, rank)) {
          out.push({ handIndex, card, file, rank });
        }
      }
    }
  }
  return out;
}
