"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useJarvis } from "@/lib/state/JarvisProvider";

export function TranscriptPanel() {
  const { transcript } = useJarvis();
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcript]);

  return (
    <div
      className={clsx(
        "pointer-events-auto fixed right-4 top-20 bottom-36 z-20 w-[320px] max-w-[85vw]",
        "transition-transform duration-300",
        !open && "translate-x-[calc(100%+2rem)]"
      )}
    >
      <div className="hud-brackets relative h-full bg-black/40 backdrop-blur-md flex flex-col">
        <span className="br-tr" />
        <span className="br-bl" />
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-cyan-soft/20">
          <span className="hud text-[11px]">TRANSCRIPT</span>
          <button
            className="hud-dim text-[10px] tracking-[0.3em] hover:text-cyan-mist"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "COLLAPSE" : "EXPAND"}
          </button>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[12px] leading-relaxed scrollbar-thin"
        >
          {transcript.length === 0 && (
            <div className="hud-dim text-[11px] tracking-[0.26em]">
              NO TRANSMISSION YET.
            </div>
          )}
          {transcript.map((row) => (
            <div
              key={row.id}
              className={clsx(
                "row-in flex flex-col gap-0.5",
                row.role === "user" ? "items-end text-right" : "items-start text-left"
              )}
            >
              <span
                className={clsx(
                  "hud text-[9px] tracking-[0.3em]",
                  row.role === "user" ? "text-cyan-mist" : "text-amber-soft"
                )}
              >
                {row.role === "user" ? "YOU" : "JARVIS"}
              </span>
              <span
                className={clsx(
                  "max-w-[90%] whitespace-pre-wrap",
                  row.role === "user" ? "text-cyan-mist" : "text-cyan-ice",
                  row.partial && "opacity-70"
                )}
              >
                {row.text}
                {row.partial && <span className="animate-fadeInOut">▌</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      {!open && (
        <button
          className="absolute top-1/2 -left-10 -translate-y-1/2 hud-chip hud text-[10px]"
          onClick={() => setOpen(true)}
          aria-label="Open transcript"
        >
          LOG
        </button>
      )}
    </div>
  );
}
