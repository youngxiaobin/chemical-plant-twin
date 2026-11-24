import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeTelemetryEvent } from '../server/sse.ts';
import { DISCLAIMER, type TelemetryFrame } from '../src/sim/types.ts';

test('invalid control requests leave the complete simulator state intact', { timeout: 15_000 }, async (t) => {
  const origin = await startSimulator(t);
  await submitControl(origin, { load: 0.43, fault: 'cooling' });
  const feed = await openFeed(origin);
  t.after(feed.close);
  await feed.next((frame) => frame.seq > 0 && frame.stress > 0);

  const frozen = await submitControl(origin, { paused: true });
  assert.ok(frozen.seq > 0 && frozen.stress > 0);
  assert.equal(frozen.paused, true);
  assert.deepEqual(await feed.next((frame) => frame.paused), frozen);

  const rejectedBodies = [
    '{"load":0.85,"fault":"unsupported"}',
    '{"reset":true,"paused":"yes"}',
    '{"fault":"none","paused":0}',
    '{"reset":"yes","load":0.5}',
    '{"load":1e309}',
    'null',
    '[]',
    '{',
  ];
  for (const body of rejectedBodies) {
    const rejected = await requestControl(origin, body);
    assert.equal(rejected.status, 400, body);
    assert.equal(typeof (await rejected.json()).error, 'string');
    const current = await openFeed(origin);
    try {
      assert.deepEqual(simulatorState(await current.next()), simulatorState(frozen), body);
    } finally {
      await current.close();
    }
  }

  const combined = await submitControl(origin, { reset: true, load: 1.25, fault: 'cooling', paused: true });
  assert.deepEqual(simulatorState(combined), { seq: 0, load: 1, fault: 'cooling', paused: true, stress: 0 });
  assert.deepEqual(await feed.next((frame) => frame.seq === 0), combined);
  const low = await submitControl(origin, { load: -0.1 });
  assert.equal(low.load, 0);
});

test('SSE skips blocked subscribers until they can receive a current snapshot', () => {
  const slow = responseSink(true);
  const fast = responseSink(false);
  const frame: TelemetryFrame = {
    seq: 0,
    timestamp: '2026-01-01T00:00:00.000Z',
    simulated: true,
    source: 'local-deterministic-sim',
    disclaimer: DISCLAIMER,
    paused: false,
    load: 0.78,
    fault: 'none',
    stress: 0,
    assets: {},
  };

  for (const seq of [1, 2, 3]) {
    for (const response of [slow, fast]) writeTelemetryEvent(response, { ...frame, seq });
  }
  assert.deepEqual(slow.samples, [1]);
  assert.deepEqual(fast.samples, [1, 2, 3]);

  slow.writableNeedDrain = false;
  writeTelemetryEvent(slow, { ...frame, seq: 4 });
  assert.deepEqual(slow.samples, [1, 4]);

  slow.writableNeedDrain = false;
  slow.writableEnded = true;
  fast.destroyed = true;
  for (const response of [slow, fast]) writeTelemetryEvent(response, { ...frame, seq: 5 });
  assert.deepEqual(slow.samples, [1, 4]);
  assert.deepEqual(fast.samples, [1, 2, 3]);
});

async function startSimulator(t: TestContext): Promise<string> {
  const entry = fileURLToPath(new URL('../server/index.ts', import.meta.url));
  const child = spawn(process.execPath, ['--experimental-strip-types', entry], {
    env: { ...process.env, SIM_HOST: '127.0.0.1', SIM_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let diagnostic = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { diagnostic += chunk; });
  child.on('error', (error) => { diagnostic += String(error); });
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
  });

  const lines = createInterface({ input: child.stdout, signal: AbortSignal.timeout(5_000) });
  for await (const line of lines) {
    const origin = /\[sim\].* (http:\/\/127\.0\.0\.1:[1-9]\d*)\/api\/stream/.exec(line)?.[1];
    if (origin) return origin;
  }
  throw new Error(`未能启动临时模拟器。${diagnostic}`);
}

function requestControl(origin: string, body: string): Promise<Response> {
  return fetch(`${origin}/api/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(5_000),
  });
}

async function submitControl(origin: string, fields: Record<string, unknown>): Promise<TelemetryFrame> {
  const response = await requestControl(origin, JSON.stringify(fields));
  assert.equal(response.status, 200);
  return response.json() as Promise<TelemetryFrame>;
}

async function openFeed(origin: string) {
  const response = await fetch(`${origin}/api/stream`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200);
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return {
    async next(accept: (frame: TelemetryFrame) => boolean = () => true): Promise<TelemetryFrame> {
      while (true) {
        const separator = buffer.indexOf('\n\n');
        if (separator < 0) {
          const { done, value } = await reader.read();
          assert.equal(done, false, '收到遥测帧前连接已关闭');
          buffer += decoder.decode(value, { stream: true });
          continue;
        }

        const event = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        if (!event.startsWith('data: ')) continue;
        const frame = JSON.parse(event.slice('data: '.length)) as TelemetryFrame;
        if (accept(frame)) return frame;
      }
    },
    close: () => reader.cancel().catch(() => undefined),
  };
}

function simulatorState({ seq, load, fault, paused, stress }: TelemetryFrame) {
  return { seq, load, fault, paused, stress };
}

function responseSink(blockAfterWrite: boolean) {
  const samples: number[] = [];
  return {
    samples,
    writableNeedDrain: false,
    writableEnded: false,
    destroyed: false,
    write(chunk: string) {
      const { seq } = JSON.parse(chunk.slice('data: '.length)) as TelemetryFrame;
      samples.push(seq);
      this.writableNeedDrain = blockAfterWrite;
      return !this.writableNeedDrain;
    },
  };
}
