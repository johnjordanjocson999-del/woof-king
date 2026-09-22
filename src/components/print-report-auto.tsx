"use client";

import { useEffect } from "react";

/** Triggers the browser print / Save as PDF dialog once the report has painted. */
export function PrintReportAuto() {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
