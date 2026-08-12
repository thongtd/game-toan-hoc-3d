import type { Grade, Question, Topic } from '../game-types.ts';
import { formatFraction, formatInteger, formatTenths } from './format-number.ts';
import { CorrectLaneHistory, placeAnswers } from './shuffle-answers.ts';
import type { Rng } from './seeded-rng.ts';
import { createRng } from './seeded-rng.ts';
import { validateQuestion } from './question-validator.ts';
import { GRADE_TOPICS } from '../content/grade-config.ts';

/**
 * A question before its answers are shuffled into lanes.
 * Keeping this intermediate shape lets every topic generator focus purely on
 * the maths and stay unaware of lane placement rules.
 */
interface RawQuestion {
  topic: Topic;
  prompt: string;
  correct: string;
  distractors: [string, string];
  explanation: string;
}

const MAX_ATTEMPTS_PER_QUESTION = 60;

/* ------------------------------------------------------------------ *
 * Distractor helpers
 * ------------------------------------------------------------------ */

/**
 * Builds plausible wrong integers near `correct`.
 *
 * Offsets scale with the size of the number so a "close miss" stays close:
 * being 1 off is a realistic slip for sums under 20, while 100-scale problems
 * need bigger gaps to look believable.
 */
export function createIntegerDistractors(
  correct: number,
  scale: number,
  rng: Rng,
  options: { allowNegative?: boolean; minimum?: number } = {},
): number[] {
  const allowNegative = options.allowNegative ?? false;
  const minimum = options.minimum ?? 0;

  let offsets: number[];
  if (scale <= 20) {
    offsets = [1, -1, 2, -2, 3, -3];
  } else if (scale <= 100) {
    offsets = [1, -1, 5, -5, 10, -10, 2, -2];
  } else {
    offsets = [10, -10, 50, -50, 100, -100, 1, -1];
  }

  const candidates = rng
    .shuffle(offsets)
    .map((offset) => correct + offset)
    .filter((value) => value !== correct)
    .filter((value) => allowNegative || value >= minimum);

  return [...new Set(candidates)];
}

/** Takes the first two usable distractors, or returns null when impossible. */
function pickTwo(
  candidates: readonly number[],
  format: (n: number) => string,
  correct: string,
): [string, string] | null {
  const seen = new Set<string>([correct]);
  const chosen: string[] = [];
  for (const candidate of candidates) {
    const text = format(candidate);
    if (seen.has(text)) continue;
    seen.add(text);
    chosen.push(text);
    if (chosen.length === 2) break;
  }
  const [first, second] = chosen;
  if (first === undefined || second === undefined) return null;
  return [first, second];
}

/* ------------------------------------------------------------------ *
 * Topic generators
 * ------------------------------------------------------------------ */

function generateAddition(grade: Grade, rng: Rng): RawQuestion | null {
  const max = grade === 1 ? 20 : grade === 2 ? 100 : 1000;
  const a = rng.int(1, Math.floor(max / 2));
  const b = rng.int(1, max - a);
  const result = a + b;

  const distractors = pickTwo(
    createIntegerDistractors(result, max, rng),
    formatInteger,
    formatInteger(result),
  );
  if (distractors === null) return null;

  return {
    topic: 'addition',
    prompt: `${String(a)} + ${String(b)} = ?`,
    correct: formatInteger(result),
    distractors,
    explanation: `${String(a)} cộng ${String(b)} bằng ${String(result)}.`,
  };
}

function generateSubtraction(grade: Grade, rng: Rng): RawQuestion | null {
  const max = grade === 1 ? 20 : grade === 2 ? 100 : 1000;
  const a = rng.int(2, max);
  const b = rng.int(1, a); // never negative
  const result = a - b;

  const distractors = pickTwo(
    createIntegerDistractors(result, max, rng),
    formatInteger,
    formatInteger(result),
  );
  if (distractors === null) return null;

  return {
    topic: 'subtraction',
    prompt: `${String(a)} − ${String(b)} = ?`,
    correct: formatInteger(result),
    distractors,
    explanation: `${String(a)} trừ ${String(b)} bằng ${String(result)}.`,
  };
}

