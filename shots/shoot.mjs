// Visual QA screenshot rig — shoots the production build at several
// times of day / weather / camera modes, desktop + mobile.
// Usage: node shots/shoot.mjs [baseURL] [outDir] [roundName]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:4180';
const outDir = process.argv[3] || 'artifacts';
const round = process.argv[4] || 'round';
mkdirSync(outDir, { recursive: true });

const SCENARIOS = [
  { name: 'morning-clear-orbit', time: 0.36, weather: 0.1, mode: 'orbit' },
  { name: 'goldenhour-clear-shore', time: 0.735, weather: 0.1, mode: 'shore' },
  { name: 'noon-clear-aerial', time: 0.5, weather: 0.1, mode: 'aerial' },
  { name: 'dusk-cinematic', time: 0.79, weather: 0.35, mode: 'cinematic' },
  { name: 'night-clear-orbit', time: 0.0, weather: 0.1, mode: 'orbit' },
  { name: 'day-rain-shore', time: 0.45, weather: 0.9, mode: 'shore' }
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  page.on('pageerror', (e) => console.error(`[pageerror:${vp.name}]`, e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(`[console:${vp.name}]`, m.text());
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__luminous?.getState, null, { timeout: 30_000 });
  await page.waitForTimeout(2500);

  for (const sc of SCENARIOS) {
    // Orbit keeps whatever pose a previous scripted mode left behind —
    // reload so orbit scenarios show the true default (first-visit) view.
    if (sc.mode === 'orbit') {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__luminous?.getState, null, { timeout: 30_000 });
      await page.waitForTimeout(1500);
    }
    await page.evaluate((s) => {
      const L = window.__luminous;
      L.setWeather(0.1);
      L.setTimeOfDay(s.time);
      L.setWeather(s.weather);
      L.setCameraMode(s.mode);
    }, sc);
    await page.waitForTimeout(sc.weather > 0.5 ? 4500 : 2200);
    const file = `${outDir}/${round}-${vp.name}-${sc.name}.png`;
    await page.screenshot({ path: file });
    const state = await page.evaluate(() => window.__luminous.getState());
    console.log(file, JSON.stringify({ tier: state.qualityTier, fps: state.fps, rain: state.rainCount, renderer: state.rendererType }));
  }

  // Mobile: the panel starts collapsed (scenery-first) — also capture one
  // expanded-panel shot to QA the compact/scrollable layout.
  if (vp.name === 'mobile') {
    await page.evaluate(() => {
      const L = window.__luminous;
      L.setWeather(0.1);
      L.setTimeOfDay(0.735);
      L.setCameraMode('shore');
    });
    await page.locator('#panel-handle').click();
    await page.waitForTimeout(2200);
    const file = `${outDir}/${round}-mobile-panel-expanded.png`;
    await page.screenshot({ path: file });
    console.log(file);
  }
  await page.close();
}
await browser.close();
console.log('done');
