"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Download, Share, MoreVertical, Plus, X, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop" | "installed";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari when launched from home screen
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  if (standalone) return "installed";

  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos) return "ios";

  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * “Get the app” control: native install on Chrome/Edge/Android, step-by-step
 * guide on iOS Safari, and desktop install when the browser supports it.
 */
export function InstallAppButton({
  className,
  variant = "ghost",
  label = "Get the app",
  compact = false,
}: {
  className?: string;
  variant?: "primary" | "ghost" | "solid";
  label?: string;
  compact?: boolean;
}) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const onInstalled = () => {
      setDeferred(null);
      setPlatform("installed");
      setOpen(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMode = () => {
      if (mq.matches) setPlatform("installed");
    };
    mq.addEventListener?.("change", onMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onMode);
    };
  }, []);

  const runNativeInstall = useCallback(async () => {
    if (!deferred) {
      setOpen(true);
      return;
    }
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } finally {
      setInstalling(false);
    }
  }, [deferred]);

  if (platform === "installed") return null;

  const btnClass = cn(
    "btn btn-sm",
    variant === "primary" && "btn-primary",
    variant === "ghost" && "btn-ghost",
    variant === "solid" && "btn-solid",
    className,
  );

  const canOneTap = Boolean(deferred) && platform !== "ios";

  return (
    <>
      <button
        type="button"
        className={btnClass}
        onClick={() => (canOneTap ? void runNativeInstall() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Download size={compact ? 14 : 16} aria-hidden className="shrink-0" />
        {label}
      </button>

      {open ? (
        <InstallSheet
          platform={platform}
          canOneTap={canOneTap}
          installing={installing}
          onInstall={() => void runNativeInstall()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function InstallSheet({
  platform,
  canOneTap,
  installing,
  onInstall,
  onClose,
}: {
  platform: Platform;
  canOneTap: boolean;
  installing: boolean;
  onInstall: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-black/55 p-0 sm:place-items-center sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-app-title"
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl sm:max-w-md sm:rounded-[var(--radius-xl)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="eyebrow">Woof King app</p>
            <h2 id="install-app-title" className="font-display text-2xl leading-tight">
              Install on your device
            </h2>
            <p className="muted text-sm leading-6">
              Works on phone, tablet, and computer — opens like a normal app, no App Store
              or Play Store needed.
            </p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--line)]"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {canOneTap ? (
          <div className="grid gap-4">
            <p className="text-sm leading-6">
              Tap below and confirm in your browser. The icon lands on your home screen or
              app list.
            </p>
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={installing}
              onClick={onInstall}
            >
              <Download size={16} aria-hidden />
              {installing ? "Opening install…" : "Install Woof King"}
            </button>
          </div>
        ) : platform === "ios" ? (
          <IosSteps />
        ) : platform === "android" ? (
          <AndroidSteps onInstall={onInstall} />
        ) : (
          <DesktopSteps canOneTap={false} onInstall={onInstall} />
        )}

        <p className="faint mt-6 text-center text-xs leading-5">
          Tip: use Safari on iPhone/iPad, or Chrome on Android and Windows, for the install
          option.
        </p>
      </div>
    </div>
  );
}

function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-6">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ember)]">
        {icon}
      </span>
      <span className="pt-1.5">{children}</span>
    </li>
  );
}

function IosSteps() {
  return (
    <ol className="grid gap-4">
      <Step icon={<Share size={16} aria-hidden />}>
        Tap the <strong className="text-[var(--paper)]">Share</strong> button in Safari
        (square with an arrow up).
      </Step>
      <Step icon={<Plus size={16} aria-hidden />}>
        Scroll and choose <strong className="text-[var(--paper)]">Add to Home Screen</strong>.
      </Step>
      <Step icon={<Smartphone size={16} aria-hidden />}>
        Tap <strong className="text-[var(--paper)]">Add</strong>. Woof King opens full-screen
        like an app on iPhone and iPad.
      </Step>
    </ol>
  );
}

function AndroidSteps({ onInstall }: { onInstall: () => void }) {
  return (
    <div className="grid gap-4">
      <ol className="grid gap-4">
        <Step icon={<MoreVertical size={16} aria-hidden />}>
          Open the Chrome menu <strong className="text-[var(--paper)]">⋮</strong> (top
          right).
        </Step>
        <Step icon={<Download size={16} aria-hidden />}>
          Tap <strong className="text-[var(--paper)]">Install app</strong> or{" "}
          <strong className="text-[var(--paper)]">Add to Home screen</strong>.
        </Step>
        <Step icon={<Smartphone size={16} aria-hidden />}>
          Confirm. The app fits phones and tablets and works offline for the menu.
        </Step>
      </ol>
      <button type="button" className="btn btn-ghost w-full" onClick={onInstall}>
        Try install prompt
      </button>
    </div>
  );
}

function DesktopSteps({
  canOneTap,
  onInstall,
}: {
  canOneTap: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="grid gap-4">
      <ol className="grid gap-4">
        <Step icon={<Download size={16} aria-hidden />}>
          In Chrome or Edge, look for the{" "}
          <strong className="text-[var(--paper)]">install</strong> icon in the address bar
          (or Menu → Install Woof King).
        </Step>
        <Step icon={<Smartphone size={16} aria-hidden />}>
          On a PC it opens in its own window; on a tablet it pins to your home screen or
          app drawer.
        </Step>
      </ol>
      {canOneTap ? (
        <button type="button" className="btn btn-primary w-full" onClick={onInstall}>
          <Download size={16} aria-hidden />
          Install now
        </button>
      ) : null}
    </div>
  );
}
