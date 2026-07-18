// Procedural terrain: heightmap ring with a lake bowl, vertex colors.
import * as THREE from 'three';
import { ValueNoise } from '../sim/rng.js';
import { clamp01, lerp } from '../sim/controls.js';

function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function createTerrain(seed = 20260717) {
  const noise = new ValueNoise(seed, 128);

  // World-space height at (x, z). Water level is y = 0.
  function heightAt(x, z) {
    const r = Math.hypot(x, z);
    const hills = noise.fbm(x * 0.012 + 7.3, z * 0.012 + 3.1, 4) * 17 * smoothstep(60, 185, r);
    const detail = noise.fbm(x * 0.05 + 1.7, z * 0.05 + 9.2, 3) * 1.7 * smoothstep(48, 85, r);
    const rim = 2.8 * smoothstep(52, 80, r);
    const bowl = -4.6 * (1 - smoothstep(26, 62, r));
    return hills + detail + rim + bowl;
  }

  const SIZE = 420;
  const SEGS = 140;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const sand = [0.42, 0.37, 0.28];
  const grassA = [0.16, 0.29, 0.12];
  const grassB = [0.09, 0.19, 0.09];
  const forest = [0.06, 0.13, 0.07];
  const rock = [0.42, 0.4, 0.38];
  const bedShallow = [0.52, 0.5, 0.36]; // sunlit sandy shallows, visible through clear water
  const bedDeep = [0.07, 0.18, 0.19];
  const lakebed = bedShallow;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);

    // slope estimate from finite differences
    const e = 1.5;
    const slope = Math.abs(heightAt(x + e, z) - h) + Math.abs(heightAt(x, z + e) - h);

    const patch = noise.fbm(x * 0.03 + 21, z * 0.03 + 5, 3) * 0.5 + 0.5;
    const moor = noise.fbm(x * 0.008 + 40, z * 0.008 + 13, 3) * 0.5 + 0.5; // large clearings
    let c;
    if (h < -0.25) {
      // Depth-graded lakebed: bright sandy shallows fading to a deep teal basin,
      // with a subtle static caustic dappling so the bottom reads through the surface.
      const depth = clamp01((-h - 0.25) / 4.3);
      const caustic = noise.fbm(x * 0.09 + 31, z * 0.09 + 17, 2) * 0.5 + 0.5;
      c = bedShallow.map((v, k) => lerp(v, bedDeep[k], depth));
      c = c.map((v, k) => Math.min(1, v + caustic * (1 - depth) * (k === 1 ? 0.1 : 0.07)));
    } else if (h < 0.7) {
      c = sand.map((v, k) => lerp(v, lakebed[k], clamp01((0.05 - h) * 2)));
    } else if (h < 5.5) {
      const g = grassA.map((v, k) => lerp(v, grassB[k], patch));
      // large-scale value variation: shadowed moors vs open meadow
      const gv = g.map((v) => v * lerp(0.55, 1.0, moor));
      c = sand.map((v, k) => lerp(gv[k], v, clamp01((0.7 - h) / 0.9)));
    } else {
      c = grassB.map((v, k) => lerp(v, forest[k], clamp01((h - 5.5) / 6) * lerp(0.6, 1.2, moor)));
    }
    if (slope > 0.9 || h > 15) {
      const k = clamp01(Math.max(slope - 0.9, (h - 15) * 0.2));
      c = c.map((v, j) => lerp(v, rock[j], Math.min(0.8, k)));
    }
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return { mesh, heightAt };
}
