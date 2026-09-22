import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm, SignupForm } from "@/components/auth-forms";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const signup = mode === "signup";

  return (
    <div className="shell grid max-w-md gap-8 py-16">
      <header className="grid gap-3">
        <Eyebrow>Account</Eyebrow>
        <h1 className="text-[2.4rem] leading-[1]">
          {signup ? "Create an account" : "Welcome back"}
        </h1>
        <p className="muted text-sm leading-6">
          {signup
            ? "Create an account for member discounts: volume savings after 10 products, streak rewards for consecutive weeks, and cashback on every ₱100. You can still check out as a guest anytime."
            : "Optional. Guests can still order — an account keeps past orders handy and unlocks member discounts and cashback."}
        </p>
      </header>
      {signup ? <SignupForm /> : <LoginForm />}
      <p className="muted text-sm">
        {signup ? (
          <>
            Already have one?{" "}
            <Link href="/login" className="link-underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/login?mode=signup" className="link-underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
