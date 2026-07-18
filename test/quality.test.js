import test from 'node:test';
import assert from 'node:assert/strict';
import { QualityScaler, FpsMeter, TIERS } from '../src/sim/quality.js';
import { clamp01, clamp, densityToCount, damp } from '../src/sim/controls.js';

test('quality scaler steps down after sustained low fps', () => {
  const q = new QualityScaler();
  assert.equal(q.tierName, 'high');
  // below threshold but not long enough
  for (let i = 0; i < 20; i++) q.update(0.1, 40); // 2s
  assert.equal(q.tierName, 'high');
  const action = q.update(1.5, 40); // crosses 3s hold
  assert.equal(action, 'down');
  assert.equal(q.tierName, 'medium');
});

test('quality scaler steps up after sustained high fps', () => {
  const q = new QualityScaler({ startTier: 2 });
  assert.equal(q.tierName, 'low');
  for (let i = 0; i < 70; i++) q.update(0.1, 60); // 7s
  assert.equal(q.tierName, 'medium');
});

test('quality scaler never leaves the tier range', () => {
  const q = new QualityScaler({ downHold: 0.1, upHold: 0.1 });
  for (let i = 0; i < 50; i++) q.update(0.5, 10);
  assert.equal(q.tierName, 'low');
  for (let i = 0; i < 200; i++) q.update(0.5, 120);
  assert.equal(q.tierName, 'high');
  assert.equal(q.tier, TIERS[0]);
});

test('tier props are monotone sane', () => {
  assert.ok(TIERS[0].fireflyMax > TIERS[2].fireflyMax);
  assert.ok(TIERS[0].rainMax > TIERS[2].rainMax);
  assert.ok(TIERS[0].cubeInterval < TIERS[2].cubeInterval);
  assert.equal(TIERS[2].shadows, false);
});

test('fps meter converges to the observed rate', () => {
  const m = new FpsMeter(0.5);
  for (let i = 0; i < 200; i++) m.sample(1 / 30);
  assert.ok(Math.abs(m.avg - 30) < 3);
});

test('slider mapping clamps out-of-range values', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(NaN), 0);
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(densityToCount(0, 2, 10), 2);
  assert.equal(densityToCount(1, 2, 10), 10);
  assert.equal(densityToCount(7, 2, 10), 10);
  assert.equal(densityToCount(0.5, 0, 10), 5);
});

test('damp is framerate independent-ish and moves toward target', () => {
  let a = 0;
  for (let i = 0; i < 60; i++) a = damp(a, 1, 4, 1 / 60);
  assert.ok(a > 0.9);
  let b = 0;
  for (let i = 0; i < 30; i++) b = damp(b, 1, 4, 1 / 30);
  assert.ok(Math.abs(a - b) < 0.05);
});
