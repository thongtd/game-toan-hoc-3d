#!/usr/bin/env node
/**
 * Checks the shipped assets against the manifest and the size budgets.
 *
 * Run it after adding or replacing anything under `public/assets/`. It fails
 * the build rather than letting an oversized texture, a missing thumbnail or an
 * unrecorded source pack reach production.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { MAPS } from '../shared/maps/map-manifest.ts';

const PUBLIC_ROOT = path.resolve('public');
const AVATAR_MANIFEST = path.resolve('shared/content/avatars.json');
const ASSET_SOURCES = path.resolve('ASSET_SOURCES.md');
const NOTICES = path.resolve('THIRD_PARTY_NOTICES.md');

const LIMITS = {
  /** Map thumbnail: 100 KB target, 160 KB hard limit. */
  thumbnailBytes: 160 * 1024,
  /** Avatar: 60 KB target, 90 KB hard limit. */
  avatarBytes: 90 * 1024,
  /** Any single downloaded asset file. */
  assetBytes: 5 * 1024 * 1024,
};

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkMapThumbnails() {
  for (const map of MAPS) {
    const file = path.join(PUBLIC_ROOT, map.thumbnailUrl.replace(/^\//, ''));
    if (!(await exists(file))) {
      fail(`Thiếu thumbnail của bản đồ ${map.id}: ${path.relative(process.cwd(), file)}`);
      continue;
    }

    const info = await stat(file);
    if (info.size > LIMITS.thumbnailBytes) {
      fail(`Thumbnail ${map.id} nặng ${(info.size / 1024).toFixed(1)} KB, vượt giới hạn 160 KB.`);
    } else if (info.size > 100 * 1024) {
      notes.push(`Thumbnail ${map.id} là ${(info.size / 1024).toFixed(1)} KB (mục tiêu ≤ 100 KB).`);
    }
  }
}

async function checkAvatars() {
  const manifest = JSON.parse(await readFile(AVATAR_MANIFEST, 'utf8'));
  const items = Array.isArray(manifest.items) ? manifest.items : [];

  const seen = new Set();
  for (const avatar of items) {
    if (seen.has(avatar.id)) fail(`Avatar trùng id: ${avatar.id}`);
    seen.add(avatar.id);

    const file = path.join(PUBLIC_ROOT, String(avatar.imageUrl).replace(/^\//, ''));
    if (!(await exists(file))) {
      fail(`Thiếu file avatar ${avatar.id}: ${path.relative(process.cwd(), file)}`);
      continue;
    }

    const info = await stat(file);
    if (info.size > LIMITS.avatarBytes) {
      fail(`Avatar ${avatar.id} nặng ${(info.size / 1024).toFixed(1)} KB, vượt giới hạn 90 KB.`);
    }
  }

  if (items.length < 24) {
    fail(`Cần tối thiểu 24 avatar, hiện có ${String(items.length)}.`);
  }
}

/** Nothing may ship without its licence recorded somewhere readable. */
async function checkNotices() {
  for (const file of [ASSET_SOURCES, NOTICES]) {
    if (!(await exists(file))) {
      fail(`Thiếu file kê khai: ${path.relative(process.cwd(), file)}`);
    }
  }

  const licenceDir = path.join(PUBLIC_ROOT, 'assets/licenses');
  if (!(await exists(licenceDir))) {
    fail('Thiếu thư mục public/assets/licenses.');
    return;
  }

  const licences = await readdir(licenceDir);
  if (licences.length === 0) fail('Thư mục licenses rỗng.');
}

/** Walks the asset tree looking for anything unexpectedly large. */
async function checkFileSizes(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await checkFileSizes(full);
      continue;
    }

    if (/\.(zip|rar|7z|blend|fbx)$/i.test(entry.name)) {
      fail(`Không được commit file nguồn/đóng gói: ${path.relative(process.cwd(), full)}`);
      continue;
    }

    const info = await stat(full);
    if (info.size > LIMITS.assetBytes) {
      fail(
        `${path.relative(process.cwd(), full)} nặng ${(info.size / 1024 / 1024).toFixed(1)} MB.`,
      );
    }
  }
}

await checkMapThumbnails();
await checkAvatars();
await checkNotices();
await checkFileSizes(path.join(PUBLIC_ROOT, 'assets'));

for (const note of notes) {
  console.warn(`⚠ ${note}`);
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`✗ ${problem}`);
  }
  console.error(`\n${String(problems.length)} vấn đề về asset.`);
  process.exit(1);
}

console.log('✓ Asset hợp lệ: thumbnail, avatar, giấy phép và dung lượng đều đạt.');
