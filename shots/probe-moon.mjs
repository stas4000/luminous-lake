import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4180');
await page.waitForFunction(() => window.__luminous?.getState, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { const L = window.__luminous; L.setTimeOfDay(0.0); L.setWeather(0.1); L.setCameraMode('orbit'); });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const L = window.__luminous;
  const scene = L.scene;
  const cam = L.world.camera;
  const out = { camPos: cam.position.toArray().map((v) => +v.toFixed(1)), fov: cam.fov, aspect: +cam.aspect.toFixed(2) };
  scene.traverse((o) => {
    if (o.isSprite) {
      const p = o.position.clone().project(cam);
      out[o.material.map?.source?.uuid?.slice(0, 6) || 'sprite'] = {
        pos: o.position.toArray().map((v) => +v.toFixed(0)),
        opacity: +o.material.opacity.toFixed(2),
        scale: +o.scale.x.toFixed(0),
        ndc: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(3)],
        visible: o.visible
      };
    }
  });
  return out;
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'artifacts/probe-moon.png' });
await browser.close();
