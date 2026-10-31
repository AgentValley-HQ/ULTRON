"use client";

import { useEffect, useRef, useState } from "react";

export type MicPermission = "idle" | "requesting" | "granted" | "denied" | "unsupported";

interface MicState {
  permission: MicPermission;
  stream: MediaStream | null;
  level: number; // 0..1 RMS envelope
  frequencyBins: Uint8Array | null;
  error: string | null;
}

/**
 * Opens the user's microphone when `active` is true, releases it when false.
 * Exposes a running RMS envelope and FFT bins driven by Web Audio.
 */
export function useMicrophone(active: boolean) {
  const [state, setState] = useState<MicState>({
    permission: "idle",
    stream: null,
    level: 0,
    frequencyBins: null,
    error: null
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const freqRef = useRef<Uint8Array | null>(null);
  const timeRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setState((s) => ({ ...s, permission: "unsupported" }));
        return;
      }
      setState((s) => ({ ...s, permission: "requesting", error: null }));
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        src.connect(analyser);

        ctxRef.current = ctx;
        analyserRef.current = analyser;
        srcRef.current = src;
        freqRef.current = new Uint8Array(analyser.frequencyBinCount);
        timeRef.current = new Uint8Array(analyser.fftSize);

        setState({
          permission: "granted",
          stream,
          level: 0,
          frequencyBins: freqRef.current,
          error: null
        });

        const tick = () => {
          if (!analyserRef.current || !timeRef.current || !freqRef.current) return;
          analyserRef.current.getByteTimeDomainData(timeRef.current);
          analyserRef.current.getByteFrequencyData(freqRef.current);

          let sum = 0;
          const buf = timeRef.current;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          // perceptual boost
          const level = Math.min(1, Math.pow(rms * 1.8, 0.85));
          setState((s) =>
            s.level === level ? s : { ...s, level, frequencyBins: freqRef.current }
          );
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Microphone unavailable";
        const denied = /denied|not allowed|permission/i.test(message);
        setState({
          permission: denied ? "denied" : "unsupported",
          stream: null,
          level: 0,
          frequencyBins: null,
          error: message
        });
      }
    }

    function stop() {
      cancelAnimationFrame(rafRef.current);
      analyserRef.current?.disconnect();
      srcRef.current?.disconnect();
      ctxRef.current?.close().catch(() => {});
      setState((s) => {
        s.stream?.getTracks().forEach((t) => t.stop());
        return {
          permission: s.permission === "granted" ? "idle" : s.permission,
          stream: null,
          level: 0,
          frequencyBins: null,
          error: null
        };
      });
      analyserRef.current = null;
      srcRef.current = null;
      ctxRef.current = null;
    }

    if (active) void start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return state;
}
