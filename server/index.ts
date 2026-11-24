import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ASSETS, PIPES } from '../src/sim/plant.ts';
import { computeReadings, isFaultMode, stepStress } from '../src/sim/telemetry.ts';
import { DISCLAIMER, SAMPLE_MS, STALE_MS, type FaultMode, type TelemetryFrame } from '../src/sim/types.ts';
import { writeTelemetryEvent } from './sse.ts';

const port = Number(process.env.SIM_PORT ?? 4318);
const host = process.env.SIM_HOST ?? '127.0.0.1';

let seq = 0;
let load = 0.78;
let fault: FaultMode = 'none';
let paused = false;
let stress = 0;

const clients = new Set<ServerResponse>();

function frame(): TelemetryFrame {
  return {
    seq,
    timestamp: new Date().toISOString(),
    simulated: true,
    source: 'local-deterministic-sim',
    disclaimer: DISCLAIMER,
    paused,
    load,
    fault,
    stress,
    assets: computeReadings({ seq, load, stress }),
  };
}

function broadcast(payload = frame()): void {
  for (const client of clients) writeTelemetryEvent(client, payload);
}

function tick(): void {
  if (!paused) {
    seq += 1;
    stress = stepStress(stress, fault === 'cooling');
  }
  broadcast();
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      if (chunks.reduce((sum, item) => sum + item.length, 0) > 20_000) {
        reject(new Error('body too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(raw),
  });
  response.end(raw);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, simulated: true, source: 'local-deterministic-sim' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/schema') {
    sendJson(response, 200, {
      disclaimer: DISCLAIMER,
      sampleMs: SAMPLE_MS,
      staleMs: STALE_MS,
      units: { temperature: '°C', pressure: 'MPa', flow: 'm³/h', level: '%' },
      assets: ASSETS.map((asset) => ({
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        group: asset.group,
        tutorialAnalog: asset.tutorialAnalog,
      })),
      pipes: PIPES.map((pipe) => ({ id: pipe.id, name: pipe.name, from: pipe.from, to: pipe.to })),
      control: 'read-only telemetry. /api/control changes only this local drill, never a field device.',
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/stream') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    clients.add(response);
    response.once('close', () => clients.delete(response));
    response.write(`retry: ${SAMPLE_MS}\n\n`);
    writeTelemetryEvent(response, frame());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/control') {
    let body: unknown;
    try {
      const raw = await readBody(request);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      if (!response.destroyed) sendJson(response, 400, { error: 'invalid json' });
      return;
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      sendJson(response, 400, { error: 'control body must be an object' });
      return;
    }
    const {
      reset,
      load: nextLoad,
      fault: nextFault,
      paused: nextPaused,
    } = body as Record<string, unknown>;
    if (reset !== undefined && typeof reset !== 'boolean') {
      sendJson(response, 400, { error: 'reset must be boolean' });
      return;
    }
    if (nextLoad !== undefined && (typeof nextLoad !== 'number' || !Number.isFinite(nextLoad))) {
      sendJson(response, 400, { error: 'load must be a finite number from 0 to 1' });
      return;
    }
    if (nextFault !== undefined && !isFaultMode(nextFault)) {
      sendJson(response, 400, { error: 'fault must be none or cooling' });
      return;
    }
    if (nextPaused !== undefined && typeof nextPaused !== 'boolean') {
      sendJson(response, 400, { error: 'paused must be boolean' });
      return;
    }

    if (reset === true) {
      seq = 0;
      load = 0.78;
      fault = 'none';
      paused = false;
      stress = 0;
    }
    if (nextLoad !== undefined) load = Math.min(1, Math.max(0, nextLoad));
    if (nextFault !== undefined) fault = nextFault;
    if (nextPaused !== undefined) paused = nextPaused;
    const payload = frame();
    broadcast(payload);
    sendJson(response, 200, payload);
    return;
  }

  sendJson(response, 404, { error: 'not found' });
});

const timer = setInterval(tick, SAMPLE_MS);
server.listen(port, host, () => {
  const address = server.address();
  const listeningPort = address && typeof address === 'object' ? address.port : port;
  console.log(`[sim] local telemetry http://${host}:${listeningPort}/api/stream every ${SAMPLE_MS}ms`);
});

function shutdown(): void {
  clearInterval(timer);
  for (const client of clients) client.end();
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
