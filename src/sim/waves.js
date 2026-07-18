// Shared wave field — pure module.
// One deterministic sum-of-sines wave function drives the water mesh,
// duck/boat bobbing, and fish ripples so everything stays in sync.

// calmness 0..1 (1 = mirror flat)
export function waveAmplitude(calmness) {
  const c = calmness < 0 ? 0 : calmness > 1 ? 1 : calmness;
  return 0.58 * (1 - c) + 0.02;
}

// Wind (0..1) increases chop frequency, micro-ripples, and drift speed.
// The long swells travel diagonally while a wind-driven cross-chop breaks the
// surface up so it reads as moving water instead of a flat blue plane.
export function waveHeight(x, z, time, calmness, wind = 0.3) {
  const a = waveAmplitude(calmness);
  const w = 1 + wind * 1.05;
  const t = time * (0.72 + wind * 1.05);
  const swell =
    Math.sin(x * 0.105 * w + t * 1.08) * 0.4 +
    Math.sin(z * 0.138 * w - t * 0.92 + 1.7) * 0.3 +
    Math.sin((x + z) * 0.066 * w + t * 0.56 + 4.2) * 0.2 +
    Math.sin((x * 0.22 - z * 0.185) * w + t * 1.55 + 2.6) * 0.1;
  // Fine wind chop: higher frequency, lower amplitude, fades out on glass-calm water.
  const chop =
    (Math.sin(x * 0.62 * w + z * 0.31 + t * 2.9) * 0.55 +
      Math.sin(z * 0.74 * w - x * 0.28 - t * 3.6 + 0.9) * 0.45) *
    (0.09 + wind * 0.24) *
    (1 - calmness * 0.55);
  return swell * a + chop * a;
}
