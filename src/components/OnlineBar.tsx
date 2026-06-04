import { useState } from 'react';
import { useAppStore } from '../store/appStore';

const STATUS_TEXT: Record<string, string> = {
  connecting: 'Connecting…',
  waiting: 'Waiting for opponent…',
  playing: 'Playing',
  over: 'Game over',
  opponent_left: 'Opponent left',
  error: 'Connection error',
};

export function OnlineBar() {
  const online = useAppStore((s) => s.online);
  const goMenu = useAppStore((s) => s.goMenu);
  const [copied, setCopied] = useState(false);

  if (!online) return null;

  const link = `${location.origin}${location.pathname}#r=${online.code}`;
  const youAre =
    online.side === 'white'
      ? 'White'
      : online.side === 'black'
        ? 'Black'
        : online.side === 'spectator'
          ? 'Spectator'
          : '…';
  const statusText = online.status === 'error' && online.error ? online.error : STATUS_TEXT[online.status];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="online-bar" data-testid="online-bar">
      <span className="online-you">
        You are <b>{youAre}</b>
      </span>
      <span className={`online-status ${online.status}`} data-testid="online-status">
        {statusText}
      </span>
      <span className="online-code">
        Room <b>{online.code}</b>
      </span>
      <button className="btn" data-testid="copy-link" onClick={copyLink}>
        {copied ? '✓ Copied' : 'Copy link'}
      </button>
      <button className="btn" data-testid="leave" onClick={goMenu}>
        ← Leave
      </button>
    </div>
  );
}
