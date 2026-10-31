import { log } from "./log.ts";

/**
 * ElevenLabs streaming TTS → raw PCM 16-bit LE at the configured sample rate.
 * Returns the sample rate used so the server can forward it to the browser.
 *
 * Defaults to Adam (deep male voice). Override via ELEVENLABS_VOICE_ID.
 * Default sample rate is 24000 Hz (pcm_24000), which requires a paid tier.
 * Set ELEVENLABS_SAMPLE_RATE=22050 or 16000 for free-tier accounts.
 */
export const hasElevenLabs = () => Boolean(process.env.ELEVENLABS_API_KEY);

export const ELEVEN_SAMPLE_RATE = Number(process.env.ELEVENLABS_SAMPLE_RATE ?? 24000);
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";

export interface TtsOptions {
  onPcm: (chunk: Buffer) => void;
  signal?: AbortSignal;
}

const SUPPORTED_RATES = new Set([8000, 16000, 22050, 24000, 44100]);

export async function speakElevenLabs(text: string, opts: TtsOptions): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID;

  const rate = SUPPORTED_RATES.has(ELEVEN_SAMPLE_RATE) ? ELEVEN_SAMPLE_RATE : 24000;
  const outputFormat = `pcm_${rate}`;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`;

  const controller = new AbortController();
  opts.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/pcm",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
    signal: controller.signal,
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`ElevenLabs ${resp.status}: ${errText.slice(0, 300)}`);
  }

  log.info(`ElevenLabs TTS stream open voice=${voiceId.slice(0, 8)} rate=${rate}`);

  const reader = resp.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (opts.signal?.aborted) break;
      if (value && value.byteLength > 0) opts.onPcm(Buffer.from(value));
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}
