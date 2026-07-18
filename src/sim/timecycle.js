// Time-of-day cycle — pure module.
// t in [0,1): 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.

import { clamp01, lerp, wrapTime } from './controls.js';

export function sunElevation(t) {
  // +1 at noon, -1 at midnight, 0 at sunrise/sunset.
  return Math.sin(2 * Math.PI * (wrapTime(t) - 0.25));
}

export function sunAzimuth(t) {
  // Rises in the east (+x), sets in the west (-x).
  return 2 * Math.PI * (wrapTime(t) - 0.25);
}

// How dark the world is: 0 = full day, 1 = deep night.
export function nightFactor(t) {
  const e = sunElevation(t);
  return clamp01(-e * 2.2 + 0.25);
}

// Star visibility ramps in only deep at night.
export function starVisibility(t) {
  return clamp01((nightFactor(t) - 0.55) / 0.35);
}

// Firefly visibility: strongest at dusk and night, gone by day.
export function fireflyVisibility(t) {
  return clamp01((nightFactor(t) - 0.25) / 0.4);
}

// Dawn boost for mist (peaks shortly after sunrise).
export function dawnFactor(t) {
  const w = wrapTime(t);
  const d = Math.min(Math.abs(w - 0.27), 1 - Math.abs(w - 0.27));
  return clamp01(1 - d / 0.08);
}

// Sky palette keyframes: [t, zenith, horizon, sun tint] as RGB arrays 0-255.
const KEYS = [
  [0.0, [7, 11, 30], [14, 26, 52], [120, 150, 220]],
  [0.2, [16, 28, 58], [48, 52, 88], [150, 140, 190]],
  [0.26, [52, 76, 124], [238, 140, 82], [255, 176, 110]],
  [0.33, [52, 96, 165], [255, 206, 148], [255, 226, 170]],
  [0.5, [42, 106, 205], [168, 220, 255], [255, 246, 224]],
  [0.66, [52, 106, 190], [198, 228, 250], [255, 238, 200]],
  [0.735, [58, 66, 142], [255, 150, 56], [255, 196, 104]],
  [0.79, [46, 38, 102], [214, 92, 120], [248, 146, 118]],
  [0.86, [12, 18, 48], [28, 40, 74], [130, 150, 215]],
  [1.0, [7, 11, 30], [14, 26, 52], [120, 150, 220]]
];

function lerp3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Interpolated sky palette for time t. Returns {zenith, horizon, sun} RGB 0-255.
export function skyPalette(t) {
  const w = wrapTime(t);
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [t0, z0, h0, s0] = KEYS[i];
    const [t1, z1, h1, s1] = KEYS[i + 1];
    if (w >= t0 && w <= t1) {
      const k = t1 === t0 ? 0 : (w - t0) / (t1 - t0);
      return { zenith: lerp3(z0, z1, k), horizon: lerp3(h0, h1, k), sun: lerp3(s0, s1, k) };
    }
  }
  const last = KEYS[KEYS.length - 1];
  return { zenith: last[1], horizon: last[2], sun: last[3] };
}

// Directional sun/moon light description for time t.
export function sunLight(t) {
  const e = sunElevation(t);
  const az = sunAzimuth(t);
  const day = clamp01(e * 3);
  if (e > -0.06) {
    const warm = clamp01(1 - e * 2.4); // low sun = warm
    return {
      isMoon: false,
      elevation: e,
      azimuth: az,
      intensity: lerp(0.15, 1.75, day),
      color: [
        Math.round(lerp(255, 255, 1 - warm)),
        Math.round(lerp(255, 138, warm)),
        Math.round(lerp(235, 72, warm))
      ]
    };
  }
  // Moon: mirrored elevation so it arcs through the night.
  const me = clamp01(-e);
  return {
    isMoon: true,
    elevation: me,
    azimuth: az + Math.PI,
    intensity: lerp(0.08, 0.5, me),
    color: [168, 190, 235]
  };
}

export class TimeCycle {
  constructor(start = 0.35) {
    this.t = wrapTime(start);
    this.speed = 1 / 240; // full day in 4 minutes of real time
    this.auto = true;
  }

  set(t) {
    this.t = wrapTime(t);
  }

  update(dt) {
    if (this.auto) this.t = wrapTime(this.t + dt * this.speed);
  }
}
