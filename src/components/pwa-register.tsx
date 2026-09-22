"use client";

import { useEffect } from "react";

/** Registers the service worker once on the client (required for install prompts). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          // Pick up sw.js bumps (cache version) without waiting for a full day.
          void reg.update();
        })
        .catch(() => {
          /* Local HTTP without SW support — ignore. */
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
