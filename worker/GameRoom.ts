import { DurableObject } from 'cloudflare:workers';
import { DEFAULT_SPEED, GAME_TICK_MS } from '../src/game/constants';
import {
  advanceRoom,
  createRoom,
  cycleRoom,
  queueIntent,
  startGame,
  type RoomState,
} from '../src/online/roomLogic';
import type { ClientMsg, OnlineRole, ServerMsg } from '../src/online/protocol';

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

const SERVER_TICK_MS = GAME_TICK_MS;

interface Attachment {
  role: OnlineRole;
}

/**
 * One Durable Object per room code. It is the authoritative game server: it runs
 * the exact same engine the local game uses (via roomLogic), advances the
 * simulation on an alarm loop, validates deploy intents, and broadcasts state to
 * the connected players over WebSockets (Hibernation API).
 */
export class GameRoom extends DurableObject<Env> {
  private room: RoomState | undefined;
  private lastWall = 0;
  private code = '';

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // In-memory state is rebuilt from storage on wake (after hibernation/eviction).
    ctx.blockConcurrencyWhile(async () => {
      this.room = await ctx.storage.get<RoomState>('room');
      this.code = (await ctx.storage.get<string>('code')) ?? '';
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/\/api\/room\/([^/]+)\/ws$/);
    if (match) {
      this.code = decodeURIComponent(match[1]).toUpperCase();
      await this.ctx.storage.put('code', this.code);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const role = this.assignRole();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role } satisfies Attachment);

    if (!this.room) {
      // The creator (first to connect) defines the game speed via ?speed=.
      const sp = Number(url.searchParams.get('speed'));
      this.room = createRoom(Date.now(), Number.isFinite(sp) && sp > 0 ? sp : DEFAULT_SPEED);
      await this.save();
    }

    this.sendTo(server, { t: 'assigned', side: role, code: this.code });
    this.sendTo(server, {
      t: 'state',
      game: this.room.game,
      phase: this.room.phase,
      pending: this.room.pending,
    });
    this.broadcastPresence();
    this.maybeStart();

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as ClientMsg;
    } catch {
      return;
    }
    if (!this.room) return;
    const role = this.roleOf(ws);

    if (msg.t === 'deploy' && (role === 'white' || role === 'black')) {
      const next = queueIntent(this.room, role, msg.handIndex, msg.file, msg.rank);
      if (next !== this.room) {
        this.room = next;
        void this.save();
        this.broadcastState();
      }
    } else if (msg.t === 'cycle' && (role === 'white' || role === 'black')) {
      const next = cycleRoom(this.room, role);
      if (next !== this.room) {
        this.room = next;
        void this.save();
        this.broadcastState();
      }
    } else if (msg.t === 'rematch') {
      this.room = startGame(Date.now(), this.room.speed);
      this.lastWall = 0;
      void this.save();
      this.broadcastState();
      void this.ctx.storage.setAlarm(Date.now() + SERVER_TICK_MS);
    }
  }

  webSocketClose(ws: WebSocket): void {
    const role = this.roleOf(ws);
    // A player leaving mid-game ends the game for the one who stayed.
    if ((role === 'white' || role === 'black') && this.room?.phase === 'playing') {
      this.room = { ...this.room, phase: 'over' };
      void this.save();
      this.broadcast({ t: 'opponent_left' });
    }
    this.broadcastPresence();
  }

  async alarm(): Promise<void> {
    if (!this.room || this.room.phase !== 'playing' || !this.bothPlayersPresent()) return;
    const now = Date.now();
    const dt = this.lastWall ? now - this.lastWall : SERVER_TICK_MS;
    this.lastWall = now;
    this.room = advanceRoom(this.room, dt);
    await this.save();
    this.broadcastState();
    if (this.room.phase === 'playing') {
      await this.ctx.storage.setAlarm(now + SERVER_TICK_MS);
    }
  }

  // ---- helpers ----

  private sockets(): WebSocket[] {
    return this.ctx.getWebSockets();
  }

  private roleOf(ws: WebSocket): OnlineRole | undefined {
    return (ws.deserializeAttachment() as Attachment | null)?.role;
  }

  private takenRoles(): Set<OnlineRole | undefined> {
    return new Set(this.sockets().map((w) => this.roleOf(w)));
  }

  private assignRole(): OnlineRole {
    const taken = this.takenRoles();
    if (!taken.has('white')) return 'white';
    if (!taken.has('black')) return 'black';
    return 'spectator';
  }

  private bothPlayersPresent(): boolean {
    const taken = this.takenRoles();
    return taken.has('white') && taken.has('black');
  }

  private maybeStart(): void {
    if (this.room?.phase === 'waiting' && this.bothPlayersPresent()) {
      this.room = startGame(Date.now(), this.room.speed);
      this.lastWall = 0;
      void this.save();
      this.broadcastState();
      void this.ctx.storage.setAlarm(Date.now() + SERVER_TICK_MS);
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket closing */
    }
  }

  private broadcast(msg: ServerMsg): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.sockets()) {
      try {
        ws.send(payload);
      } catch {
        /* socket closing */
      }
    }
  }

  private broadcastState(): void {
    if (this.room) {
      this.broadcast({
        t: 'state',
        game: this.room.game,
        phase: this.room.phase,
        pending: this.room.pending,
      });
    }
  }

  private broadcastPresence(): void {
    const taken = this.takenRoles();
    const spectators = this.sockets().filter((w) => this.roleOf(w) === 'spectator').length;
    this.broadcast({
      t: 'presence',
      white: taken.has('white'),
      black: taken.has('black'),
      spectators,
    });
  }

  private async save(): Promise<void> {
    if (this.room) await this.ctx.storage.put('room', this.room);
  }
}
