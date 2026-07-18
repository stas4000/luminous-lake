import { test, expect } from '@playwright/test';

async function waitForWorld(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__luminous && window.__luminous.getState, null, { timeout: 60_000 });
  // let a few frames render
  await page.waitForTimeout(1200);
}

test.describe('Luminous Lake', () => {
  test('loads without console errors and renders non-uniform pixels', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));
    await waitForWorld(page);

    const canvas = page.locator('canvas#scene');
    await expect(canvas).toBeVisible();

    // A living scene compresses poorly: a rich screenshot is large, and two
    // screenshots at different times of day must differ.
    const shotA = await page.screenshot();
    expect(shotA.length).toBeGreaterThan(40_000);

    await page.evaluate(() => window.__luminous.setTimeOfDay(0.02));
    await page.waitForTimeout(700);
    const shotB = await page.screenshot();
    expect(shotB.equals(shotA)).toBeFalsy();

    // Transparent-water upgrade: surface blends instead of hiding the lake,
    // and the fishing boat is part of the world state.
    const probe = await page.evaluate(() => {
      const w = window.__luminous.world;
      return {
        hasBoat: Boolean(w.boat && w.boat.group),
        waterOpacity: w.water.mesh.material.opacity,
        waterDepthWrite: w.water.mesh.material.depthWrite,
        waterTransparent: w.water.mesh.material.transparent
      };
    });
    expect(probe.hasBoat).toBeTruthy();
    expect(probe.waterTransparent).toBeTruthy();
    expect(probe.waterDepthWrite).toBeFalsy();
    expect(probe.waterOpacity).toBeLessThan(0.9);

    expect(errors).toEqual([]);
  });

  test('time slider changes timeOfDay and the sky', async ({ page }) => {
    await waitForWorld(page);
    const before = await page.evaluate(() => window.__luminous.getState().timeOfDay);
    const skyBefore = await page.screenshot();

    const slider = page.locator('input[data-control="timeOfDay"]');
    await slider.fill('800'); // evening golden hour
    await page.waitForTimeout(700);

    const after = await page.evaluate(() => window.__luminous.getState().timeOfDay);
    expect(after).not.toBeCloseTo(before, 2);
    expect(after).toBeCloseTo(0.8, 2);

    const skyAfter = await page.screenshot();
    expect(skyAfter.equals(skyBefore)).toBeFalsy();
  });

  test('camera buttons switch camera modes', async ({ page }) => {
    await waitForWorld(page);
    for (const mode of ['cinematic', 'shore', 'aerial', 'orbit']) {
      await page.locator(`.cam-btn[data-mode="${mode}"]`).click();
      await expect
        .poll(() => page.evaluate(() => window.__luminous.getState().cameraMode), { timeout: 5_000 })
        .toBe(mode);
    }
  });

  test('storm weather increases rain particle count', async ({ page }) => {
    await waitForWorld(page);
    const clearCount = await page.evaluate(() => window.__luminous.getState().rainCount);

    const slider = page.locator('input[data-control="weather"]');
    await slider.fill('1000');
    // wait for the blend to converge and rain to recycle in
    await expect
      .poll(async () => page.evaluate(() => window.__luminous.getState().rainCount), { timeout: 15_000 })
      .toBeGreaterThan(clearCount + 100);
    const state = await page.evaluate(() => window.__luminous.getState());
    expect(state.weatherState).toBe('storm');
  });

  test('panel collapses and expands via the handle', async ({ page }) => {
    await waitForWorld(page);
    const handle = page.locator('#panel-handle');
    const panel = page.locator('#panel');
    const slider = page.locator('input[data-control="wind"]');

    // Narrow viewports intentionally start collapsed — expand first.
    if (await panel.evaluate((el) => el.classList.contains('collapsed'))) {
      await handle.click();
    }
    // Mobile starts collapsed (scenery-first) — normalize to expanded.
    if (await panel.evaluate((el) => el.classList.contains('collapsed'))) {
      await handle.click();
      await page.waitForTimeout(600);
    }
    await expect(panel).not.toHaveClass(/collapsed/);
    await expect(slider).toBeVisible();
    const yBefore = (await panel.boundingBox()).y;

    await handle.click();
    await expect(panel).toHaveClass(/collapsed/);
    await page.waitForTimeout(600);
    const yCollapsed = (await panel.boundingBox()).y;
    expect(yCollapsed).toBeGreaterThan(yBefore + 100);

    await handle.click();
    await expect(panel).not.toHaveClass(/collapsed/);
    await page.waitForTimeout(600);
    const yExpanded = (await panel.boundingBox()).y;
    expect(yExpanded).toBeLessThan(yCollapsed - 100);
    await expect(slider).toBeVisible();
  });

  test('keyboard keys 1-4 switch camera modes', async ({ page }) => {
    await waitForWorld(page);
    await page.keyboard.press('2');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__luminous.getState().cameraMode)).toBe('cinematic');
    await page.keyboard.press('1');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__luminous.getState().cameraMode)).toBe('orbit');
  });
});
