"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

interface Props {
  active: boolean;
  bins: Uint8Array | null;
  level: number;
  className?: string;
  colorActive?: string;
  colorIdle?: string;
}

/**
 * Live frequency-bar waveform. Degrades to a soft heartbeat when inactive
 * so the control bar never looks dead.
 */
export function Waveform({
  active,
  bins,
  level,
  className,
  colorActive = "#19ddff",
  colorIdle = "#4a6b75"
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const idleT = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const bars = 32;
      const gap = 3;
      const bw = (w - gap * (bars - 1)) / bars;

      idleT.current += 0.045;
      for (let i = 0; i < bars; i++) {
        let v: number;
        if (active && bins) {
          // Sample log-spaced bins
          const idx = Math.floor(
            (Math.log2(i + 1) / Math.log2(bars + 1)) * bins.length
          );
          v = bins[Math.min(bins.length - 1, idx)] / 255;
          v = Math.pow(v, 1.1) * (0.7 + level * 0.6);
        } else {
          v =
            0.18 +
            0.1 * Math.sin(idleT.current + i * 0.5) +
            0.05 * Math.sin(idleT.current * 2 + i);
        }

        const bh = Math.max(2, v * h);
        const y = (h - bh) / 2;
        ctx.fillStyle = active ? colorActive : colorIdle;
        ctx.globalAlpha = active ? 0.65 + 0.35 * v : 0.45;
        ctx.fillRect(i * (bw + gap), y, bw, bh);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, bins, level, colorActive, colorIdle]);

  return (
    <canvas
      ref={ref}
      className={clsx("h-10 w-full", className)}
      aria-hidden
    />
  );
}
