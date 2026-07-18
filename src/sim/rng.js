// Seeded deterministic RNG (mulberry32) — pure module, no three imports.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
    this._next = mulberry32(this.seed);
  }

  float(min = 0, max = 1) {
    return min + (max - min) * this._next();
  }

  int(min, max) {
    // inclusive min, exclusive max
    return Math.floor(this.float(min, max));
  }

  pick(list) {
    return list[Math.min(list.length - 1, Math.floor(this._next() * list.length))];
  }

  sign() {
    return this._next() < 0.5 ? -1 : 1;
  }

  chance(p) {
    return this._next() < p;
  }
}

// Tileable value-noise sampler built from a seeded permutation grid.
// Used for terrain fBm and water normal fields; deterministic per seed.
export class ValueNoise {
  constructor(seed = 42, size = 64) {
    this.size = size;
    const rng = new Rng(seed);
    this.grid = new Float32Array(size * size);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rng.float();
  }

  _lat(ix, iz) {
    const s = this.size;
    return this.grid[((iz % s + s) % s) * s + ((ix % s + s) % s)];
  }

  // Smooth bilinear sample, coordinates in grid cells (any real, wraps).
  sample(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fz = z - z0;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = this._lat(x0, z0);
    const b = this._lat(x0 + 1, z0);
    const c = this._lat(x0, z0 + 1);
    const d = this._lat(x0 + 1, z0 + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }

  // Fractal Brownian motion, returns roughly [-1, 1].
  fbm(x, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * (this.sample(x * freq, z * freq) * 2 - 1);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
