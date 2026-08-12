import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { MAP_IDS } from '../../shared/maps/map-manifest.ts';
import { SPEED_CONFIG } from '../../shared/scoring/speed-config.ts';
import {
  answerCurrentQuestion,
  ensureProfile,
  setTimeScale,
  snapshot,
  startRun,
  waitForSnapshot,
} from './helpers.ts';

const SCREENSHOT_DIR = 'artifacts/screenshots';

/** A short, unique nickname so the shared leaderboard stays readable. */
function uniqueNickname(prefix: string): string {
  return `${prefix} ${String(Date.now() % 1000).padStart(3, '0')}`;
}

async function openHome(page: Page, nickname: string): Promise<void> {
  await page.goto('/');
  await ensureProfile(page, { nickname });
  await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });
}

/** Picks one map by hand, turning the roulette off. */
async function pickMap(page: Page, mapId: string): Promise<void> {
  await page.getByTestId(`map-dot-${mapId}`).click();
  await expect(page.getByTestId('map-card')).toHaveAttribute('data-map-id', mapId);
}

test.describe('chọn bản đồ', () => {
  test('chọn thủ công từng bản đồ và bắt đầu đúng bản đồ đó', async ({ page }) => {
    await openHome(page, uniqueNickname('Bản Đồ'));

    for (const mapId of MAP_IDS) {
      await pickMap(page, mapId);
      await expect(page.getByTestId('map-thumbnail')).toHaveAttribute(
        'alt',
        /Ảnh xem trước bản đồ/,
      );
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/map-picker-desktop.png` });

    // The last one picked is the one the run is played on.
    await pickMap(page, 'cosmic-orbit');
    await startRun(page, { grade: 1, timeScale: 3 });

    const state = await snapshot(page);
    expect(state.mapId).toBe('cosmic-orbit');
    expect(state.mapFallback).toBe(false);
  });

  test('lựa chọn bản đồ được nhớ sau khi tải lại trang', async ({ page }) => {
    await openHome(page, uniqueNickname('Nhớ Map'));
    await pickMap(page, 'toy-city');

    await page.reload();
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('map-card')).toHaveAttribute('data-map-id', 'toy-city');
    await expect(page.getByTestId('btn-map-random')).toHaveAttribute('aria-pressed', 'false');
  });

  test('ngẫu nhiên thông minh không lặp lại bản đồ vừa chơi', async ({ page }) => {
    await openHome(page, uniqueNickname('Xúc Xắc'));

    await page.getByTestId('btn-map-random').click();
    await expect(page.getByTestId('btn-map-random')).toHaveAttribute('aria-pressed', 'true');

    await startRun(page, { grade: 1, timeScale: 4 });
    const first = (await snapshot(page)).mapId;

    // Finish the run so the map counts as played.
    for (let i = 0; i < 12; i += 1) {
      const state = await snapshot(page);
      if (state.phase === 'finished') break;
      await answerCurrentQuestion(page, (question) => question.correctIndex);
    }
    await waitForSnapshot(page, (s) => s.phase === 'finished', { message: 'run to finish' });

    await page.getByTestId('btn-replay').click();
    await waitForSnapshot(page, (s) => s.phase === 'running', { message: 'second run' });

    expect((await snapshot(page)).mapId).not.toBe(first);
  });

  test('bản đồ hỏng vẫn chạy được bằng đường dự phòng', async ({ page }) => {
    await openHome(page, uniqueNickname('Dự Phòng'));
    await pickMap(page, 'enchanted-forest');

    // Every map module is its own chunk, so blocking them all forces the
    // fallback without touching the rest of the bundle.
    await page.route('**/assets/create*.js', (route) => route.abort('failed'));

    await startRun(page, { grade: 1, timeScale: 3 });

    const state = await snapshot(page);
    expect(state.mapId).toBe('enchanted-forest');
    expect(state.mapFallback).toBe(true);
    await expect(page.getByTestId('hud-question')).toBeVisible();
  });

  test('màn hình chờ hiện trước khi đếm ngược', async ({ page }) => {
    await openHome(page, uniqueNickname('Chờ Map'));

    // Slow the map chunk down so the loading board is observable.
    await page.route('**/assets/create*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    await page.getByTestId('btn-start').click();

    const tutorial = page.getByTestId('screen-tutorial');
    if (await tutorial.isVisible()) {
      await page.getByTestId('btn-left').click();
      await page.getByTestId('btn-ready').click();
    }

    await expect(page.getByTestId('screen-map-loading')).toBeVisible();
    await expect(page.getByTestId('map-loading-status')).toContainText('Đang chuẩn bị');
    // The countdown only starts once the world is standing.
    await expect(page.getByTestId('screen-countdown')).toBeVisible({ timeout: 30_000 });
  });

  test('bộ chọn bản đồ dùng được trên mobile và không che nút chạy', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page, uniqueNickname('Mobile Map'));

    const arrow = page.getByTestId('btn-map-next');
    const box = await arrow.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await arrow.click();
    await expect(page.getByTestId('map-card')).toHaveAttribute('data-map-id', /.+/);

    const start = page.getByTestId('btn-start');
    await expect(start).toBeVisible();
    const startBox = await start.boundingBox();
    expect((startBox?.y ?? 0) + (startBox?.height ?? 0)).toBeLessThanOrEqual(845);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/map-picker-mobile.png` });
  });
});

