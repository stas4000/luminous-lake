// Low-poly procedural animal meshes driven by the pure sim modules.
import * as THREE from 'three';
import { Rng } from '../sim/rng.js';
import { clamp01 } from '../sim/controls.js';
import { DeerSim, FoxSim, BirdSim, DuckSim, FishSim, FireflySim } from '../sim/animals.js';
import { waveHeight } from '../sim/waves.js';
import { makeGlowTexture } from './textures.js';

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...opts });
}

// ------------------------------------------------------------------ deer ---
function buildDeer(withAntlers) {
  const g = new THREE.Group();
  const coat = std(0x6f5136);
  const dark = std(0x533b26);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.8, 3, 8), coat);
  body.geometry.rotateZ(Math.PI / 2);
  body.position.y = 0.92;
  body.castShadow = true;
  g.add(body);

  const neckG = new THREE.Group();
  neckG.position.set(0.5, 1.05, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.55, 6), coat);
  neck.position.set(0.08, 0.24, 0);
  neck.rotation.z = -0.35;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.18), dark);
  head.position.set(0.26, 0.52, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), dark);
  snout.position.set(0.46, 0.48, 0);
  const earGeo = new THREE.ConeGeometry(0.05, 0.16, 4);
  const earL = new THREE.Mesh(earGeo, dark);
  earL.position.set(0.16, 0.66, 0.09);
  const earR = new THREE.Mesh(earGeo, dark);
  earR.position.set(0.16, 0.66, -0.09);
  neckG.add(neck, head, snout, earL, earR);
  if (withAntlers) {
    const antlerMat = std(0xd8cbb2);
    for (const side of [-1, 1]) {
      const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4), antlerMat);
      a1.position.set(0.14, 0.82, side * 0.08);
      a1.rotation.z = 0.3;
      a1.rotation.x = side * 0.35;
      const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.24, 4), antlerMat);
      a2.position.set(0.06, 0.92, side * 0.14);
      a2.rotation.z = 0.9;
      a2.rotation.x = side * 0.5;
      neckG.add(a1, a2);
    }
  }
  g.add(neckG);

  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.66, 5);
  legGeo.translate(0, -0.33, 0);
  for (const [lx, lz] of [[0.36, 0.16], [0.36, -0.16], [-0.36, 0.16], [-0.36, -0.16]]) {
    const legG = new THREE.Group();
    legG.position.set(lx, 0.68, lz);
    const leg = new THREE.Mesh(legGeo, dark);
    leg.castShadow = true;
    legG.add(leg);
    g.add(legG);
    legs.push(legG);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), coat);
  tail.position.set(-0.62, 1.02, 0);
  tail.rotation.z = 1.2;
  g.add(tail);
  return { group: g, neckG, legs };
}

// ------------------------------------------------------------------- fox ---
function buildFox() {
  const g = new THREE.Group();
  const coat = std(0xc96a2c);
  const dark = std(0x8a3f16);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 3, 7), coat);
  body.geometry.rotateZ(Math.PI / 2);
  body.position.y = 0.42;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 6), coat);
  head.rotation.z = -Math.PI / 2;
  head.position.set(0.48, 0.52, 0);
  g.add(head);

  const earGeo = new THREE.ConeGeometry(0.045, 0.12, 4);
  const earL = new THREE.Mesh(earGeo, dark);
  earL.position.set(0.36, 0.66, 0.07);
  const earR = new THREE.Mesh(earGeo, dark);
  earR.position.set(0.36, 0.66, -0.07);
  g.add(earL, earR);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 6), coat);
  tail.geometry.translate(0, 0.27, 0);
  tail.position.set(-0.38, 0.42, 0);
  tail.rotation.z = 1.9;
  g.add(tail);

  const legs = [];
  const legGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.34, 5);
  legGeo.translate(0, -0.17, 0);
  for (const [lx, lz] of [[0.22, 0.1], [0.22, -0.1], [-0.22, 0.1], [-0.22, -0.1]]) {
    const legG = new THREE.Group();
    legG.position.set(lx, 0.34, lz);
    legG.add(new THREE.Mesh(legGeo, dark));
    g.add(legG);
    legs.push(legG);
  }
  return { group: g, legs, tail };
}

