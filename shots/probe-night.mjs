import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4180');
await page.waitForFunction(() => window.__luminous?.getState, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { const L = window.__luminous; L.setTimeOfDay(0.0); L.setWeather(0.1); L.setCameraMode('orbit'); });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'artifacts/probe-m-night-base.png' });
// hide clouds entirely
await page.evaluate(() => { window.__luminous.scene.getObjectByName('clouds').visible = false; });
await page.waitForTimeout(800);
await page.screenshot({ path: 'artifacts/probe-m-night-noclouds.png' });
await page.evaluate(() => { window.__luminous.scene.getObjectByName('clouds').visible = true; });
// hide mist entirely
await page.evaluate(() => { window.__luminous.scene.getObjectByName('mist').visible = false; });
await page.waitForTimeout(800);
await page.screenshot({ path: 'artifacts/probe-m-night-nomist.png' });
// disable cube reflections
await page.evaluate(() => { const L = window.__luminous; L.world.water.cubeEnabled = false; L.world.water.mesh.material.envMap = null; L.world.water.mesh.material.needsUpdate = true; });
await page.waitForTimeout(800);
await page.screenshot({ path: 'artifacts/probe-m-night-nocube.png' });
await browser.close();
console.log('done');
