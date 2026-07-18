// Visual QA capture for the transparent-water upgrade. Not part of the build.
import { chromium, devices } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:4180/';
const OUT = new URL('../artifacts/', import.meta.url).pathname;

const shots = [
  {
    name: 'water-upgrade-desktop-goldenhour-shore.png',
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    state: { timeOfDay: 0.78, weather: 0.1, wind: 0.62, wildlife: 1, calmness: 0.42, mist: 0.25, camera: 'shore' }
  },
  {
    name: 'water-upgrade-desktop-day-orbit-boat.png',
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    state: { timeOfDay: 0.42, weather: 0.1, wind: 0.5, wildlife: 1, calmness: 0.5, mist: 0.2, camera: 'orbit' }
  },
  {
    name: 'water-upgrade-mobile-goldenhour-shore.png',
    context: { ...devices['iPhone 15 Pro Max'] },
    state: { timeOfDay: 0.78, weather: 0.1, wind: 0.62, wildlife: 1, calmness: 0.42, mist: 0.25, camera: 'shore' }
  },
  {
    name: 'water-upgrade-desktop-day-close-fish.png',
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    state: { timeOfDay: 0.45, weather: 0.05, wind: 0.28, wildlife: 1, calmness: 0.72, mist: 0.15, camera: 'orbit', close: true }
  }
];

for (const shot of shots) {
  const browser = await chromium.launch();
  const context = await browser.newContext(shot.context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__luminous && window.__luminous.getState, null, { timeout: 60_000 });
  await page.evaluate((s) => {
    const L = window.__luminous;
    L.setTimeOfDay(s.timeOfDay);
    L.setWeather(s.weather);
    L.setWind(s.wind);
    L.setWildlife(s.wildlife);
    L.setCalmness(s.calmness);
    L.setMist(s.mist);
    L.setCameraMode(s.camera);
    const handle = document.getElementById('panel-handle');
    const panel = document.getElementById('panel');
    if (handle && panel && !panel.classList.contains('collapsed')) handle.click();
    if (s.close) {
      L.world.camera.position.set(7.5, 1.9, 12);
      L.world.director.controls.target.set(0, -0.2, 0);
      L.world.director.controls.update();
    }
  }, shot.state);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: OUT + shot.name });
  const state = await page.evaluate(() => window.__luminous.getState());
  console.log(JSON.stringify({ shot: shot.name, errors, state: { rendererType: state.rendererType, qualityTier: state.qualityTier, fps: state.fps, boat: state.boat } }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
}
