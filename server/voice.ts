import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { log } from "./log.ts";

const STT_URL = "wss://stt-rt.soniox.com/transcribe-websocket";
const TTS_URL = "wss://tts-rt.soniox.com/tts-websocket";

export const STT_SAMPLE_RATE = 16000;
export const TTS_SAMPLE_RATE = 24000;

export const hasSoniox = () => Boolean(process.env.SONIOX_API_KEY);

/* ===================== STT ===================== */

export interface SttHandle {
  /** Pipe a raw PCM 16-bit LE mono chunk (16 kHz) to Soniox. */
  send(pcmChunk: Buffer): void;
  /** Signal end-of-audio; the final transcript resolves when Soniox finishes. */
  end(): Promise<string>;
  /** Abort the session (no final transcript). */
  close(): void;
}

export interface SttCallbacks {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
}

/** Open a Soniox streaming STT session. The returned handle accepts PCM chunks. */
export function openStt(sampleRate: number, cb: SttCallbacks = {}): SttHandle {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) throw new Error("SONIOX_API_KEY is not set");

  const ws = new WebSocket(STT_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
  const finalTokens: string[] = [];
  const pending: Buffer[] = [];
  let open = false;
  let endPromise: { resolve: (s: string) => void; reject: (e: Error) => void } | null = null;

  let bytesSent = 0;
  ws.on("open", () => {
    log.info(`Soniox STT WS open — config rate=${sampleRate}Hz`);
    ws.send(
      JSON.stringify({
        model: "stt-rt-v5",
        language_hints: [process.env.SONIOX_LANG ?? "en"],
        enable_endpoint_detection: true,
        audio_format: "pcm_s16le",
        sample_rate: sampleRate,
        num_channels: 1,
      }),
    );
    open = true;
    for (const chunk of pending) { ws.send(chunk); bytesSent += chunk.byteLength; }
    pending.length = 0;
  });

  ws.on("message", (raw) => {
    let res: {
      error_code?: string;
      error_message?: string;
      tokens?: { text: string; is_final: boolean }[];
      finished?: boolean;
    };
    try {
      res = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (res.error_code) {
      log.err(`Soniox STT ${res.error_code}: ${res.error_message}`);
      endPromise?.reject(new Error(`STT ${res.error_code}: ${res.error_message}`));
      ws.close();
      return;
    }
    if (res.tokens) {
      const finalText: string[] = [];
      const interimText: string[] = [];
      for (const tk of res.tokens) {
        if (!tk.text || tk.text === "<end>") continue; // skip endpoint-detection marker
        if (tk.is_final) finalText.push(tk.text);
        else interimText.push(tk.text);
      }
      if (finalText.length) {
        finalTokens.push(...finalText);
        cb.onFinal?.(finalText.join(""));
      }
      if (interimText.length) cb.onInterim?.(interimText.join(""));
    }
    if (res.finished && endPromise) {
      endPromise.resolve(finalTokens.join(""));
      ws.close();
    }
  });

  ws.on("error", (err) => {
    log.err("Soniox STT WS error: " + (err as Error).message);
    endPromise?.reject(err as Error);
  });
  ws.on("close", (code, reason) => {
    log.info(`Soniox STT WS closed code=${code} reason="${reason?.toString?.() ?? ""}" bytesSent=${bytesSent} finalTokens=${finalTokens.length}`);
    if (endPromise) endPromise.resolve(finalTokens.join(""));
  });

  return {
    send(chunk) {
      if (open && ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
        bytesSent += chunk.byteLength;
      } else {
        pending.push(chunk);
      }
    },
    end() {
      log.info(`Soniox STT end() — bytesSent=${bytesSent}, awaiting final transcript`);
      return new Promise<string>((resolve, reject) => {
        endPromise = { resolve, reject };
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send("");
        } catch {
          /* ignore */
        }
      });
    },
    close() {
      try { ws.close(); } catch { /* ignore */ }
    },
  };
}

/* ===================== TTS ===================== */

export interface TtsOptions {
  onPcm: (chunk: Buffer) => void;
  signal?: AbortSignal;
}

/** Open a streaming Soniox TTS session. Send text chunks via `pushText`; call `end()` when done. */
export interface TtsStreamHandle {
  pushText(text: string): void;
  end(): Promise<void>;
  cancel(): void;
}

