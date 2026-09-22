"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = { ok: boolean; message?: string };

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid email and password." };

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { ok: false, message: "Email or password is wrong." };
  }

  await createSession(user.id);
  // Staff land on the dedicated gate (Open admin), not straight into /admin.
  if (user.role === "owner" || user.role === "staff") redirect("/staff");
  redirect("/account");
}

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const schema = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    phone: z.string().trim().min(10).max(20),
    password: z.string().min(8, "Use at least 8 characters"),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { ok: false, message: "That email already has an account." };

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      passwordHash: await hashPassword(parsed.data.password),
      role: "customer",
    },
  });

  // Seed a customer book row so staff can see them even before a first order.
  await db.customer.create({
    data: {
      userId: user.id,
      name: user.name,
      phone: user.phone ?? parsed.data.phone,
      email: user.email,
    },
  });

  await createSession(user.id);
  redirect("/account");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function adminLoginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid email and password." };

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { ok: false, message: "Email or password is wrong." };
  }
  if (user.role !== "owner" && user.role !== "staff") {
    return { ok: false, message: "This login is for bakery staff only." };
  }

  await createSession(user.id);
  redirect("/staff");
}
