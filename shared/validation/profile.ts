import type { Grade } from '../game-types.ts';
import { isSelectableAvatar } from '../content/avatars.ts';

/** Age and avatar rules, shared by the browser and the server. */

export const MIN_AGE = 6;
export const MAX_AGE = 12;

export const SELECTABLE_AGES: readonly number[] = [6, 7, 8, 9, 10, 11, 12];

export type AgeErrorCode = 'AGE_REQUIRED' | 'AGE_OUT_OF_RANGE';
export type AvatarErrorCode = 'AVATAR_REQUIRED' | 'AVATAR_UNKNOWN';

export const PROFILE_MESSAGES: Readonly<Record<AgeErrorCode | AvatarErrorCode, string>> = {
  AGE_REQUIRED: 'Hãy chọn tuổi của bạn nhé!',
  AGE_OUT_OF_RANGE: `Tuổi cần từ ${String(MIN_AGE)} đến ${String(MAX_AGE)}.`,
  AVATAR_REQUIRED: 'Hãy chọn một hình đại diện nhé!',
  AVATAR_UNKNOWN: 'Hình đại diện này không còn dùng được, chọn hình khác nhé!',
};

export type AgeResult =
  { ok: true; value: number } | { ok: false; code: AgeErrorCode; message: string };
export type AvatarResult =
  { ok: true; value: string } | { ok: false; code: AvatarErrorCode; message: string };

export function validateAge(input: unknown): AgeResult {
  if (input === null || input === undefined || input === '') {
    return { ok: false, code: 'AGE_REQUIRED', message: PROFILE_MESSAGES.AGE_REQUIRED };
  }
  // Strings and floats are rejected outright rather than coerced: a birth date
  // or a typo must never quietly become a valid age.
  if (typeof input !== 'number' || !Number.isInteger(input)) {
    return { ok: false, code: 'AGE_OUT_OF_RANGE', message: PROFILE_MESSAGES.AGE_OUT_OF_RANGE };
  }
  if (input < MIN_AGE || input > MAX_AGE) {
    return { ok: false, code: 'AGE_OUT_OF_RANGE', message: PROFILE_MESSAGES.AGE_OUT_OF_RANGE };
  }
  return { ok: true, value: input };
}

export function validateAvatarId(input: unknown): AvatarResult {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { ok: false, code: 'AVATAR_REQUIRED', message: PROFILE_MESSAGES.AVATAR_REQUIRED };
  }
  if (!isSelectableAvatar(input)) {
    return { ok: false, code: 'AVATAR_UNKNOWN', message: PROFILE_MESSAGES.AVATAR_UNKNOWN };
  }
  return { ok: true, value: input };
}

/**
 * Grade the UI pre-selects for a given age.
 *
 * Only a starting suggestion - the player always picks their own grade on the
 * home screen, and age never locks anyone into a level.
 */
export function suggestGradeForAge(age: number): Grade {
  if (age <= 6) return 1;
  if (age === 7) return 2;
  if (age === 8) return 3;
  if (age === 9) return 4;
  return 5;
}
