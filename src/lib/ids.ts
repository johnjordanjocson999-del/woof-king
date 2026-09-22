import { randomBytes, randomInt } from "node:crypto";

/**
 * Order codes are read aloud across a counter, so the alphabet drops every
 * character that gets confused when spoken or handwritten: no O/0, no I/1, no
 * S/5, no B/8.
 */
const CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY2346789";

/** "WK-7KQ4T2" */
export function orderCode(): string {
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `WK-${body}`;
}

/** Unguessable token so a customer can open their order without an account. */
export function accessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function sessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Filename-safe random stem for uploaded photos. */
export function mediaId(): string {
  return randomBytes(10).toString("hex");
}
