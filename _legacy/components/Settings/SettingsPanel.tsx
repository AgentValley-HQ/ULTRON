"use client";

import { useState } from "react";
import clsx from "clsx";
import { useJarvis } from "@/lib/state/JarvisProvider";

type ThemeId = "cyan" | "amber" | "mint" | "violet";

const THEMES: { id: ThemeId; swatch: string; label: string }[] = [
  { id: "cyan", swatch: "#19ddff", label: "CYAN" },
  { id: "amber", swatch: "#f5a623", label: "AMBER" },
  { id: "mint", swatch: "#5ff1b1", label: "MINT" },
  { id: "violet", swatch: "#b57bff", label: "VIOLET" }
];

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("cyan");
  const [voice, setVoice] = useState("default");
  const { connection } = useJarvis();

  return (
    <>
      <button
        className={clsx(
          "fixed top-20 left-5 z-30 hud-chip hud text-[10px]",
          "pointer-events-auto"
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        ⚙︎ SETTINGS
      </button>

      <div
        className={clsx(
          "pointer-events-auto fixed left-4 top-32 z-30 w-[260px] max-w-[80vw]",
          "transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="hud-brackets relative bg-black/60 backdrop-blur-md p-4 space-y-5">
          <span className="br-tr" />
          <span className="br-bl" />

          <div>
            <div className="hud text-[10px] mb-2">PALETTE</div>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  title={t.label}
                  onClick={() => setTheme(t.id)}
                  className={clsx(
                    "h-7 w-7 rounded-full border transition",
                    theme === t.id
                      ? "border-cyan-core ring-2 ring-cyan-core/40"
                      : "border-cyan-soft/30 hover:border-cyan-soft"
                  )}
                  style={{ background: t.swatch }}
                />
              ))}
            </div>
            <div className="hud-dim text-[10px] tracking-[0.26em] mt-2">
              {THEMES.find((x) => x.id === theme)?.label} · UI tokens
            </div>
          </div>

          <div>
            <div className="hud text-[10px] mb-2">VOICE</div>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full bg-transparent border border-cyan-soft/30 hud text-[11px] px-2 py-1 focus:outline-none focus:border-cyan-core"
            >
              <option value="default">BROWSER DEFAULT</option>
              <option value="elevenlabs">ELEVENLABS (SERVER)</option>
              <option value="openai">OPENAI (SERVER)</option>
            </select>
            <div className="hud-dim text-[10px] mt-2">
              Server providers require backend credentials.
            </div>
          </div>

          <div>
            <div className="hud text-[10px] mb-2">LINK</div>
            <div className="hud text-[11px]">
              {connection.mockMode ? (
                <span className="hud-amber">MOCK MODE</span>
              ) : (
                <span className="hud">LIVE</span>
              )}
            </div>
            <div className="hud-dim text-[10px] mt-1">
              Set NEXT_PUBLIC_JARVIS_MODE=real to use /api/chat.
            </div>
          </div>

          <div className="hud-dim text-[10px] tracking-[0.26em]">
            KEYBOARD · SPACE · / · ESC
          </div>
        </div>
      </div>
    </>
  );
}
