import type { Grade, Question } from '../game-types.ts';
import type { Rng } from '../math/seeded-rng.ts';

/**
 * Handcrafted questions, ten per grade.
 *
 * They serve three purposes:
 * 1. a stable set for smoke tests and fixed demos;
 * 2. a fallback if the generator ever fails to produce a full valid run;
 * 3. a readable reference for what each grade is expected to practise.
 *
 * The minus sign is U+2212 (−) everywhere so prompts render evenly and the
 * validator parses them the same way it parses generated prompts.
 */
export const SEED_QUESTIONS: readonly Question[] = [
  /* ------------------------------ Grade 1 ------------------------------ */
  {
    id: 'g1-add-001',
    grade: 1,
    topic: 'addition',
    prompt: '8 + 7 = ?',
    answers: ['13', '15', '17'],
    correctIndex: 1,
    explanation: '8 cộng 7 bằng 15.',
  },
  {
    id: 'g1-add-002',
    grade: 1,
    topic: 'addition',
    prompt: '5 + 6 = ?',
    answers: ['11', '12', '10'],
    correctIndex: 0,
    explanation: '5 cộng 6 bằng 11.',
  },
  {
    id: 'g1-sub-001',
    grade: 1,
    topic: 'subtraction',
    prompt: '14 − 6 = ?',
    answers: ['7', '9', '8'],
    correctIndex: 2,
    explanation: '14 trừ 6 bằng 8.',
  },
  {
    id: 'g1-sub-002',
    grade: 1,
    topic: 'subtraction',
    prompt: '20 − 9 = ?',
    answers: ['12', '11', '9'],
    correctIndex: 1,
    explanation: '20 trừ 9 bằng 11.',
  },
  {
    id: 'g1-cmp-001',
    grade: 1,
    topic: 'comparison',
    prompt: '12 ... 9',
    answers: ['<', '>', '='],
    correctIndex: 1,
    explanation: '12 lớn hơn 9.',
  },
  {
    id: 'g1-cmp-002',
    grade: 1,
    topic: 'comparison',
    prompt: '7 ... 15',
    answers: ['<', '>', '='],
    correctIndex: 0,
    explanation: '7 bé hơn 15.',
  },
  {
    id: 'g1-mis-001',
    grade: 1,
    topic: 'missing-number',
    prompt: '6 + ? = 13',
    answers: ['8', '7', '6'],
    correctIndex: 1,
    explanation: '13 trừ 6 bằng 7.',
  },
  {
    id: 'g1-mis-002',
    grade: 1,
    topic: 'missing-number',
    prompt: '18 − ? = 10',
    answers: ['9', '6', '8'],
    correctIndex: 2,
    explanation: '18 trừ 10 bằng 8.',
  },
  {
    id: 'g1-add-003',
    grade: 1,
    topic: 'addition',
    prompt: '9 + 9 = ?',
    answers: ['16', '19', '18'],
    correctIndex: 2,
    explanation: '9 cộng 9 bằng 18.',
  },
  {
    id: 'g1-sub-003',
    grade: 1,
    topic: 'subtraction',
    prompt: '11 − 4 = ?',
    answers: ['7', '8', '6'],
    correctIndex: 0,
    explanation: '11 trừ 4 bằng 7.',
  },

  /* ------------------------------ Grade 2 ------------------------------ */
  {
    id: 'g2-add-001',
    grade: 2,
    topic: 'addition',
    prompt: '36 + 27 = ?',
    answers: ['53', '63', '62'],
    correctIndex: 1,
    explanation: '36 cộng 27 bằng 63.',
  },
  {
    id: 'g2-add-002',
    grade: 2,
    topic: 'addition',
    prompt: '45 + 38 = ?',
    answers: ['73', '83', '84'],
    correctIndex: 1,
    explanation: '45 cộng 38 bằng 83.',
  },
  {
    id: 'g2-sub-001',
    grade: 2,
    topic: 'subtraction',
    prompt: '72 − 35 = ?',
    answers: ['37', '47', '35'],
    correctIndex: 0,
    explanation: '72 trừ 35 bằng 37.',
  },
  {
    id: 'g2-sub-002',
    grade: 2,
    topic: 'subtraction',
    prompt: '90 − 48 = ?',
    answers: ['52', '42', '32'],
    correctIndex: 1,
    explanation: '90 trừ 48 bằng 42.',
  },
  {
    id: 'g2-cmp-001',
    grade: 2,
    topic: 'comparison',
    prompt: '64 ... 46',
    answers: ['>', '<', '='],
    correctIndex: 0,
    explanation: '64 lớn hơn 46.',
  },
  {
    id: 'g2-cmp-002',
    grade: 2,
    topic: 'comparison',
    prompt: '58 ... 58',
    answers: ['>', '<', '='],
    correctIndex: 2,
    explanation: '58 bằng 58.',
  },
  {
    id: 'g2-mis-001',
    grade: 2,
    topic: 'missing-number',
    prompt: '25 + ? = 60',
    answers: ['35', '45', '30'],
    correctIndex: 0,
    explanation: '60 trừ 25 bằng 35.',
  },
  {
    id: 'g2-mis-002',
    grade: 2,
    topic: 'missing-number',
    prompt: '81 − ? = 47',
    answers: ['24', '44', '34'],
    correctIndex: 2,
    explanation: '81 trừ 47 bằng 34.',
  },
  {
    id: 'g2-add-003',
    grade: 2,
    topic: 'addition',
    prompt: '19 + 46 = ?',
    answers: ['65', '55', '66'],
    correctIndex: 0,
    explanation: '19 cộng 46 bằng 65.',
  },
  {
    id: 'g2-sub-003',
    grade: 2,
    topic: 'subtraction',
    prompt: '100 − 63 = ?',
    answers: ['47', '37', '33'],
    correctIndex: 1,
    explanation: '100 trừ 63 bằng 37.',
  },

  /* ------------------------------ Grade 3 ------------------------------ */
  {
    id: 'g3-mul-001',
    grade: 3,
    topic: 'multiplication',
    prompt: '7 × 8 = ?',
    answers: ['48', '56', '54'],
    correctIndex: 1,
    explanation: '7 nhân 8 bằng 56.',
  },
  {
    id: 'g3-mul-002',
    grade: 3,
    topic: 'multiplication',
    prompt: '6 × 9 = ?',
    answers: ['54', '45', '56'],
    correctIndex: 0,
    explanation: '6 nhân 9 bằng 54.',
  },
  {
    id: 'g3-div-001',
    grade: 3,
    topic: 'division',
    prompt: '42 : 6 = ?',
    answers: ['6', '8', '7'],
    correctIndex: 2,
    explanation: '42 chia 6 bằng 7.',
  },
  {
    id: 'g3-div-002',
    grade: 3,
    topic: 'division',
    prompt: '72 : 9 = ?',
    answers: ['8', '9', '7'],
    correctIndex: 0,
    explanation: '72 chia 9 bằng 8.',
  },
  {
    id: 'g3-mul-003',
    grade: 3,
    topic: 'multiplication',
    prompt: '4 × 7 = ?',
    answers: ['24', '28', '32'],
    correctIndex: 1,
    explanation: '4 nhân 7 bằng 28.',
  },
  {
    id: 'g3-div-003',
    grade: 3,
    topic: 'division',
    prompt: '56 : 8 = ?',
    answers: ['7', '6', '9'],
    correctIndex: 0,
    explanation: '56 chia 8 bằng 7.',
  },
  {
    id: 'g3-add-001',
    grade: 3,
    topic: 'addition',
    prompt: '348 + 256 = ?',
    answers: ['594', '604', '614'],
    correctIndex: 1,
    explanation: '348 cộng 256 bằng 604.',
  },
  {
    id: 'g3-sub-001',
    grade: 3,
    topic: 'subtraction',
    prompt: '725 − 480 = ?',
    answers: ['235', '255', '245'],
    correctIndex: 2,
    explanation: '725 trừ 480 bằng 245.',
  },
  {
    id: 'g3-mul-004',
    grade: 3,
    topic: 'multiplication',
    prompt: '9 × 6 = ?',
    answers: ['54', '63', '48'],
    correctIndex: 0,
    explanation: '9 nhân 6 bằng 54.',
  },
  {
    id: 'g3-div-004',
    grade: 3,
    topic: 'division',
    prompt: '63 : 7 = ?',
    answers: ['8', '9', '7'],
    correctIndex: 1,
    explanation: '63 chia 7 bằng 9.',
  },

  /* ------------------------------ Grade 4 ------------------------------ */
  {
    id: 'g4-mul-001',
    grade: 4,
    topic: 'multiplication',
    prompt: '23 × 4 = ?',
    answers: ['82', '92', '96'],
    correctIndex: 1,
    explanation: '23 nhân 4 bằng 92.',
  },
  {
    id: 'g4-mul-002',
    grade: 4,
    topic: 'multiplication',
    prompt: '36 × 5 = ?',
    answers: ['180', '170', '185'],
    correctIndex: 0,
    explanation: '36 nhân 5 bằng 180.',
  },
  {
    id: 'g4-div-001',
    grade: 4,
    topic: 'division',
    prompt: '144 : 6 = ?',
    answers: ['24', '26', '22'],
    correctIndex: 0,
    explanation: '144 chia 6 bằng 24.',
  },
  {
    id: 'g4-div-002',
    grade: 4,
    topic: 'division',
    prompt: '126 : 9 = ?',
    answers: ['12', '14', '16'],
    correctIndex: 1,
    explanation: '126 chia 9 bằng 14.',
  },
  {
    id: 'g4-exp-001',
    grade: 4,
    topic: 'addition',
    prompt: '8 × 7 + 15 = ?',
    answers: ['61', '71', '70'],
    correctIndex: 1,
    explanation: '8 × 7 = 56, rồi 56 + 15 = 71.',
  },
  {
    id: 'g4-exp-002',
    grade: 4,
    topic: 'subtraction',
    prompt: '9 × 6 − 24 = ?',
    answers: ['30', '20', '34'],
    correctIndex: 0,
    explanation: '9 × 6 = 54, rồi 54 − 24 = 30.',
  },
  {
    id: 'g4-mul-003',
    grade: 4,
    topic: 'multiplication',
    prompt: '48 × 3 = ?',
    answers: ['134', '154', '144'],
    correctIndex: 2,
    explanation: '48 nhân 3 bằng 144.',
  },
  {
    id: 'g4-div-003',
    grade: 4,
    topic: 'division',
    prompt: '216 : 8 = ?',
    answers: ['27', '24', '28'],
    correctIndex: 0,
    explanation: '216 chia 8 bằng 27.',
  },
  {
    id: 'g4-exp-003',
    grade: 4,
    topic: 'addition',
    prompt: '7 × 9 + 12 = ?',
    answers: ['65', '75', '73'],
    correctIndex: 1,
    explanation: '7 × 9 = 63, rồi 63 + 12 = 75.',
  },
  {
    id: 'g4-exp-004',
    grade: 4,
    topic: 'subtraction',
    prompt: '5 × 8 − 17 = ?',
    answers: ['33', '23', '13'],
    correctIndex: 1,
    explanation: '5 × 8 = 40, rồi 40 − 17 = 23.',
  },

  /* ------------------------------ Grade 5 ------------------------------ */
  {
    id: 'g5-dec-001',
    grade: 5,
    topic: 'decimal',
    prompt: '2,5 + 1,3 = ?',
    answers: ['3,6', '3,8', '4,8'],
    correctIndex: 1,
    explanation: '2,5 cộng 1,3 bằng 3,8.',
  },
  {
    id: 'g5-dec-002',
    grade: 5,
    topic: 'decimal',
    prompt: '7,4 − 2,9 = ?',
    answers: ['4,5', '5,5', '4,3'],
    correctIndex: 0,
    explanation: '7,4 trừ 2,9 bằng 4,5.',
  },
  {
    id: 'g5-fra-001',
    grade: 5,
    topic: 'fraction',
    prompt: '1/4 + 2/4 = ?',
    answers: ['3/8', '2/4', '3/4'],
    correctIndex: 2,
    explanation: 'Cùng mẫu số nên chỉ cộng tử số: 1 + 2 = 3, giữ nguyên mẫu số 4.',
  },
  {
    id: 'g5-fra-002',
    grade: 5,
    topic: 'fraction',
    prompt: '5/8 − 2/8 = ?',
    answers: ['3/8', '7/8', '3/16'],
    correctIndex: 0,
    explanation: 'Cùng mẫu số nên chỉ trừ tử số: 5 − 2 = 3, giữ nguyên mẫu số 8.',
  },
  {
    id: 'g5-dec-003',
    grade: 5,
    topic: 'decimal',
    prompt: '6,2 + 3,9 = ?',
    answers: ['10,1', '9,1', '10,2'],
    correctIndex: 0,
    explanation: '6,2 cộng 3,9 bằng 10,1.',
  },
  {
    id: 'g5-dec-004',
    grade: 5,
    topic: 'decimal',
    prompt: '12,0 − 4,5 = ?',
    answers: ['8,5', '7,5', '7,0'],
    correctIndex: 1,
    explanation: '12,0 trừ 4,5 bằng 7,5.',
  },
  {
    id: 'g5-fra-003',
    grade: 5,
    topic: 'fraction',
    prompt: '3/5 + 1/5 = ?',
    answers: ['4/5', '4/10', '2/5'],
    correctIndex: 0,
    explanation: 'Cùng mẫu số nên chỉ cộng tử số: 3 + 1 = 4, giữ nguyên mẫu số 5.',
  },
  {
    id: 'g5-fra-004',
    grade: 5,
    topic: 'fraction',
    prompt: '9/10 − 4/10 = ?',
    answers: ['5/20', '5/10', '6/10'],
    correctIndex: 1,
    explanation: 'Cùng mẫu số nên chỉ trừ tử số: 9 − 4 = 5, giữ nguyên mẫu số 10.',
  },
  {
    id: 'g5-exp-001',
    grade: 5,
    topic: 'multiplication',
    prompt: '8 × 7 + 24 = ?',
    answers: ['70', '80', '78'],
    correctIndex: 1,
    explanation: '8 × 7 = 56, rồi 56 + 24 = 80.',
  },
  {
    id: 'g5-dec-005',
    grade: 5,
    topic: 'decimal',
    prompt: '0,8 + 0,7 = ?',
    answers: ['1,5', '1,4', '2,5'],
    correctIndex: 0,
    explanation: '0,8 cộng 0,7 bằng 1,5.',
  },
];

/** All handcrafted questions for one grade, in authoring order. */
export function getSeedQuestions(grade: Grade): Question[] {
  return SEED_QUESTIONS.filter((question) => question.grade === grade);
}

/**
 * Fallback run used when the generator cannot produce a full set of valid
 * questions. Repeats the handcrafted pool in a seeded order if more questions
 * are requested than exist.
 */
export function buildFallbackRun(grade: Grade, count: number, rng: Rng): Question[] {
  const pool = getSeedQuestions(grade);
  if (pool.length === 0) return [];

  const run: Question[] = [];
  let shuffled = rng.shuffle(pool);
  let cursor = 0;

  while (run.length < count) {
    if (cursor >= shuffled.length) {
      shuffled = rng.shuffle(pool);
      cursor = 0;
    }
    const question = shuffled[cursor];
    cursor += 1;
    if (question === undefined) continue;
    run.push({ ...question, id: `${question.id}-r${String(run.length)}` });
  }

  return run;
}
