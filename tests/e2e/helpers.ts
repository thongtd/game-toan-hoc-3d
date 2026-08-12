import type { ConsoleMessage, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// The window augmentation comes from the app itself, so the tests and the game
// can never drift apart on the shape of the debug bridge.
import type { DebugSnapshot } from '../../src/app/debug-bridge.ts';
import type { Question } from '../../shared/game-types.ts';

export type { DebugSnapshot };
export type DebugQuestion = Question;

/** Collects console errors so a test can assert the run stayed clean. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error: Error) => {
    errors.push(error.message);
  });
  return errors;
}

export async function snapshot(page: Page): Promise<DebugSnapshot> {
  return page.evaluate(() => {
    const bridge = window.__MATH_RUNNER_DEBUG__;
    if (bridge === undefined) throw new Error('Debug bridge is not installed');
    return bridge.getSnapshot();
  });
}

export async function setTimeScale(page: Page, scale: number): Promise<void> {
  await page.evaluate((value) => {
    window.__MATH_RUNNER_DEBUG__?.setTimeScale(value);
  }, scale);
}

export async function moveToLane(page: Page, lane: 0 | 1 | 2): Promise<void> {
  await page.evaluate((value) => {
    window.__MATH_RUNNER_DEBUG__?.moveToLane(value);
  }, lane);
}

/** Waits until the debug snapshot satisfies `predicate`. */
export async function waitForSnapshot(
  page: Page,
  predicate: (snapshot: DebugSnapshot) => boolean,
  options: { timeout?: number; message?: string } = {},
): Promise<DebugSnapshot> {
  const timeout = options.timeout ?? 30_000;
  const deadline = Date.now() + timeout;

  for (;;) {
    const current = await snapshot(page);
    if (predicate(current)) return current;
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for game state${options.message === undefined ? '' : `: ${options.message}`}. ` +
          `Last snapshot: ${JSON.stringify(current)}`,
      );
    }
    await page.waitForTimeout(80);
  }
}

/**
 * Creates a player in the hub when one is needed.
 * Returning visits skip straight past it.
 */
export async function ensureProfile(
  page: Page,
  options: { nickname?: string; age?: number; avatarId?: string } = {},
): Promise<void> {
  const hub = page.getByTestId('screen-player-hub');
  await expect(hub).toBeVisible({ timeout: 30_000 });

  const saveButton = page.getByTestId('btn-save-player');
  const nickname = page.getByTestId('input-nickname');

  // A returning player already has a profile: the pass shows "enter race".
  if (!(await nickname.isVisible())) {
    await saveButton.click();
    return;
  }

  await nickname.fill(options.nickname ?? 'Gấu Mập');

  if (options.avatarId !== undefined) {
    await page.getByTestId('btn-open-avatar').click();
    await page.getByTestId(`avatar-option-${options.avatarId}`).click();
    await page.getByTestId('btn-avatar-done').click();
  }

  await page.getByTestId(`age-${String(options.age ?? 8)}`).click();
  await saveButton.click();
}

/** Walks through loading, hub, home, tutorial and countdown into a running game. */
export async function startRun(
  page: Page,
  options: { grade?: 1 | 2 | 3 | 4 | 5; timeScale?: number; nickname?: string } = {},
): Promise<void> {
  const grade = options.grade ?? 1;

  await ensureProfile(page, options.nickname === undefined ? {} : { nickname: options.nickname });
  await expect(page.getByTestId('screen-home')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId(`grade-${String(grade)}`).click();
  await page.getByTestId('btn-start').click();

  // The tutorial only appears the first time; skip it when already seen.
  const tutorial = page.getByTestId('screen-tutorial');
  if (await tutorial.isVisible()) {
    await expect(page.getByTestId('btn-ready')).toBeDisabled();
    await page.getByTestId('btn-tutorial-left').click();
    await expect(page.getByTestId('btn-ready')).toBeEnabled();
    await page.getByTestId('btn-ready').click();
  }

  await expect(page.getByTestId('screen-countdown')).toBeVisible();
  await waitForSnapshot(page, (s) => s.phase === 'running', { message: 'countdown to finish' });

  if (options.timeScale !== undefined) {
    await setTimeScale(page, options.timeScale);
  }
}

/**
 * Answers the current question by moving into `lane`, then waits until the
 * game has moved on to the next question or finished the run.
 */
export async function answerCurrentQuestion(
  page: Page,
  chooseLane: (question: DebugQuestion) => 0 | 1 | 2,
): Promise<{ before: DebugSnapshot; after: DebugSnapshot; chosen: 0 | 1 | 2 }> {
  const before = await waitForSnapshot(page, (s) => s.activeQuestion !== null, {
    message: 'a question to become active',
  });
  const question = before.activeQuestion;
  if (question === null) throw new Error('No active question');

  const chosen = chooseLane(question);
  await moveToLane(page, chosen);

  const after = await waitForSnapshot(
    page,
    (s) => s.questionIndex > before.questionIndex || s.phase === 'finished',
    { message: `question ${String(before.questionIndex)} to resolve` },
  );

  return { before, after, chosen };
}
