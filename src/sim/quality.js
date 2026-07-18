// Adaptive quality scaler — pure module.
// Tiers: high -> medium -> low. Steps down when rolling FPS stays low,
// steps back up when there is headroom. Hysteresis avoids oscillation.

export const TIERS = [
  {
    name: 'high',
    pixelRatioCap: 2,
    shadows: true,
    fireflyMax: 180,
    rainMax: 900,
    cubeInterval: 2,
    normalMapEvery: 1
  },
  {
    name: 'medium',
    pixelRatioCap: 1.5,
    shadows: true,
    fireflyMax: 120,
    rainMax: 550,
    cubeInterval: 3,
    normalMapEvery: 2
  },
  {
    name: 'low',
    pixelRatioCap: 1,
    shadows: false,
    fireflyMax: 70,
    rainMax: 300,
    cubeInterval: 4,
    normalMapEvery: 3
  }
];

export class QualityScaler {
  constructor({ startTier = 0, downFps = 45, upFps = 55, downHold = 3, upHold = 6 } = {}) {
    this.tierIndex = startTier;
    this.downFps = downFps;
    this.upFps = upFps;
    this.downHold = downHold;
    this.upHold = upHold;
    this._below = 0;
    this._above = 0;
    this._cooldown = 0;
  }

  get tier() {
    return TIERS[this.tierIndex];
  }

  get tierName() {
    return this.tier.name;
  }

  // Feed the rolling average FPS each frame (or tick). dt in seconds.
  update(dt, avgFps) {
    this._cooldown = Math.max(0, this._cooldown - dt);

    if (avgFps < this.downFps) {
      this._below += dt;
      this._above = 0;
    } else if (avgFps > this.upFps) {
      this._above += dt;
      this._below = 0;
    } else {
      this._below = 0;
      this._above = 0;
    }

    if (this._cooldown > 0) return null;

    if (this._below >= this.downHold && this.tierIndex < TIERS.length - 1) {
      this.tierIndex += 1;
      this._below = 0;
      this._cooldown = 4;
      return 'down';
    }
    if (this._above >= this.upHold && this.tierIndex > 0) {
      this.tierIndex -= 1;
      this._above = 0;
      this._cooldown = 4;
      return 'up';
    }
    return null;
  }
}

// Rolling FPS meter (exponential moving average over frame times).
export class FpsMeter {
  constructor(windowSeconds = 1) {
    this.window = windowSeconds;
    this.avg = 60;
  }

  sample(dt) {
    if (dt <= 0) return this.avg;
    const fps = 1 / dt;
    const k = 1 - Math.exp(-dt / this.window);
    this.avg += (fps - this.avg) * k;
    return this.avg;
  }
}
