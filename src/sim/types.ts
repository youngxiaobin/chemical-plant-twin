export type AssetStatus = 'normal' | 'warning' | 'alarm';
export type FaultMode = 'none' | 'cooling';
export type FloorIndex = 0 | 1 | 2;
export type LaneId = 'L0' | 'L1' | 'L2';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Measure {
  value: number;
  unit: string;
  low: number;
  high: number;
}

export interface AssetReading {
  temperature: Measure;
  pressure: Measure;
  flow: Measure;
  level: Measure;
  status: AssetStatus;
}

export interface TelemetryFrame {
  seq: number;
  timestamp: string;
  simulated: true;
  source: 'local-deterministic-sim';
  disclaimer: string;
  paused: boolean;
  load: number;
  fault: FaultMode;
  stress: number;
  assets: Record<string, AssetReading>;
}

export const DISCLAIMER = '本地确定性模拟示意，非本厂实时数据，不可用于工程决策或现场操作';

export const STALE_MS = 4500;
export const SAMPLE_MS = 1500;

/** Cooling-fault assets. Mapped from the tutorial trio E-301 / T-202 / V-301. */
export const FAULT_ASSETS = ['CW-301', 'T-102', 'V-301'] as const;

export interface SimInput {
  seq: number;
  /** 0..1 plant load. */
  load: number;
  /** 0..1 cooling-fault approach. Advanced only by stepStress. */
  stress: number;
}
