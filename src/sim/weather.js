// Weather state machine — pure module.
// States: clear -> cloudy -> rain -> storm. Slider sets target directly;
// optional gentle auto-drift wanders within clear/cloudy when idle.

import { clamp01 } from './controls.js';

export const WEATHER_STATES = ['clear', 'cloudy', 'rain', 'storm'];

export function sliderToState(v) {
  const s = clamp01(v);
  if (s < 0.25) return 'clear';
  if (s < 0.5) return 'cloudy';
  if (s < 0.75) return 'rain';
  return 'storm';
}

export function stateToSlider(state) {
  switch (state) {
    case 'clear': return 0.1;
    case 'cloudy': return 0.37;
    case 'rain': return 0.62;
    case 'storm': return 0.9;
    default: return 0.1;
  }
}

const PROPS = {
  clear: { cloudCover: 0.12, rain: 0, darkness: 0, lightning: false },
  cloudy: { cloudCover: 0.72, rain: 0, darkness: 0.18, lightning: false },
  rain: { cloudCover: 0.92, rain: 0.6, darkness: 0.38, lightning: false },
  storm: { cloudCover: 1, rain: 1, darkness: 0.62, lightning: true }
};

export class WeatherMachine {
  constructor(rng) {
    this.rng = rng;
    this.state = 'clear';
    this.blend = { ...PROPS.clear }; // smoothly-followed live values
    this.autoDrift = true;
    this._driftTimer = 20;
    this._idleTimer = 0;
    this.lightningFlash = 0; // 0..1, decays fast after a strike
    this._lightningTimer = 6;
  }

  setSlider(v) {
    this.state = sliderToState(v);
    this._idleTimer = 45; // pause auto-drift after manual input
  }

  get slider() {
    return stateToSlider(this.state);
  }

  update(dt) {
    // Auto drift: wander between clear and cloudy when user is idle.
    // A manually chosen rain/storm is never overridden by drift.
    if (this.autoDrift && (this.state === 'clear' || this.state === 'cloudy')) {
      this._idleTimer -= dt;
      this._driftTimer -= dt;
      if (this._idleTimer <= 0 && this._driftTimer <= 0) {
        this._driftTimer = this.rng.float(25, 60);
        this.state = this.rng.chance(0.6) ? 'clear' : 'cloudy';
      }
    }

    // Blend live props toward the state target.
    const target = PROPS[this.state];
    const k = 1 - Math.exp(-dt * 0.8);
    for (const key of ['cloudCover', 'rain', 'darkness']) {
      this.blend[key] += (target[key] - this.blend[key]) * k;
    }

    // Flash decays to ~0 in about 110ms (decay first so a fresh strike reads 1).
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 12);
    // Lightning: only during storms.
    if (target.lightning) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningTimer = this.rng.float(3.5, 9);
        this.lightningFlash = 1;
      }
    } else {
      this._lightningTimer = Math.max(this._lightningTimer, 2);
    }
  }

  get rainIntensity() {
    return this.blend.rain;
  }

  get cloudCover() {
    return this.blend.cloudCover;
  }

  get darkness() {
    return this.blend.darkness;
  }
}
