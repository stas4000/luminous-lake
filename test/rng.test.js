import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng, mulberry32, ValueNoise } from '../src/sim/rng.js';

test('mulberry32 is deterministic for the same seed', () => {
  const a = mulberry32(1234);
  const b = mulberry32(1234);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('different seeds produce different sequences', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  let same = 0;
  for (let i = 0; i < 50; i++) if (a() === b()) same++;
  assert.ok(same < 5);
});

test('Rng helpers stay in range', () => {
  const rng = new Rng(99);
  for (let i = 0; i < 500; i++) {
    const f = rng.float(3, 7);
    assert.ok(f >= 3 && f < 7);
    const n = rng.int(2, 5);
    assert.ok(n >= 2 && n < 5 && Number.isInteger(n));
    assert.ok([-1, 1].includes(rng.sign()));
  }
});

test('Rng sequences are reproducible from the seed', () => {
  const a = new Rng(777);
  const b = new Rng(777);
  const seqA = Array.from({ length: 20 }, () => a.float());
  const seqB = Array.from({ length: 20 }, () => b.float());
  assert.deepEqual(seqA, seqB);
});

test('ValueNoise is deterministic and tileable', () => {
  const n1 = new ValueNoise(5, 32);
  const n2 = new ValueNoise(5, 32);
  for (let i = 0; i < 50; i++) {
    const x = i * 0.37;
    const z = i * 0.91;
    assert.equal(n1.sample(x, z), n2.sample(x, z));
    // wraps by grid size (float rounding makes this approximate)
    assert.ok(Math.abs(n1.sample(x, z) - n1.sample(x + 32, z)) < 1e-6);
  }
  const v = n1.fbm(3.3, 4.4);
  assert.ok(v >= -1.2 && v <= 1.2);
});
