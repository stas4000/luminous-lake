// Canvas-generated textures — the only source of custom looks (WebGPU-safe).
import * as THREE from 'three';
import { ValueNoise } from '../sim/rng.js';

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function rgb(c) {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

// Vertical-gradient sky dome texture (top = zenith, bottom = horizon).
export function createSkyTexture() {
  const { canvas, ctx } = makeCanvas(64, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return {
    texture: tex,
    redraw(zenith, horizon, brightness = 1) {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      const z = zenith.map((v) => Math.min(255, v * brightness));
      const h = horizon.map((v) => Math.min(255, v * brightness));
      // The dome is a sphere centered on the viewer: the geometric horizon
      // is the equator (v = 0.5). Hold the zenith high, then bloom the
      // horizon color right at eye level so sunsets read amber/rose.
      g.addColorStop(0, rgb(z));
      g.addColorStop(0.32, rgb(z));
      g.addColorStop(0.44, rgb(z.map((v, i) => v * 0.45 + h[i] * 0.55)));
      g.addColorStop(0.5, rgb(h));
      g.addColorStop(0.56, rgb(h.map((v) => v * 0.9)));
      g.addColorStop(1, rgb(h.map((v) => v * 0.6)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 512);
      tex.needsUpdate = true;
    }
  };
}

// Equirect environment texture: sky gradient + a warm sun glow blob.
// Assigned straight to scene.environment (both renderers convert equirect).
export function createEnvTexture() {
  const { canvas, ctx } = makeCanvas(256, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return {
    texture: tex,
    redraw(zenith, horizon, sunColor, sunAzimuth, sunElevation) {
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, rgb(zenith));
      g.addColorStop(0.52, rgb(horizon));
      g.addColorStop(0.56, rgb(horizon.map((v) => v * 0.55)));
      g.addColorStop(1, rgb([24, 34, 30])); // ground bounce, dark green-brown
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 128);
      if (sunElevation > -0.12) {
        // equirect: u = azimuth / 2PI (+0.5), v = 0.5 - elevation/PI-ish
        const u = ((sunAzimuth / (2 * Math.PI)) % 1 + 1) % 1;
        const v = Math.max(0.05, Math.min(0.55, 0.5 - sunElevation * 0.45));
        const x = u * 256;
        const y = v * 128;
        const glow = ctx.createRadialGradient(x, y, 1, x, y, 42);
        glow.addColorStop(0, rgb(sunColor));
        glow.addColorStop(0.25, rgb(sunColor.map((c) => c * 0.6)));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 256, 128);
      }
      tex.needsUpdate = true;
    }
  };
}

// Two scrolling noise fields combined into a single normal map, recomputed
// on the CPU so classic materials keep a dual-scroll look on any renderer.
export class DualScrollNormalMap {
  constructor(size = 128, seedA = 101, seedB = 202) {
    this.size = size;
    this.noiseA = new ValueNoise(seedA, 64);
    this.noiseB = new ValueNoise(seedB, 64);
    const { canvas, ctx } = makeCanvas(size, size);
    this.canvas = canvas;
    this.ctx = ctx;
    this.image = ctx.createImageData(size, size);
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.repeat.set(9, 9);
  }

  // height sample from both fields with independent scroll
  _h(x, z, t1, t2) {
    return (
      this.noiseA.sample(x * 0.11 + t1, z * 0.11 + t1 * 0.6) * 0.7 +
      this.noiseB.sample(x * 0.27 - t2 * 0.7, z * 0.27 + t2) * 0.3
    );
  }

  update(time, windSpeed) {
    const s = this.size;
    const t1 = time * (0.9 + windSpeed * 2.2);
    const t2 = time * (0.6 + windSpeed * 1.4);
    const data = this.image.data;
    const strength = 2.1; // crisp ripple relief — high values glitter into white noise on calm water
    let i = 0;
    for (let z = 0; z < s; z++) {
      for (let x = 0; x < s; x++) {
        const hL = this._h(x - 1, z, t1, t2);
        const hR = this._h(x + 1, z, t1, t2);
        const hD = this._h(x, z - 1, t1, t2);
        const hU = this._h(x, z + 1, t1, t2);
        let nx = (hL - hR) * strength;
        let nz = (hD - hU) * strength;
        const inv = 1 / Math.sqrt(nx * nx + nz * nz + 1);
        nx *= inv;
        nz *= inv;
        data[i] = (nx * 0.5 + 0.5) * 255;
        data[i + 1] = (nz * 0.5 + 0.5) * 255;
        data[i + 2] = inv * 255;
        data[i + 3] = 255;
        i += 4;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.needsUpdate = true;
  }
}

// Soft radial glow sprite (sun, moon, firefly halo).
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 63);
  g.addColorStop(0, inner);
  g.addColorStop(0.3, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Crisp sun core: solid disc with a fast falloff (paired with a soft glow).
export function makeSunCoreTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,252,244,1)');
  g.addColorStop(0.4, 'rgba(255,249,232,1)');
  g.addColorStop(0.5, 'rgba(255,241,212,0.85)');
  g.addColorStop(0.62, 'rgba(255,231,190,0.22)');
  g.addColorStop(1, 'rgba(255,222,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Moon disc with subtle terminator shading.
export function makeMoonTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(52, 52, 4, 64, 64, 60);
  g.addColorStop(0, 'rgba(235,242,255,1)');
  g.addColorStop(0.55, 'rgba(205,218,240,0.95)');
  g.addColorStop(0.72, 'rgba(160,178,215,0.55)');
  g.addColorStop(1, 'rgba(120,140,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Puffy cloud sprite: cluster of soft blobs.
export function makeCloudTexture(rng) {
  const { canvas, ctx } = makeCanvas(256, 128);
  for (let i = 0; i < 26; i++) {
    const x = 30 + rng.float(0, 196);
    const y = 40 + rng.float(0, 50);
    const r = rng.float(20, 46);
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Wide soft ellipse for mist banks.
export function makeMistTexture() {
  const { canvas, ctx } = makeCanvas(256, 64);
  ctx.save();
  ctx.translate(128, 32);
  ctx.scale(1, 0.25); // squash the radial gradient into a horizontal ellipse
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 126);
  g.addColorStop(0, 'rgba(225,235,246,0.30)');
  g.addColorStop(0.55, 'rgba(225,235,246,0.12)');
  g.addColorStop(1, 'rgba(225,235,246,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-128, -256, 256, 512);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