function generateMultiplication(grade: Grade, rng: Rng): RawQuestion | null {
  const a = rng.int(2, 9);
  const b = grade >= 4 ? rng.int(2, 29) : rng.int(2, 9);
  const result = a * b;

  // Mirror the mistakes children actually make: an off-by-one row or column
  // in the times table.
  const candidates = rng.shuffle([
    (a + 1) * b,
    (a - 1) * b,
    a * (b + 1),
    a * (b - 1),
    result + 1,
    result - 1,
  ]);
  const distractors = pickTwo(
    candidates.filter((value) => value > 0),
    formatInteger,
    formatInteger(result),
  );
  if (distractors === null) return null;

  return {
    topic: 'multiplication',
    prompt: `${String(a)} × ${String(b)} = ?`,
    correct: formatInteger(result),
    distractors,
    explanation: `${String(a)} nhân ${String(b)} bằng ${String(result)}.`,
  };
}

function generateDivision(grade: Grade, rng: Rng): RawQuestion | null {
  // Build the problem from the answer so the division is always exact.
  const divisor = rng.int(2, 9);
  const quotient = grade >= 4 ? rng.int(2, 20) : rng.int(2, 9);
  const dividend = divisor * quotient;

  const candidates = rng.shuffle([quotient + 1, quotient - 1, quotient + 2, quotient - 2, divisor]);
  const distractors = pickTwo(
    candidates.filter((value) => value > 0 && value !== quotient),
    formatInteger,
    formatInteger(quotient),
  );
  if (distractors === null) return null;

  return {
    topic: 'division',
    prompt: `${String(dividend)} : ${String(divisor)} = ?`,
    correct: formatInteger(quotient),
    distractors,
    explanation: `${String(dividend)} chia ${String(divisor)} bằng ${String(quotient)}.`,
  };
}

function generateComparison(grade: Grade, rng: Rng): RawQuestion | null {
  const max = grade === 1 ? 20 : grade === 2 ? 100 : 1000;
  const a = rng.int(1, max);
  // Keep the two sides close together often enough that the answer needs thought.
  const b = rng.chance(0.25) ? a : Math.max(1, Math.min(max, a + rng.int(-9, 9)));

  const correct = a > b ? '>' : a < b ? '<' : '=';
  const others = (['>', '<', '='] as const).filter((symbol) => symbol !== correct);
  const [first, second] = others;
  if (first === undefined || second === undefined) return null;

  const relation = correct === '>' ? 'lớn hơn' : correct === '<' ? 'bé hơn' : 'bằng';

  return {
    topic: 'comparison',
    prompt: `${String(a)} ... ${String(b)}`,
    correct,
    distractors: [first, second],
    explanation: `${String(a)} ${relation} ${String(b)}.`,
  };
}

function generateMissingNumber(grade: Grade, rng: Rng): RawQuestion | null {
  const max = grade === 1 ? 20 : grade === 2 ? 100 : 1000;
  const useAddition = rng.chance(0.5);

  let prompt: string;
  let missing: number;
  let explanation: string;

  if (useAddition) {
    const known = rng.int(1, max - 2);
    missing = rng.int(1, max - known);
    const total = known + missing;
    prompt = `${String(known)} + ? = ${String(total)}`;
    explanation = `${String(total)} trừ ${String(known)} bằng ${String(missing)}.`;
  } else {
    const total = rng.int(3, max);
    missing = rng.int(1, total - 1);
    const result = total - missing;
    prompt = `${String(total)} − ? = ${String(result)}`;
    explanation = `${String(total)} trừ ${String(result)} bằng ${String(missing)}.`;
  }

  const distractors = pickTwo(
    createIntegerDistractors(missing, max, rng, { minimum: 0 }),
    formatInteger,
    formatInteger(missing),
  );
  if (distractors === null) return null;

  return {
    topic: 'missing-number',
    prompt,
    correct: formatInteger(missing),
    distractors,
    explanation,
  };
}

