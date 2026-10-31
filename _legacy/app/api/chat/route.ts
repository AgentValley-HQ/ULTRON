import { NextRequest } from "next/server";

export const runtime = "edge";

interface Body {
  prompt: string;
  system?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

/**
 * Streams newline-delimited `data:` SSE frames to the client. Each frame is
 * JSON matching `AIChunk`: `{ "type": "text", "text": "..." }`.
 *
 * The route is a thin passthrough. The real-brain path is only taken when
 * the right API key is present on the server; otherwise we emit a clear
 * error frame instead of silently falling back — the mock provider is
 * strictly client-side and this route exists so API keys stay out of the
 * bundle.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const provider = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        if (provider === "anthropic") {
          await pipeAnthropic(body, push);
        } else if (provider === "openai") {
          await pipeOpenAI(body, push);
        } else {
          push({
            type: "text",
            text: `No AI_PROVIDER configured (received "${provider}").`
          });
        }
      } catch (e) {
        push({
          type: "text",
          text: e instanceof Error ? `Error: ${e.message}` : "Unknown error"
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

async function pipeAnthropic(
  body: Body,
  push: (obj: unknown) => void
): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
  if (!key) {
    push({
      type: "text",
      text: "ANTHROPIC_API_KEY is not set. Add it to .env.local or switch NEXT_PUBLIC_JARVIS_MODE=mock."
    });
    return;
  }

  const messages = [
    ...(body.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: body.prompt }
  ];

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      stream: true,
      system:
        body.system ??
        "You are JARVIS, a terse mission-control AI. Answer in short, confident sentences.",
      messages
    })
  });

  if (!r.ok || !r.body) {
    push({ type: "text", text: `Upstream ${r.status}` });
    return;
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const ev = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          push({ type: "text", text: ev.delta.text ?? "" });
        }
      } catch {
        /* ignore */
      }
    }
  }
}

async function pipeOpenAI(
  body: Body,
  push: (obj: unknown) => void
): Promise<void> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (!key) {
    push({
      type: "text",
      text: "OPENAI_API_KEY is not set."
    });
    return;
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            body.system ??
            "You are JARVIS, a terse mission-control AI. Answer in short, confident sentences."
        },
        ...(body.history ?? []),
        { role: "user", content: body.prompt }
      ]
    })
  });
  if (!r.ok || !r.body) {
    push({ type: "text", text: `Upstream ${r.status}` });
    return;
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const ev = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const text = ev.choices?.[0]?.delta?.content ?? "";
        if (text) push({ type: "text", text });
      } catch {
        /* ignore */
      }
    }
  }
}
