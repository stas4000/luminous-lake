// Instanced forest: trunk + merged triple-cone canopy, wind sway on a
// rotating subset of instances so the woods feel alive for ~free.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../sim/rng.js';

const MAX_TREES = 720;
const SWAY_SUBSET = 60;

function buildCanopyGeometry() {
  const c1 = new THREE.ConeGeometry(1.7, 2.6, 7);
  c1.translate(0, 3.1, 0);
  const c2 = new THREE.ConeGeometry(1.3, 2.2, 7);
  c2.translate(0, 4.5, 0);
  const c3 = new THREE.ConeGeometry(0.85, 1.7, 7);
  c3.translate(0, 5.7, 0);
  return mergeGeometries([c1, c2, c3]);
}

export function createForest({ heightAt, seed = 5150 }) {
  const rng = new Rng(seed);

  // Poisson-ish placement: jittered annulus samples with a min-distance grid.
  const placements = [];
  const cell = 3.4;
  const grid = new Map();
  const keyOf = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  let attempts = 0;
  while (placements.length < MAX_TREES && attempts < MAX_TREES * 40) {
    attempts++;
    const angle = rng.float(0, Math.PI * 2);
    // denser far ring: bias radius outward
    const u = rng.float();
    const r = 63 + (175 - 63) * (u < 0.45 ? rng.float(0, 0.45) : rng.float(0.3, 1));
    const x = Math.cos(angle) * r + rng.float(-2, 2);
    const z = Math.sin(angle) * r + rng.float(-2, 2);
    const h = heightAt(x, z);
    if (h < 0.8 || h > 16) continue;
    const k = keyOf(x, z);
    if (grid.has(k)) continue;
    grid.set(k, true);
    placements.push({
      x,
      z,
      y: h - 0.15,
      rotY: rng.float(0, Math.PI * 2),
      scale: rng.float(0.5, 1.75) * (r > 120 ? rng.float(1, 1.35) : 1),
      tint: rng.float()
    });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 2.4, 5);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const canopyGeo = buildCanopyGeometry();
  const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, placements.length);
  trunks.castShadow = true;
  canopies.castShadow = true;
  trunks.receiveShadow = true;
  canopies.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const trunkColor = new THREE.Color();
  const canopyColor = new THREE.Color();
  const deepGreen = new THREE.Color(0x1d4a24);
  const warmGreen = new THREE.Color(0x3d6b2a);
  const blueSpruce = new THREE.Color(0x1c3d33);
  const bark = new THREE.Color(0x4a3524);
  const barkDark = new THREE.Color(0x33241a);

  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rotY, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);

    trunkColor.lerpColors(barkDark, bark, p.tint);
    trunks.setColorAt(i, trunkColor);
    if (p.tint < 0.08) canopyColor.setHex(0x7d6428); // sparse amber accents
    else if (p.tint < 0.4) canopyColor.lerpColors(deepGreen, warmGreen, (p.tint - 0.08) / 0.32);
    else canopyColor.lerpColors(warmGreen, blueSpruce, (p.tint - 0.4) / 0.6);
    canopies.setColorAt(i, canopyColor);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(trunks, canopies);
  group.name = 'forest';

  let swayCursor = 0;
  let swayAmplitude = 0.5;

  const api = {
    group,
    count: placements.length,
    setWind(wind) {
      swayAmplitude = 0.15 + wind * 1.1;
    },
    update(time) {
      // Rotate through the forest, bending SWAY_SUBSET trees per frame.
      for (let n = 0; n < SWAY_SUBSET; n++) {
        const i = (swayCursor + n) % placements.length;
        const p = placements[i];
        const sway = Math.sin(time * 1.3 + p.x * 0.15 + p.z * 0.11) * 0.022 * swayAmplitude;
        const sway2 = Math.cos(time * 0.9 + p.z * 0.2) * 0.014 * swayAmplitude;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(sway, p.rotY, sway2);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        canopies.setMatrixAt(i, dummy.matrix);
      }
      swayCursor = (swayCursor + SWAY_SUBSET) % placements.length;
      trunks.instanceMatrix.needsUpdate = true;
      canopies.instanceMatrix.needsUpdate = true;
    }
  };
  return api;
}
