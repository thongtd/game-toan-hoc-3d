import { describe, expect, it } from 'vitest';

import {
  BASE_GATE_DISTANCE,
  MIN_READING_SECONDS_BY_GRADE,
  SPEED_CONFIG,
  SPEED_TIER_COUNT,
  clampWorldSpeed,
  gateDistanceForQuestion,
  speedTierForScore,
  targetSpeedForScore,
} from '../../shared/scoring/speed-config.ts';
import { pacingForQuestion } from '../../shared/scoring/run-pacing.ts';
import { SpeedSystem } from '../../src/game/speed/SpeedSystem.ts';
import type { Grade } from '../../shared/game-types.ts';

/** The table straight out of the specification. */
const TABLE: readonly [score: number, tier: number, speed: number][] = [
  [-1, 0, 7.5],
  [0, 0, 7.5],
  [299, 0, 7.5],
  [300, 1, 8.25],
  [599, 1, 8.25],
  [600, 2, 9],
  [899, 2, 9],
  [900, 3, 9.75],
  [1199, 3, 9.75],
  [1200, 4, 10.5],
  [1499, 4, 10.5],
  [1500, 5, 11.25],
  [999_999, 5, 11.25],
];

describe('tốc độ theo điểm', () => {
  it.each(TABLE)('điểm %i cho bậc %i và tốc độ %f', (score, tier, speed) => {
    expect(speedTierForScore(score)).toBe(tier);
    expect(targetSpeedForScore(score)).toBeCloseTo(speed, 5);
  });

  it('coi giá trị không hợp lệ như điểm 0', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(speedTierForScore(value)).toBe(0);
      expect(targetSpeedForScore(value)).toBe(SPEED_CONFIG.baseSpeed);
    }
  });

  it('không bao giờ giảm khi điểm tăng', () => {
    let previous = 0;
    for (let score = 0; score <= 3000; score += 25) {
      const speed = targetSpeedForScore(score);
      expect(speed).toBeGreaterThanOrEqual(previous);
      expect(speed).toBeLessThanOrEqual(SPEED_CONFIG.maxSpeed);
      previous = speed;
    }
  });

  it('có đúng sáu bậc hiển thị', () => {
    expect(SPEED_TIER_COUNT).toBe(6);
    expect(targetSpeedForScore(SPEED_CONFIG.pointsPerTier * 5)).toBe(SPEED_CONFIG.maxSpeed);
  });

  it('clamp mọi giá trị về khoảng hợp lệ', () => {
    expect(clampWorldSpeed(-100)).toBe(SPEED_CONFIG.baseSpeed);
    expect(clampWorldSpeed(1000)).toBe(SPEED_CONFIG.maxSpeed);
    expect(clampWorldSpeed(Number.NaN)).toBe(SPEED_CONFIG.baseSpeed);
  });
});

describe('SpeedSystem', () => {
  it('bắt đầu và reset về tốc độ nền', () => {
    const system = new SpeedSystem();
    expect(system.getCurrent()).toBe(SPEED_CONFIG.baseSpeed);

    system.applyScore(1500);
    system.update(1);
    system.reset();

    expect(system.getCurrent()).toBe(SPEED_CONFIG.baseSpeed);
    expect(system.tier).toBe(0);
  });

  it('đạt đúng tốc độ mục tiêu sau 0,65 giây', () => {
    const system = new SpeedSystem();
    system.applyScore(300);

    let elapsed = 0;
    while (elapsed < SPEED_CONFIG.transitionSeconds) {
      system.update(1 / 60);
      elapsed += 1 / 60;
    }

    expect(system.getCurrent()).toBeCloseTo(targetSpeedForScore(300), 5);
  });

  it('chuyển mượt: giữa quãng vẫn thấp hơn mục tiêu', () => {
    const system = new SpeedSystem();
    system.applyScore(300);
    const half = system.update(SPEED_CONFIG.transitionSeconds / 2);

    expect(half).toBeGreaterThan(SPEED_CONFIG.baseSpeed);
    expect(half).toBeLessThan(targetSpeedForScore(300));
  });

  it('không vượt trần dù delta bất thường', () => {
    const system = new SpeedSystem();
    system.applyScore(100_000);
    for (const delta of [0, 5, -3, Number.MAX_SAFE_INTEGER]) {
      expect(system.update(delta)).toBeLessThanOrEqual(SPEED_CONFIG.maxSpeed);
    }
  });

  it('tạm dừng không làm transition nhảy cóc', () => {
    const paused = new SpeedSystem();
    const running = new SpeedSystem();
    paused.applyScore(600);
    running.applyScore(600);

    // The paused system is fed zero-length steps, exactly as the game does.
    for (let i = 0; i < 30; i += 1) paused.update(0);
    paused.update(SPEED_CONFIG.transitionSeconds / 2);
    running.update(SPEED_CONFIG.transitionSeconds / 2);

    expect(paused.getCurrent()).toBeCloseTo(running.getCurrent(), 6);
  });

  it('câu sai không đổi mục tiêu vì điểm không đổi', () => {
    const system = new SpeedSystem();
    expect(system.applyScore(320)).not.toBeNull();
    // A wrong answer adds nothing, so the same total arrives again.
    expect(system.applyScore(320)).toBeNull();
  });

  it('báo bậc tối đa đúng một lần mỗi lượt', () => {
    const system = new SpeedSystem();
    system.applyScore(1500);
    expect(system.isAtMaxTier).toBe(true);

    const again = system.applyScore(5000);
    expect(again).toBeNull();
  });
});

