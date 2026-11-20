export type WeatherMode = 'clear' | 'rain' | 'storm';
export type FloorFilter = 'all' | 0 | 1 | 2;
export type QualityTier = 'low' | 'medium' | 'high';
export type LinkStatus = 'connecting' | 'live' | 'reconnecting' | 'stale' | 'offline';

export interface WeatherState {
  mode: WeatherMode;
  /** 0..1 visual rain amount. Does not change process readings. */
  rain: number;
  /** 0..1 visual wind. Does not change process readings. */
  wind: number;
  particles: boolean;
  puddles: boolean;
  fog: boolean;
  wet: boolean;
  vane: boolean;
  lightning: boolean;
  night: boolean;
}

export const DEFAULT_WEATHER: WeatherState = {
  mode: 'rain',
  rain: 0.42,
  wind: 0.22,
  particles: true,
  puddles: true,
  fog: true,
  wet: true,
  vane: false,
  lightning: false,
  night: false,
};

export function weatherPreset(mode: WeatherMode, current: WeatherState): WeatherState {
  if (mode === 'clear') {
    return { ...current, mode, rain: 0.02, wind: 0.12, lightning: false };
  }
  if (mode === 'storm') {
    return { ...current, mode, rain: 0.86, wind: 0.7, lightning: true, particles: true, fog: true, wet: true, puddles: true };
  }
  return { ...current, mode, rain: 0.48, wind: 0.28, lightning: false, particles: true };
}
