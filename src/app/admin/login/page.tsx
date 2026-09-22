import { redirect } from "next/navigation";

/**
 * Staff sign-in lives at /staff — one dedicated door, not a public /admin backdoor.
 */
export default function AdminLoginRedirectPage() {
  redirect("/staff");
}
