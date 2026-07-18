import test from 'node:test';
import assert from 'node:assert/strict';
import { createFishingBoat } from '../src/world/boat.js';

test('fishing boat rides the wave field and stays on the lake', () => {
  const boat = createFishingBoat();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 600; i++) {
    boat.update(0.05, i * 0.05, 0, 0.8); // choppy + windy
    minY = Math.min(minY, boat.group.position.y);
    maxY = Math.max(maxY, boat.group.position.y);
  }
  const r = Math.hypot(boat.group.position.x, boat.group.position.z);
  assert.ok(maxY - minY > 0.03, 'boat bobs on waves');
  assert.ok(r > 8 && r < 15, 'boat drifts inside the lake');
  assert.ok(Math.abs(boat.group.rotation.x) <= 0.16);
  assert.ok(Math.abs(boat.group.rotation.z) <= 0.16);
});

test('fishing boat is calm on mirror water', () => {
  const boat = createFishingBoat();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < 400; i++) {
    boat.update(0.05, i * 0.05, 1, 0); // glass calm
    minY = Math.min(minY, boat.group.position.y);
    maxY = Math.max(maxY, boat.group.position.y);
  }
  assert.ok(maxY - minY < 0.12, 'calm water keeps the boat nearly level');
});
