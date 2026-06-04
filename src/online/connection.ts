// Single browser<->room WebSocket. Kept as a module singleton so event handlers
// (drag/drop) can send without threading the socket through React props.
import type { ClientMsg, ServerMsg } from './protocol';

export interface RoomHandlers {
  onMessage: (msg: ServerMsg) => void;
  onClose: () => void;
  onError: () => void;
}

let ws: WebSocket | null = null;

function roomUrl(code: string, speed?: number): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const query = speed != null ? `?speed=${encodeURIComponent(speed)}` : '';
  return `${proto}//${location.host}/api/room/${encodeURIComponent(code)}/ws${query}`;
}

export function connect(code: string, handlers: RoomHandlers, speed?: number): void {
  disconnect();
  const socket = new WebSocket(roomUrl(code, speed));
  ws = socket;
  socket.addEventListener('message', (e) => {
    try {
      handlers.onMessage(JSON.parse(e.data as string) as ServerMsg);
    } catch {
      /* ignore malformed frame */
    }
  });
  socket.addEventListener('close', () => {
    if (ws === socket) ws = null;
    handlers.onClose();
  });
  socket.addEventListener('error', () => handlers.onError());
}

export function disconnect(): void {
  if (ws) {
    try {
      ws.close();
    } catch {
      /* already closing */
    }
    ws = null;
  }
}

function send(msg: ClientMsg): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export function sendDeploy(handIndex: number, file: number, rank: number): void {
  send({ t: 'deploy', handIndex, file, rank });
}

export function sendCycle(): void {
  send({ t: 'cycle' });
}

export function sendRematch(): void {
  send({ t: 'rematch' });
}