// ------------------------------------------------------------------ bird ---
function buildBird() {
  const g = new THREE.Group();
  g.scale.setScalar(0.55);
  const feather = std(0x39404e, { side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), feather);
  body.scale.set(1.8, 0.8, 0.8);
  g.add(body);
  const wingGeo = new THREE.PlaneGeometry(0.24, 0.62);
  wingGeo.translate(0, 0.31, 0);
  wingGeo.rotateX(-Math.PI / 2);
  const wingL = new THREE.Mesh(wingGeo, feather);
  wingL.position.set(0, 0.04, 0.08);
  const wingR = new THREE.Mesh(wingGeo, feather);
  wingR.position.set(0, 0.04, -0.08);
  wingR.rotation.y = Math.PI;
  g.add(wingL, wingR);
  return { group: g, wingL, wingR };
}

// ------------------------------------------------------------------ duck ---
function buildDuck() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), std(0x7a5c38));
  body.scale.set(1.35, 0.85, 0.95);
  body.position.y = 0.16;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), std(0x2f5d3a));
  head.position.set(0.26, 0.4, 0);
  g.add(head);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 5), std(0xd8a03c));
  bill.rotation.z = -Math.PI / 2;
  bill.position.set(0.4, 0.38, 0);
  g.add(bill);
  return { group: g };
}

// ------------------------------------------------------------------ fish ---
function buildFish(gold = false) {
  const g = new THREE.Group();
  g.scale.setScalar(2.1); // readable through the transparent surface from orbit
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.07, 0.34, 3, 6),
    gold
      ? std(0xd9a24a, { roughness: 0.35, metalness: 0.05, emissive: 0x4a2c08, emissiveIntensity: 0.75 })
      : std(0xc4dcea, { roughness: 0.32, metalness: 0.08, emissive: 0x1c3842, emissiveIntensity: 0.8 })
  );
  body.geometry.rotateZ(Math.PI / 2);
  g.add(body);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.16, 4),
    gold
      ? std(0xb9822f, { roughness: 0.4, emissive: 0x3a2206, emissiveIntensity: 0.4 })
      : std(0x9fc2d6, { roughness: 0.35, emissive: 0x142c34, emissiveIntensity: 0.4 })
  );
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.26, 0, 0);
  g.add(tail);
  return { group: g };
}

// ------------------------------------------------------------- fireflies ---
const FIREFLY_CAP = 180;

function buildFireflies() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(FIREFLY_CAP * 3);
  const col = new Float32Array(FIREFLY_CAP * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    map: makeGlowTexture('rgba(255,236,170,1)', 'rgba(255,200,90,0.4)'),
    size: 1.6, // big enough to read as warm sparks from the orbit camera
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return { points, pos, col };
}

// --------------------------------------------------------------- splashes ---
function buildSplashPool() {
  const pool = [];
  const group = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 24), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.renderOrder = 3; // above the transparent water surface
    ring.visible = false;
    group.add(ring);
    pool.push({ ring, t: 1 });
  }
  return { group, pool };
}

