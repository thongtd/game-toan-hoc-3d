// Visual QA helper: walks the game and saves screenshots at desktop + mobile.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'D:/T3SKY/projects/game-toan-hoc/artifacts/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const snap = (page) => page.evaluate(() => window.__MATH_RUNNER_DEBUG__?.getSnapshot() ?? null);

async function waitFor(page, predicate, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const s = await snap(page);
    if (s && predicate(s)) return s;
    if (Date.now() > deadline) throw new Error(`timeout: ${label} (${JSON.stringify(s)})`);
    await page.waitForTimeout(100);
  }
}

async function run(name, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('http://127.0.0.1:4173/');
  await page.waitForSelector('[data-testid="screen-home"]:not(.is-hidden)', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/home-${name}.png` });

  await page.getByTestId('grade-2').click();
  await page.getByTestId('btn-start').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/tutorial-${name}.png` });

  // Practise a lane change, then start.
  await page.getByTestId('btn-right').click();
  await page.waitForTimeout(500);
  await page.getByTestId('btn-ready').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/countdown-${name}.png` });

  await waitFor(page, (s) => s.phase === 'running', 'countdown to end');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/game-${name}.png` });

  // Answer question 1 correctly and capture the feedback moment.
  let s = await waitFor(page, (x) => x.activeQuestion !== null, 'question');
  await page.evaluate(
    (lane) => window.__MATH_RUNNER_DEBUG__.moveToLane(lane),
    s.activeQuestion.correctIndex,
  );
  await waitFor(page, (x) => x.questionIndex > s.questionIndex, 'q1 resolve');
  await page.screenshot({ path: `${OUT}/feedback-correct-${name}.png` });

  // Answer question 2 wrongly.
  s = await waitFor(page, (x) => x.activeQuestion !== null, 'question 2');
  const wrongLane = s.activeQuestion.correctIndex === 0 ? 2 : s.activeQuestion.correctIndex - 1;
  await page.evaluate((lane) => window.__MATH_RUNNER_DEBUG__.moveToLane(lane), wrongLane);
  await waitFor(page, (x) => x.questionIndex > s.questionIndex, 'q2 resolve');
  await page.screenshot({ path: `${OUT}/feedback-wrong-${name}.png` });

  await page.getByTestId('btn-pause').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/pause-${name}.png` });
  await page.getByTestId('btn-resume').click();

  await page.evaluate(() => window.__MATH_RUNNER_DEBUG__.setTimeScale(4));
  for (let i = 0; i < 12; i += 1) {
    const cur = await snap(page);
    if (!cur || cur.phase === 'finished' || cur.activeQuestion === null) break;
    await page.evaluate(
      (lane) => window.__MATH_RUNNER_DEBUG__.moveToLane(lane),
      cur.activeQuestion.correctIndex,
    );
    await waitFor(
      page,
      (x) => x.questionIndex > cur.questionIndex || x.phase === 'finished',
      `q${i}`,
    );
  }

  await page.waitForSelector('[data-testid="screen-result"]:not(.is-hidden)', { timeout: 30000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/result-${name}.png` });

  await page.getByTestId('btn-change-grade').click();
  await page.waitForTimeout(800);
  await page.getByTestId('btn-credits').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/credits-${name}.png` });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

  console.log(`[${name}] overflow=${overflow} errors=${errors.length}`, errors.slice(0, 5));
  await context.close();
}

await run('desktop', 1440, 900);
await run('mobile', 390, 844);
await run('small', 360, 640);
await browser.close();
console.log('done');
