import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4180');
await page.waitForFunction(() => window.__luminous?.getState, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { const L = window.__luminous; L.setTimeOfDay(0.0); L.setWeather(0.1); L.setCameraMode('orbit'); });
await page.waitForTimeout(2500);

async function shotWith(name, fn) {
  await page.evaluate(fn);
  await page.waitForTimeout(1200); // let the cube map refresh
  await page.screenshot({ path: `artifacts/probe-x-${name}.png` });
  console.log(name);
}

const L = () => window.__luminous;
// hide stars
await shotWith('nostars', () => { window.__luminous.scene.getObjectByName('stars').visible = false; });
// hide moon+halo (sprites near (0,117,-340))
await shotWith('nomoon', () => {
  window.__luminous.scene.traverse((o) => { if (o.isSprite && Math.abs(o.position.x) < 5 && o.position.y > 50) o.visible = false; });
});
// hide animals (fireflies)
await shotWith('noanimals', () => { window.__luminous.scene.getObjectByName('animals').visible = false; });
// hide forest
await shotWith('noforest', () => {
  window.__luminous.scene.traverse((o) => { if (o.name === 'forest' || o.name === 'trees') o.visible = false; });
});
await browser.close();
console.log('done');
