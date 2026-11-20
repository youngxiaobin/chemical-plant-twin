import { ASSET_IDS, ASSETS } from './plant.ts';
import { FAULT_ASSETS, type AssetReading, type AssetStatus, type FaultMode, type SimInput } from './types.ts';

export interface MeasureDraft {
  value: number;
  unit: string;
  low: number;
  high: number;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function wave(seq: number, phase: number, amplitude: number): number {
  return Math.sin(seq / 7 + phase) * amplitude;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function judge(temp: number, tempHigh: number, pressure: number, pressureHigh: number, stress: number, watched: boolean): AssetStatus {
  if (temp >= tempHigh || pressure >= pressureHigh) return 'alarm';
  if (watched && stress >= 0.28) return 'warning';
  if (temp >= tempHigh * 0.92 || pressure >= pressureHigh * 0.92) return 'warning';
  return 'normal';
}

function reading(
  temperature: MeasureDraft,
  pressure: MeasureDraft,
  flow: MeasureDraft,
  level: MeasureDraft,
  stress: number,
  watched: boolean,
): AssetReading {
  return {
    temperature: { ...temperature, value: round(temperature.value, 1) },
    pressure: { ...pressure, value: round(pressure.value, 3) },
    flow: { ...flow, value: round(flow.value, 1) },
    level: { ...level, value: round(level.value, 1) },
    status: judge(temperature.value, temperature.high, pressure.value, pressure.high, stress, watched),
  };
}

/**
 * Deterministic schematic readings. Same seq/load/stress always return the same numbers.
 * This is not a physical or thermodynamic simulation.
 */
export function computeReadings(input: SimInput): Record<string, AssetReading> {
  const load = clamp01(input.load);
  const stress = clamp01(input.stress);
  const seq = input.seq;
  const watched = new Set<string>(FAULT_ASSETS);

  const pumpFlow = 30 + load * 160;
  const columnFlow = 28 + load * 148;
  const stripperFlow = (24 + load * 126) * (1 - 0.22 * stress);
  const coolerFlow = (42 + load * 168) * (1 - 0.62 * stress);
  const refluxFlow = (18 + load * 72) * (1 - 0.28 * stress);
  const productFlow = (14 + load * 58) * (1 - 0.12 * stress);
  const waterFlow = (90 + load * 210) * (1 - 0.35 * stress);

  const t101Temp = 78 + load * 20 + wave(seq, 0.2, 0.7);
  const t102Temp = 76 + load * 14 + stress * 36 + wave(seq, 0.5, 0.6);
  const coolerTemp = 33 + load * 8 + stress * 30 + wave(seq, 1.1, 0.4);
  const drumPressure = 0.12 + load * 0.08 + stress * 0.28 + wave(seq, 0.8, 0.004);

  const assets: Record<string, AssetReading> = {
    'T-101': reading(
      { value: t101Temp, unit: '°C', low: 60, high: 118 },
      { value: 0.18 + load * 0.22 + wave(seq, 0.4, 0.004), unit: 'MPa', low: 0.05, high: 0.62 },
      { value: columnFlow, unit: 'm³/h', low: 0, high: 240 },
      { value: 54 + load * 12 + wave(seq, 1.4, 0.8), unit: '%', low: 15, high: 90 },
      stress,
      false,
    ),
    'T-102': reading(
      { value: t102Temp, unit: '°C', low: 60, high: 108 },
      { value: 0.16 + load * 0.18 + stress * 0.22 + wave(seq, 0.9, 0.004), unit: 'MPa', low: 0.05, high: 0.55 },
      { value: stripperFlow, unit: 'm³/h', low: 0, high: 220 },
      { value: 51 + load * 10 + stress * 6 + wave(seq, 1.6, 0.7), unit: '%', low: 15, high: 90 },
      stress,
      true,
    ),
    'T-103': reading(
      { value: 64 + load * 12 + wave(seq, 0.3, 0.5), unit: '°C', low: 40, high: 100 },
      { value: 0.14 + load * 0.12 + wave(seq, 1.2, 0.003), unit: 'MPa', low: 0.05, high: 0.45 },
      { value: 16 + load * 42, unit: 'm³/h', low: 0, high: 90 },
      { value: 48 + load * 8 + wave(seq, 2, 0.6), unit: '%', low: 10, high: 90 },
      stress,
      false,
    ),
    'T-104': reading(
      { value: 48 + load * 10 + wave(seq, 0.7, 0.4), unit: '°C', low: 20, high: 90 },
      { value: 0.11 + load * 0.06 + wave(seq, 1.8, 0.002), unit: 'MPa', low: 0.05, high: 0.32 },
      { value: 8 + load * 18, unit: 'm³/h', low: 0, high: 50 },
      { value: 36 + load * 6 + wave(seq, 2.2, 0.5), unit: '%', low: 5, high: 85 },
      stress,
      false,
    ),
    'TK-201': reading(
      { value: 26 + load * 7 + wave(seq, 0.1, 0.25), unit: '°C', low: 5, high: 55 },
      { value: 0.105 + load * 0.03 + wave(seq, 0.6, 0.001), unit: 'MPa', low: 0.09, high: 0.22 },
      { value: pumpFlow, unit: 'm³/h', low: 0, high: 260 },
      { value: 78 - load * 16 + wave(seq, 1.1, 0.5), unit: '%', low: 10, high: 95 },
      stress,
      false,
    ),
    'TK-202': reading(
      { value: 34 + load * 8 + stress * 4 + wave(seq, 0.4, 0.3), unit: '°C', low: 10, high: 70 },
      { value: 0.108 + load * 0.035 + wave(seq, 1.3, 0.001), unit: 'MPa', low: 0.09, high: 0.24 },
      { value: productFlow, unit: 'm³/h', low: 0, high: 120 },
      { value: 46 + load * 14 + wave(seq, 1.9, 0.6), unit: '%', low: 10, high: 95 },
      stress,
      false,
    ),
    'E-101': reading(
      { value: 58 + load * 34 + wave(seq, 0.25, 0.6), unit: '°C', low: 30, high: 130 },
      { value: 0.32 + load * 0.4 + wave(seq, 0.5, 0.006), unit: 'MPa', low: 0.1, high: 1.05 },
      { value: pumpFlow, unit: 'm³/h', low: 0, high: 260 },
      { value: 40 + load * 45, unit: '%', low: 0, high: 100 },
      stress,
      false,
    ),
    'V-301': reading(
      { value: 40 + load * 9 + stress * 26 + wave(seq, 0.8, 0.45), unit: '°C', low: 20, high: 72 },
      { value: drumPressure, unit: 'MPa', low: 0.05, high: 0.38 },
      { value: refluxFlow, unit: 'm³/h', low: 0, high: 140 },
      { value: 49 + load * 8 + stress * 7 + wave(seq, 1.5, 0.7), unit: '%', low: 15, high: 90 },
      stress,
      true,
    ),
    'CW-301': reading(
      { value: coolerTemp, unit: '°C', low: 15, high: 58 },
      { value: 0.15 + load * 0.1 + stress * 0.18 + wave(seq, 1.0, 0.003), unit: 'MPa', low: 0.05, high: 0.48 },
      { value: coolerFlow, unit: 'm³/h', low: 0, high: 280 },
      { value: 44 + load * 20 * (1 - 0.45 * stress), unit: '%', low: 0, high: 100 },
      stress,
      true,
    ),
    'CW-302': reading(
      { value: 23 + load * 5 + stress * 3.5 + wave(seq, 0.2, 0.2), unit: '°C', low: 8, high: 42 },
      { value: 0.102 + wave(seq, 0.3, 0.001), unit: 'MPa', low: 0.09, high: 0.16 },
      { value: waterFlow, unit: 'm³/h', low: 0, high: 420 },
      { value: 68 + load * 6 - stress * 4 + wave(seq, 2.1, 0.4), unit: '%', low: 20, high: 96 },
      stress,
      false,
    ),
    'P-401': reading(
      { value: 36 + load * 18 + wave(seq, 0.6, 0.35), unit: '°C', low: 10, high: 85 },
      { value: 0.35 + load * 0.55 + wave(seq, 0.15, 0.006), unit: 'MPa', low: 0.1, high: 1.2 },
      { value: pumpFlow, unit: 'm³/h', low: 0, high: 260 },
      { value: load * 100, unit: '%', low: 0, high: 100 },
      stress,
      false,
    ),
    'PR-401': reading(
      { value: 22 + load * 6 + wave(seq, 0.9, 0.2), unit: '°C', low: -5, high: 60 },
      { value: 0.101, unit: 'MPa', low: 0.09, high: 0.12 },
      { value: 0, unit: 'm³/h', low: 0, high: 1 },
      { value: load * 100, unit: '%', low: 0, high: 100 },
      stress,
      false,
    ),
  };

  for (const id of ASSET_IDS) {
    if (!assets[id]) throw new Error(`missing reading ${id}`);
  }
  for (const id of watched) {
    if (!ASSETS.some((asset) => asset.id === id)) throw new Error(`fault asset missing ${id}`);
  }
  return assets;
}

/** Approach 1 while the cooling drill is on, and 0 after it is cleared. */
export function stepStress(stress: number, fault: boolean): number {
  const target = fault ? 1 : 0;
  return clamp01(stress + (target - stress) * 0.35);
}

export function flowSpeed(flowM3h: number, hold: boolean): number {
  if (hold || flowM3h <= 0.5) return 0;
  return flowM3h / 140;
}

export function isFaultMode(value: unknown): value is FaultMode {
  return value === 'none' || value === 'cooling';
}
