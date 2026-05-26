/**
 * Cryptographic utilities for Workers using Web Crypto API.
 * PBKDF2 for password hashing (bcrypt unavailable in Workers).
 * SHA-256 for session/invite token hashing.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

// --- Base64 helpers ---

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(str: string): Uint8Array {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toBase64url(buf: Uint8Array): string {
  return toBase64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(padded);
}

// --- Password hashing (PBKDF2) ---

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    KEY_BYTES * 8
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts[0] !== "pbkdf2" || parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    expected.byteLength * 8
  ));
  // Constant-time comparison
  if (derived.byteLength !== expected.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < derived.byteLength; i++) diff |= derived[i] ^ expected[i];
  return diff === 0;
}

// --- Token generation and hashing ---

/** Generate a random token; returns raw (for cookie/URL) and hash (for DB storage). */
export async function generateToken(): Promise<{ raw: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = toBase64url(bytes);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return { raw, hash: toBase64(hashBuf) };
}

/** Hash a raw token string to its stored form. */
export async function hashToken(raw: string): Promise<string> {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64url(raw);
  } catch {
    return "__invalid_token__";
  }
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return toBase64(hashBuf);
}
