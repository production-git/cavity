/**
 * T.6 — E2E smoke tests: load structure, rotate, export PNG.
 *
 * Covers the three critical flows required by Phase T exit criteria.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke — load, rotate, export', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the structure to load: atom count label becomes a number
    await expect(page.locator('#s-natoms')).not.toHaveText('—', { timeout: 8_000 });
  });

  // ── T.6a: structure loads ──────────────────────────────────────────────────

  test('loads HKUST-1 structure on startup', async ({ page }) => {
    const natoms = page.locator('#s-natoms');
    const nbonds = page.locator('#s-nbonds');

    // HKUST-1 default structure has atoms and bonds
    const atomText = await natoms.textContent();
    const bondText = await nbonds.textContent();

    expect(Number(atomText)).toBeGreaterThan(0);
    expect(Number(bondText)).toBeGreaterThan(0);
  });

  // ── T.6b: canvas renders ───────────────────────────────────────────────────

  test('canvas is visible and has nonzero dimensions', async ({ page }) => {
    const canvas = page.locator('#mol');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
  });

  // ── T.6c: rotation ────────────────────────────────────────────────────────

  test('rotating the canvas does not crash the app', async ({ page }) => {
    const canvas = page.locator('#mol');
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Drag to rotate
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 40, { steps: 10 });
    await page.mouse.up();

    // App is still functional: atom count unchanged
    const atomText = await page.locator('#s-natoms').textContent();
    expect(Number(atomText)).toBeGreaterThan(0);

    // No error dialog / crash overlay visible
    await expect(page.locator('body')).not.toContainText('Uncaught');
  });

  // ── T.6d: PNG export ──────────────────────────────────────────────────────

  test('PNG export triggers a file download', async ({ page }) => {
    const [ download ] = await Promise.all([
      page.waitForEvent('download', { timeout: 8_000 }),
      page.click('button[onclick="exportPNG()"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });

});
