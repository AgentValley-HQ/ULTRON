export type JarvisState =
  | "idle"
  | "listening"
  | "processing"
  | "thinking"
  | "speaking"
  | "executing_tool"
  | "error";

export type JarvisEvent =
  | { type: "MIC_ACTIVATED" }
  | { type: "MIC_DEACTIVATED" }
  | { type: "SPEECH_CAPTURED"; transcript: string }
  | { type: "TEXT_SUBMITTED"; text: string }
  | { type: "MODEL_REQUESTED" }
  | { type: "TOOL_STARTED"; name: string }
  | { type: "TOOL_FINISHED" }
  | { type: "AUDIO_STARTED" }
  | { type: "AUDIO_FINISHED" }
  | { type: "INTERRUPT" }
  | { type: "CANCEL" }
  | { type: "ERROR"; message: string }
  | { type: "RECOVER" };

export type TranscriptRole = "user" | "assistant" | "system";

export interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  partial?: boolean;
  ts: number;
}

export interface ConnectionStatus {
  online: boolean;
  mockMode: boolean;
  latencyMs: number | null;
}

export interface JarvisContextValue {
  state: JarvisState;
  previousState: JarvisState | null;
  activeTool: string | null;
  errorMessage: string | null;
  audioLevel: number;        // 0..1, drives shader uniforms
  transcript: TranscriptEntry[];
  connection: ConnectionStatus;
  send: (event: JarvisEvent) => void;
  // UI-facing actions (wrap send() for ergonomics)
  toggleMic: () => void;
  submitText: (text: string) => void;
  cancel: () => void;
  setAudioLevel: (v: number) => void;
}