describe('khoảng cách cổng', () => {
  it('không bao giờ ngắn hơn khoảng cách nền', () => {
    for (const grade of [1, 2, 3, 4, 5] as Grade[]) {
      expect(gateDistanceForQuestion(grade, 0, 0)).toBeGreaterThanOrEqual(BASE_GATE_DISTANCE);
    }
  });

  it('đủ thời gian đọc cho từng khối lớp ở tốc độ tối đa', () => {
    const expected: Record<Grade, number> = {
      1: 67.875,
      2: 62.25,
      3: 56.625,
      4: 56.625,
      5: 56.625,
    };

    for (const grade of [1, 2, 3, 4, 5] as Grade[]) {
      const distance = gateDistanceForQuestion(grade, SPEED_CONFIG.maxSpeed, SPEED_CONFIG.maxSpeed);
      expect(distance).toBeGreaterThanOrEqual(expected[grade]);
      expect(distance / SPEED_CONFIG.maxSpeed).toBeGreaterThanOrEqual(
        MIN_READING_SECONDS_BY_GRADE[grade],
      );
    }
  });

  it('dùng tốc độ lớn hơn giữa hiện tại và mục tiêu', () => {
    const duringRamp = gateDistanceForQuestion(1, 8, SPEED_CONFIG.maxSpeed);
    const atTarget = gateDistanceForQuestion(1, SPEED_CONFIG.maxSpeed, SPEED_CONFIG.maxSpeed);
    expect(duringRamp).toBeCloseTo(atTarget, 6);
  });

  it('không input nào đẩy tốc độ dự trù vượt trần', () => {
    const absurd = gateDistanceForQuestion(1, 10_000, 10_000);
    expect(absurd).toBeCloseTo(SPEED_CONFIG.maxSpeed * 5.5 + 6, 6);
  });
});

describe('pacing của một câu hỏi', () => {
  it('mọi bản đồ đều cho cùng pacing với cùng điểm', () => {
    // Pacing takes no map argument at all, which is what makes it fair.
    const a = pacingForQuestion(3, 4, 900);
    const b = pacingForQuestion(3, 4, 900);
    expect(a).toEqual(b);
  });

  it('cửa sổ trả lời khớp với khoảng cách và tốc độ', () => {
    const pacing = pacingForQuestion(1, 0, 0);
    expect(pacing.speed).toBe(SPEED_CONFIG.baseSpeed);
    expect(pacing.windowMs).toBeCloseTo((pacing.distance / pacing.speed) * 1000, 6);
    expect(pacing.windowMs / 1000).toBeGreaterThanOrEqual(MIN_READING_SECONDS_BY_GRADE[1]);
  });

  it('điểm cao hơn cho bậc cao hơn nhưng vẫn đủ thời gian đọc', () => {
    const slow = pacingForQuestion(2, 1, 0);
    const fast = pacingForQuestion(2, 1, 1500);

    expect(fast.speed).toBeGreaterThan(slow.speed);
    expect(fast.tier).toBe(5);
    expect(fast.windowMs / 1000).toBeGreaterThanOrEqual(MIN_READING_SECONDS_BY_GRADE[2]);
  });
});
