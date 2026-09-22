import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { sessionToken } from "@/lib/ids";
import type { User } from "@prisma/client";

export { hashPassword, verifyPassword } from "@/lib/password";

const COOKIE = "wk_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string): Promise<void> {
  const token = sessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  jar.delete(COOKIE);
}

/** One session lookup per request (layout + page share this). */
export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
});

export function isStaff(user: User | null): boolean {
  return user?.role === "owner" || user?.role === "staff";
}

/** Storefront Admin link — owner account only (owner@woofking.ph). */
export function isOwner(user: User | null): boolean {
  return user?.role === "owner";
}

/**
 * Gate for every /admin page and every admin server action. Checking the role
 * on each entry point, rather than only in a layout, is what keeps the customer
 * book and the POS out of reach of a customer who guesses the URL.
 */
export async function requireStaff(): Promise<User> {
  const user = await currentUser();
  if (!isStaff(user)) redirect("/staff");
  return user as User;
}

export async function requireOwner(): Promise<User> {
  const user = await currentUser();
  if (user?.role !== "owner") redirect("/staff");
  return user;
}

/** The customer-account equivalent: optional, never required to place an order. */
export async function requireCustomer(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