test.describe('đổi bản đồ nhiều lần', () => {
  test('không rò rỉ geometry hay texture sau nhiều lần đổi bản đồ', async ({ page }) => {
    test.setTimeout(180_000);
    await openHome(page, uniqueNickname('Đổi Map'));

    const stats = async (): Promise<{ geometries: number; textures: number }> =>
      page.evaluate(
        () =>
          window.__MATH_RUNNER_DEBUG__?.getRenderStats() ?? {
            geometries: 0,
            textures: 0,
            programs: 0,
          },
      );

    /** Loads one map by starting a run, then walks back to home. */
    const visitMap = async (mapId: string): Promise<void> => {
      await pickMap(page, mapId);
      await startRun(page, { grade: 1, timeScale: 4 });
      await page.getByTestId('btn-pause').click();
      await page.getByTestId('btn-home').click();
      await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });
    };

    // Warm up first: the very first map also allocates the shared scene.
    await visitMap('rainbow-skyway');
    await visitMap('cosmic-orbit');
    const baseline = await stats();

    for (const mapId of ['toy-city', 'vietnam-countryside', 'enchanted-forest', 'rainbow-skyway']) {
      await visitMap(mapId);
    }

    const after = await stats();

    // Each map builds its own geometry, so the count moves - but a map that
    // failed to release would push it up by hundreds, not by a handful.
    expect(after.geometries).toBeLessThan(baseline.geometries * 2);
    expect(after.textures).toBeLessThanOrEqual(baseline.textures + 4);
  });
});

test.describe('tốc độ theo điểm', () => {
  test('bắt đầu ở bậc 1 và lên bậc khi vượt ngưỡng điểm', async ({ page }) => {
    await openHome(page, uniqueNickname('Tốc Độ'));
    await startRun(page, { grade: 1, timeScale: 4 });

    const start = await snapshot(page);
    expect(start.speedTier).toBe(0);
    expect(start.speed).toBeCloseTo(SPEED_CONFIG.baseSpeed, 2);

    await expect(page.getByTestId('speed-meter')).toBeVisible();
    await expect(page.getByTestId('speed-meter')).toHaveAttribute(
      'aria-label',
      'Tốc độ bậc 1 trên 6',
    );

    // Three correct answers are worth well over 300 points.
    let crossed = false;
    for (let i = 0; i < 6 && !crossed; i += 1) {
      await answerCurrentQuestion(page, (question) => question.correctIndex);
      const state = await snapshot(page);
      crossed = state.speedTier > 0;
    }

    expect(crossed).toBe(true);
    const after = await snapshot(page);
    expect(after.speed).toBeGreaterThan(SPEED_CONFIG.baseSpeed);
    expect(after.speed).toBeLessThanOrEqual(SPEED_CONFIG.maxSpeed);
    await expect(page.getByTestId('speed-meter')).toHaveAttribute(
      'aria-label',
      /Tốc độ bậc [2-6] trên 6|Tốc độ tối đa/,
    );
  });

  test('không frame nào vượt tốc độ tối đa, kể cả khi điểm rất cao', async ({ page }) => {
    await openHome(page, uniqueNickname('Trần Tốc'));
    await startRun(page, { grade: 5, timeScale: 5 });

    for (let i = 0; i < 12; i += 1) {
      const state = await snapshot(page);
      if (state.phase === 'finished') break;
      expect(state.speed).toBeLessThanOrEqual(SPEED_CONFIG.maxSpeed + 1e-6);
      await answerCurrentQuestion(page, (question) => question.correctIndex);
      expect((await snapshot(page)).speed).toBeLessThanOrEqual(SPEED_CONFIG.maxSpeed + 1e-6);
    }
  });

  test('tạm dừng giữa lúc tăng tốc rồi chạy tiếp vẫn đúng', async ({ page }) => {
    await openHome(page, uniqueNickname('Tạm Dừng'));
    await startRun(page, { grade: 1, timeScale: 2 });

    await answerCurrentQuestion(page, (question) => question.correctIndex);
    await answerCurrentQuestion(page, (question) => question.correctIndex);
    await answerCurrentQuestion(page, (question) => question.correctIndex);

    await page.getByTestId('btn-pause').click();
    await expect(page.getByTestId('screen-pause')).toBeVisible();

    const paused = await snapshot(page);
    await page.waitForTimeout(600);
    const stillPaused = await snapshot(page);
    expect(stillPaused.speed).toBeCloseTo(paused.speed, 3);

    await page.getByTestId('btn-resume').click();
    await waitForSnapshot(page, (s) => s.phase === 'running', { message: 'resume' });
    await setTimeScale(page, 2);

    const resumed = await snapshot(page);
    expect(resumed.speed).toBeGreaterThanOrEqual(paused.speed - 1e-6);
    expect(resumed.speed).toBeLessThanOrEqual(SPEED_CONFIG.maxSpeed);
  });

  test('trả lời sai không làm chậm thế giới', async ({ page }) => {
    await openHome(page, uniqueNickname('Sai Không'));
    await startRun(page, { grade: 2, timeScale: 2 });

    const before = await snapshot(page);
    await answerCurrentQuestion(page, (question) =>
      question.correctIndex === 0 ? 2 : ((question.correctIndex - 1) as 0 | 1 | 2),
    );
    const after = await snapshot(page);

    expect(after.speed).toBeGreaterThanOrEqual(before.speed - 1e-6);
    expect(after.speedTier).toBe(before.speedTier);
  });
});
