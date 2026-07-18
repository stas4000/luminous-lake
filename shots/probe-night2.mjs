import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4180');
await page.waitForFunction(() => window.__luminous?.getState, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { const L = window.__luminous; L.setTimeOfDay(0.0); L.setWeather(0.1); L.setCameraMode('orbit'); });
await page.waitForTimeout(2500);
const diag = await page.evaluate(() => {
  const w = window.__luminous.world.water;
  return { cubeEnabled: w.cubeEnabled, hasEnvMap: !!w.mesh.material.envMap, refresh: w.refreshInterval };
});
console.log('water:', JSON.stringify(diag));
// flatten water: no normal map distortion, roughness 0 -> perfect mirror
await page.evaluate(() => {
  const m = window.__luminous.world.water.mesh.material;
  m.normalScale.set(0, 0);
  m.roughness = 0;
});
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/probe-m-night-mirror.png' });
// opaque water (no see-through to sandy bottom)
await page.evaluate(() => {
  const m = window.__luminous.world.water.mesh.material;
  m.transparent = false;
  m.opacity = 1;
  m.needsUpdate = true;
});
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/probe-m-night-opaque.png' });
await browser.close();
console.log('done');
