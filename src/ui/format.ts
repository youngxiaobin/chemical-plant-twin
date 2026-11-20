import type { AssetReading, AssetStatus } from '../sim/types.ts';
import type { LinkStatus } from '../sim/view.ts';

export function statusText(status: AssetStatus, link: LinkStatus): string {
  if (link === 'stale' || link === 'offline') return '已过期';
  if (status === 'alarm') return '告警';
  if (status === 'warning') return '预警';
  return '正常';
}

export function linkText(link: LinkStatus): string {
  if (link === 'live') return '模拟已连接';
  if (link === 'connecting') return '正在连接';
  if (link === 'reconnecting') return '正在重连';
  if (link === 'stale') return '数据已过期';
  return '链路已断开';
}

export function num(value: number, digits: number): string {
  return value.toFixed(digits);
}

export function trendPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 6) - 3;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function readingOf(assets: Record<string, AssetReading> | undefined, id: string | null): AssetReading | null {
  if (!assets || !id) return null;
  return assets[id] ?? null;
}
