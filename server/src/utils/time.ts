/**
 * Time helpers.
 *
 * Everything is stored as UTC ISO-8601. Timezones only enter the picture when
 * deciding which week a run belongs to, which the product defines in
 * Asia/Ho_Chi_Minh (UTC+7, no daylight saving).
 */

const HO_CHI_MINH_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface Period {
  /** Inclusive start, as a UTC instant. */
  start: Date;
  /** Exclusive end, as a UTC instant. */
  end: Date;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(date: Date): string {
  return date.toISOString();
}

/**
 * The Monday-to-Monday window containing `instant`, measured in Vietnamese
 * local time but returned as UTC instants ready for storage comparisons.
 */
export function currentWeek(instant: Date = new Date()): Period {
  const shifted = new Date(instant.getTime() + HO_CHI_MINH_OFFSET_MS);
  // getUTCDay on the shifted value gives the local weekday: 0 = Sunday.
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;

  const localMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceMonday,
  );

  const start = new Date(localMidnight - HO_CHI_MINH_OFFSET_MS);
  return { start, end: new Date(start.getTime() + WEEK_MS) };
}

/** Formats an instant with the +07:00 offset, for display in API responses. */
export function toLocalIso(date: Date): string {
  const shifted = new Date(date.getTime() + HO_CHI_MINH_OFFSET_MS);
  return `${shifted.toISOString().slice(0, -1)}+07:00`;
}

export function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

export function isExpired(expiresAtIso: string, now: Date = new Date()): boolean {
  const expiresAt = Date.parse(expiresAtIso);
  return Number.isFinite(expiresAt) && now.getTime() > expiresAt;
}
