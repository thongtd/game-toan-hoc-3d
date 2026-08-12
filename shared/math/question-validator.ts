import type { Question } from '../game-types.ts';
import { formatFraction, formatInteger, formatTenths } from './format-number.ts';

/**
 * Independent verification of a generated question.
 *
 * This module deliberately does **not** share code with the generators. It
 * re-reads the rendered prompt text and recomputes the expected answer, so a
 * mistake inside a topic generator shows up as a validation failure instead of
 * reaching a child as a wrong "correct" answer.
 */

type Value =
  | { kind: 'int'; value: number }
  | { kind: 'tenths'; value: number }
  | { kind: 'fraction'; numerator: number; denominator: number };

const INTEGER_PATTERN = /^\d+$/;
const DECIMAL_PATTERN = /^(\d+),(\d)$/;
const FRACTION_PATTERN = /^(\d+)\/(\d+)$/;

function parseValue(token: string): Value | null {
  if (INTEGER_PATTERN.test(token)) {
    return { kind: 'int', value: Number.parseInt(token, 10) };
  }

  const decimal = DECIMAL_PATTERN.exec(token);
  if (decimal !== null) {
    const whole = decimal[1];
    const tenth = decimal[2];
    if (whole === undefined || tenth === undefined) return null;
    return {
      kind: 'tenths',
      value: Number.parseInt(whole, 10) * 10 + Number.parseInt(tenth, 10),
    };
  }

  const fraction = FRACTION_PATTERN.exec(token);
  if (fraction !== null) {
    const numerator = fraction[1];
    const denominator = fraction[2];
    if (numerator === undefined || denominator === undefined) return null;
    const parsedDenominator = Number.parseInt(denominator, 10);
    if (parsedDenominator === 0) return null;
    return {
      kind: 'fraction',
      numerator: Number.parseInt(numerator, 10),
      denominator: parsedDenominator,
    };
  }

  return null;
}

function formatValue(value: Value): string {
  switch (value.kind) {
    case 'int':
      return formatInteger(value.value);
    case 'tenths':
      return formatTenths(value.value);
    case 'fraction':
      return formatFraction(value.numerator, value.denominator);
  }
}

function applyOperator(left: Value, operator: string, right: Value): Value | null {
  if (left.kind === 'fraction' && right.kind === 'fraction') {
    if (left.denominator !== right.denominator) return null;
    const numerator =
      operator === '+'
        ? left.numerator + right.numerator
        : operator === '−'
          ? left.numerator - right.numerator
          : null;
    if (numerator === null) return null;
    return { kind: 'fraction', numerator, denominator: left.denominator };
  }

  if (left.kind === 'fraction' || right.kind === 'fraction') return null;
  if (left.kind !== right.kind) return null;

  const a = left.value;
  const b = right.value;
  const kind = left.kind;

  switch (operator) {
    case '+':
      return { kind, value: a + b };
    case '−':
      return { kind, value: a - b };
    case '×':
      if (kind !== 'int') return null;
      return { kind, value: a * b };
    case ':':
      if (kind !== 'int' || b === 0 || a % b !== 0) return null;
      return { kind, value: a / b };
    default:
      return null;
  }
}

/** Evaluates `token op token [op token]` honouring × / : before + / −. */
function evaluateExpression(tokens: readonly string[]): Value | null {
  if (tokens.length !== 3 && tokens.length !== 5) return null;

  const values: Value[] = [];
  const operators: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === undefined) return null;
    if (i % 2 === 0) {
      const value = parseValue(token);
      if (value === null) return null;
      values.push(value);
    } else {
      operators.push(token);
    }
  }

  // First pass: multiplication and division.
  for (let i = 0; i < operators.length;) {
    const operator = operators[i];
    const left = values[i];
    const right = values[i + 1];
    if (operator === undefined || left === undefined || right === undefined) return null;

    if (operator === '×' || operator === ':') {
      const result = applyOperator(left, operator, right);
      if (result === null) return null;
      values.splice(i, 2, result);
      operators.splice(i, 1);
    } else {
      i += 1;
    }
  }

  // Second pass: addition and subtraction, left to right.
  let accumulator = values[0];
  if (accumulator === undefined) return null;
  for (let i = 0; i < operators.length; i += 1) {
    const operator = operators[i];
    const right = values[i + 1];
    if (operator === undefined || right === undefined) return null;
    const result = applyOperator(accumulator, operator, right);
    if (result === null) return null;
    accumulator = result;
  }

  return accumulator;
}

