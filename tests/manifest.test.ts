import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ASSET_IDS, PIPES, assetOrigin } from '../src/sim/plant.ts';

test('asset manifest matches stable ids, origins and directed pipes', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/manifest.json', import.meta.url), 'utf8')) as {
    units: string;
    east: string;
    north: string;
    assets: Array<{ id: string; origin: { x: number; y: number; z: number }; tutorialAnalog: string }>;
    pipes: Array<{ id: string; from: string; to: string; flowAsset: string }>;
  };
  assert.equal(manifest.units, 'm');
  assert.equal(manifest.east, '+X');
  assert.equal(manifest.north, '-Z');
  assert.deepEqual(manifest.assets.map((asset) => asset.id), ASSET_IDS);
  for (const asset of manifest.assets) {
    const origin = assetOrigin(asset.id, 0);
    assert.equal(asset.origin.x, Math.round(origin.x * 1000) / 1000);
    assert.equal(asset.origin.y, Math.round(origin.y * 1000) / 1000);
    assert.equal(asset.origin.z, Math.round(origin.z * 1000) / 1000);
    assert.ok(asset.tutorialAnalog.length > 0);
  }
  assert.deepEqual(
    manifest.pipes.map(({ id, from, to, flowAsset }) => [id, from, to, flowAsset]),
    PIPES.map(({ id, from, to, flowAsset }) => [id, from, to, flowAsset]),
  );
});
