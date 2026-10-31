"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import { reduce } from "./machine";
import type {
  ConnectionStatus,
  JarvisContextValue,
  JarvisEvent,
  JarvisState,
  TranscriptEntry
} from "./types";
import { getAIProvider } from "@/lib/services/ai";
import { getVoiceProvider } from "@/lib/services/voice";

const JarvisCtx = createContext<JarvisContextValue | null>(null);

interface InnerState {
  state: JarvisState;
  previous: JarvisState | null;
  tool: string | null;
  error: string | null;
}

type Action = { event: JarvisEvent };

function root(current: InnerState, action: Action): InnerState {
  const next = reduce(current.state, action.event);
  const event = action.event;
  return {
    state: next,
    previous: next !== current.state ? current.state : current.previous,
    tool:
      event.type === "TOOL_STARTED"
        ? event.name
        : event.type === "TOOL_FINISHED"
          ? null
          : current.tool,
    error:
      event.type === "ERROR"
        ? event.message
        : event.type === "RECOVER" || event.type === "CANCEL"
          ? null
          : current.error
  };
}

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const [inner, dispatch] = useReducer(root, {
    state: "idle",
    previous: null,
    tool: null,
    error: null
  });

  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>({
    online: true,
    mockMode: (process.env.NEXT_PUBLIC_JARVIS_MODE ?? "mock") === "mock",
    latencyMs: null
  });

  // Keep refs so async handlers always see fresh values
  const stateRef = useRef(inner.state);
  stateRef.current = inner.state;

  const cancelRef = useRef<AbortController | null>(null);

  const appendTranscript = useCallback(
    (entry: Omit<TranscriptEntry, "id" | "ts">) => {
      setTranscript((t) => [
        ...t,
        { ...entry, id: crypto.randomUUID(), ts: Date.now() }
      ]);
    },
    []
  );

  const updateLastPartial = useCallback(
    (role: "assistant" | "user", chunk: string, done = false) => {
      setTranscript((t) => {
        const last = t[t.length - 1];
        if (last && last.role === role && last.partial) {
          const updated: TranscriptEntry = {
            ...last,
            text: last.text + chunk,
            partial: !done
          };
          return [...t.slice(0, -1), updated];
        }
        return [
          ...t,
          {
            id: crypto.randomUUID(),
            role,
            text: chunk,
            partial: !done,
            ts: Date.now()
          }
        ];
      });
    },
    []
  );

  const send = useCallback((event: JarvisEvent) => {
    dispatch({ event });
  }, []);

  const runTurn = useCallback(
    async (userInput: string) => {
      cancelRef.current?.abort();
      const ctrl = new AbortController();
      cancelRef.current = ctrl;

      try {
        appendTranscript({ role: "user", text: userInput });
        send({ type: "MODEL_REQUESTED" });

        const ai = getAIProvider();
        const voice = getVoiceProvider();

        // Open an assistant partial row the stream will fill
        updateLastPartial("assistant", "");
        let full = "";

        for await (const chunk of ai.stream(
          { prompt: userInput },
          { signal: ctrl.signal }
        )) {
          if (ctrl.signal.aborted) return;

          if (chunk.type === "tool") {
            send({ type: "TOOL_STARTED", name: chunk.name });
            // simulate work; mock provider resolves tool itself
            await chunk.promise;
            send({ type: "TOOL_FINISHED" });
            continue;
          }

          if (chunk.type === "text") {
            full += chunk.text;
            updateLastPartial("assistant", chunk.text);
          }
        }
        if (ctrl.signal.aborted) return;

        updateLastPartial("assistant", "", true);

        send({ type: "AUDIO_STARTED" });
        await voice.speak(full, {
          signal: ctrl.signal,
          onLevel: setAudioLevel
        });
        if (ctrl.signal.aborted) return;
        setAudioLevel(0);
        send({ type: "AUDIO_FINISHED" });
      } catch (e: unknown) {
        if (ctrl.signal.aborted) return;
        const msg =
          e instanceof Error ? e.message : "Unknown error from JARVIS brain";
        send({ type: "ERROR", message: msg });
      }
    },
    [appendTranscript, send, updateLastPartial]
  );

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      send({ type: "TEXT_SUBMITTED", text: trimmed });
      void runTurn(trimmed);
    },
    [runTurn, send]
  );

  const cancel = useCallback(() => {
    cancelRef.current?.abort();
    setAudioLevel(0);
    send({ type: "CANCEL" });
  }, [send]);

  const toggleMic = useCallback(() => {
    if (stateRef.current === "listening") {
      send({ type: "MIC_DEACTIVATED" });
      return;
    }
    if (stateRef.current === "speaking" || stateRef.current === "thinking") {
      send({ type: "INTERRUPT" });
      cancelRef.current?.abort();
    }
    send({ type: "MIC_ACTIVATED" });
  }, [send]);

  // Health heartbeat for the LINK pill (purely cosmetic in mock mode).
  useEffect(() => {
    const int = window.setInterval(() => {
      setConnection((c) => ({
        ...c,
        latencyMs: c.mockMode
          ? 24 + Math.round(Math.random() * 18)
          : c.latencyMs
      }));
    }, 1800);
    return () => window.clearInterval(int);
  }, []);

  // Keyboard: space = toggle mic, / = focus text, esc = cancel
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (ev.code === "Space" && !isInput) {
        ev.preventDefault();
        toggleMic();
      } else if (ev.key === "Escape") {
        cancel();
      } else if (ev.key === "/" && !isInput) {
        ev.preventDefault();
        document.getElementById("jarvis-text-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel, toggleMic]);

  const value = useMemo<JarvisContextValue>(
    () => ({
      state: inner.state,
      previousState: inner.previous,
      activeTool: inner.tool,
      errorMessage: inner.error,
      audioLevel,
      transcript,
      connection,
      send,
      toggleMic,
      submitText,
      cancel,
      setAudioLevel
    }),
    [inner, audioLevel, transcript, connection, send, toggleMic, submitText, cancel]
  );

  return <JarvisCtx.Provider value={value}>{children}</JarvisCtx.Provider>;
}

export function useJarvis() {
  const ctx = useContext(JarvisCtx);
  if (!ctx) throw new Error("useJarvis must be used inside <JarvisProvider>");
  return ctx;
}
