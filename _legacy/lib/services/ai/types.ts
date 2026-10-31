export interface AIRequest {
  prompt: string;
  system?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export type AIChunk =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input?: unknown; promise: Promise<void> };

export interface AIProvider {
  readonly label: string;           // human-readable (e.g. "mock", "anthropic")
  readonly isMock: boolean;
  stream(
    req: AIRequest,
    opts?: { signal?: AbortSignal }
  ): AsyncIterable<AIChunk>;
}
