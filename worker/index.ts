import { GameRoom, type Env } from './GameRoom';

export { GameRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // /api/room/:code/ws  ->  WebSocket upgrade routed to the room's Durable Object
    const room = url.pathname.match(/^\/api\/room\/([^/]+)\/ws$/);
    if (room) {
      const code = decodeURIComponent(room[1]).toUpperCase();
      if (!/^[A-Z0-9]{1,8}$/.test(code)) {
        return new Response('invalid room code', { status: 400 });
      }
      const stub = env.GAME_ROOM.getByName(code);
      return stub.fetch(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('not found', { status: 404 });
    }

    // Everything else is served by the static-assets layer (SPA fallback). The
    // Worker only runs first for /api/* (see assets.run_worker_first), so this is
    // a safety net.
    return env.ASSETS.fetch(request);
  },
};
