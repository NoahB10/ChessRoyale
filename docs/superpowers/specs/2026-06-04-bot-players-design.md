# Bot Players — Design

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Add bot players to the existing Chess Royale MVP. Extend the current
architecture; do not rewrite the game.

## Goal

Bots that play by the same rules as humans: they only deploy cards from their
hand onto legal deployment squares via the existing engine. They never move
pieces directly — movement/combat stays in `tick`/`decideAction`.

Game modes (per-side controller): Human vs Human, Human vs Bot, Bot vs Human,
Bot vs Bot. Difficulty levels: Easy, Medium, Hard.

## Constraints (non-negotiable)

- All deployments go through `canDeploy` + `deployCard`. No cheating: no
  unaffordable cards, no illegal squares. `deployCard` returns the same state
  reference when illegal, so routing through it makes cheating structurally
  impossible.
- Bots use only information in the current `GameState`.
- The controller runs on a single `setInterval`, never per React render.
- Reaction delays: Easy 2500–4000ms, Medium 1500–2500ms, Hard 600–1200ms.
- Randomness is injectable (seeded `mulberry32`) so tests are deterministic.
- Default mode stays Human vs Human so the existing 60s soak e2e keeps passing.
- The game screen stays the first (only) screen.

## Architecture

Pure decision functions + a pure scheduler, with a thin React wiring layer.

```
src/game/bot/
  types.ts            Difficulty, BotConfig, ControllerConfig, Deployment, Rng
  rng.ts              mulberry32 seeded RNG + helpers (pick, randRange)
  legalDeployments.ts legalDeployments(state, player) -> Deployment[]
  evaluate.ts         reusable feature scorers + scoreDeployment (hard bot)
  easyBot.ts          chooseDeployment: uniform random over legal moves
  mediumBot.ts        chooseDeployment: defend-when-threatened, else progress
  hardBot.ts          chooseDeployment: argmax over scoreDeployment
  botController.ts    REACTION_DELAYS, chooseForDifficulty, BotScheduler
  bot.test.ts         all required tests (seeded)
```

### Deployment

`type Deployment = { handIndex: number; card: CardType; file: number; rank: number }`

`legalDeployments(state, player)` enumerates handIndex × DEPLOY_RANKS × files,
keeping only those that pass `canDeploy`. Single source of legality.

### evaluate.ts feature scorers

All read-only. To score a placement we build a hypothetical `Piece[]` =
`state.pieces` + the prospective piece, then use the real `movement.ts` rules.

- `ownKing` / `enemyKing`
- `threatsNearKing(state, player, radius)` — enemy non-king pieces close to own king
- `isThreatened` — boolean from the above
- `centerControlScore(file, rank)` — closer to board center scores higher
- `kingPressureScore(file, rank, enemyKing)` — closer to enemy king scores higher
- `canCaptureSoonScore(hypoPieces, newPiece)` — legal capture now (big) else
  proximity to nearest enemy (small)
- `blockPathScore(file, rank, ownKing, threats)` — sits between a threat and own king
- `scoreDeployment(state, player, deployment)` — weighted sum of the above minus
  a cost penalty (so cheaper pieces win ties → "don't waste expensive pieces")

Weights are named constants for transparency/tuning.

### Bot strategies

- **Easy** — `pick(rng, legalDeployments(...))`. No defense/attack reasoning.
- **Medium** — if `isThreatened`, choose the placement maximizing
  defense (block path + nearness to king), preferring cheaper pieces; else
  choose the placement maximizing progress (king pressure + can-capture-soon),
  preferring cheaper pieces. Skips obviously wasteful expensive pieces when a
  cheaper one achieves a comparable position.
- **Hard** — `argmax(scoreDeployment)` over all legal deployments. Faster
  reaction. Ties broken by lower cost, then rng.

All return `Deployment | null` (null when nothing legal/affordable).

### Scheduler

`BotScheduler` is pure (side effects via injected callbacks):

- holds `nextActionAt: Record<Player, number>`
- `step(now, ctx)` where `ctx = { getState, getController(player), isPaused, deploy, rng }`
- For each player: if controller is a bot, not paused, status playing:
  - lazily initialize `nextActionAt[player] = now + randomDelay(difficulty)`
  - when `now >= nextActionAt[player]`: choose via `chooseForDifficulty`; if a
    deployment is found, `deploy(...)`; reschedule with a fresh random delay.
    If none found, reschedule a short retry (energy may regen).

React wiring (in `App.tsx`): one `setInterval(~150ms)` calls
`scheduler.step(Date.now(), ctx)` with `ctx` reading `useGameStore.getState()`.

## Store changes (`gameStore.ts`)

- `controllers: Record<Player, ControllerConfig>` — `{kind:'human'}` |
  `{kind:'bot', difficulty}`. Default both `human`.
- `paused: boolean` (default false).
- `setController(player, config)`, `setPaused(paused)`, `togglePause()`.
- `tick(now)` freezes simulation when `paused` (advances `lastTickAt` only, so
  resume does not burst-simulate).

## UI changes

Compact controls on the existing game screen (no separate menu):

- Per-side selector (Human / Easy / Medium / Hard) for white and black —
  `data-testid="controller-white" | "controller-black"`. Covers all 4 modes.
- "🤖 <difficulty>" badge near each side when bot-controlled.
- Pause/Resume button (`data-testid="pause"`).
- Existing Restart button kept (`data-testid="reset"`).

## Testing

`src/game/bot/bot.test.ts` (vitest, seeded):
1. `legalDeployments` returns only `canDeploy`-valid squares.
2. Easy bot only chooses valid moves (sampled across seeds).
3. Medium bot prefers defending the king when threatened.
4. Hard bot chooses higher-scoring deployments.
5. Bots do not act when the game is over.
6. Bots do not deploy unaffordable cards.
7. Bot-vs-bot runs 30s of simulated game time without crashing (deterministic,
   advancing fake time through `tick` + scheduler).

Existing vitest + e2e suites stay green. Add one short `e2e/bot.spec.ts` for the
bot badge + pause/resume.

## Known limitations

- Heuristic bots, not search-based; "Hard" is one-ply positional scoring, not
  multi-step lookahead.
- Block/capture scoring approximates the engine's step-based movement, so a
  placement scored as "blocking" may be bypassed as pieces shuffle.
- The 30s bot-vs-bot test uses simulated game time, not wall-clock.
```