/** Grade 4-5 two-step expression, kept inside non-negative integers. */
function generateExpression(rng: Rng): RawQuestion | null {
  const a = rng.int(2, 9);
  const b = rng.int(2, 9);
  const c = rng.int(1, 40);
  const product = a * b;
  const addition = rng.chance(0.6);
  const result = addition ? product + c : Math.max(0, product - Math.min(c, product));
  const shownC = addition ? c : Math.min(c, product);

  const prompt = `${String(a)} × ${String(b)} ${addition ? '+' : '−'} ${String(shownC)} = ?`;

  const candidates = rng.shuffle([
    result + 1,
    result - 1,
    result + 10,
    result - 10,
    addition ? product - shownC : product + shownC,
    a * (b + 1),
  ]);
  const distractors = pickTwo(
    candidates.filter((value) => value >= 0),
    formatInteger,
    formatInteger(result),
  );
  if (distractors === null) return null;

  return {
    topic: addition ? 'addition' : 'subtraction',
    prompt,
    correct: formatInteger(result),
    distractors,
    explanation: `${String(a)} × ${String(b)} = ${String(product)}, rồi ${
      addition ? `${String(product)} + ${String(shownC)}` : `${String(product)} − ${String(shownC)}`
    } = ${String(result)}.`,
  };
}

/** Grade 5 decimals with a single decimal place, computed in integer tenths. */
function generateDecimal(rng: Rng): RawQuestion | null {
  const addition = rng.chance(0.6);
  const aTenths = rng.int(11, 99);
  const bTenths = addition ? rng.int(11, 99) : rng.int(11, aTenths);
  const resultTenths = addition ? aTenths + bTenths : aTenths - bTenths;

  const candidates = rng.shuffle([
    resultTenths + 1,
    resultTenths - 1,
    resultTenths + 10,
    resultTenths - 10,
    // Classic slip: adding the whole and fractional parts separately.
    addition ? aTenths + bTenths + 10 : aTenths - bTenths - 10,
  ]);
  const distractors = pickTwo(
    candidates.filter((value) => value > 0),
    formatTenths,
    formatTenths(resultTenths),
  );
  if (distractors === null) return null;

  const symbol = addition ? '+' : '−';
  return {
    topic: 'decimal',
    prompt: `${formatTenths(aTenths)} ${symbol} ${formatTenths(bTenths)} = ?`,
    correct: formatTenths(resultTenths),
    distractors,
    explanation: `${formatTenths(aTenths)} ${symbol} ${formatTenths(bTenths)} = ${formatTenths(resultTenths)}.`,
  };
}

/** Grade 5 fractions - version 1 keeps the denominators equal. */
function generateFraction(rng: Rng): RawQuestion | null {
  const denominator = rng.pick([2, 3, 4, 5, 8, 10]);
  if (denominator < 3) return null; // needs room for two numerators

  const addition = rng.chance(0.6);
  let a: number;
  let b: number;
  let result: number;

  if (addition) {
    a = rng.int(1, denominator - 2);
    b = rng.int(1, denominator - 1 - a);
    result = a + b;
  } else {
    a = rng.int(2, denominator - 1);
    b = rng.int(1, a - 1);
    result = a - b;
  }
  if (result <= 0 || result >= denominator) return null;

  const symbol = addition ? '+' : '−';
  const correct = formatFraction(result, denominator);

  // The signature mistake is operating on the denominators too.
  const wrongDenominator = addition ? denominator * 2 : denominator;
  const candidateFractions = rng.shuffle([
    formatFraction(result, wrongDenominator === denominator ? denominator + 1 : wrongDenominator),
    formatFraction(Math.min(denominator - 1, result + 1), denominator),
    formatFraction(Math.max(1, result - 1), denominator),
    formatFraction(a + b, denominator + b),
  ]);

  const seen = new Set<string>([correct]);
  const chosen: string[] = [];
  for (const candidate of candidateFractions) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    chosen.push(candidate);
    if (chosen.length === 2) break;
  }
  const [first, second] = chosen;
  if (first === undefined || second === undefined) return null;

  return {
    topic: 'fraction',
    prompt: `${formatFraction(a, denominator)} ${symbol} ${formatFraction(b, denominator)} = ?`,
    correct,
    distractors: [first, second],
    explanation: `Cùng mẫu số nên chỉ ${addition ? 'cộng' : 'trừ'} tử số: ${String(a)} ${symbol} ${String(b)} = ${String(result)}, giữ nguyên mẫu số ${String(denominator)}.`,
  };
}

