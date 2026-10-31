import type { VoiceProvider } from "./types";
import { BrowserVoiceProvider } from "./mock";

let cached: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (cached) return cached;
  // Only the browser provider is implemented for the open-source scaffold.
  // Swap in a server-TTS provider (ElevenLabs/OpenAI) behind the same
  // interface when real credentials are configured.
  cached = new BrowserVoiceProvider();
  return cached;
}

export type { VoiceProvider, SpeakOptions } from "./types";
