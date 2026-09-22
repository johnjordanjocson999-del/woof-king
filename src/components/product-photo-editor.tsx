"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Move, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/cn";

export type PhotoFrame = {
  x: number;
  y: number;
  zoom: number;
};

/**
 * Drag-to-pan + zoom crop editor for product photos.
 * Replaces the tiny focal pin with a real frame you can move and expand.
 */
export function ProductPhotoEditor({
  src,
  value,
  onChange,
  className,
}: {
  src: string | null;
  value: PhotoFrame;
  onChange: (next: PhotoFrame) => void;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const clampZoom = (z: number) => Math.min(2.4, Math.max(1, Math.round(z * 100) / 100));

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!src) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: value.x,
        originY: value.y,
      };
      setDragging(true);
    },
    [src, value.x, value.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const el = frameRef.current;
      if (!drag || !el || drag.pointerId !== e.pointerId) return;
      const rect = el.getBoundingClientRect();
      // Dragging the photo moves the crop the opposite way (natural pan).
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      onChange({
        ...value,
        x: clamp(drag.originX - dx),
        y: clamp(drag.originY - dy),
      });
    },
    [onChange, value],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      setDragging(false);
    }
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!src) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      onChange({ ...value, zoom: clampZoom(value.zoom + delta) });
    },
    [onChange, src, value],
  );

  return (
    <div className={cn("grid gap-3", className)}>
      <div
        ref={frameRef}
        className={cn(
          "photo relative aspect-[4/5] select-none touch-none overflow-hidden rounded-[var(--radius-md)]",
          src ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        role="img"
        aria-label={src ? "Drag to reposition the photo crop" : "No photo"}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="320px"
            draggable={false}
            className="pointer-events-none object-cover"
            style={{
              objectPosition: `${value.x * 100}% ${value.y * 100}%`,
              transform: `scale(${value.zoom})`,
              transformOrigin: `${value.x * 100}% ${value.y * 100}%`,
            }}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <span className="faint text-xs">No photo</span>
          </div>
        )}

        {/* Crop guide overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2] border-2 border-[var(--ember)]/80"
        >
          <span className="absolute left-0 top-0 size-4 border-l-2 border-t-2 border-[var(--ember)]" />
          <span className="absolute right-0 top-0 size-4 border-r-2 border-t-2 border-[var(--ember)]" />
          <span className="absolute bottom-0 left-0 size-4 border-b-2 border-l-2 border-[var(--ember)]" />
          <span className="absolute bottom-0 right-0 size-4 border-b-2 border-r-2 border-[var(--ember)]" />
          <span className="absolute inset-x-[33%] top-0 h-full border-x border-white/25" />
          <span className="absolute inset-y-[33%] left-0 w-full border-y border-white/25" />
        </div>

        {src ? (
          <span className="pointer-events-none absolute bottom-2 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ink)_78%,transparent)] px-2.5 py-1 text-[0.65rem] font-semibold text-[var(--paper)] backdrop-blur-sm">
            <Move size={12} aria-hidden />
            Drag to move
          </span>
        ) : null}
      </div>

      {src ? (
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-[var(--ember)] hover:text-[var(--paper)]"
              aria-label="Zoom out"
              onClick={() => onChange({ ...value, zoom: clampZoom(value.zoom - 0.1) })}
            >
              <ZoomOut size={15} aria-hidden />
            </button>
            <input
              type="range"
              min={1}
              max={2.4}
              step={0.05}
              value={value.zoom}
              onChange={(e) =>
                onChange({ ...value, zoom: clampZoom(Number(e.target.value)) })
              }
              className="min-w-0 flex-1 accent-[var(--ember)]"
              aria-label="Zoom"
            />
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:border-[var(--ember)] hover:text-[var(--paper)]"
              aria-label="Zoom in"
              onClick={() => onChange({ ...value, zoom: clampZoom(value.zoom + 0.1) })}
            >
              <ZoomIn size={15} aria-hidden />
            </button>
            <span className="w-10 text-right text-xs tabular-nums text-[var(--muted)]">
              {Math.round(value.zoom * 100)}%
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange({ x: 0.5, y: 0.5, zoom: 1 })}
            >
              <RotateCcw size={13} aria-hidden />
              Reset
            </button>
          </div>
          <p className="faint text-xs leading-5">
            Drag to move · zoom slider or scroll to expand · reset centers the crop. Corner guides
            match what customers see on the menu.
          </p>
        </div>
      ) : (
        <p className="faint text-xs">Upload a photo, then drag and zoom to frame it.</p>
      )}
    </div>
  );
}
