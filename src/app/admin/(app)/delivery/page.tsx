import { redirect } from "next/navigation";

/** Legacy route — availability calendar replaces delivery windows. */
export default function AdminDeliveryRedirect() {
  redirect("/admin/availability");
}
