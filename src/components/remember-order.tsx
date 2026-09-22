"use client";

import { useEffect } from "react";
import { trackOrderVisit } from "@/app/actions/track-order";

/** Remembers this order in the visitor cookie so active-order notices work for guests. */
export function RememberOrder({ code, token }: { code: string; token: string }) {
  useEffect(() => {
    void trackOrderVisit(code, token);
  }, [code, token]);
  return null;
}
