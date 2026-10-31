import type { AIChunk, AIProvider, AIRequest } from "./types";

const CANNED: Record<string, string[]> = {
  default: [
    "Online.",
    " Primary systems nominal.",
    " I'm picking up your signal clearly."
  ],
  hello: [
    "Hello.",
    " Signal is strong.",
    " Ready whenever you are."
  ],
  status: [
    "All subsystems green.",
    " Audio in-feed stable at four-eight kilohertz.",
    " Latency inside the twenty-millisecond envelope."
  ],
  time: ["Local time is being synchronised from the host clock."],
  weather: [
    "Weather tooling engaged.",
    " Running a sweep now."
  ]
};

function selectReply(prompt: string): string[] {
  const q = prompt.toLowerCase();
  if (/\b(hi|hello|hey|wake up|jarvis)\b/.test(q)) return CANNED.hello;
  if (/status|health|diagnos|system/.test(q)) return CANNED.status;
  if (/time|clock/.test(q)) return CANNED.time;
  if (/weather|forecast/.test(q)) return CANNED.weather;
  return CANNED.default;
}

async function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new DOMException("Aborted", "AbortError"));
    });
  });
}

export class MockAIProvider implements AIProvider {
  readonly label = "mock";
  readonly isMock = true;

  async *stream(req: AIRequest, opts?: { signal?: AbortSignal }): AsyncIterable<AIChunk> {
    const parts = selectReply(req.prompt);

    // simulated "thinking" latency
    await sleep(380 + Math.random() * 320, opts?.signal);

    // optional tool invocation on weather-like prompts
    if (/weather|forecast|search|look up/.test(req.prompt.toLowerCase())) {
      const toolP = sleep(650, opts?.signal);
      yield { type: "tool", name: "web.search", promise: toolP };
      await toolP;
    }

    for (const chunk of parts) {
      // token-by-token illusion
      const tokens = chunk.split(/(\s+)/);
      for (const tok of tokens) {
        if (opts?.signal?.aborted) return;
        yield { type: "text", text: tok };
        await sleep(28 + Math.random() * 32, opts?.signal);
      }
    }
  }
}
