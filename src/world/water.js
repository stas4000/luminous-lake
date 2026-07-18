// The hero: transparent reflective lake water.
// MeshPhysicalMaterial (clearcoat + IOR) + CPU vertex waves + dual-scroll canvas
// normal map + CubeCamera live reflections (gracefully disabled if the renderer
// rejects it). Alpha transparency keeps the lakebed, fish, and the boat hull
// visible through the surface on every renderer.
import * as THREE from 'three';
import { waveHeight } from '../sim/waves.js';
import { DualScrollNormalMap } from './textures.js';

const DAY_COLOR = new THREE.Color(0x0e4f5c); // deep alpine teal — a tint, not paint
const NIGHT_COLOR = new THREE.Color(0x04101f); // deep blue-black mirror

export function createWater({ isMobile = false } = {}) {
  const R = 68;
  const SEGS = isMobile ? 112 : 168;
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);

  const normals = new DualScrollNormalMap(isMobile ? 128 : 192);
  normals.texture.repeat.set(8, 8);

  const mat = new THREE.MeshPhysicalMaterial({
    color: DAY_COLOR.clone(),
    roughness: 0.04,
    metalness: 0,
    envMapIntensity: 0.4, // sky reflection is a glaze, not a milky wash — the lakebed stays visible
    normalMap: normals.texture,
    normalScale: new THREE.Vector2(0.5, 0.5),
    transparent: true,
    opacity: 0.26,
    depthWrite: false, // fish / lakebed / boat hull stay visible through the surface
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
    ior: 1.333, // water
    specularIntensity: 1.0,
    fog: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.name = 'water';
  mesh.renderOrder = 2; // after opaque world, before splash rings / wake foam

  // Live reflections: cube camera hovering just above the surface.
  const cubeSize = isMobile ? 128 : 256;
  const cubeRT = new THREE.WebGLCubeRenderTarget(cubeSize, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter
  });
  const cubeCamera = new THREE.CubeCamera(0.5, 420, cubeRT);
  cubeCamera.position.set(0, 0.7, 0);

  const pos = geo.attributes.position;
  const baseXZ = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    baseXZ[i * 2] = pos.getX(i);
    baseXZ[i * 2 + 1] = pos.getZ(i);
  }

  let frame = 0;
  let cubeFailed = false;

  const api = {
    mesh,
    cubeCamera,
    cubeEnabled: true,
    refreshInterval: isMobile ? 4 : 2,
    normalEvery: 1,
    // Objects hidden while the cube camera renders (mist/clouds would
    // otherwise smear big soft blobs across the reflection).
    hiddenFromReflection: [],

    update(time, calmness, wind) {
      // CPU vertex waves (only where the lake actually is — cheap mask).
      for (let i = 0; i < pos.count; i++) {
        const x = baseXZ[i * 2];
        const z = baseXZ[i * 2 + 1];
        pos.setY(i, waveHeight(x, z, time, calmness, wind));
      }
      pos.needsUpdate = true;

      // NOTE: vertex normals intentionally stay flat (up). Recomputing them
      // from the coarse wave grid produces zigzag artifacts in reflections;
      // all ripple detail comes from the scrolling normal map instead.
      frame++;
      if (frame % this.normalEvery === 0) {
        normals.update(time, wind);
      }
    },

    // Called before the main render on the frames the cube map refreshes.
    updateReflection(renderer, scene) {
      if (!this.cubeEnabled || cubeFailed) return;
      if (frame % this.refreshInterval !== 0) return;
      try {
        mesh.visible = false;
        const prevVis = this.hiddenFromReflection.map((o) => o.visible);
        for (const o of this.hiddenFromReflection) o.visible = false;
        cubeCamera.update(renderer, scene);
        mesh.visible = true;
        this.hiddenFromReflection.forEach((o, i) => { o.visible = prevVis[i]; });
        if (mat.envMap !== cubeRT.texture) {
          mat.envMap = cubeRT.texture;
          mat.needsUpdate = true;
        }
      } catch (err) {
        cubeFailed = true;
        mesh.visible = true;
        console.warn('[luminous-lake] cube reflections disabled:', err.message || err);
      }
    },

    // Night: darker base color, calmer env response, and a calmer surface —
    // runs after setCalmLook each frame. The smoother normal field keeps the
    // moon a coherent streak instead of scattering it into grey puffs.
    setNightLook(nf) {
      mat.color.copy(DAY_COLOR).lerp(NIGHT_COLOR, nf);
      mat.envMapIntensity = 0.4 - nf * 0.15; // night floor ~0.25: crisp moon/star mirror
      mat.roughness *= 1 - nf * 0.55;
      mat.normalScale.multiplyScalar(1 - nf * 0.7);
      mat.opacity = Math.min(0.85, mat.opacity * (1 + nf * 0.55)); // night reads darker, less see-through
    },

    setCalmLook(calmness) {
      // Calmer water = sharper mirror and MORE see-through; choppier = milkier.
      const chop = 1 - calmness;
      mat.roughness = 0.03 + chop * 0.11;
      mat.normalScale.setScalar(0.18 + chop * 0.5);
      mat.opacity = 0.16 + chop * 0.24; // glass-calm: clearly see fish/bed; choppy: milkier
    }
  };

  return api;
}
