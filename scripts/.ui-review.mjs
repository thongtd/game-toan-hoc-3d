// Mobile-first UI review: walk the game and save screenshots.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[3] ?? 'artifacts/review';
const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const snap = (page) => page.evaluate(() => window.__MATH_RUNNER_DEBUG__?.getSnapshot() ?? null);

async function waitFor(page, predicate, label, timeout = 40000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const s = await snap(page);
    if (s && predicate(s)) return s;
    if (Date.now() > deadline) throw new Error(`timeout: ${label} ${JSON.stringify(s)}`);
    await page.waitForTimeout(120);
  }
}

async function run(name, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width < 500,
    hasTouch: width < 500,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE);
  await page.waitForSelector('[data-testid="screen-player-hub"]:not(.is-hidden)', { timeout: 40000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/01-hub-${name}.png` });

  await page.getByTestId('btn-open-avatar').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/02-avatar-${name}.png` });
  await page.getByTestId('btn-avatar-done').click();

  await page.getByTestId('input-nickname').fill('Bé Bơ');
  await page.getByTestId('age-8').click();
  await page.getByTestId('btn-save-player').click();
  await page.waitForSelector('[data-testid="screen-home"]:not(.is-hidden)', { timeout: 40000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/03-home-${name}.png` });
  await page.screenshot({ path: `${OUT}/03b-home-full-${name}.png`, fullPage: true });

  await page.getByTestId('btn-start').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/04-tutorial-${name}.png` });

  await page.getByTestId('btn-left').click();
  await page.waitForTimeout(400);
  await page.getByTestId('btn-ready').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/05-maploading-${name}.png` });

  await waitFor(page, (s) => s.phase === 'running', 'countdown');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/06-game-${name}.png` });

  // Answer a few correctly to light the speed meter.
  await page.evaluate(() => window.__MATH_RUNNER_DEBUG__.setTimeScale(3));
  for (let i = 0; i < 4; i += 1) {
    const cur = await waitFor(page, (x) => x.activeQuestion !== null, `q${i}`);
    await page.evaluate(
      (lane) => window.__MATH_RUNNER_DEBUG__.moveToLane(lane),
      cur.activeQuestion.correctIndex,
    );
    await waitFor(page, (x) => x.questionIndex > cur.questionIndex || x.phase === 'finished', `r${i}`);
  }
  await page.screenshot({ path: `${OUT}/07-game-speed-${name}.png` });

  await page.getByTestId('btn-pause').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/08-pause-${name}.png` });
  await page.getByTestId('btn-resume').click();

  await page.evaluate(() => window.__MATH_RUNNER_DEBUG__.setTimeScale(5));
  for (let i = 0; i < 12; i += 1) {
    const cur = await snap(page);
    if (!cur || cur.phase === 'finished' || cur.activeQuestion === null) break;
    await page.evaluate(
      (lane) => window.__MATH_RUNNER_DEBUG__.moveToLane(lane),
      cur.activeQuestion.correctIndex,
    );
    await waitFor(page, (x) => x.questionIndex > cur.questionIndex || x.phase === 'finished', `f${i}`);
  }

  await page.waitForSelector('[data-testid="screen-result"]:not(.is-hidden)', { timeout: 40000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/09-result-${name}.png` });

  await page.getByTestId('btn-change-grade').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/10-home-return-${name}.png` });

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      overflowX: root.scrollWidth - root.clientWidth,
      overflowY: root.scrollHeight - root.clientHeight,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      start: rect('#btn-start'),
      picker: rect('.map-picker'),
      medals: rect('#grade-medals'),
      card: rect('#map-card'),
      dice: rect('#btn-map-random'),
      best: rect('#home-best'),
      logo: rect('.home__top .logo'),
    };
  });

  console.log(`\n[${name} ${width}x${height}]`, JSON.stringify(metrics, null, 1));
  if (errors.length) console.log('errors:', errors.slice(0, 6));
  await context.close();
}

await run('mobile', 390, 844);
await run('small', 360, 640);
await run('desktop', 1440, 900);
await browser.close();
console.log('done');
