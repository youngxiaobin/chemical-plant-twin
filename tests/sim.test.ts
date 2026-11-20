import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSET_IDS } from '../src/sim/plant.ts';
import { FAULT_ASSETS } from '../src/sim/types.ts';
import { computeReadings, flowSpeed, stepStress } from '../src/sim/telemetry.ts';

const units = new Set(['°C', 'MPa', 'm³/h', '%']);

test('readings are deterministic and carry units', () => {
  const input = { seq: 4, load: 0.78, stress: 0 };
  const a = computeReadings(input);
  const b = computeReadings(input);
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a).sort(), [...ASSET_IDS].sort());
  for (const id of ASSET_IDS) {
    for (const key of ['temperature', 'pressure', 'flow', 'level'] as const) {
      assert.equal(typeof a[id][key].value, 'number');
      assert.ok(Number.isFinite(a[id][key].value));
      assert.ok(units.has(a[id][key].unit), `${id}.${key} unit`);
      assert.ok(a[id][key].high > a[id][key].low);
    }
    assert.ok(['normal', 'warning', 'alarm'].includes(a[id].status));
  }
});

test('load raises feed flow and column temperature', () => {
  const low = computeReadings({ seq: 3, load: 0.2, stress: 0 });
  const high = computeReadings({ seq: 3, load: 0.9, stress: 0 });
  assert.ok(high['P-401'].flow.value > low['P-401'].flow.value);
  assert.ok(high['E-101'].flow.value > low['E-101'].flow.value);
  assert.ok(high['T-101'].temperature.value > low['T-101'].temperature.value);
  assert.ok(high['T-101'].pressure.value > low['T-101'].pressure.value);
});

test('cooling fault alarms the mapped trio and recovery clears it', () => {
  const healthy = computeReadings({ seq: 6, load: 0.78, stress: 0 });
  const failed = computeReadings({ seq: 6, load: 0.78, stress: 1 });
  for (const id of FAULT_ASSETS) {
    assert.equal(failed[id].status, 'alarm', id);
    assert.equal(healthy[id].status, 'normal', id);
  }
  assert.ok(failed['T-102'].temperature.value - healthy['T-102'].temperature.value > 20);
  assert.ok(failed['CW-301'].temperature.value - healthy['CW-301'].temperature.value > 15);
  assert.ok(failed['V-301'].pressure.value > healthy['V-301'].pressure.value);
  assert.ok(failed['CW-301'].flow.value < healthy['CW-301'].flow.value);
  assert.ok(failed['TK-201'].temperature.value - healthy['TK-201'].temperature.value < 5);

  let stress = 1;
  const temp = failed['T-102'].temperature.value;
  for (let i = 0; i < 8; i += 1) stress = stepStress(stress, false);
  const recovered = computeReadings({ seq: 6, load: 0.78, stress });
  assert.ok(recovered['T-102'].temperature.value < temp);
  assert.equal(recovered['T-102'].status, 'normal');
  assert.equal(recovered['CW-301'].status, 'normal');
  assert.equal(recovered['V-301'].status, 'normal');
  assert.ok(stress < 0.05);
});

test('stress moves toward the drill target', () => {
  let rising = 0;
  for (let i = 0; i < 6; i += 1) {
    const next = stepStress(rising, true);
    assert.ok(next > rising);
    rising = next;
  }
  assert.ok(rising > 0.9);
  const falling = stepStress(rising, false);
  assert.ok(falling < rising);
});

test('held or tiny flow does not keep a full animation speed', () => {
  assert.equal(flowSpeed(180, true), 0);
  assert.equal(flowSpeed(0, false), 0);
  assert.ok(flowSpeed(70, false) > 0);
  assert.ok(flowSpeed(180, false) > flowSpeed(70, false));
});
