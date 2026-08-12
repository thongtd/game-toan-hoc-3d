import { describe, expect, it } from 'vitest';
import {
  createIntegerDistractors,
  generateQuestions,
} from '../../shared/math/question-generator.ts';
import { evaluatePrompt, validateQuestion } from '../../shared/math/question-validator.ts';
import { ALL_GRADES } from '../../shared/game-types.ts';
import type { Grade, Question } from '../../shared/game-types.ts';
import { createRng } from '../../shared/math/seeded-rng.ts';
import {
  SEED_QUESTIONS,
  buildFallbackRun,
  getSeedQuestions,
} from '../../shared/content/seed-questions.ts';

/** Generates at least `minimum` questions for a grade across several runs. */
function generateMany(grade: Grade, minimum: number): Question[] {
  const collected: Question[] = [];
  let seed = 1;
  while (collected.length < minimum) {
    collected.push(...generateQuestions({ grade, seed, count: 12 }));
    seed += 1;
  }
  return collected;
}

const DECIMAL_ANSWER = /^\d+,\d$/;
const FRACTION_ANSWER = /^\d+\/\d+$/;
const INTEGER_ANSWER = /^-?\d+$/;
const COMPARISON_ANSWER = /^[<>=]$/;

describe('generateQuestions', () => {
  it.each([...ALL_GRADES])('produces 1000 valid questions for grade %i', (grade) => {
    const questions = generateMany(grade, 1000);
    expect(questions.length).toBeGreaterThanOrEqual(1000);

    for (const question of questions) {
      const problems = validateQuestion(question);
      expect(problems, `${question.prompt} -> ${problems.join('; ')}`).toEqual([]);
    }
  });

  it.each([...ALL_GRADES])('always has exactly three distinct answers (grade %i)', (grade) => {
    for (const question of generateMany(grade, 1000)) {
      expect(question.answers).toHaveLength(3);
      expect(new Set(question.answers).size).toBe(3);
      for (const answer of question.answers) {
        expect(answer.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it.each([...ALL_GRADES])('marks a correctIndex between 0 and 2 (grade %i)', (grade) => {
    for (const question of generateMany(grade, 1000)) {
      expect([0, 1, 2]).toContain(question.correctIndex);
    }
  });

  it.each([...ALL_GRADES])(
    'points correctIndex at the independently recomputed answer (grade %i)',
    (grade) => {
      let verified = 0;
      for (const question of generateMany(grade, 1000)) {
        const expected = evaluatePrompt(question.prompt);
        if (expected === null) continue;
        expect(question.answers[question.correctIndex]).toBe(expected);
        verified += 1;
      }
      // Every prompt shape the generator emits must be verifiable.
      expect(verified).toBeGreaterThanOrEqual(1000);
    },
  );

  it.each([1, 2, 3, 4] as const)('never produces a negative result for grade %i', (grade) => {
    for (const question of generateMany(grade, 1000)) {
      for (const answer of question.answers) {
        expect(answer.startsWith('-')).toBe(false);
      }
    }
  });

  it.each([...ALL_GRADES])('only divides exactly (grade %i)', (grade) => {
    for (const question of generateMany(grade, 1000)) {
      const match = /^(\d+) : (\d+) = \?$/.exec(question.prompt);
      if (match === null) continue;
      const dividend = Number(match[1]);
      const divisor = Number(match[2]);
      expect(divisor).toBeGreaterThan(0);
      expect(dividend % divisor).toBe(0);
      expect(question.answers[question.correctIndex]).toBe(String(dividend / divisor));
    }
  });

  it('keeps grade 1 inside 20 and grade 2 inside 100', () => {
    const limits: readonly (readonly [Grade, number])[] = [
      [1, 20],
      [2, 100],
    ];
    for (const [grade, limit] of limits) {
      for (const question of generateMany(grade, 1000)) {
        const numbers = [...question.prompt.matchAll(/\d+/g)].map((m) => Number(m[0]));
        for (const value of numbers) {
          expect(value).toBeLessThanOrEqual(limit);
        }
      }
    }
  });

  it('uses only same-denominator fractions from the allowed set for grade 5', () => {
    const allowed = new Set([2, 3, 4, 5, 8, 10]);
    let seen = 0;
    for (const question of generateMany(5, 1000)) {
      if (question.topic !== 'fraction') continue;
      seen += 1;
      const denominators = [...question.prompt.matchAll(/\d+\/(\d+)/g)].map((m) => Number(m[1]));
      expect(denominators.length).toBe(2);
      expect(new Set(denominators).size).toBe(1);
      expect(allowed.has(denominators[0]!)).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('formats every answer in one of the four supported shapes', () => {
    for (const grade of ALL_GRADES) {
      for (const question of generateMany(grade, 500)) {
        for (const answer of question.answers) {
          const recognised =
            INTEGER_ANSWER.test(answer) ||
            DECIMAL_ANSWER.test(answer) ||
            FRACTION_ANSWER.test(answer) ||
            COMPARISON_ANSWER.test(answer);
          expect(recognised, `unexpected answer format: ${answer}`).toBe(true);
        }
      }
    }
  });

  it('never repeats a prompt inside one run', () => {
    for (const grade of ALL_GRADES) {
      for (let seed = 1; seed <= 60; seed += 1) {
        const run = generateQuestions({ grade, seed, count: 12 });
        expect(new Set(run.map((q) => q.prompt)).size).toBe(12);
      }
    }
  });

  it('never leaves the correct answer in one lane more than twice in a row', () => {
    for (const grade of ALL_GRADES) {
      for (let seed = 1; seed <= 60; seed += 1) {
        const run = generateQuestions({ grade, seed, count: 12 });
        let repeats = 1;
        for (let i = 1; i < run.length; i += 1) {
          repeats = run[i]!.correctIndex === run[i - 1]!.correctIndex ? repeats + 1 : 1;
          expect(repeats, `lane repeated ${repeats} times at seed ${seed}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('is reproducible for the same seed', () => {
    for (const grade of ALL_GRADES) {
      const first = generateQuestions({ grade, seed: 4242, count: 12 });
      const second = generateQuestions({ grade, seed: 4242, count: 12 });
      expect(second).toEqual(first);
    }
  });

  it('produces different runs for different seeds in almost every case', () => {
    let identical = 0;
    const samples = 100;
    for (let seed = 1; seed <= samples; seed += 1) {
      const a = generateQuestions({ grade: 3, seed, count: 12 })
        .map((q) => q.prompt)
        .join('|');
      const b = generateQuestions({ grade: 3, seed: seed + 1000, count: 12 })
        .map((q) => q.prompt)
        .join('|');
      if (a === b) identical += 1;
    }
    expect(identical).toBeLessThanOrEqual(1);
  });

  it('returns an empty run when asked for no questions', () => {
    expect(generateQuestions({ grade: 1, seed: 1, count: 0 })).toEqual([]);
  });
});

describe('createIntegerDistractors', () => {
  it('never returns the correct value and stays non-negative by default', () => {
    const rng = createRng(7);
    for (let correct = 0; correct <= 60; correct += 1) {
      const candidates = createIntegerDistractors(correct, 100, rng);
      expect(candidates).not.toContain(correct);
      for (const value of candidates) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
      expect(new Set(candidates).size).toBe(candidates.length);
    }
  });

  it('keeps distractors close for small numbers', () => {
    const rng = createRng(11);
    for (const value of createIntegerDistractors(12, 20, rng)) {
      expect(Math.abs(value - 12)).toBeLessThanOrEqual(3);
    }
  });
});

describe('seed questions', () => {
  it('provides at least ten handcrafted questions per grade', () => {
    for (const grade of ALL_GRADES) {
      expect(getSeedQuestions(grade).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('passes the same validation as generated questions', () => {
    for (const question of SEED_QUESTIONS) {
      const problems = validateQuestion(question);
      expect(problems, `${question.id}: ${problems.join('; ')}`).toEqual([]);
    }
  });

  it('uses unique ids', () => {
    expect(new Set(SEED_QUESTIONS.map((q) => q.id)).size).toBe(SEED_QUESTIONS.length);
  });

  it('builds a full fallback run of the requested length', () => {
    for (const grade of ALL_GRADES) {
      const run = buildFallbackRun(grade, 12, createRng(99));
      expect(run).toHaveLength(12);
      expect(new Set(run.map((q) => q.id)).size).toBe(12);
      for (const question of run) {
        expect(validateQuestion(question)).toEqual([]);
      }
    }
  });
});

describe('evaluatePrompt', () => {
  it('recomputes each supported prompt shape', () => {
    expect(evaluatePrompt('8 + 7 = ?')).toBe('15');
    expect(evaluatePrompt('14 − 6 = ?')).toBe('8');
    expect(evaluatePrompt('7 × 8 = ?')).toBe('56');
    expect(evaluatePrompt('42 : 6 = ?')).toBe('7');
    expect(evaluatePrompt('8 × 7 + 15 = ?')).toBe('71');
    expect(evaluatePrompt('9 × 6 − 24 = ?')).toBe('30');
    expect(evaluatePrompt('6 + ? = 13')).toBe('7');
    expect(evaluatePrompt('18 − ? = 10')).toBe('8');
    expect(evaluatePrompt('12 ... 9')).toBe('>');
    expect(evaluatePrompt('7 ... 15')).toBe('<');
    expect(evaluatePrompt('58 ... 58')).toBe('=');
    expect(evaluatePrompt('2,5 + 1,3 = ?')).toBe('3,8');
    expect(evaluatePrompt('7,4 − 2,9 = ?')).toBe('4,5');
    expect(evaluatePrompt('1/4 + 2/4 = ?')).toBe('3/4');
    expect(evaluatePrompt('9/10 − 4/10 = ?')).toBe('5/10');
  });

  it('adds decimals through integer tenths, not floating point', () => {
    // 0.1 + 0.2 === 0.30000000000000004 as a float.
    expect(evaluatePrompt('0,1 + 0,2 = ?')).toBe('0,3');
  });

  it('returns null for shapes it cannot verify', () => {
    expect(evaluatePrompt('Hôm nay trời đẹp')).toBeNull();
    expect(evaluatePrompt('1/2 + 1/3 = ?')).toBeNull();
  });
});

describe('validateQuestion', () => {
  const base: Question = {
    id: 'test-1',
    grade: 2,
    topic: 'addition',
    prompt: '10 + 5 = ?',
    answers: ['15', '14', '16'],
    correctIndex: 0,
    explanation: '10 cộng 5 bằng 15.',
  };

  it('accepts a well-formed question', () => {
    expect(validateQuestion(base)).toEqual([]);
  });

  it('rejects a correctIndex pointing at the wrong answer', () => {
    const problems = validateQuestion({ ...base, correctIndex: 1 });
    expect(problems.join(' ')).toContain('correct answer mismatch');
  });

  it('rejects duplicate answers', () => {
    const problems = validateQuestion({ ...base, answers: ['15', '15', '16'] });
    expect(problems.join(' ')).toContain('duplicate answers');
  });

  it('rejects a negative answer below grade 5', () => {
    const problems = validateQuestion({
      ...base,
      prompt: '5 − 10 = ?',
      answers: ['-5', '5', '15'],
      correctIndex: 0,
    });
    expect(problems.join(' ')).toContain('negative answer');
  });
});
