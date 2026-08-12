import type { Grade, Topic } from '../game-types.ts';

export interface GradeConfig {
  grade: Grade;
  /** Short label used on the grade chips. */
  label: string;
  /** One line describing what the grade practises, shown under the chips. */
  description: string;
  topics: readonly Topic[];
  /** World speed at the start of a run, in units per second. */
  baseSpeed: number;
  /** Hard ceiling for the world speed. */
  maxSpeed: number;
}

/**
 * Grade 1 runs slower than the rest.
 *
 * The specification allows a dedicated slower profile for grade 1 so six and
 * seven year olds have time to read the prompt; it is applied from the start
 * rather than waiting for a playtest to prove the default is too fast.
 */
export const GRADE_CONFIGS: Readonly<Record<Grade, GradeConfig>> = {
  1: {
    grade: 1,
    label: 'Lớp 1',
    description: 'Cộng, trừ, so sánh và số còn thiếu trong phạm vi 20',
    topics: ['addition', 'subtraction', 'comparison', 'missing-number'],
    baseSpeed: 7,
    maxSpeed: 9.5,
  },
  2: {
    grade: 2,
    label: 'Lớp 2',
    description: 'Cộng, trừ, so sánh và số còn thiếu trong phạm vi 100',
    topics: ['addition', 'subtraction', 'comparison', 'missing-number'],
    baseSpeed: 8,
    maxSpeed: 12,
  },
  3: {
    grade: 3,
    label: 'Lớp 3',
    description: 'Bảng nhân chia 2–9, cộng trừ trong phạm vi 1.000',
    topics: ['multiplication', 'division', 'addition', 'subtraction'],
    baseSpeed: 8,
    maxSpeed: 12,
  },
  4: {
    grade: 4,
    label: 'Lớp 4',
    description: 'Nhân, chia hết và biểu thức hai bước',
    topics: ['multiplication', 'division', 'addition', 'subtraction'],
    baseSpeed: 8,
    maxSpeed: 12,
  },
  5: {
    grade: 5,
    label: 'Lớp 5',
    description: 'Số thập phân, phân số cùng mẫu và biểu thức',
    topics: ['decimal', 'fraction', 'multiplication', 'division', 'addition'],
    baseSpeed: 8,
    maxSpeed: 12,
  },
};

export const GRADE_TOPICS: Readonly<Record<Grade, readonly Topic[]>> = {
  1: GRADE_CONFIGS[1].topics,
  2: GRADE_CONFIGS[2].topics,
  3: GRADE_CONFIGS[3].topics,
  4: GRADE_CONFIGS[4].topics,
  5: GRADE_CONFIGS[5].topics,
};

export function getGradeConfig(grade: Grade): GradeConfig {
  return GRADE_CONFIGS[grade];
}
