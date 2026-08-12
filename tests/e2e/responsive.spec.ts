import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerCurrentQuestion, snapshot, startRun } from './helpers.ts';

const SCREENSHOT_DIR = 'artifacts/screenshots';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 360, height: 640 },
] as const;

/** Minimum comfortable touch target from the design spec. */
const MIN_TOUCH_TARGET = 56;

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1 || document.body.scrollWidth > root.clientWidth + 1;
  });
}

test.describe('bố cục đáp ứng', () => {
  for (const viewport of VIEWPORTS) {
    test(`không tràn ngang ở ${viewport.name} (${String(viewport.width)}x${String(viewport.height)})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });

      expect(await hasHorizontalOverflow(page)).toBe(false);

      await startRun(page, { grade: 1, timeScale: 2 });
      expect(await hasHorizontalOverflow(page)).toBe(false);

      // Lane buttons must stay on screen and stay big enough to tap.
      for (const id of ['btn-left', 'btn-right']) {
        const button = page.getByTestId(id);
        await expect(button).toBeVisible();

        const box = await button.boundingBox();
        expect(box, `${id} has no bounding box`).not.toBeNull();
        if (box === null) continue;

        expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      }

      // The question must be fully rendered, not clipped.
      const question = page.getByTestId('hud-question');
      await expect(question).toBeVisible();
      const clipping = await question.evaluate((element) => ({
        overflowX: element.scrollWidth - element.clientWidth,
        overflowY: element.scrollHeight - element.clientHeight,
        text: element.textContent ?? '',
      }));
      expect(clipping.text.trim().length).toBeGreaterThan(0);
      expect(clipping.overflowX).toBeLessThanOrEqual(1);
      expect(clipping.overflowY).toBeLessThanOrEqual(1);

      const box = await question.boundingBox();
      expect(box).not.toBeNull();
      if (box !== null) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });
  }

  test('chụp ảnh màn hình chơi và kết quả trên mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await startRun(page, { grade: 2, timeScale: 3 });

    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/game-mobile.png` });

    for (let i = 0; i < 12; i += 1) {
      const current = await snapshot(page);
      if (current.phase === 'finished' || current.activeQuestion === null) break;
      await answerCurrentQuestion(page, (question) => question.correctIndex);
    }

    await expect(page.getByTestId('screen-result')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/result-mobile.png` });

    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('đổi kích thước khi đang tạm dừng không làm game lỗi', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await startRun(page, { grade: 3, timeScale: 2 });

    await page.getByTestId('btn-pause').click();
    await expect(page.getByTestId('screen-pause')).toBeVisible();
    const paused = await snapshot(page);

    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);

    const afterResize = await snapshot(page);
    expect(afterResize.phase).toBe('paused');
    expect(afterResize.questionIndex).toBe(paused.questionIndex);
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.getByTestId('btn-resume').click();
    await expect(page.getByTestId('screen-pause')).toBeHidden();
  });

  test('vùng canvas khoá cuộn trang khi chạm', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });

    const touchAction = await page
      .locator('#game-canvas')
      .evaluate((element) => getComputedStyle(element).touchAction);
    expect(touchAction).toBe('none');
  });

  test('mọi nút đều là phần tử button thật và nút biểu tượng có aria-label', async ({ page }) => {
    await page.goto('/');
    await startRun(page, { grade: 1, timeScale: 2 });

    const iconButtons = ['btn-left', 'btn-right', 'btn-pause', 'btn-mute-hud'];
    for (const id of iconButtons) {
      const button = page.getByTestId(id);
      await expect(button).toHaveJSProperty('tagName', 'BUTTON');
      const label = await button.getAttribute('aria-label');
      expect(label, `${id} is missing an aria-label`).toBeTruthy();
    }
  });
});
