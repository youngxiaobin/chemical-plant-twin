import { STALE_MS, type TelemetryFrame } from '../sim/types.ts';
import type { LinkStatus } from '../sim/view.ts';

export interface LinkHandle {
  disconnect(): void;
  reconnect(): void;
  close(): void;
}

export function connectTelemetry(options: {
  onFrame: (frame: TelemetryFrame) => void;
  onStatus: (status: LinkStatus) => void;
  staleMs?: number;
}): LinkHandle {
  const staleMs = options.staleMs ?? STALE_MS;
  let source: EventSource | null = null;
  let closed = false;
  let manualOffline = false;
  let attempt = 0;
  let retryTimer = 0;
  let lastMessage = 0;

  const staleTimer = window.setInterval(() => {
    if (closed || manualOffline || !source) return;
    if (lastMessage > 0 && Date.now() - lastMessage > staleMs) options.onStatus('stale');
  }, 400);

  function open(): void {
    if (closed || manualOffline) return;
    source?.close();
    source = new EventSource('/api/stream');
    source.onopen = () => {
      attempt = 0;
      lastMessage = Date.now();
      options.onStatus('live');
    };
    source.onmessage = (event) => {
      lastMessage = Date.now();
      options.onStatus('live');
      options.onFrame(JSON.parse(event.data) as TelemetryFrame);
    };
    source.onerror = () => {
      source?.close();
      source = null;
      if (closed || manualOffline) return;
      options.onStatus(lastMessage > 0 && Date.now() - lastMessage > staleMs ? 'stale' : 'reconnecting');
      const delay = Math.min(8000, 500 * 2 ** attempt);
      attempt += 1;
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(open, delay);
    };
  }

  options.onStatus('connecting');
  open();

  return {
    disconnect() {
      manualOffline = true;
      window.clearTimeout(retryTimer);
      source?.close();
      source = null;
      options.onStatus('offline');
    },
    reconnect() {
      manualOffline = false;
      attempt = 0;
      options.onStatus('reconnecting');
      open();
    },
    close() {
      closed = true;
      window.clearInterval(staleTimer);
      window.clearTimeout(retryTimer);
      source?.close();
    },
  };
}

export async function postControl(body: Record<string, unknown>): Promise<TelemetryFrame> {
  const response = await fetch('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `control ${response.status}`);
  }
  return await response.json() as TelemetryFrame;
}
