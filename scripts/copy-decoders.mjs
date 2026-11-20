import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'public', 'decoders', 'basis');
mkdirSync(dest, { recursive: true });
const src = path.join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
cpSync(path.join(src, 'basis_transcoder.js'), path.join(dest, 'basis_transcoder.js'));
cpSync(path.join(src, 'basis_transcoder.wasm'), path.join(dest, 'basis_transcoder.wasm'));
// LICENSE and NOTICE in this directory are Apache-2.0 attribution.
// Do not delete them and do not replace them with the MIT license.
console.log('[twin] copied Basis transcoder into public/decoders/basis');
