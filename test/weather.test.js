import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherMachine, sliderToState, stateToSlider, WEATHER_STATES } from '../src/sim/weather.js';
import { Rng } from '../src/sim/rng.js';

test('slider maps to the four weather states', () => {
  assert.deepEqual(WEATHER_STATES, ['clear', 'cloudy', 'rain', 'storm']);
  assert.equal(sliderToState(0), 'clear');
  assert.equal(sliderToState(0.24), 'clear');
  assert.equal(sliderToState(0.25), 'cloudy');
  assert.equal(sliderToState(0.49), 'cloudy');
  assert.equal(sliderToState(0.5), 'rain');
  assert.equal(sliderToState(0.74), 'rain');
  assert.equal(sliderToState(0.75), 'storm');
  assert.equal(sliderToState(1), 'storm');
  // clamps out-of-range input
  assert.equal(sliderToState(-3), 'clear');
  assert.equal(sliderToState(42), 'storm');
  assert.equal(sliderToState(NaN), 'clear');
});

test('stateToSlider round-trips into the same state', () => {
  for (const s of WEATHER_STATES) {
    assert.equal(sliderToState(stateToSlider(s)), s);
  }
});

test('manual setSlider pauses auto drift', () => {
  const rng = new Rng(1);
  const w = new WeatherMachine(rng);
  w.setSlider(0.9);
  assert.equal(w.state, 'storm');
  for (let i = 0; i < 200; i++) w.update(0.5); // 100s of sim time
  assert.equal(w.state, 'storm', 'state must not drift while idle timer active');
});

test('auto drift only wanders between clear and cloudy', () => {
  const rng = new Rng(7);
  const w = new WeatherMachine(rng);
  for (let i = 0; i < 4000; i++) {
    w.update(0.5);
    assert.ok(['clear', 'cloudy'].includes(w.state));
  }
});

test('rain intensity follows state smoothly', () => {
  const rng = new Rng(3);
  const w = new WeatherMachine(rng);
  w.setSlider(1); // storm
  assert.equal(w.rainIntensity, 0, 'starts blended at clear');
  for (let i = 0; i < 100; i++) w.update(0.1); // 10s
  assert.ok(w.rainIntensity > 0.9, 'converges to storm rain');
  assert.ok(w.darkness > 0.5);
});

test('lightning only fires during storms and decays fast', () => {
  const rng = new Rng(11);
  const w = new WeatherMachine(rng);
  w.setSlider(0.6); // rain, no lightning
  let flashes = 0;
  for (let i = 0; i < 600; i++) {
    w.update(0.05);
    if (w.lightningFlash > 0.9) flashes++;
  }
  assert.equal(flashes, 0);

  w.setSlider(1); // storm
  let stormFlashes = 0;
  let maxFlash = 0;
  for (let i = 0; i < 1200; i++) {
    w.update(0.05); // 60s
    if (w.lightningFlash > 0.9) stormFlashes++;
    maxFlash = Math.max(maxFlash, w.lightningFlash);
  }
  assert.ok(stormFlashes >= 2, 'storm should produce several strikes per minute');
  assert.ok(maxFlash <= 1);
  // decay: 120ms after a strike the flash is mostly gone
  w.setSlider(0); // leave storm so no new strike interferes
  w.lightningFlash = 1;
  w.update(0.12);
  assert.ok(w.lightningFlash < 0.1);
});
