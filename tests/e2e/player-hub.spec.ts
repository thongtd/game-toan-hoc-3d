import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerCurrentQuestion, collectConsoleErrors, ensureProfile, snapshot, startRun } from './helpers.ts';

const SCREENSHOT_DIR = 'artifacts/screenshots';

/**
 * A fresh nickname per test keeps the shared leaderboard readable.
 * Kept short so the result always fits the 16 character limit.
 */
function uniqueNickname(prefix: string): string {
  return `${prefix} ${String(Date.now() % 1000).padStart(3, '0')}`;
}

/** Marks the tutorial as already seen, so Start goes straight to a run. */
async function skipTutorialOnce(page: Page): Promise<void> {
  await page.evaluate(() => {
    const key = 'math-runner-3d:v1';
    const raw = window.localStorage.getItem(key);
    const data: Record<string, unknown> =
      raw === null ? { version: 1 } : (JSON.parse(raw) as Record<string, unknown>);
    data['version'] = 1;
    data['tutorialSeen'] = true;
    window.localStorage.setItem(key, JSON.stringify(data));
  });
}

async function openHub(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('screen-player-hub')).toBeVisible({ timeout: 30_000 });
}

test.describe('Sảnh Người Chơi', () => {
  test('người chơi mới tạo được hồ sơ và vào đường đua', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await openHub(page);

    // The leaderboard loads independently of having a profile.
    await expect(page.getByTestId('leaderboard')).toBeVisible();
    await expect(page.getByTestId('pass-title')).toHaveText('Tạo tay đua');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/player-hub-new-desktop.png` });

    // Every avatar category can be browsed.
    await page.getByTestId('btn-open-avatar').click();
    await expect(page.getByTestId('avatar-grid')).toBeVisible();
    for (const category of ['animals', 'robots', 'aircraft', 'vehicles']) {
      await page.getByTestId(`avatar-tab-${category}`).click();
      await expect(page.getByTestId(`avatar-tab-${category}`)).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
    await page.getByTestId('avatar-tab-robots').click();
    await page.getByTestId('avatar-option-robot-blue-01').click();
    await page.getByTestId('btn-avatar-done').click();

    const nickname = uniqueNickname('Rô Bốt');
    await page.getByTestId('input-nickname').fill(nickname);
    await page.getByTestId('age-9').click();
    await page.getByTestId('btn-save-player').click();

    // Saving moves on to grade selection.
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 20_000 });

    // The token was stored, so a reload comes back as a returning player.
    const token = await page.evaluate(() =>
      window.localStorage.getItem('math-runner-3d:player-token:v1'),
    );
    expect(token).not.toBeNull();

    await page.reload();
    await expect(page.getByTestId('screen-player-hub')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pass-title')).toHaveText(nickname);
    await expect(page.getByTestId('input-nickname')).toBeHidden();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/player-hub-returning-desktop.png` });

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('biệt danh không hợp lệ bị từ chối ngay trên máy', async ({ page }) => {
    await openHub(page);

    await page.getByTestId('input-nickname').fill('a');
    await page.getByTestId('age-8').click();
    await page.getByTestId('btn-save-player').click();

    await expect(page.getByTestId('nickname-error')).toBeVisible();
    await expect(page.getByTestId('nickname-error')).toContainText('ít nhất 2 ký tự');
    await expect(page.getByTestId('screen-home')).toBeHidden();

    // A phone number is refused with its own message.
    await page.getByTestId('input-nickname').fill('0912345678');
    await page.getByTestId('btn-save-player').click();
    await expect(page.getByTestId('nickname-error')).toContainText('số điện thoại');

    // Nothing is saved until the input is acceptable.
    expect(
      await page.evaluate(() => window.localStorage.getItem('math-runner-3d:player-token:v1')),
    ).toBeNull();
  });

  test('phải chọn tuổi trước khi lưu', async ({ page }) => {
    await openHub(page);

    await page.getByTestId('input-nickname').fill(uniqueNickname('Chưa Tuổi'));
    await page.getByTestId('btn-save-player').click();

    await expect(page.getByTestId('age-error')).toBeVisible();
    await expect(page.getByTestId('screen-home')).toBeHidden();
  });

  test('tiếng Việt có dấu hiển thị đúng trong hồ sơ và bảng xếp hạng', async ({ page }) => {
    const nickname = uniqueNickname('Nhím Xù');
    await openHub(page);
    await ensureProfile(page, { nickname, age: 7 });
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 20_000 });

    await page.goto('/');
    await expect(page.getByTestId('pass-title')).toHaveText(nickname, { timeout: 30_000 });
  });

  test('sửa hồ sơ cập nhật biệt danh, tuổi và avatar', async ({ page }) => {
    await openHub(page);
    await ensureProfile(page, { nickname: uniqueNickname('Ban Đầu'), age: 8 });
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 20_000 });

    await page.goto('/');
    await expect(page.getByTestId('screen-player-hub')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('btn-edit-profile').click();
    await expect(page.getByTestId('pass-title')).toHaveText('Sửa hồ sơ');

    const updated = uniqueNickname('Đã Sửa');
    await page.getByTestId('input-nickname').fill(updated);
    await page.getByTestId('age-11').click();
    await page.getByTestId('btn-open-avatar').click();
    await page.getByTestId('avatar-tab-vehicles').click();
    await page.getByTestId('avatar-option-vehicle-tank-green-01').click();
    await page.getByTestId('btn-avatar-done').click();
    await page.getByTestId('btn-save-player').click();

    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 20_000 });

    await page.goto('/');
    await expect(page.getByTestId('pass-title')).toHaveText(updated, { timeout: 30_000 });
    await expect(page.getByTestId('pass-avatar')).toHaveAttribute(
      'src',
      /vehicle-tank-green-01/,
    );
  });

  test('token hỏng đưa người chơi về luồng tạo mới', async ({ page }) => {
    await openHub(page);
    await ensureProfile(page, { nickname: uniqueNickname('Sẽ Mất') });
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 20_000 });

    await page.evaluate(() => {
      window.localStorage.setItem('math-runner-3d:player-token:v1', 'khong-hop-le');
    });
    await page.reload();

    await expect(page.getByTestId('screen-player-hub')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pass-title')).toHaveText('Tạo tay đua');
    await expect(page.getByTestId('pass-notice')).toBeVisible();
  });

  test('lỗi bảng xếp hạng không chặn việc tạo hồ sơ', async ({ page }) => {
    // The leaderboard endpoint fails; everything else keeps working.
    await page.route('**/api/v1/leaderboard**', (route) => route.abort('failed'));

    await openHub(page);
    await expect(page.getByTestId('lb-message')).toContainText('đang nghỉ một chút');
    await expect(page.getByTestId('btn-lb-retry')).toBeVisible();

    await ensureProfile(page, { nickname: uniqueNickname('Vẫn Chạy') });
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 20_000 });
  });

  test('không bắt đầu được lượt xếp hạng khi máy chủ lỗi', async ({ page }) => {
    await openHub(page);
    await ensureProfile(page, { nickname: uniqueNickname('Mất Mạng') });
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 20_000 });

    await skipTutorialOnce(page);
    await page.route('**/api/v1/runs/start', (route) => route.abort('failed'));
    await page.getByTestId('btn-start').click();

    await expect(page.getByTestId('home-notice')).toBeVisible();
    await expect(page.getByTestId('screen-countdown')).toBeHidden();
  });

  test('điểm dùng kết quả server và lên bảng xếp hạng', async ({ page }) => {
    const nickname = uniqueNickname('Top');
    await page.goto('/');
    await startRun(page, { grade: 1, timeScale: 3, nickname });

    for (let i = 0; i < 12; i += 1) {
      const current = await snapshot(page);
      if (current.phase === 'finished' || current.activeQuestion === null) break;
      await answerCurrentQuestion(page, (question) => question.correctIndex);
    }

    await expect(page.getByTestId('screen-result')).toBeVisible({ timeout: 30_000 });
    // The rank chip only appears when the server verified and ranked the run.
    await expect(page.getByTestId('result-rank')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('result-notice')).toBeHidden();

    const shownScore = (await page.getByTestId('result-score').textContent())?.trim() ?? '';
    expect(shownScore.length).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/leaderboard-new-record.png` });

    // Back in the hub the player appears on the board for their grade.
    await page.goto('/');
    await expect(page.getByTestId('screen-player-hub')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('lb-grade-1').click();
    await expect(page.getByTestId('lb-rows')).toContainText(nickname, { timeout: 20_000 });
  });

  test('bảng xếp hạng không lộ tuổi hay mã người chơi', async ({ page }) => {
    const payloads: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/leaderboard')) {
        void response
          .text()
          .then((text) => payloads.push(text))
          .catch(() => undefined);
      }
    });

    await openHub(page);
    await expect(page.getByTestId('leaderboard')).toBeVisible();
    await page.waitForTimeout(1500);

    expect(payloads.length).toBeGreaterThan(0);
    for (const payload of payloads) {
      expect(payload).not.toContain('"age"');
      expect(payload).not.toContain('playerId');
      expect(payload).not.toContain('playerToken');
    }
  });

  test('hồ sơ và top bảng xếp hạng đều thấy được trên mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHub(page);

    await expect(page.getByTestId('player-pass')).toBeVisible();
    await expect(page.getByTestId('leaderboard')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/player-hub-leaderboard-mobile.png` });

    await page.getByTestId('btn-open-avatar').click();
    await expect(page.getByTestId('avatar-grid')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/avatar-picker-mobile.png` });

    // Touch targets stay tappable on a phone.
    const box = await page.getByTestId('avatar-option-animal-panda-01').boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(56);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
  });

  test('chọn avatar dùng được bằng bàn phím', async ({ page }) => {
    await openHub(page);
    await page.getByTestId('btn-open-avatar').click();

    const option = page.getByTestId('avatar-option-animal-frog-01');
    await option.focus();
    await page.keyboard.press('Enter');

    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pass-avatar')).toHaveAttribute('src', /animal-frog-01/);
  });
});
