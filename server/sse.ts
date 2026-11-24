import type { ServerResponse } from 'node:http';
import type { TelemetryFrame } from '../src/sim/types.ts';

export function writeTelemetryEvent(
  response: Pick<ServerResponse, 'destroyed' | 'writableEnded' | 'writableNeedDrain' | 'write'>,
  payload: TelemetryFrame,
): void {
  // 遥测是实时快照，慢端恢复可写后直接接收下一次广播。
  if (response.destroyed || response.writableEnded || response.writableNeedDrain) return;
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}
