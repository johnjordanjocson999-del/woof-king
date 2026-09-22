import { redirect } from "next/navigation";
import { confirmMockPayment } from "@/app/actions/payments";
import { Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form";

export default async function MockPayPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string; token?: string }>;
}) {
  const { paymentId, token } = await searchParams;
  if (!paymentId || !token) {
    return (
      <div className="shell py-20">
        <Notice tone="danger" title="Missing payment">Open this page from your order link.</Notice>
      </div>
    );
  }

  async function pay() {
    "use server";
    const result = await confirmMockPayment(paymentId!, token!);
    if (result.ok && result.code) {
      redirect(`/order/${result.code}?token=${token}&status=success`);
    }
  }

  return (
    <div className="shell grid max-w-lg gap-6 py-20">
      <Notice tone="warn" title="Demo payment — not a real transaction">
        This adapter exists so the checkout flow can be tested without PayMongo keys or a GCash
        account. Nothing is charged.
      </Notice>
      <form action={pay}>
        <SubmitButton className="w-full">Mark as paid (demo)</SubmitButton>
      </form>
    </div>
  );
}
