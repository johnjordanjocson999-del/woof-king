"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * One observer for the whole page instead of a client component per section.
 *
 * On phones we skip delays entirely (CSS also forces .reveal visible) so menu
 * photos are never stuck at opacity 0 while waiting for IntersectionObserver.
 */
export function RevealRoot() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isPhone = window.matchMedia("(max-width: 767px)").matches;

    const revealAll = (nodes: Iterable<HTMLElement>) => {
      for (const el of nodes) el.classList.add("is-in");
    };

    const pending = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)"));

    if (reduced || isPhone || !("IntersectionObserver" in window)) {
      revealAll(pending());
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.revealDelay ?? 0);
          window.setTimeout(() => el.classList.add("is-in"), Math.min(delay, 120));
          observer.unobserve(el);
        }
      },
      { rootMargin: "80px 0px 80px 0px", threshold: 0.01 },
    );

    const observePending = () => {
      for (const el of pending()) observer.observe(el);
    };

    observePending();

    const raf = window.requestAnimationFrame(observePending);
    const safety = window.setTimeout(() => revealAll(pending()), 600);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(safety);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
