import { cookies } from "next/headers";

/**
 * Remembers recent order links in a cookie so guests (and members) can see
 * active-order notifications without signing in. Tokens stay httpOnly.
 */

const COOKIE = "wk_orders";
const MAX = 8;
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export type TrackedOrderRef = { code: string; token: string };

function sanitise(value: unknown): TrackedOrderRef[] {
  if (!Array.isArray(value)) return [];
  const out: TrackedOrderRef[] = [];
  for (const entry of value.slice(0, MAX * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const code = String((entry as { code?: unknown }).code ?? "")
      .trim()
      .toUpperCase();
    const token = String((entry as { token?: unknown }).token ?? "").trim();
    if (!code || !token || token.length < 12) continue;
    if (out.some((o) => o.code === code)) continue;
    out.push({ code, token });
    if (out.length >= MAX) break;
  }
  return out;
}

export async function readTrackedOrders(): Promise<TrackedOrderRef[]> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return [];
  try {
    return sanitise(JSON.parse(decodeURIComponent(raw)));
  } catch {
    try {
      return sanitise(JSON.parse(raw));
    } catch {
      return [];
    }
  }
}

async function writeTrackedOrders(refs: TrackedOrderRef[]): Promise<void> {
  const jar = await cookies();
  const clean = sanitise(refs);
  if (clean.length === 0) {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, JSON.stringify(clean), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Prefers the newest order at the front of the list. */
export async function rememberOrder(code: string, token: string): Promise<void> {
  const nextCode = code.trim().toUpperCase();
  const nextToken = token.trim();
  if (!nextCode || !nextToken) return;
  const existing = await readTrackedOrders();
  const rest = existing.filter((o) => o.code !== nextCode);
  await writeTrackedOrders([{ code: nextCode, token: nextToken }, ...rest]);
}

export async function forgetOrder(code: string): Promise<void> {
  const existing = await readTrackedOrders();
  await writeTrackedOrders(existing.filter((o) => o.code !== code.trim().toUpperCase()));
}
