import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSET_IDS, PIPES, anchorWorld, buildWaypoints } from '../src/sim/plant.ts';
import { dist } from '../src/sim/route.ts';

test('ten directed pipes stay on known assets', () => {
  assert.equal(PIPES.length, 10);
  const ids = new Set(PIPES.map((pipe) => pipe.id));
  assert.equal(ids.size, 10);
  for (const pipe of PIPES) {
    assert.ok(ASSET_IDS.includes(pipe.from), pipe.from);
    assert.ok(ASSET_IDS.includes(pipe.to), pipe.to);
    assert.notEqual(pipe.from, pipe.to);
  }
  const forward = PIPES.find((pipe) => pipe.id === 'L05');
  const reflux = PIPES.find((pipe) => pipe.id === 'L07');
  const product = PIPES.find((pipe) => pipe.id === 'L08');
  assert.deepEqual([forward?.from, forward?.to], ['T-102', 'CW-301']);
  assert.deepEqual([reflux?.from, reflux?.to], ['V-301', 'T-102']);
  assert.deepEqual([product?.from, product?.to], ['T-102', 'TK-202']);
  const chain = ['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'L07', 'L08'].map((id) => PIPES.find((pipe) => pipe.id === id));
  assert.deepEqual(chain.map((pipe) => pipe?.from), ['TK-201', 'P-401', 'E-101', 'T-101', 'T-102', 'CW-301', 'V-301', 'T-102']);
  assert.deepEqual(chain.map((pipe) => pipe?.to), ['P-401', 'E-101', 'T-101', 'T-102', 'CW-301', 'V-301', 'T-102', 'TK-202']);
});

test('waypoints keep both endpoints and follow an expanded floor', () => {
  for (const pipe of PIPES) {
    const points = buildWaypoints(pipe.id, 0);
    assert.ok(points.length >= 2, pipe.id);
    const start = anchorWorld(pipe.from, pipe.fromAnchor, 0);
    const end = anchorWorld(pipe.to, pipe.toAnchor, 0);
    assert.ok(dist(points[0], start) < 1e-6, `${pipe.id} start`);
    assert.ok(dist(points[points.length - 1], end) < 1e-6, `${pipe.id} end`);
    for (const point of points) {
      assert.ok(Number.isFinite(point.x + point.y + point.z));
    }
  }

  const collapsed = buildWaypoints('L07', 0);
  const expanded = buildWaypoints('L07', 10);
  assert.ok(Math.abs(expanded[0].y - collapsed[0].y - 20) < 1e-6);
  assert.ok(Math.abs(expanded[expanded.length - 1].y - collapsed[collapsed.length - 1].y) < 1e-6);
  const drum = anchorWorld('V-301', 'inlet', 10);
  const drumHome = anchorWorld('V-301', 'inlet', 0);
  assert.ok(Math.abs(drum.y - drumHome.y - 20) < 1e-6);
});
