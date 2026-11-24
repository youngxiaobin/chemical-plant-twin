import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { connectTelemetry, type LinkHandle } from '../src/net/client.ts';
import { computeReadings } from '../src/sim/telemetry.ts';
import { DISCLAIMER, STALE_MS, type TelemetryFrame } from '../src/sim/types.ts';
import type { LinkStatus } from '../src/sim/view.ts';

test('退避期间到达过期阈值，重新握手后等待有效帧', (t) => {
  const { clock, streams, latest, status, frames } = setup(t);
  assert.equal(status(), 'connecting');
  latest().handshake();
  assert.equal(status(), 'connecting');
  latest().send(telemetry(1));
  assert.equal(status(), 'live');

  latest().fail();
  for (const delay of [500, 1000, 2000]) {
    clock.tick(delay);
    latest().fail();
  }
  assert.equal(streams.length, 4);
  assert.equal(status(), 'reconnecting');
  clock.tick(STALE_MS - 3500 - 1);
  assert.equal(status(), 'reconnecting');
  clock.tick(1);
  assert.equal(status(), 'stale');
  assert.equal(streams.length, 4);

  clock.tick(7500 - STALE_MS);
  assert.equal(streams.length, 5);
  latest().handshake();
  latest().send({});
  assert.equal(status(), 'stale');
  assert.equal(frames.length, 1);
  latest().send(telemetry(2));
  assert.equal(status(), 'live');
  assert.deepEqual(frames.map((frame) => frame.seq), [1, 2]);
});

test('同序号的暂停心跳续期，无效帧不会续期', (t) => {
  const { clock, latest, status, frames } = setup(t);
  latest().send(telemetry(7, true));
  clock.tick(3000);
  latest().send(telemetry(7, true));
  clock.tick(STALE_MS - 3000);
  assert.equal(status(), 'live');
  assert.deepEqual(frames.map((frame) => frame.seq), [7, 7]);

  latest().sendRaw('{');
  latest().send({
    ...telemetry(7, true),
    assets: { 'T-101': { status: 'normal', temperature: null } },
  });
  clock.tick(2999);
  assert.equal(status(), 'live');
  clock.tick(1);
  assert.equal(status(), 'stale');
  assert.equal(frames.length, 2);
});

test('手动重连取消旧重试，断开和关闭隔离旧连接事件', (t) => {
  const { clock, link, streams, latest, status, frames } = setup(t);
  const original = latest();
  original.send(telemetry(1));
  original.fail();
  link.reconnect();
  const replacement = latest();
  assert.equal(original.closed, true);
  assert.equal(status(), 'reconnecting');
  original.send(telemetry(99));
  original.fail();
  clock.tick(500);
  assert.equal(streams.length, 2);
  assert.equal(frames.length, 1);

  link.disconnect();
  assert.equal(replacement.closed, true);
  replacement.send(telemetry(99));
  replacement.fail();
  clock.tick(STALE_MS + 1000);
  assert.equal(status(), 'offline');
  assert.equal(streams.length, 2);
  assert.equal(frames.length, 1);

  link.reconnect();
  const restored = latest();
  assert.equal(streams.length, 3);
  assert.equal(status(), 'stale');
  restored.handshake();
  assert.equal(status(), 'stale');
  restored.send(telemetry(2));
  assert.equal(status(), 'live');
  link.close();
  assert.equal(restored.closed, true);
  restored.send(telemetry(3));
  restored.fail();
  clock.tick(STALE_MS + 1000);
  assert.equal(status(), 'live');
  assert.equal(streams.length, 3);
  assert.deepEqual(frames.map((frame) => frame.seq), [1, 2]);
});

function setup(t: TestContext) {
  const clock = t.mock.timers;
  clock.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const streams: FakeEventSource[] = [];
  const statuses: LinkStatus[] = [];
  const frames: TelemetryFrame[] = [];
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldSource = Object.getOwnPropertyDescriptor(globalThis, 'EventSource');
  let activeLink: LinkHandle | null = null;

  class FakeEventSource {
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    closed = false;

    constructor(url: string) {
      assert.equal(url, '/api/stream');
      streams.push(this);
    }

    close(): void {
      this.closed = true;
    }

    handshake(): void {
      this.onopen?.();
    }

    fail(): void {
      this.onerror?.();
    }

    send(frame: unknown): void {
      this.sendRaw(JSON.stringify(frame));
    }

    sendRaw(data: string): void {
      this.onmessage?.({ data });
    }
  }

  t.after(() => {
    activeLink?.close();
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (oldSource) Object.defineProperty(globalThis, 'EventSource', oldSource);
    else Reflect.deleteProperty(globalThis, 'EventSource');
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setTimeout, clearTimeout, performance: { now: () => Date.now() } },
  });
  Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: FakeEventSource });

  const link = connectTelemetry({
    onFrame: (frame) => frames.push(frame),
    onStatus: (status) => statuses.push(status),
  });
  activeLink = link;
  return { clock, link, streams, frames, latest: () => streams[streams.length - 1], status: () => statuses.at(-1) };
}

function telemetry(seq: number, paused = false): TelemetryFrame {
  const load = 0.78;
  const stress = 0;
  return {
    seq,
    paused,
    timestamp: new Date().toISOString(),
    simulated: true,
    source: 'local-deterministic-sim',
    disclaimer: DISCLAIMER,
    load,
    stress,
    fault: 'none',
    assets: computeReadings({ seq, load, stress }),
  };
}
