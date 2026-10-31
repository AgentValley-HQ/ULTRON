"use client";

import { useState } from "react";
import clsx from "clsx";

interface Props {
  disabled?: boolean;
  onSubmit: (text: string) => void;
}

export function TextComposer({ disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");

  const submit = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setValue("");
  };

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="hud-dim text-[11px] tracking-[0.3em]">›</div>
      <input
        id="jarvis-text-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        placeholder="TRANSMIT A MESSAGE"
        className={clsx(
          "w-full bg-transparent hud text-xs md:text-sm placeholder:text-muted/70",
          "border-b border-cyan-soft/20 pb-1.5 pt-1 focus:border-cyan-core/80",
          "focus:outline-none transition-colors"
        )}
      />
      <button
        type="submit"
        disabled={disabled}
        className={clsx(
          "hud text-[11px] px-3 py-1 border border-cyan-soft/40 hover:border-cyan-core",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-core/60",
          "disabled:opacity-40"
        )}
      >
        SEND
      </button>
    </form>
  );
}
