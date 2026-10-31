import type { JarvisEvent, JarvisState } from "./types";

export function reduce(current: JarvisState, event: JarvisEvent): JarvisState {
  // ERROR and CANCEL are universal transitions
  if (event.type === "ERROR") return "error";
  if (event.type === "CANCEL") return "idle";
  if (event.type === "RECOVER") return "idle";

  switch (current) {
    case "idle":
      if (event.type === "MIC_ACTIVATED") return "listening";
      if (event.type === "TEXT_SUBMITTED") return "thinking";
      return current;

    case "listening":
      if (event.type === "MIC_DEACTIVATED") return "idle";
      if (event.type === "SPEECH_CAPTURED") return "processing";
      return current;

    case "processing":
      if (event.type === "MODEL_REQUESTED") return "thinking";
      return current;

    case "thinking":
      if (event.type === "TOOL_STARTED") return "executing_tool";
      if (event.type === "AUDIO_STARTED") return "speaking";
      if (event.type === "INTERRUPT") return "listening";
      return current;

    case "executing_tool":
      if (event.type === "TOOL_FINISHED") return "thinking";
      if (event.type === "INTERRUPT") return "listening";
      return current;

    case "speaking":
      if (event.type === "AUDIO_FINISHED") return "idle";
      if (event.type === "INTERRUPT") return "listening";
      return current;

    case "error":
      return current;

    default:
      return current;
  }
}

export const STATE_LABEL: Record<JarvisState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  processing: "PROCESSING",
  thinking: "THINKING",
  executing_tool: "TOOL",
  speaking: "SPEAKING",
  error: "LINK LOST"
};

export const STATE_TINT: Record<JarvisState, "cyan" | "amber" | "danger" | "muted"> = {
  idle: "muted",
  listening: "cyan",
  processing: "cyan",
  thinking: "cyan",
  executing_tool: "amber",
  speaking: "amber",
  error: "danger"
};
