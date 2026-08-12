import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Anonymous player identity.
 *
 * The raw token is handed to the client once and never stored: the database
 * only ever sees a peppered SHA-256 hash, so a database leak cannot be replayed
 * as a login.
 */

const TOKEN_BYTES = 32;

export function newPlayerId(): string {
  return randomUUID();
}

export function newRunId(): string {
  return randomUUID();
}

export function newRequestId(): string {
  return `req_${randomBytes(8).toString('hex')}`;
}

/** Cryptographically random, URL-safe, 32 bytes of entropy. */
export function generatePlayerToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashPlayerToken(token: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${token}`).digest('hex');
}

/** Constant-time comparison of two hex digests of equal length. */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Extracts the bearer token from an Authorization header, if present. */
export function readBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/** A run seed: a positive 31-bit integer, generated server-side only. */
export function generateSeed(): number {
  return randomBytes(4).readUInt32BE(0) & 0x7fffffff;
}
