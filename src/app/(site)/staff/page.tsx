import type { Metadata } from "next";
import Link from "next/link";
import { currentUser, isStaff } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-marks";
import { AdminLoginForm } from "@/components/auth-forms";
import { Card, Eyebrow, Notice } from "@/components/ui";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Admin — ${BRAND.name}`,
  robots: { index: false, follow: false },
};

/**
 * Dedicated admin door.
 * Sign in here → then choose Open admin. /admin itself stays staff-only.
 */
export default async function StaffGatePage() {
  const user = await currentUser();
  const staff = isStaff(user);

  return (
    <div className="shell grid min-h-[70vh] place-items-center py-16">
      <div className="grid w-full max-w-md gap-8">
        <div className="grid justify-items-center gap-4 text-center">
          <BrandLogo priority href="/" className="h-[140px]" />
          <Eyebrow>Admin</Eyebrow>
          <h1 className="text-[2.2rem] leading-[1]">Bakery sign in</h1>
          <p className="muted text-sm leading-6">
            Sign in with your admin account. After that you can open the admin desk anytime from the
            Admin button on the site.
          </p>
        </div>

        {staff && user ? (
          <Card className="grid gap-4 p-6 text-center">
            <Notice tone="success" title={`Signed in as ${user.name}`}>
              You are on an admin account. Open the desk to manage orders, menu, and payments.
            </Notice>
            <Link href="/admin" className="btn btn-primary w-full">
              Open admin
            </Link>
            <Link href="/" className="btn btn-ghost w-full">
              Back to storefront
            </Link>
          </Card>
        ) : (
          <Card className="grid gap-5 p-6">
            <p className="muted text-center text-sm">
              Admin email and password only — customer accounts cannot enter here.
            </p>
            <AdminLoginForm />
            <Link href="/" className="faint text-center text-xs hover:text-[var(--paper)]">
              ← Back to the bakery site
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
