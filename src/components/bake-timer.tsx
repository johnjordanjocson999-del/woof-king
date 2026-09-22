"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Soft oven-done chime via Web Audio — no sound file required. */
function playDoneChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.18 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.5);
    });
    window.setTimeout(() => void ctx.close(), 2000);
  } catch {
    // Audio blocked or unavailable — visual alert still shows.
  }
}

export function BakeTimer({
  productName,
  defaultMinutes = 0,
}: {
  productName: string;
  defaultMinutes?: number;
}) {
  const initial = Math.max(0, Math.round(defaultMinutes)) * 60 || 20 * 60;
  const [durationSec, setDurationSec] = useState(initial);
  const [remainingSec, setRemainingSec] = useState(initial);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endAtRef = useRef<number | null>(null);

  useEffect(() => {
    const next = Math.max(0, Math.round(defaultMinutes)) * 60 || 20 * 60;
    setDurationSec(next);
    setRemainingSec(next);
    setRunning(false);
    setDone(false);
    endAtRef.current = null;
  }, [defaultMinutes, productName]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (endAtRef.current == null) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        setRunning(false);
        setDone(true);
        endAtRef.current = null;
        playDoneChime();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const minutesInput = Math.floor(durationSec / 60);
  const secondsInput = durationSec % 60;
  const progress = durationSec > 0 ? 1 - remainingSec / durationSec : 0;

  function applyDuration(mins: number, secs: number) {
    const total = Math.max(0, mins * 60 + secs);
    setDurationSec(total);
    if (!running) {
      setRemainingSec(total);
      setDone(false);
    }
  }

  function start() {
    if (remainingSec <= 0) {
      setRemainingSec(durationSec);
    }
    const base = remainingSec > 0 ? remainingSec : durationSec;
    if (base <= 0) return;
    endAtRef.current = Date.now() + base * 1000;
    setDone(false);
    setRunning(true);
  }

  function pause() {
    setRunning(false);
    endAtRef.current = null;
  }

  function reset() {
    setRunning(false);
    endAtRef.current = null;
    setRemainingSec(durationSec);
    setDone(false);
  }

  return (
    <div className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="eyebrow">Oven timer</p>
          <p className="font-display text-lg leading-tight">{productName}</p>
          <p className="muted text-xs leading-5">
            Start when the tray goes in. A chime plays when time is up.
          </p>
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ember)] bg-[color-mix(in_oklab,var(--ember)_18%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--ember-glow)]">
            <Bell size={14} aria-hidden />
            Done — check the oven
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "font-display text-center text-5xl tracking-wide tnum sm:text-6xl",
          done ? "text-[var(--ember)]" : running ? "text-[var(--ember-glow)]" : "text-[var(--paper)]",
        )}
        aria-live="polite"
      >
        {formatClock(remainingSec)}
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full rounded-full bg-[var(--ember)] md:transition-[width] md:duration-200"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="muted text-xs">Minutes</span>
          <input
            type="number"
            min={0}
            max={240}
            value={minutesInput}
            disabled={running}
            onChange={(e) => applyDuration(Number(e.target.value) || 0, secondsInput)}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="muted text-xs">Seconds</span>
          <input
            type="number"
            min={0}
            max={59}
            value={secondsInput}
            disabled={running}
            onChange={(e) =>
              applyDuration(minutesInput, Math.min(59, Math.max(0, Number(e.target.value) || 0)))
            }
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {running ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={pause}>
            <Pause size={15} aria-hidden />
            Pause
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={start}>
            <Play size={15} aria-hidden />
            {remainingSec > 0 && remainingSec < durationSec ? "Resume" : "Start"}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
          <RotateCcw size={15} aria-hidden />
          Reset
        </button>
        {done ? (
          <button type="button" className="btn btn-solid btn-sm" onClick={() => playDoneChime()}>
            <Bell size={15} aria-hidden />
            Play chime again
          </button>
        ) : null}
      </div>
    </div>
  );
}
