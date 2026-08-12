import { expect, test } from '@playwright/test';
import {
  answerCurrentQuestion,
  collectConsoleErrors,
  setTimeScale,
  snapshot,
  startRun,
  waitForSnapshot,
} from './helpers.ts';

const SCREENSHOT_DIR = 'artifacts/screenshots';

test.describe('luồng chơi đầy đủ', () => {
  test('chơi hết 12 câu, xem kết quả và chơi lại', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/');

    // 1-2. Loading finishes and home appears.
    await expect(page.getByTestId('screen-loading')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/home-desktop.png` });

    // 3-5. Grade 1, tutorial, countdown.
    await startRun(page, { grade: 1, timeScale: 3 });
    await expect(page.getByTestId('screen-hud')).toBeVisible();

    // 6-7. Answer the first question correctly; the score must go up.
    const first = await answerCurrentQuestion(page, (question) => question.correctIndex);
    expect(first.before.score).toBe(0);
    await expect(page.getByTestId('hud-banner')).toBeVisible();
    await expect(page.getByTestId('hud-banner')).toContainText('Chính xác');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/feedback-correct.png` });

    const afterCorrect = await snapshot(page);
    expect(afterCorrect.score).toBeGreaterThan(0);
    expect(afterCorrect.streak).toBe(1);

    // 8. Deliberately answer the next question wrongly.
    const scoreBeforeMistake = afterCorrect.score;
    const wrong = await answerCurrentQuestion(page, (question) =>
      question.correctIndex === 0 ? 2 : ((question.correctIndex - 1) as 0 | 1 | 2),
    );
    const expectedAnswer = wrong.before.activeQuestion?.answers[wrong.before.activeQuestion.correctIndex];
    expect(expectedAnswer).toBeDefined();

    const banner = page.getByTestId('hud-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Gần đúng rồi');
    await expect(banner).toContainText(expectedAnswer ?? '');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/feedback-wrong.png` });

    const afterMistake = await snapshot(page);
    expect(afterMistake.score).toBeGreaterThanOrEqual(scoreBeforeMistake);
    expect(afterMistake.streak).toBe(0);

    // 9. Pause freezes the run: the question index must not move on.
    await page.getByTestId('btn-pause').click();
    await expect(page.getByTestId('screen-pause')).toBeVisible();
    const paused = await snapshot(page);
    expect(paused.phase).toBe('paused');

    await page.waitForTimeout(2500);
    const stillPaused = await snapshot(page);
    expect(stillPaused.questionIndex).toBe(paused.questionIndex);
    expect(stillPaused.score).toBe(paused.score);

    // 10. Resume and finish the remaining questions.
    await page.getByTestId('btn-resume').click();
    await expect(page.getByTestId('screen-pause')).toBeHidden();
    await setTimeScale(page, 3);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/game-desktop.png` });

    let guard = 0;
    while (guard < 12) {
      guard += 1;
      const current = await snapshot(page);
      if (current.phase === 'finished' || current.activeQuestion === null) break;
      await answerCurrentQuestion(page, (question) => question.correctIndex);
    }

    // 11. Result screen.
    await expect(page.getByTestId('screen-result')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('result-headline')).toContainText('/12 câu');
    await expect(page.getByTestId('result-stars')).toBeVisible();

    const result = await page.evaluate(() => window.__MATH_RUNNER_DEBUG__?.getLastResult() ?? null);
    expect(result).not.toBeNull();
    expect(result?.correctAnswers).toBeGreaterThanOrEqual(10);
    expect(result?.stars).toBe(3);

    const shownScore = await page.getByTestId('result-score').textContent();
    expect(shownScore?.trim().length).toBeGreaterThan(0);

    // 12. Replay starts a fresh run.
    await page.getByTestId('btn-replay').click();
    await expect(page.getByTestId('screen-countdown')).toBeVisible();
    await waitForSnapshot(page, (s) => s.phase === 'running', { message: 'replay to start' });
    const replayed = await snapshot(page);
    expect(replayed.score).toBe(0);
    expect(replayed.questionIndex).toBe(0);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('điều khiển bàn phím và nút màn hình đổi làn', async ({ page }) => {
    await page.goto('/');
    await startRun(page, { grade: 2, timeScale: 1 });

    const start = await snapshot(page);
    expect(start.lane).toBe(1);

    await page.keyboard.press('ArrowLeft');
    await waitForSnapshot(page, (s) => s.lane === 0, { message: 'ArrowLeft to move left' });

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowRight');
    await waitForSnapshot(page, (s) => s.lane === 2, { message: 'ArrowRight to move right' });

    // The runner cannot leave the road.
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    expect((await snapshot(page)).lane).toBe(2);

    await page.getByTestId('btn-left').click();
    await waitForSnapshot(page, (s) => s.lane === 1, { message: 'on-screen button to move left' });

    // `A` and `D` mirror the arrow keys.
    await page.keyboard.press('a');
    await waitForSnapshot(page, (s) => s.lane === 0, { message: 'A to move left' });
    await page.waitForTimeout(150);
    await page.keyboard.press('d');
    await waitForSnapshot(page, (s) => s.lane === 1, { message: 'D to move right' });

    // The runner is centred on the middle lane.
    const centred = await snapshot(page);
    expect(Math.abs(centred.playerX)).toBeLessThan(0.35);
  });

  test('phím Escape tạm dừng và tiếp tục', async ({ page }) => {
    await page.goto('/');
    await startRun(page, { grade: 1, timeScale: 2 });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('screen-pause')).toBeVisible();
    expect((await snapshot(page)).phase).toBe('paused');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('screen-pause')).toBeHidden();
    expect((await snapshot(page)).phase).not.toBe('paused');
  });

  test('chơi lại từ màn tạm dừng cần xác nhận', async ({ page }) => {
    await page.goto('/');
    await startRun(page, { grade: 1, timeScale: 2 });
    await answerCurrentQuestion(page, (q) => q.correctIndex);

    await page.getByTestId('btn-pause').click();
    await page.getByTestId('btn-restart').click();
    await expect(page.getByTestId('restart-confirm')).toBeVisible();

    await page.getByTestId('btn-restart-no').click();
    await expect(page.getByTestId('restart-confirm')).toBeHidden();

    await page.getByTestId('btn-restart').click();
    await page.getByTestId('btn-restart-yes').click();

    await expect(page.getByTestId('screen-countdown')).toBeVisible();
    await waitForSnapshot(page, (s) => s.phase === 'running', { message: 'restart to begin' });
    expect((await snapshot(page)).score).toBe(0);
  });

  test('tắt tiếng được lưu lại sau khi tải lại trang', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('btn-mute-home').click();
    await expect(page.getByTestId('btn-mute-home')).toHaveAttribute('aria-label', 'Bật âm thanh');

    await page.reload();
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('btn-mute-home')).toHaveAttribute('aria-label', 'Bật âm thanh');

    await page.getByTestId('btn-mute-home').click();
    await expect(page.getByTestId('btn-mute-home')).toHaveAttribute('aria-label', 'Tắt âm thanh');
  });

  test('kỷ lục cá nhân được lưu và hiển thị lại', async ({ page }) => {
    await page.goto('/');
    await startRun(page, { grade: 3, timeScale: 3 });

    for (let i = 0; i < 12; i += 1) {
      const current = await snapshot(page);
      if (current.phase === 'finished' || current.activeQuestion === null) break;
      await answerCurrentQuestion(page, (question) => question.correctIndex);
    }

    await expect(page.getByTestId('screen-result')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('result-record')).toBeVisible();
    const best = (await page.getByTestId('result-best').textContent())?.trim() ?? '';
    expect(best.length).toBeGreaterThan(0);

    await page.getByTestId('btn-change-grade').click();
    await expect(page.getByTestId('screen-home')).toBeVisible();
    await expect(page.getByTestId('home-best')).toContainText('Kỷ lục của bạn');

    await page.reload();
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-best')).toContainText(best);
  });

  test('modal nguồn tài nguyên mở được và đóng được', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('btn-credits').click();
    const modal = page.getByTestId('modal-credits');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Kenney');
    await expect(modal).toContainText('CC0');
    await expect(modal).toContainText('MIT');

    await page.getByTestId('btn-credits-close').click();
    await expect(modal).toBeHidden();
  });

  test('chuyển tab sang nền sẽ tự tạm dừng, không bỏ lỡ cổng', async ({ page, context }) => {
    await page.goto('/');
    await startRun(page, { grade: 1, timeScale: 1 });

    const before = await snapshot(page);

    // Opening another tab hides this one, which must pause the simulation.
    const other = await context.newPage();
    await other.goto('about:blank');
    await page.waitForTimeout(1500);

    const whileHidden = await snapshot(page);
    expect(whileHidden.phase).toBe('paused');
    expect(whileHidden.questionIndex).toBe(before.questionIndex);

    await other.close();
    await page.bringToFront();

    // Coming back must not resume on its own - the player has to choose to.
    await page.waitForTimeout(500);
    expect((await snapshot(page)).phase).toBe('paused');
    await expect(page.getByTestId('screen-pause')).toBeVisible();

    await page.getByTestId('btn-resume').click();
    await waitForSnapshot(page, (s) => s.phase !== 'paused', { message: 'resume after tab switch' });
  });

  test('không có yêu cầu mạng ra ngoài domain của game', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://127.0.0.1:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        external.push(url);
      }
    });

    await page.goto('/');
    await startRun(page, { grade: 5, timeScale: 3 });
    await answerCurrentQuestion(page, (q) => q.correctIndex);

    expect(external, `external requests: ${external.join(', ')}`).toEqual([]);
  });
});
