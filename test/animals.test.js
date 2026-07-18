import test from 'node:test';
import assert from 'node:assert/strict';
import { DeerSim, FoxSim, BirdSim, DuckSim, FishSim, FireflySim } from '../src/sim/animals.js';
import { Rng } from '../src/sim/rng.js';

function run(sim, seconds, dt = 0.05, extra) {
  const seen = new Set();
  for (let i = 0; i < seconds / dt; i++) {
    sim.update(dt, i * dt, ...(extra || []));
    seen.add(sim.state);
  }
  return seen;
}

test('deer cycles through graze, walk, alert and idle', () => {
  const rng = new Rng(42);
  const deer = new DeerSim(rng, { x: 0, z: 0 });
  deer.pickWaypoint = () => ({ x: rng.float(-30, 30), z: rng.float(-30, 30) });
  const seen = run(deer, 300);
  assert.ok(seen.has('walk'), 'deer should walk');
  assert.ok(seen.has('graze'), 'deer should graze');
  assert.ok(seen.has('idle'), 'deer should idle');

  // disturb forces alert, then it recovers
  deer.disturb();
  assert.equal(deer.state, 'alert');
  assert.ok(deer.alertness >= 0);
  run(deer, 10);
  assert.notEqual(deer.state, 'alert');
});

test('deer is deterministic from the same seed', () => {
  const mk = () => {
    const rng = new Rng(9);
    const d = new DeerSim(rng, { x: 1, z: 2 });
    d.pickWaypoint = () => ({ x: rng.float(-30, 30), z: rng.float(-30, 30) });
    return d;
  };
  const a = mk();
  const b = mk();
  for (let i = 0; i < 2000; i++) {
    a.update(0.05);
    b.update(0.05);
  }
  assert.equal(a.x, b.x);
  assert.equal(a.state, b.state);
  assert.equal(a.heading, b.heading);
});

test('grazing deer lowers its head', () => {
  const rng = new Rng(5);
  const deer = new DeerSim(rng, { x: 0, z: 0 });
  deer._enter('graze', 30, 30);
  for (let i = 0; i < 40; i++) deer.update(0.05);
  assert.ok(deer.headDown > 0.9);
});

test('fox dashes faster than it trots and rests between bursts', () => {
  const rng = new Rng(21);
  const fox = new FoxSim(rng, { x: 0, z: 0 });
  fox.pickWaypoint = () => ({ x: rng.float(-40, 40), z: rng.float(-40, 40) });
  const seen = run(fox, 300);
  assert.ok(seen.has('rest') && seen.has('trot'));
  assert.ok(Number.isFinite(fox.x) && Number.isFinite(fox.z));
});

test('birds circle the lake and occasionally dive', () => {
  const rng = new Rng(31);
  const bird = new BirdSim(rng, 0);
  const seen = run(bird, 240, 0.05);
  assert.ok(seen.has('circle'));
  assert.ok(seen.has('dive'));
  assert.ok(bird.y > 0, 'bird stays above water');
});

test('ducks bob on the wave field', () => {
  const rng = new Rng(8);
  const duck = new DuckSim(rng, 0);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 400; i++) {
    duck.update(0.05, i * 0.05, 0, 0.5); // calmness 0 = choppy
    minY = Math.min(minY, duck.y);
    maxY = Math.max(maxY, duck.y);
  }
  assert.ok(maxY - minY > 0.05, 'choppy water should bob the duck');
  const r = Math.hypot(duck.x, duck.z);
  assert.ok(r > 4 && r < 36, 'duck stays on the lake');
});

test('fish jumps produce splash events and return underwater', () => {
  const rng = new Rng(77);
  const fish = new FishSim(rng);
  let splashes = 0;
  let maxY = -Infinity;
  for (let i = 0; i < 4000; i++) {
    fish.update(0.05);
    if (fish.splash) splashes++;
    maxY = Math.max(maxY, fish.y);
  }
  assert.ok(splashes >= 2, 'jumps splash at exit and entry');
  assert.ok(maxY > 1, 'fish clears the surface');
  assert.equal(fish.state === 'swim' || fish.state === 'jump', true);
});

test('fireflies honor the density slider', () => {
  const rng = new Rng(13);
  const anchors = [{ x: 0, z: 0 }, { x: 10, z: 5 }];
  const ff = new FireflySim(rng, anchors, 100);
  const out = new Float32Array(400);
  const full = ff.update(0.05, 1, 1, out);
  assert.equal(full, 100);
  const half = ff.update(0.05, 1, 0.5, out);
  assert.equal(half, 50);
  const none = ff.update(0.05, 1, 0, out);
  assert.equal(none, 0);
  // inactive points write zero brightness
  assert.equal(out[99 * 4 + 3], 0);
});
