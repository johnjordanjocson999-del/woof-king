"use client";

import { useActionState } from "react";
import {
  adminLoginAction,
  loginAction,
  signupAction,
  type AuthState,
} from "@/app/actions/auth";
import { Field, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, { ok: false } as AuthState);
  return (
    <form action={action} className="grid gap-4">
      {state.message ? <Notice tone="danger">{state.message}</Notice> : null}
      <Field label="Email" required>
        <input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" required>
        <input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signupAction, { ok: false } as AuthState);
  return (
    <form action={action} className="grid gap-4">
      {state.message ? <Notice tone="danger">{state.message}</Notice> : null}
      <Field label="Name" required>
        <input name="name" autoComplete="name" required />
      </Field>
      <Field label="Phone" required>
        <input name="phone" type="tel" autoComplete="tel" required />
      </Field>
      <Field label="Email" required>
        <input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" required hint="At least 8 characters">
        <input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLoginAction, { ok: false } as AuthState);
  return (
    <form action={action} className="grid gap-4">
      {state.message ? <Notice tone="danger">{state.message}</Notice> : null}
      <Field label="Admin email" required>
        <input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" required>
        <input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
