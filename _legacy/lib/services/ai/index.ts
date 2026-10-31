import type { AIProvider } from "./types";
import { MockAIProvider } from "./mock";
import { RealAIProvider } from "./real";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const mode = process.env.NEXT_PUBLIC_JARVIS_MODE ?? "mock";
  cached = mode === "real" ? new RealAIProvider() : new MockAIProvider();
  return cached;
}

export type { AIProvider, AIChunk, AIRequest } from "./types";
