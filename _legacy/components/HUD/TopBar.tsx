"use client";

import clsx from "clsx";
import { useJarvis } from "@/lib/state/JarvisProvider";
import { STATE_LABEL, STATE_TINT } from "@/lib/state/machine";

export function TopBar() {
  const { state, connection, audioLevel } = useJarvis();
  const tint = STATE_TINT[state];
  const intensity = audioLevel > 0.7 ? "HIGH" : audioLevel > 0.35 ? "MID" : "LOW";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between px-5 py-4 md:px-10 md:py-6">
      <div className="flex items-center gap-3">
        <span className="hud text-sm md:text-base">JARVIS</span>
        <span className="hud-dim text-[11px] md:text-xs tracking-[0.3em]">
          v0.1 · HUMANOID
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={clsx(
            "hud text-[11px] md:text-xs animate-fadeInOut",
            tint === "amber" && "hud-amber",
            tint === "danger" && "hud-danger",
            tint === "muted" && "hud-dim"
          )}
        >
          STATUS: {STATE_LABEL[state]}
        </span>
        <span className="hud-dim text-[11px] md:text-xs hidden sm:inline">
          · INTENSITY: {intensity}
        </span>
        <span
          className={clsx(
            "hud-chip hud text-[10px] md:text-[11px]",
            connection.online ? "" : "hud-danger"
          )}
        >
          <span
            className={clsx(
              "inline-block h-1.5 w-1.5 rounded-full",
              connection.online ? "bg-cyan-core" : "bg-danger"
            )}
          />
          {connection.online ? "LINK" : "LINK LOST"}
          {connection.latencyMs !== null && (
            <span className="hud-dim">· {connection.latencyMs}ms</span>
          )}
          {connection.mockMode && (
            <span className="hud-amber">· MOCK</span>
          )}
        </span>
      </div>
    </div>
  );
}
