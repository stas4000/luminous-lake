// Rain streaks, mist banks — classic Points/Sprites, recycled around origin.
import * as THREE from 'three';
import { Rng } from '../sim/rng.js';
import { clamp01 } from '../sim/controls.js';
import { makeMistTexture } from './textures.js';

const RAIN_CAP = 900;

// Rain as line-segment streaks: renders identically on every renderer.
export function createRain({ seed = 31 }) {
  const rng = new Rng(seed);
  const pos = new Float32Array(RAIN_CAP * 2 * 3); // 2 verts per streak
  const vel = new Float32Array(RAIN_CAP);
  const head = new Float32Array(RAIN_CAP * 3); // streak head position
  for (let i = 0; i < RAIN_CAP; i++) {
    respawn(head, vel, rng, i, true);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xc3d6ea,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  const points = new THREE.LineSegments(geo, mat);
  points.name = 'rain';
  points.frustumCulled = false;
  points.visible = false;

  function respawn(h, v, r, i, randomY = false) {
    const a = r.float(0, Math.PI * 2);
    const rad = Math.sqrt(r.float()) * 55;
    h[i * 3] = Math.cos(a) * rad;
    h[i * 3 + 1] = randomY ? r.float(0, 40) : r.float(28, 40);
    h[i * 3 + 2] = Math.sin(a) * rad;
    v[i] = r.float(22, 34);
  }

  const api = {
    points,
    activeCount: 0,
    update(dt, intensity, wind, maxCount) {
      const target = Math.min(maxCount, Math.round(RAIN_CAP * clamp01(intensity)));
      this.activeCount = target;
      points.visible = target > 4;
      if (!points.visible) return;
      mat.opacity = 0.22 + intensity * 0.3;
      const slantX = wind * 6;
      const len = 0.02 + intensity * 0.02; // streak length scales with fall speed
      const attr = geo.attributes.position;
      for (let i = 0; i < target; i++) {
        let y = head[i * 3 + 1] - vel[i] * dt;
        let x = head[i * 3] + slantX * dt;
        if (y < 0) {
          respawn(head, vel, rng, i);
          y = head[i * 3 + 1];
          x = head[i * 3];
        } else {
          if (x > 60) x -= 120;
          head[i * 3] = x;
          head[i * 3 + 1] = y;
        }
        const z = head[i * 3 + 2];
        const vy = vel[i];
        const o = i * 6;
        pos[o] = x;
        pos[o + 1] = y;
        pos[o + 2] = z;
        // tail trails along the fall direction (slanted by wind)
        pos[o + 3] = x - slantX * len;
        pos[o + 4] = y + vy * len;
        pos[o + 5] = z;
      }
      // park unused drops far below
      for (let i = target; i < RAIN_CAP; i++) {
        const o = i * 6;
        pos[o + 1] = -100;
        pos[o + 4] = -100;
      }
      attr.needsUpdate = true;
    }
  };
  return api;
}

export function createMist({ seed = 87 }) {
  const rng = new Rng(seed);
  const tex = makeMistTexture();
  const group = new THREE.Group();
  group.name = 'mist';
  const banks = [];
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const angle = rng.float(0, Math.PI * 2);
    const radius = rng.float(6, 52);
    s.position.set(Math.cos(angle) * radius, rng.float(0.35, 1.1), Math.sin(angle) * radius);
    const w = rng.float(10, 22);
    s.scale.set(w, w * 0.22, 1);
    s.userData = { drift: rng.float(0.2, 0.7), phase: rng.float(0, Math.PI * 2) };
    group.add(s);
    banks.push(s);
  }
  const api = {
    group,
    update(dt, time, mistLevel, cameraPos) {
      const vis = clamp01(mistLevel);
      group.visible = vis > 0.02;
      if (!group.visible) return;
      for (const s of banks) {
        s.position.x += Math.cos(s.userData.phase) * s.userData.drift * dt;
        s.position.z += Math.sin(s.userData.phase) * s.userData.drift * dt;
        s.userData.phase += dt * 0.05;
        const r = Math.hypot(s.position.x, s.position.z);
        if (r > 58) {
          s.position.x *= -0.9;
          s.position.z *= -0.9;
        }
        // fade banks that drift too close to the camera (no giant blobs)
        let near = 1;
        if (cameraPos) {
          const d = Math.hypot(s.position.x - cameraPos.x, s.position.z - cameraPos.z);
          near = clamp01((d - 7) / 12);
        }
        s.material.opacity =
          vis * near * (0.11 + 0.07 * Math.sin(time * 0.3 + s.userData.phase * 4));
      }
    }
  };
  return api;
}
