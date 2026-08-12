#!/usr/bin/env node
/**
 * Captures the map selector thumbnails from the running game.
 *
 * Each picture is the real scene at a fixed seed and camera, not a mock-up, so
 * what a child picks from the stand is what they get to run through. WebP is
 * encoded by the page itself (`canvas.toDataURL`), which keeps the script free
 * of any image dependency.
 *
 * Usage:
 *   npm run preview -- --port 4173 &
 *   node scripts/capture-map-thumbnails.mjs [baseUrl]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

import { MAPS } from '../shared/maps/map-manifest.ts';

const BASE_URL = process.argv[2] ?? 'http://127.0.0.1:4173';
const OUTPUT_ROOT = path.resolve('public/assets/maps');
const SIZE = { width: 960, height: 540 };
const SEED = 1001;

/** Hard limit from the specification; a bigger file is a build failure. */
const MAX_BYTES = 160 * 1024;

async function main() {
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-lcd-text',
    ],
  });

  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1 });
  const page = await context.newPage();

  let failed = false;

  for (const map of MAPS) {
    const url = `${BASE_URL}/?previewMap=${map.id}&previewSeed=${String(SEED)}&ui=0`;
    process.stdout.write(`• ${map.id} … `);

    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__MATH_RUNNER_PREVIEW_READY__ === true, null, {
      timeout: 60_000,
    });

    const dataUrl = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('No canvas');
      return canvas.toDataURL('image/webp', 0.86);
    });

    const base64 = dataUrl.split(',')[1] ?? '';
    const bytes = Buffer.from(base64, 'base64');

    const directory = path.join(OUTPUT_ROOT, map.id);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'thumbnail.webp'), bytes);

    const kb = (bytes.length / 1024).toFixed(1);
    if (bytes.length > MAX_BYTES) {
      failed = true;
      process.stdout.write(`${kb} KB — QUÁ LỚN (giới hạn 160 KB)\n`);
    } else {
      process.stdout.write(`${kb} KB\n`);
    }
  }

  await browser.close();

  if (failed) {
    process.exitCode = 1;
  }
}

await main();