/**
 * Recomputes the expected answer for a prompt.
 *
 * Returns `null` when the prompt shape is not one this validator understands,
 * which callers treat as "cannot verify" rather than "invalid".
 */
export function evaluatePrompt(prompt: string): string | null {
  const tokens = prompt.trim().split(/\s+/);

  // Comparison: "12 ... 9"
  if (tokens.length === 3 && tokens[1] === '...') {
    const left = tokens[0];
    const right = tokens[2];
    if (left === undefined || right === undefined) return null;
    const a = parseValue(left);
    const b = parseValue(right);
    if (a === null || b === null || a.kind === 'fraction' || b.kind === 'fraction') return null;
    if (a.kind !== b.kind) return null;
    if (a.value > b.value) return '>';
    if (a.value < b.value) return '<';
    return '=';
  }

  const equalsAt = tokens.indexOf('=');
  if (equalsAt < 0) return null;

  const left = tokens.slice(0, equalsAt);
  const right = tokens.slice(equalsAt + 1);

  // Standard form: "a + b = ?"
  if (right.length === 1 && right[0] === '?') {
    const result = evaluateExpression(left);
    return result === null ? null : formatValue(result);
  }

  // Missing number: "7 + ? = 12" or "12 − ? = 5"
  if (left.length === 3 && left[1] !== undefined && left[2] === '?' && right.length === 1) {
    const knownToken = left[0];
    const operator = left[1];
    const totalToken = right[0];
    if (knownToken === undefined || totalToken === undefined) return null;

    const known = parseValue(knownToken);
    const total = parseValue(totalToken);
    if (known === null || total === null) return null;
    if (known.kind !== 'int' || total.kind !== 'int') return null;

    if (operator === '+') {
      return formatInteger(total.value - known.value);
    }
    if (operator === '−') {
      return formatInteger(known.value - total.value);
    }
    return null;
  }

  return null;
}

/**
 * Returns a list of problems with the question. An empty array means the
 * question is safe to show to a player.
 */
export function validateQuestion(question: Question): string[] {
  const problems: string[] = [];

  if (question.prompt.trim().length === 0) {
    problems.push('prompt is empty');
  }
  if (question.explanation.trim().length === 0) {
    problems.push('explanation is empty');
  }
  if (question.answers.length !== 3) {
    problems.push(`expected 3 answers, got ${String(question.answers.length)}`);
  }
  if (question.answers.some((answer) => answer.trim().length === 0)) {
    problems.push('an answer is empty');
  }
  if (new Set(question.answers).size !== question.answers.length) {
    problems.push(`duplicate answers: ${question.answers.join(' | ')}`);
  }
  if (![0, 1, 2].includes(question.correctIndex)) {
    problems.push(`correctIndex out of range: ${String(question.correctIndex)}`);
  }

  // Grades 1-4 must never show a negative result.
  if (question.grade <= 4) {
    for (const answer of question.answers) {
      if (answer.startsWith('-')) {
        problems.push(`negative answer for grade ${String(question.grade)}: ${answer}`);
      }
    }
  }

  const expected = evaluatePrompt(question.prompt);
  if (expected !== null) {
    const marked = question.answers[question.correctIndex];
    if (marked !== expected) {
      problems.push(
        `correct answer mismatch for "${question.prompt}": marked "${marked}", expected "${expected}"`,
      );
    }
    const matches = question.answers.filter((answer) => answer === expected).length;
    if (matches > 1) {
      problems.push(`expected answer appears ${String(matches)} times`);
    }
  }

  return problems;
}
