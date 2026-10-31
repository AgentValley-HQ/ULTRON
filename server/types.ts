export type Connector =
  | "gmail"
  | "calendar"
  | "notion"
  | "drive"
  | "canva"
  | "higgsfield"
  | "none";

export type ModelTier = "haiku" | "sonnet" | "opus";

export interface RouterDecision {
  connector: Connector;
  model: ModelTier;
  missing: number;
  confidence: number;
}

export interface GateDecision {
  upset: number;
  commits: number;
  risk: "low" | "medium" | "high";
  needsApproval: boolean;
}

export type ClientMessage =
  | { type: "request"; text: string }
  | { type: "approve"; id: string }
  | { type: "deny"; id: string }
  | { type: "mic_start"; sampleRate: number }
  | { type: "mic_end" }
  | { type: "greet" }
  | { type: "interrupt" };

export type ServerMessage =
  | { type: "state"; state: "idle" | "listening" | "thinking" | "speaking" }
  | { type: "status"; text: string }
  | { type: "voice_mode"; mode: "soniox" | "browser"; sttSampleRate?: number; ttsSampleRate?: number }
  | { type: "transcript"; text: string; isFinal: boolean }
  | { type: "route"; decision: RouterDecision }
  | { type: "clarify"; text: string }
  | { type: "gate"; id: string; decision: GateDecision; preview: string }
  | { type: "say"; text: string }
  | { type: "token"; text: string }
  | { type: "tts_start"; sampleRate: number }
  | { type: "tts_end" }
  | { type: "done" }
  | { type: "error"; text: string };