/* ------------------------------------------------------------------ *
 * Topic dispatch
 * ------------------------------------------------------------------ */

function generateForTopic(topic: Topic, grade: Grade, rng: Rng): RawQuestion | null {
  switch (topic) {
    case 'addition':
      return grade >= 4 && rng.chance(0.45)
        ? generateExpression(rng)
        : generateAddition(grade, rng);
    case 'subtraction':
      return generateSubtraction(grade, rng);
    case 'multiplication':
      return generateMultiplication(grade, rng);
    case 'division':
      return generateDivision(grade, rng);
    case 'comparison':
      return generateComparison(grade, rng);
    case 'missing-number':
      return generateMissingNumber(grade, rng);
    case 'decimal':
      return generateDecimal(rng);
    case 'fraction':
      return generateFraction(rng);
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export interface GenerateOptions {
  grade: Grade;
  seed: number;
  count: number;
}

/**
 * Generates a run's worth of questions.
 *
 * Guarantees (all covered by `tests/unit/question-generator.test.ts`):
 * - exactly three distinct answers per question;
 * - `correctIndex` points at the correct answer;
 * - no repeated prompt inside one run;
 * - the correct answer never sits in the same lane more than twice in a row;
 * - the same seed always produces the same run.
 */
export function generateQuestions(options: GenerateOptions): Question[] {
  const { grade, seed, count } = options;
  if (count <= 0) return [];

  const rng = createRng(seed);
  const topics = GRADE_TOPICS[grade];
  const laneHistory = new CorrectLaneHistory(2);
  const usedPrompts = new Set<string>();
  const questions: Question[] = [];

  let topicCursor = rng.int(0, topics.length - 1);

  while (questions.length < count) {
    let produced: Question | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_QUESTION; attempt += 1) {
      const topic = topics[topicCursor % topics.length];
      topicCursor += 1;
      if (topic === undefined) continue;

      const raw = generateForTopic(topic, grade, rng);
      if (raw === null) continue;
      if (usedPrompts.has(raw.prompt)) continue;

      let placed;
      try {
        placed = placeAnswers(raw.correct, raw.distractors, rng, laneHistory.forbiddenIndex());
      } catch {
        // Distractors collided after formatting - try another question.
        continue;
      }

      const question: Question = {
        id: `g${String(grade)}-${raw.topic}-${String(seed)}-${String(questions.length)}`,
        grade,
        topic: raw.topic,
        prompt: raw.prompt,
        answers: placed.answers,
        correctIndex: placed.correctIndex,
        explanation: raw.explanation,
      };

      const problems = validateQuestion(question);
      if (problems.length > 0) continue;

      produced = question;
      break;
    }

    if (produced === null) {
      // The generator could not satisfy the constraints. Callers fall back to
      // the handcrafted seed questions rather than shipping a broken run.
      throw new GenerationExhaustedError(grade, questions.length, count);
    }

    usedPrompts.add(produced.prompt);
    laneHistory.record(produced.correctIndex);
    questions.push(produced);
  }

  return questions;
}

export class GenerationExhaustedError extends Error {
  readonly grade: Grade;
  readonly produced: number;
  readonly requested: number;

  constructor(grade: Grade, produced: number, requested: number) {
    super(
      `Question generator exhausted for grade ${String(grade)}: produced ${String(produced)} of ${String(requested)}`,
    );
    this.name = 'GenerationExhaustedError';
    this.grade = grade;
    this.produced = produced;
    this.requested = requested;
  }
}