export function openTtsStream(opts: TtsOptions): TtsStreamHandle {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) throw new Error("SONIOX_API_KEY is not set");

  const ws = new WebSocket(TTS_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
  const streamId = `tts-${randomUUID()}`;
  let wavHeaderDropped = false;
  let open = false;
  let settled = false;              // true once the stream has terminated / errored / closed
  const buffered: string[] = [];
  let endRequested = false;
  let endPromise: Promise<void> | null = null;
  let endResolver: (() => void) | null = null;
  let safetyTimer: NodeJS.Timeout | null = null;

  const settle = () => {
    if (settled) return;
    settled = true;
    if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
    try { ws.close(); } catch { /* ignore */ }
    endResolver?.();
  };

  // Buffer tokens into sentence/clause-ish chunks so Soniox TTS gets natural
  // prosody. Flush on sentence punctuation or when buffer passes 60 chars.
  let pending = "";
  const SENTENCE_END = /[.!?…\n]/;
  const FLUSH_LEN = 60;
  const flushPending = (textEnd: boolean) => {
    const t = pending;
    pending = "";
    if (t.length === 0 && !textEnd) return;
    try {
      ws.send(JSON.stringify({ text: t, text_end: textEnd, stream_id: streamId }));
    } catch { /* ignore */ }
  };

  opts.signal?.addEventListener("abort", () => settle(), { once: true });

  ws.on("open", () => {
    log.info(`Soniox TTS WS open stream=${streamId.slice(0, 12)}`);
    ws.send(JSON.stringify({
      model: "tts-rt-v2",
      language: process.env.SONIOX_LANG ?? "en",
      voice: process.env.SONIOX_VOICE ?? "Adrian",
      audio_format: "wav",
      sample_rate: TTS_SAMPLE_RATE,
      stream_id: streamId,
    }));
    open = true;
    for (const t of buffered) { pending += t; }
    buffered.length = 0;
    if (endRequested) flushPending(true);
    else if (pending.length >= FLUSH_LEN || SENTENCE_END.test(pending)) flushPending(false);
  });

  ws.on("message", (raw) => {
    let msg: { stream_id?: string; audio?: string; terminated?: boolean; error_code?: string; error_message?: string };
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.error_code) { log.err(`Soniox TTS ${msg.error_code}: ${msg.error_message}`); settle(); return; }
    if (msg.stream_id !== streamId) return;
    if (msg.audio) {
      let chunk = Buffer.from(msg.audio, "base64");
      if (!wavHeaderDropped) {
        if (chunk.length < 44) return;
        chunk = chunk.subarray(44);
        wavHeaderDropped = true;
      }
      if (chunk.length > 0 && !opts.signal?.aborted) opts.onPcm(chunk);
    }
    if (msg.terminated) settle();
  });
  ws.on("close", () => { log.info(`Soniox TTS WS closed stream=${streamId.slice(0, 12)}`); settle(); });
  ws.on("error", (err) => { log.err("Soniox TTS WS error: " + (err as Error).message); settle(); });

  return {
    pushText(text) {
      if (!text || endRequested || settled) return;
      pending += text;
      if (!open) return;      // flush will happen on open
      // Flush on sentence boundary or when buffer gets long enough.
      if (SENTENCE_END.test(pending) || pending.length >= FLUSH_LEN) flushPending(false);
    },
    end() {
      endRequested = true;
      if (open && !settled) flushPending(true);
      if (!endPromise) {
        endPromise = new Promise<void>((res) => {
          if (settled) return res();
          endResolver = res;
          // Safety net: if Soniox never terminates, resolve after 15s so the server doesn't hang.
          safetyTimer = setTimeout(() => {
            if (!settled) { log.err(`Soniox TTS timeout — forcing close (stream=${streamId.slice(0, 12)})`); settle(); }
          }, 15000);
        });
      }
      return endPromise;
    },
    cancel() { settle(); },
  };
}

/** One-shot: synthesize a complete text in Soniox voice. */
export async function speakSoniox(text: string, opts: TtsOptions): Promise<void> {
  const stream = openTtsStream(opts);
  stream.pushText(text);
  await stream.end();
}
