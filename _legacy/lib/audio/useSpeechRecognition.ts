"use client";

import { useEffect, useRef, useState } from "react";

// SpeechRecognition is prefixed on Chromium-based browsers.
type AnyWindow = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface Options {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
}

/**
 * Thin wrapper around the Web Speech API. Returns `supported=false` on
 * browsers that lack it so the UI can fall back cleanly.
 */
export function useSpeechRecognition(active: boolean, opts: Options = {}) {
  const [supported, setSupported] = useState<boolean>(true);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refOpts = useRef(opts);
  refOpts.current = opts;
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as AnyWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }

    if (!active) {
      recRef.current?.stop();
      recRef.current = null;
      setInterim("");
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = opts.lang ?? "en-US";

    rec.onresult = (ev) => {
      let finalText = "";
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) {
        setInterim(interimText);
        refOpts.current.onInterim?.(interimText);
      }
      if (finalText.trim()) {
        setInterim("");
        refOpts.current.onFinal?.(finalText.trim());
      }
    };
    rec.onerror = (e) => setError(e.error ?? "speech recognition error");
    rec.onend = () => setInterim("");

    try {
      rec.start();
      recRef.current = rec;
    } catch (e) {
      setError(e instanceof Error ? e.message : "cannot start recognition");
    }

    return () => {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, [active, opts.lang]);

  return { supported, interim, error };
}
