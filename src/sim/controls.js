// Slider mapping + clamp helpers — pure module.

export function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v, min, max) {
  if (Number.isNaN(v)) return min;
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Time-of-day value wrapped into [0, 1). Wraps cleanly across midnight.
export function wrapTime(t) {
  const w = t % 1;
  return w < 0 ? w + 1 : w;
}

// Wildlife density slider (0..1) -> active count between min and max.
export function densityToCount(slider, min, max) {
  const s = clamp01(slider);
  return Math.round(min + (max - min) * s);
}

// Exponential smoothing factor that is framerate independent.
export function damp(current, target, lambda, dt) {
  return lerp(target, current, Math.exp(-lambda * dt));
}
