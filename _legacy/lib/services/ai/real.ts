import type { AIChunk, AIProvider, AIRequest } from "./types";

/**
 * Real AI provider: proxies to our own /api/chat server route which hides
 * API keys. Expects a text/event-stream of `data: {type,...}\n\n` chunks.
 */
export class RealAIProvider implements AIProvider {
  readonly label = "server";
  readonly isMock = false;

  async *stream(
    req: AIRequest,
    opts?: { signal?: AbortSignal }
  ): AsyncIterable<AIChunk> {
    const res = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify(req),
      headers: { "Content-Type": "application/json" },
      signal: opts?.signal
    });
    if (!res.ok || !res.body) {
      throw new Error(`JARVIS brain responded ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.replace(/^data:\s*/, "").trim();
        if (!line) continue;
        try {
          const payload = JSON.parse(line) as
            | { type: "text"; text: string }
            | { type: "tool"; name: string };
          if (payload.type === "text") {
            yield { type: "text", text: payload.text };
          } else if (payload.type === "tool") {
            yield {
              type: "tool",
              name: payload.name,
              promise: Promise.resolve()
            };
          }
        } catch {
          // ignore malformed frames
        }
      }
    }
  }
}
