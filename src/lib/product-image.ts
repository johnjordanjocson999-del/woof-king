import type { CSSProperties } from "react";

/** Shared object-position + optional zoom for product photos. */
export function productImageStyle(input: {
  focalX: number;
  focalY: number;
  imageZoom?: number | null;
}): CSSProperties {
  const zoom = Math.min(2.5, Math.max(1, Number(input.imageZoom ?? 1) || 1));
  const x = `${input.focalX * 100}%`;
  const y = `${input.focalY * 100}%`;
  return {
    objectPosition: `${x} ${y}`,
    ...(zoom > 1.01
      ? {
          transform: `scale(${zoom})`,
          transformOrigin: `${x} ${y}`,
        }
      : {}),
  };
}
