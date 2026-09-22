import { Suspense } from "react";
import { getActiveOrdersForVisitor } from "@/domain/active-orders";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { ActiveOrderToast } from "@/components/active-order-toast";

/**
 * Tab badge + toast hit Supabase. Stream behind Suspense so the page body
 * and header paint without waiting on that round-trip.
 */
async function ActiveOrderBits({
  userId,
  signedIn,
  basketCount,
}: {
  userId?: string | null;
  signedIn: boolean;
  basketCount: number;
}) {
  const activeOrders = await getActiveOrdersForVisitor(userId);
  return (
    <>
      <MobileTabBar
        basketCount={basketCount}
        signedIn={signedIn}
        activeOrderCount={activeOrders.length}
      />
      <ActiveOrderToast orders={activeOrders} />
    </>
  );
}

export function ActiveOrderChrome({
  userId,
  signedIn,
  basketCount,
}: {
  userId?: string | null;
  signedIn: boolean;
  basketCount: number;
}) {
  return (
    <Suspense
      fallback={<MobileTabBar basketCount={basketCount} signedIn={signedIn} activeOrderCount={0} />}
    >
      <ActiveOrderBits userId={userId} signedIn={signedIn} basketCount={basketCount} />
    </Suspense>
  );
}
