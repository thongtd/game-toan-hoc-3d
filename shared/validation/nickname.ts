import blockedList from '../content/blocked-nicknames.vi.json' with { type: 'json' };

/**
 * Nickname rules, shared by the browser and the server.
 *
 * The client runs these for instant feedback; the server runs exactly the same
 * code and is the deciding authority. A regex alone is not enough - the checks
 * work on Unicode code points after NFC normalisation so Vietnamese diacritics
 * survive and look-alike encodings cannot slip through.
 */

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

export type NicknameErrorCode =
  | 'NICKNAME_REQUIRED'
  | 'NICKNAME_TOO_SHORT'
  | 'NICKNAME_TOO_LONG'
  | 'NICKNAME_INVALID_CHARS'
  | 'NICKNAME_PRIVATE_INFO'
  | 'NICKNAME_BLOCKED';

export const NICKNAME_MESSAGES: Readonly<Record<NicknameErrorCode, string>> = {
  NICKNAME_REQUIRED: 'Hãy đặt một biệt danh nhé!',
  NICKNAME_TOO_SHORT: `Biệt danh cần ít nhất ${String(NICKNAME_MIN_LENGTH)} ký tự.`,
  NICKNAME_TOO_LONG: `Biệt danh tối đa ${String(NICKNAME_MAX_LENGTH)} ký tự.`,
  NICKNAME_INVALID_CHARS: 'Biệt danh có ký tự chưa phù hợp.',
  NICKNAME_PRIVATE_INFO: 'Đừng dùng số điện thoại, email hoặc đường dẫn nhé!',
  NICKNAME_BLOCKED: 'Hãy chọn một biệt danh vui vẻ khác nhé!',
};

export type NicknameResult =
  | { ok: true; value: string }
  | { ok: false; code: NicknameErrorCode; message: string };

interface BlockedConfig {
  words: string[];
}

const BLOCKED_WORDS: readonly string[] = (blockedList as BlockedConfig).words.map((word) =>
  word.toLowerCase(),
);

/** Latin letters (which covers Vietnamese), combining marks, digits, space, underscore. */
const ALLOWED_PATTERN = /^[\p{Script=Latin}\p{Mark}0-9 _]+$/u;

/** Anything that looks like contact details rather than a playful name. */
const PRIVATE_INFO_PATTERNS: readonly RegExp[] = [
  /@/u,
  /https?:/iu,
  /www\./iu,
  /\.(com|net|org|vn|io|xyz)\b/iu,
  /\d{7,}/u,
];

const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

/** Strips diacritics so "Ngu" and "Ngú" hit the same blocked entry. */
function foldForBlocklist(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/đ/giu, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Number of Unicode code points, so an emoji counts as one character. */
function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * Validates and normalises a nickname.
 *
 * On success the returned `value` is the exact form to store and display:
 * trimmed, inner whitespace collapsed to single spaces, NFC normalised.
 */
export function validateNickname(input: unknown): NicknameResult {
  if (typeof input !== 'string') {
    return fail('NICKNAME_REQUIRED');
  }

  // Normalise first so composed and decomposed Vietnamese compare equal.
  const normalised = input.normalize('NFC').trim();

  if (normalised.length === 0) {
    return fail('NICKNAME_REQUIRED');
  }
  if (CONTROL_CHARACTERS.test(normalised)) {
    return fail('NICKNAME_INVALID_CHARS');
  }

  const length = codePointLength(normalised);
  if (length < NICKNAME_MIN_LENGTH) {
    return fail('NICKNAME_TOO_SHORT');
  }
  if (length > NICKNAME_MAX_LENGTH) {
    return fail('NICKNAME_TOO_LONG');
  }

  // Contact details get their own message so the child knows what to change.
  for (const pattern of PRIVATE_INFO_PATTERNS) {
    if (pattern.test(normalised)) {
      return fail('NICKNAME_PRIVATE_INFO');
    }
  }

  if (!ALLOWED_PATTERN.test(normalised)) {
    return fail('NICKNAME_INVALID_CHARS');
  }
  if (/ {2,}/u.test(normalised)) {
    return fail('NICKNAME_INVALID_CHARS');
  }
  if (/^[0-9_ ]+$/u.test(normalised)) {
    return fail('NICKNAME_INVALID_CHARS');
  }

  const folded = foldForBlocklist(normalised);
  const words = folded.split(' ');
  for (const blocked of BLOCKED_WORDS) {
    // Short entries must match a whole word so "cc" does not reject "Cún Con".
    const isWholeWordOnly = blocked.length <= 3 && !blocked.includes(' ');
    const hit = isWholeWordOnly ? words.includes(blocked) : folded.includes(blocked);
    if (hit) {
      return fail('NICKNAME_BLOCKED');
    }
  }

  return { ok: true, value: normalised };
}

/** Lowercase, diacritic-free form used for analytics or duplicate hints. */
export function normaliseNicknameForSearch(nickname: string): string {
  return foldForBlocklist(nickname);
}

function fail(code: NicknameErrorCode): NicknameResult {
  return { ok: false, code, message: NICKNAME_MESSAGES[code] };
}
