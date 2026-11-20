import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webPort = process.env.PORT ?? '4317';
const simPort = process.env.SIM_PORT ?? '4318';
const env = { ...process.env, PORT: webPort, SIM_PORT: simPort };
const mode = process.argv[2] === 'preview' ? 'preview' : 'dev';

const children = [];
let closing = false;

function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (closing) return;
    shutdown(signal ? 0 : (code ?? 1));
  });
}

function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 50);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[twin] web http://127.0.0.1:${webPort}  sim http://127.0.0.1:${simPort}  mode ${mode}`);
start(['--experimental-strip-types', 'server/index.ts']);
start(mode === 'preview' ? ['node_modules/vite/bin/vite.js', 'preview'] : ['node_modules/vite/bin/vite.js']);
