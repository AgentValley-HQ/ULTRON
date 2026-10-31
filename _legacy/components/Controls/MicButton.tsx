"use client";

import clsx from "clsx";

interface Props {
  active: boolean;
  permission: "idle" | "requesting" | "granted" | "denied" | "unsupported";
  onToggle: () => void;
}

export function MicButton({ active, permission, onToggle }: Props) {
  const denied = permission === "denied";
  const unsupported = permission === "unsupported";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Deactivate microphone" : "Activate microphone"}
      className={clsx(
        "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-core",
        active
          ? "border-cyan-core bg-cyan-core/10 shadow-[0_0_30px_rgba(25,221,255,0.6)]"
          : "border-cyan-soft/40 bg-black/40 hover:border-cyan-soft/80",
        denied && "border-danger/60 bg-danger/10"
      )}
      disabled={unsupported}
      title={
        unsupported
          ? "Microphone unavailable in this browser"
          : denied
            ? "Microphone permission denied"
            : active
              ? "Stop listening"
              : "Start listening"
      }
    >
      {/* Pulsing ring when active */}
      {active && (
        <span className="absolute inset-0 animate-humRingBase rounded-full border border-cyan-core/70" />
      )}
      <svg
        viewBox="0 0 24 24"
        className={clsx(
          "h-6 w-6 transition-colors",
          active
            ? "text-cyan-ice"
            : denied
              ? "text-danger"
              : "text-cyan-soft"
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3z" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
        <line x1="12" y1="17.5" x2="12" y2="21" />
        <line x1="8.5" y1="21" x2="15.5" y2="21" />
      </svg>
    </button>
  );
}
