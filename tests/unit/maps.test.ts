import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAP_ID,
  MAPS,
  MAP_GAMEPLAY_MULTIPLIERS,
  MAP_IDS,
  MAP_MANIFEST_VERSION,
  enabledMapIds,
  getMapDefinition,
  isMapAvailable,
  isMapId,
} from '../../shared/maps/map-manifest.ts';
import type { MapId } from '../../shared/maps/map-manifest.ts';
import { chooseSmartMap, emptyMapStats, recordMapPlay } from '../../shared/maps/smart-random.ts';
import type { PlayerMapStats } from '../../shared/maps/smart-random.ts';

/** A repeatable RNG so the tie-break is a fact, not a coin toss. */
function fixedRng(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

describe('manifest bản đồ', () => {
  it('có đúng năm bản đồ, tất cả đều mở sẵn', () => {
    expect(MAP_IDS).toHaveLength(5);
    expect(MAPS).toHaveLength(5);
    expect(enabledMapIds()).toHaveLength(5);
  });

  it('id không trùng và sortOrder không trùng', () => {
    expect(new Set(MAPS.map((map) => map.id)).size).toBe(MAPS.length);
    expect(new Set(MAPS.map((map) => map.sortOrder)).size).toBe(MAPS.length);
  });

  it('mỗi bản đồ có tối thiểu năm segment trang trí', () => {
    for (const map of MAPS) {
      expect(map.segmentIds.length).toBeGreaterThanOrEqual(5);
      expect(new Set(map.segmentIds).size).toBe(map.segmentIds.length);
    }
  });

  it('mô tả ngắn tối đa 45 ký tự', () => {
    for (const map of MAPS) {
      expect(map.description.length).toBeLessThanOrEqual(45);
    }
  });

  it('thumbnail và asset nằm trong thư mục của chính bản đồ', () => {
    for (const map of MAPS) {
      expect(map.thumbnailUrl).toBe(`/assets/maps/${map.id}/thumbnail.webp`);
      expect(map.assetBaseUrl).toBe(`/assets/maps/${map.id}/`);
      expect(map.manifestVersion).toBe(MAP_MANIFEST_VERSION);
    }
  });

  it('không bản đồ nào được nhân điểm, tốc độ hay độ khó', () => {
    expect(MAP_GAMEPLAY_MULTIPLIERS).toEqual({
      speedMultiplier: 1,
      scoreMultiplier: 1,
      questionDifficultyMultiplier: 1,
    });

    for (const map of MAPS) {
      const record = map as unknown as Record<string, unknown>;
      expect(record.speedMultiplier).toBeUndefined();
      expect(record.scoreMultiplier).toBeUndefined();
      expect(record.questionDifficultyMultiplier).toBeUndefined();
    }
  });

  it('nhận diện id hợp lệ và từ chối id lạ', () => {
    expect(isMapId(DEFAULT_MAP_ID)).toBe(true);
    expect(isMapId('mars-highway')).toBe(false);
    expect(isMapId('')).toBe(false);
    expect(isMapId(null)).toBe(false);
    expect(isMapId(42)).toBe(false);
    expect(isMapAvailable('rainbow-skyway')).toBe(true);
    expect(isMapAvailable('mars-highway')).toBe(false);
  });

  it('ném lỗi rõ ràng khi tra id không tồn tại', () => {
    expect(() => getMapDefinition('mars-highway' as MapId)).toThrow(/Unknown map/);
  });
});

describe('ngẫu nhiên thông minh', () => {
  const all = MAP_IDS as readonly MapId[];

  it('không lặp lại bản đồ vừa chơi', () => {
    const stats: PlayerMapStats = {
      recentMapIds: ['toy-city'],
      totalPlays: { 'toy-city': 1 },
      lastPlayedMapId: 'toy-city',
    };

    for (let i = 0; i < 20; i += 1) {
      expect(chooseSmartMap(all, stats, fixedRng(i / 20))).not.toBe('toy-city');
    }
  });

  it('vẫn chọn được khi chỉ còn một bản đồ, kể cả vừa chơi', () => {
    const stats: PlayerMapStats = {
      recentMapIds: ['cosmic-orbit'],
      totalPlays: {},
      lastPlayedMapId: 'cosmic-orbit',
    };
    expect(chooseSmartMap(['cosmic-orbit'], stats, fixedRng(0.9))).toBe('cosmic-orbit');
  });

  it('không chọn bản đồ đang tắt', () => {
    const enabled: MapId[] = ['rainbow-skyway', 'cosmic-orbit'];
    for (let i = 0; i < 10; i += 1) {
      expect(enabled).toContain(chooseSmartMap(enabled, emptyMapStats(), fixedRng(i / 10)));
    }
  });

  it('ưu tiên bản đồ ít xuất hiện gần đây', () => {
    const stats: PlayerMapStats = {
      recentMapIds: [
        'rainbow-skyway',
        'rainbow-skyway',
        'cosmic-orbit',
        'vietnam-countryside',
        'enchanted-forest',
      ],
      totalPlays: {},
      lastPlayedMapId: 'rainbow-skyway',
    };

    // Only toy-city has never been seen recently.
    expect(chooseSmartMap(all, stats, fixedRng(0.5))).toBe('toy-city');
  });

  it('khi lịch sử gần đây bằng nhau thì ưu tiên tổng lượt thấp nhất', () => {
    const stats: PlayerMapStats = {
      recentMapIds: [],
      totalPlays: {
        'rainbow-skyway': 9,
        'vietnam-countryside': 4,
        'cosmic-orbit': 7,
        'enchanted-forest': 2,
        'toy-city': 6,
      },
      lastPlayedMapId: null,
    };

    expect(chooseSmartMap(all, stats, fixedRng(0.99))).toBe('enchanted-forest');
  });

  it('hòa tuyệt đối thì dùng RNG được tiêm và cho kết quả ổn định', () => {
    const stats = emptyMapStats();
    expect(chooseSmartMap(all, stats, fixedRng(0))).toBe(all[0]);
    expect(chooseSmartMap(all, stats, fixedRng(0.99))).toBe(all[all.length - 1]);
    // An RNG returning exactly 1 must not index past the end.
    expect(all).toContain(chooseSmartMap(all, stats, fixedRng(1)));
  });

  it('danh sách rỗng ném lỗi rõ ràng', () => {
    expect(() => chooseSmartMap([], emptyMapStats())).toThrow(/No enabled maps/);
  });

  it('ghi nhận lượt chơi và giới hạn lịch sử ở 10 mục', () => {
    let stats = emptyMapStats();
    for (let i = 0; i < 12; i += 1) {
      stats = recordMapPlay(stats, i % 2 === 0 ? 'toy-city' : 'cosmic-orbit');
    }

    expect(stats.recentMapIds).toHaveLength(10);
    expect(stats.lastPlayedMapId).toBe('cosmic-orbit');
    expect(stats.totalPlays['toy-city']).toBe(6);
    expect(stats.totalPlays['cosmic-orbit']).toBe(6);
  });
});
