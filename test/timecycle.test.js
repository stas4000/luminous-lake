import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TimeCycle,
  sunElevation,
  nightFactor,
  starVisibility,
  skyPalette,
  sunLight
} from '../src/sim/timecycle.js';
import { wrapTime } from '../src/sim/controls.js';

test('time wraps across midnight', () => {
  assert.equal(wrapTime(1.25), 0.25);
  assert.equal(wrapTime(-0.1), 0.9);
  assert.equal(wrapTime(0), 0);
  assert.equal(wrapTime(0.999), 0.999);
});

test('sun elevation sign matches day/night', () => {
  assert.ok(sunElevation(0.5) > 0.99, 'noon should be high sun');
  assert.ok(sunElevation(0) < -0.99, 'midnight should be deep negative');
  assert.ok(Math.abs(sunElevation(0.25)) < 1e-9, 'sunrise at horizon');
  assert.ok(Math.abs(sunElevation(0.75)) < 1e-9, 'sunset at horizon');
  assert.ok(sunElevation(0.4) > 0 && sunElevation(0.9) < 0);
});

test('night factor and star visibility are consistent', () => {
  assert.equal(nightFactor(0.5), 0);
  assert.ok(nightFactor(0) > 0.9);
  assert.equal(starVisibility(0.5), 0);
  assert.ok(starVisibility(0) > 0.9);
});

test('sky palette interpolates and stays in byte range', () => {
  for (let i = 0; i <= 100; i++) {
    const p = skyPalette(i / 100);
    for (const key of ['zenith', 'horizon', 'sun']) {
      assert.equal(p[key].length, 3);
      for (const c of p[key]) assert.ok(c >= 0 && c <= 255);
    }
  }
  // dawn horizon is warmer (more red) than noon horizon
  const dawn = skyPalette(0.26);
  const noon = skyPalette(0.5);
  assert.ok(dawn.horizon[0] > noon.horizon[0]);
});

test('sun light switches to moon at night', () => {
  const day = sunLight(0.5);
  assert.equal(day.isMoon, false);
  assert.ok(day.intensity > 1.5);
  const night = sunLight(0);
  assert.equal(night.isMoon, true);
  assert.ok(night.intensity < 1);
  // low sun is warmer than high sun
  const low = sunLight(0.27);
  assert.ok(low.color[2] < day.color[2]);
});

test('TimeCycle advances and wraps', () => {
  const tc = new TimeCycle(0.99);
  tc.speed = 1;
  tc.update(0.05);
  assert.ok(Math.abs(tc.t - 0.04) < 1e-9);
  tc.set(2.3);
  assert.ok(Math.abs(tc.t - 0.3) < 1e-9);
  tc.auto = false;
  const t = tc.t;
  tc.update(10);
  assert.equal(tc.t, t);
});