// =================================================================== view ===
export function createAnimalsView({ heightAt, seed = 909 }) {
  const rng = new Rng(seed);

  const shoreSpot = (rMin, rMax, hMin, hMax) => {
    for (let i = 0; i < 30; i++) {
      const a = rng.float(0, Math.PI * 2);
      const r = rng.float(rMin, rMax);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h > hMin && h < hMax) return { x, z };
    }
    return { x: rMin, z: 0 };
  };

  const group = new THREE.Group();
  group.name = 'animals';

  // Deer
  const deer = [];
  for (let i = 0; i < 4; i++) {
    const sim = new DeerSim(rng, shoreSpot(56, 78, 0.35, 4.5));
    sim.pickWaypoint = () => shoreSpot(56, 82, 0.35, 4.5);
    const view = buildDeer(i % 2 === 0);
    group.add(view.group);
    deer.push({ sim, view });
  }

  // Foxes
  const foxes = [];
  for (let i = 0; i < 3; i++) {
    const sim = new FoxSim(rng, shoreSpot(62, 100, 0.8, 7));
    sim.pickWaypoint = () => shoreSpot(62, 105, 0.8, 7);
    const view = buildFox();
    group.add(view.group);
    foxes.push({ sim, view });
  }

  // Birds
  const birds = [];
  for (let i = 0; i < 16; i++) {
    const sim = new BirdSim(rng, i);
    const view = buildBird();
    group.add(view.group);
    birds.push({ sim, view });
  }

  // Ducks
  const ducks = [];
  for (let i = 0; i < 6; i++) {
    const sim = new DuckSim(rng, i);
    const view = buildDuck();
    group.add(view.group);
    ducks.push({ sim, view });
  }

  // Fish + splashes
  const fish = [];
  for (let i = 0; i < 8; i++) {
    const sim = new FishSim(rng);
    const view = buildFish(i % 2 === 0); // half golden koi among the silver fish
    view.group.visible = false;
    group.add(view.group);
    fish.push({ sim, view });
  }
  const splashes = buildSplashPool();
  group.add(splashes.group);

  // A faint ripple ring tracks each cruising fish so the surface reads alive
  // even between jumps — expanding/contracting softly right above the fish.
  const fishRipples = [];
  for (let i = 0; i < fish.length; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe6f6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 24), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 3; // above the transparent water surface
    ring.visible = false;
    group.add(ring);
    fishRipples.push(ring);
  }

  // Fireflies
  const ffAnchors = [];
  for (let i = 0; i < 30; i++) ffAnchors.push(shoreSpot(52, 82, 0.2, 6));
  const fireflySim = new FireflySim(rng, ffAnchors, FIREFLY_CAP);
  const ffView = buildFireflies();
  group.add(ffView.points);
  const ffBuffer = new Float32Array(FIREFLY_CAP * 4);

  let alertTimer = 14;

  const api = {
    group,
    fireflyPoints: ffView.points,
    update(dt, time, { density, calmness, wind, fireflyVis, fireflyCap }) {
      // Deer
      const deerActive = Math.round(2 + clamp01(density) * 2);
      deer.forEach((d, i) => {
        d.view.group.visible = i < deerActive;
        if (!d.view.group.visible) return;
        d.sim.update(dt);
        const { x, z } = d.sim;
        d.view.group.position.set(x, heightAt(x, z), z);
        d.view.group.rotation.y = -d.sim.heading;
        const swing = Math.min(1, d.sim.speed) * 0.55;
        d.view.legs.forEach((leg, li) => {
          leg.rotation.z = Math.sin(d.sim.legPhase + (li % 2) * Math.PI + (li > 1 ? 0.6 : 0)) * swing;
        });
        d.view.neckG.rotation.z = -d.sim.headDown * 1.05 + d.sim.alertness * 0.18;
      });

      // Periodic startle keeps the herd lively
      alertTimer -= dt;
      if (alertTimer <= 0 && deerActive > 0) {
        alertTimer = 12 + (time % 7);
        deer[Math.floor((time * 7) % deerActive)].sim.disturb();
      }

      // Foxes
      const foxActive = Math.round(1 + clamp01(density) * 2);
      foxes.forEach((f, i) => {
        f.view.group.visible = i < foxActive;
        if (!f.view.group.visible) return;
        f.sim.update(dt);
        const { x, z } = f.sim;
        f.view.group.position.set(x, heightAt(x, z), z);
        f.view.group.rotation.y = -f.sim.heading;
        const swing = Math.min(1, f.sim.speed / 3) * 0.7;
        f.view.legs.forEach((leg, li) => {
          leg.rotation.z = Math.sin(f.sim.legPhase + (li % 2) * Math.PI) * swing;
        });
        f.view.tail.rotation.x = Math.sin(f.sim.tailWag) * 0.25;
      });

      // Birds
      const birdActive = Math.round(8 + clamp01(density) * 8);
      birds.forEach((b, i) => {
        b.view.group.visible = i < birdActive;
        if (!b.view.group.visible) return;
        b.sim.update(dt, time);
        b.view.group.position.set(b.sim.x, b.sim.y, b.sim.z);
        b.view.group.rotation.y = -b.sim.heading;
        const flap = Math.sin(b.sim.flapPhase) * 0.9;
        b.view.wingL.rotation.x = flap;
        b.view.wingR.rotation.x = -flap;
      });

      // Ducks
      const duckActive = Math.round(3 + clamp01(density) * 3);
      ducks.forEach((d, i) => {
        d.view.group.visible = i < duckActive;
        if (!d.view.group.visible) return;
        d.sim.update(dt, time, calmness, wind);
        d.view.group.position.set(d.sim.x, d.sim.y, d.sim.z);
        d.view.group.rotation.y = -d.sim.heading;
      });

      // Fish + splash rings
      const fishActive = Math.round(4 + clamp01(density) * 4);
      fish.forEach((f, i) => {
        // Fish stay visible while swimming — the transparent water shows them
        // gliding under the surface — and arc out of it on jumps.
        f.view.group.visible = i < fishActive;
        const ripple = fishRipples[i];
        if (i < fishActive) {
          f.sim.update(dt);
          if (f.sim.splash) api._spawnSplash(f.sim.splash.x, f.sim.splash.z);
          f.view.group.position.set(f.sim.x, f.sim.y, f.sim.z);
          f.view.group.rotation.y = -f.sim.heading;
          f.view.group.rotation.z = f.sim.state === 'jump' ? Math.cos(f.sim.jumpT * Math.PI) * 0.9 : 0;
          if (f.sim.state === 'swim') {
            const pulse = 0.5 + 0.5 * Math.sin(time * 2.1 + i * 1.7);
            ripple.visible = true;
            ripple.position.set(f.sim.x, waveHeight(f.sim.x, f.sim.z, time, calmness, wind) + 0.05, f.sim.z);
            ripple.scale.setScalar(0.9 + pulse * 1.1);
            ripple.material.opacity = 0.08 + pulse * 0.09;
          } else {
            ripple.visible = false;
          }
        } else {
          ripple.visible = false;
        }
      });
      for (const s of splashes.pool) {
        if (s.t >= 1) continue;
        s.t = Math.min(1, s.t + dt / 0.9);
        const k = s.t;
        s.ring.scale.setScalar(1 + k * 4.5);
        s.ring.material.opacity = 0.65 * (1 - k);
        s.ring.visible = k < 1;
      }

      // Fireflies
      const active = fireflySim.update(dt, time, density * clamp01(fireflyVis), ffBuffer);
      const show = fireflyVis > 0.03 && active > 0;
      ffView.points.visible = show;
      if (show) {
        const cap = Math.min(fireflyCap, FIREFLY_CAP);
        for (let i = 0; i < FIREFLY_CAP; i++) {
          const o = i * 4;
          const on = i < cap ? ffBuffer[o + 3] * fireflyVis : 0;
          ffView.pos[i * 3] = ffBuffer[o];
          ffView.pos[i * 3 + 1] = on > 0 ? ffBuffer[o + 1] : -50;
          ffView.pos[i * 3 + 2] = ffBuffer[o + 2];
          // HDR-ish vertex colors (>1) push a bloom-like glow via additive blending
          ffView.col[i * 3] = on * 1.6;
          ffView.col[i * 3 + 1] = on * 1.3;
          ffView.col[i * 3 + 2] = on * 0.62;
        }
        ffView.points.geometry.attributes.position.needsUpdate = true;
        ffView.points.geometry.attributes.color.needsUpdate = true;
      }
    },

    _spawnSplash(x, z) {
      const s = splashes.pool.find((p) => p.t >= 1);
      if (!s) return;
      s.t = 0;
      s.ring.position.set(x, 0.06, z);
      s.ring.visible = true;
    }
  };
  return api;
}
