import "dotenv/config";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { route } from "./router.ts";
import { gate } from "./gate.ts";
import { execute, requiresApproval, humanize } from "./executor.ts";
import {
  hasSoniox,
  openStt,
  speakSoniox,
  STT_SAMPLE_RATE,
  TTS_SAMPLE_RATE,
  type SttHandle,
} from "./voice.ts";
import { hasElevenLabs, speakElevenLabs, ELEVEN_SAMPLE_RATE } from "./elevenlabs.ts";
import { log } from "./log.ts";
import type {
  ClientMessage,
  ServerMessage,
  GateDecision,
} from "./types.ts";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "..", "public");
const PORT = Number(process.env.PORT ?? 5173);

const app = express();
app.use(express.static(PUBLIC_DIR));
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const who = req.socket.remoteAddress ?? "unknown";
  // Any server-side TTS provider → "soniox" voice mode on the wire.
  // (The client only cares whether audio arrives from the server or it needs browser Web Speech.)
  const serverTts = hasSoniox() || hasElevenLabs();
  const voiceMode: "soniox" | "browser" = serverTts ? "soniox" : "browser";
  log.conn(`client connected (${who}) voice=${voiceMode}`);

  const pending = new Map<string, (r: PermissionResult) => void>();
  let currentRequest = "";
  let sessionId: string | undefined;
  let stt: SttHandle | null = null;
  let ttsAbort: AbortController | null = null;

  const send = (m: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };
  const sendBinary = (buf: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(buf, { binary: true });
  };

  // Announce voice mode so the client picks the right STT/TTS path.
  send({
    type: "voice_mode",
    mode: voiceMode,
    sttSampleRate: STT_SAMPLE_RATE,
    ttsSampleRate: TTS_SAMPLE_RATE,
  });

  async function runPipeline(text: string): Promise<void> {
    currentRequest = text;
    const t0 = Date.now();
    try {
      send({ type: "state", state: "thinking" });
      send({ type: "status", text: "ROUTING" });
      const decision = await route(currentRequest);
      log.route(`connector=${decision.connector} model=${decision.model} missing=${decision.missing.toFixed(2)}`);
      send({ type: "route", decision });

      if (decision.missing > 0.65) {
        log.route("needs more detail — asking user");
        send({ type: "status", text: "NEEDS DETAIL" });
        const clar = "I need a bit more detail — tell me who, when, or what exactly.";
        send({ type: "clarify", text: clar });
        // Keep state=thinking until TTS begins; browser flips to speaking via tts_start / Web Speech onstart.
        if (voiceMode === "soniox") await streamTts(clar);
        else send({ type: "state", state: "idle" });
        send({ type: "done" });
        return;
      }

      send({ type: "status", text: `MODEL ${decision.model.toUpperCase()}` });
      // State stays as "thinking" throughout Claude execution.
      // The client transitions to "speaking" the moment TTS audio starts.

      const canUseTool = async (
        toolName: string,
        input: Record<string, unknown>,
      ): Promise<PermissionResult> => {
        if (!requiresApproval(toolName)) {
          log.tool(`auto-allow ${toolName}`);
          return { behavior: "allow" };
        }
        const preview = humanize(toolName, input);
        const g: GateDecision = await gate(currentRequest, preview);
        const id = randomUUID();
        log.tool(`ASK ${toolName} id=${id.slice(0, 8)} risk=${g.risk}`);
        log.tool(`  preview: ${preview.replace(/\n/g, " ⏎ ").slice(0, 160)}`);
        send({ type: "gate", id, decision: g, preview });
        return new Promise<PermissionResult>((res) => pending.set(id, res));
      };

      let charsStreamed = 0;
      const final = await execute({
        request: currentRequest,
        model: decision.model,
        connector: decision.connector,
        onText: (chunk) => {
          charsStreamed += chunk.length;
          send({ type: "token", text: chunk });
        },
        canUseTool,
        resumeSessionId: sessionId,
        onSessionId: (id) => {
          const first = !sessionId;
          sessionId = id;
          log.stream(`session ${id.slice(0, 8)} ${first ? "(new)" : "(resumed)"}`);
        },
      });

      log.done(`${charsStreamed} chars in ${Date.now() - t0}ms  →  "${final.slice(0, 140)}${final.length > 140 ? "…" : ""}"`);
      send({ type: "say", text: final });
      // Speak the complete response in one go. Streaming TTS was unreliable with
      // Soniox when tokens arrived rapidly — single call matches the greeting path
      // which works consistently.
      if (voiceMode === "soniox" && final.trim()) {
        await streamTts(final);
      } else if (!final.trim()) {
        send({ type: "state", state: "idle" });
      }
      send({ type: "status", text: "IDLE" });
      send({ type: "done" });
    } catch (e) {
      const text = e instanceof Error ? e.message : "Unknown error";
      log.err(text);
      send({ type: "error", text });
      send({ type: "state", state: "idle" });
    }
  }

  // TTS provider priority: ElevenLabs > Soniox > (nothing / browser Web Speech).
  const useElevenLabs = hasElevenLabs();
  const ttsRate = useElevenLabs ? ELEVEN_SAMPLE_RATE : TTS_SAMPLE_RATE;

  async function streamTts(text: string): Promise<void> {
    ttsAbort?.abort();
    ttsAbort = new AbortController();
    const signal = ttsAbort.signal;
    let chunks = 0, bytes = 0, announced = false;
    const onPcm = (chunk: Buffer) => {
      if (signal.aborted) return;
      if (!announced) { send({ type: "tts_start", sampleRate: ttsRate }); announced = true; }
      chunks++; bytes += chunk.byteLength;
      sendBinary(chunk);
    };
    try {
      if (useElevenLabs) {
        await speakElevenLabs(text, { onPcm, signal });
      } else {
        await speakSoniox(text, { onPcm, signal });
      }
    } catch (e) {
      log.err("TTS error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      log.info(`TTS done: ${chunks} chunks, ${bytes} bytes to browser`);
      send({ type: "tts_end" });
      if (ttsAbort?.signal === signal) ttsAbort = null;
    }
  }

  let binaryFramesIn = 0;
  let lastBinaryLog = 0;
  ws.on("message", async (raw, isBinary) => {
    // Binary frames = raw PCM audio from the browser mic → forward to Soniox STT.
    if (isBinary) {
      binaryFramesIn++;
      const now = Date.now();
      if (now - lastBinaryLog > 1000) {
        log.info(`binary frames: ${binaryFramesIn} total (stt=${stt ? "open" : "null"})`);
        lastBinaryLog = now;
      }
      if (!stt) return;
      stt.send(raw as Buffer);
      return;
    }
    log.info(`text frame: ${raw.toString().slice(0, 200)}`);

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      log.err("bad JSON from client");
      return;
    }

    if (msg.type === "approve" || msg.type === "deny") {
      log.decide(`${msg.type.toUpperCase()} ${msg.id.slice(0, 8)}`);
      const resolver = pending.get(msg.id);
      if (!resolver) return;
      pending.delete(msg.id);
      resolver(
        msg.type === "approve"
          ? { behavior: "allow" }
          : { behavior: "deny", message: "User denied this action." },
      );
      return;
    }

    if (msg.type === "greet") {
      if (voiceMode !== "soniox") return;
      log.recv("greet");
      await streamTts("Hey buddy, what's up? What are today's tasks?");
      return;
    }

    if (msg.type === "interrupt") {
      log.recv("interrupt");
      ttsAbort?.abort();
      return;
    }

    if (msg.type === "mic_start") {
      if (voiceMode !== "soniox") return;
      if (stt) { stt.close(); stt = null; }
      // Barge-in: speaking cancels any in-flight TTS.
      ttsAbort?.abort();
      const rate = msg.sampleRate || STT_SAMPLE_RATE;
      log.recv(`mic_start sampleRate=${rate}`);
      stt = openStt(rate, {
        onInterim: (t) => send({ type: "transcript", text: t, isFinal: false }),
        onFinal:   (t) => send({ type: "transcript", text: t, isFinal: true  }),
      });
      return;
    }

    if (msg.type === "mic_end") {
      if (!stt) return;
      log.recv("mic_end");
      const handle = stt;
      stt = null;
      try {
        const transcript = (await handle.end()).trim();
        log.recv(`"${transcript}"`);
        if (transcript) await runPipeline(transcript);
        else send({ type: "status", text: "NO SPEECH" });
      } catch (e) {
        const text = e instanceof Error ? e.message : "Unknown error";
        log.err(text);
        send({ type: "error", text });
      }
      return;
    }

    if (msg.type !== "request") return;
    const text = msg.text.trim();
    if (!text) return;
    log.recv(`"${text}"`);
    await runPipeline(text);
  });

  ws.on("close", () => {
    log.conn(`client disconnected`);
    stt?.close();
    stt = null;
    for (const [, resolver] of pending) {
      resolver({ behavior: "deny", message: "Session ended." });
    }
    pending.clear();
  });
});

server.listen(PORT, () => {
  log.info(`ultron listening on http://localhost:${PORT}`);
  log.info(`jev:    ${process.env.TYPESAFE_API_KEY ? "real" : "mock (regex fallback)"}`);
  const llm = process.env.ANTHROPIC_API_KEY
    ? "claude (env API key)"
    : process.env.OPENAI_API_KEY
      ? "openai (chat only — no connectors)"
      : "claude CLI OAuth if logged in, else mock";
  log.info(`llm:    ${llm}`);
  const tts = hasElevenLabs()
    ? "elevenlabs (server-side)"
    : hasSoniox()
      ? "soniox (server-side)"
      : "browser Web Speech (fallback)";
  log.info(`tts:    ${tts}`);
});
