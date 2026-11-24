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
  let retryTimer: number | undefined;
  let staleTimer: number | undefined;
  let expiresAt: number | null = null;
  let status: LinkStatus | null = null;

  function setStatus(next: LinkStatus): void {
    if (status === next) return;
    status = next;
    options.onStatus(next);
  }

  function reconnectStatus(): LinkStatus {
    return expiresAt !== null && window.performance.now() >= expiresAt ? 'stale' : 'reconnecting';
  }

  function scheduleExpiry(): void {
    window.clearTimeout(staleTimer);
    if (expiresAt === null) return;
    const remaining = Math.max(0, expiresAt - window.performance.now());
    staleTimer = window.setTimeout(() => {
      staleTimer = undefined;
      if (!closed && !manualOffline) setStatus('stale');
    }, Math.ceil(remaining));
  }

  function closeSource(): void {
    const previous = source;
    source = null;
    previous?.close();
  }

  function open(): void {
    if (closed || manualOffline) return;
    closeSource();
    const stream = new EventSource('/api/stream');
    source = stream;
    stream.onmessage = (event) => {
      if (source !== stream) return;
      const frame = parseFrame(event.data);
      if (frame === null) return;
      attempt = 0;
      expiresAt = window.performance.now() + staleMs;
      scheduleExpiry();
      setStatus('live');
      if (source === stream) options.onFrame(frame);
    };
    stream.onerror = () => {
      if (source !== stream) return;
      closeSource();
      const delay = Math.min(8000, 500 * 2 ** attempt);
      attempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        open();
      }, delay);
      setStatus(reconnectStatus());
    };
  }

  setStatus('connecting');
  open();

  return {
    disconnect() {
      if (closed) return;
      manualOffline = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(staleTimer);
      closeSource();
      setStatus('offline');
    },
    reconnect() {
      if (closed) return;
      manualOffline = false;
      attempt = 0;
      window.clearTimeout(retryTimer);
      closeSource();
      scheduleExpiry();
      setStatus(reconnectStatus());
      open();
    },
    close() {
      closed = true;
      window.clearTimeout(staleTimer);
      window.clearTimeout(retryTimer);
      closeSource();
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

function parseFrame(data: string): TelemetryFrame | null {
  try {
    const frame: unknown = JSON.parse(data);
    return isTelemetryFrame(frame) ? frame : null;
  } catch {
    return null;
  }
}

function isTelemetryFrame(frame: unknown): frame is TelemetryFrame {
  return isRecord(frame)
    && Number.isSafeInteger(frame.seq)
    && typeof frame.timestamp === 'string'
    && frame.simulated === true
    && frame.source === 'local-deterministic-sim'
    && typeof frame.disclaimer === 'string'
    && typeof frame.paused === 'boolean'
    && Number.isFinite(frame.load)
    && (frame.fault === 'none' || frame.fault === 'cooling')
    && Number.isFinite(frame.stress)
    && isRecord(frame.assets)
    && Object.values(frame.assets).every(isAssetReading);
}

function isAssetReading(reading: unknown): boolean {
  return isRecord(reading)
    && (reading.status === 'normal' || reading.status === 'warning' || reading.status === 'alarm')
    && [reading.temperature, reading.pressure, reading.flow, reading.level].every(isMeasure);
}

function isMeasure(measure: unknown): boolean {
  return isRecord(measure)
    && Number.isFinite(measure.value)
    && typeof measure.unit === 'string'
    && Number.isFinite(measure.low)
    && Number.isFinite(measure.high);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
