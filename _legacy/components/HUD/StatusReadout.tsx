"use client";

import clsx from "clsx";
import { useJarvis } from "@/lib/state/JarvisProvider";
import { STATE_LABEL } from "@/lib/state/machine";

const HINT: Record<string, string> = {
  idle: "STANDING BY · PRESS SPACE OR SPEAK",
  listening: "LISTENING · DRIVE THE SPEAKING FACE FROM YOUR MICROPHONE",
  processing: "PROCESSING SIGNAL",
  thinking: "ROUTING THROUGH BRAIN",
  executing_tool: "EXECUTING TOOL",
  speaking: "SPEAKING · ESC TO INTERRUPT",
  error: "LINK LOST · PRESS R TO RECOVER"
};

export function StatusReadout() {
  const { state, activeTool, errorMessage } = useJarvis();
  const line = activeTool ? `TOOL · ${activeTool.toUpperCase()}` : HINT[state];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-32 z-20 flex justify-center md:bottom-28">
      <div
        className={clsx(
          "hud-brackets relative px-6 py-2 min-w-[260px] text-center",
          "bg-black/30 backdrop-blur-sm"
        )}
      >
        <span className="br-tr" />
        <span className="br-bl" />
        <div className="hud text-[11px] md:text-xs animate-fadeInOut">
          {STATE_LABEL[state]}
        </div>
        <div className="hud-dim text-[10px] md:text-[11px] tracking-[0.22em] mt-1">
          {errorMessage ?? line}
        </div>
      </div>
    </div>
  );
}
