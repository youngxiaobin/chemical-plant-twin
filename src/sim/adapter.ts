import type { FaultMode, TelemetryFrame } from './types.ts';

/**
 * Read-only telemetry boundary.
 * A future adapter may replace the local simulator, but it must not send
 * setpoints, start or stop equipment, or claim to be a live plant connection.
 */
export interface TelemetryReadAdapter {
  readonly kind: 'read-only';
  readonly source: string;
  subscribe(listener: (frame: TelemetryFrame) => void): () => void;
}

/**
 * Drill controls for the bundled simulator only.
 * These calls stay on this machine and are not an industrial control path.
 */
export interface LocalDrillControl {
  setLoad(load: number): Promise<void>;
  setFault(fault: FaultMode): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  reset(): Promise<void>;
}
