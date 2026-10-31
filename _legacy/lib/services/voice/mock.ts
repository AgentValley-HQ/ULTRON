import type { SpeakOptions, VoiceProvider } from "./types";

/**
 * Browser Speech Synthesis provider. "Mock" in the sense that it doesn't
 * contact an external TTS service — but it does produce real audio.
 *
 * While speaking we drive a synthetic envelope on `onLevel` so the humanoid
 * stays reactive even on devices that forbid probing speechSynthesis output.
 */
export class BrowserVoiceProvider implements VoiceProvider {
  readonly label = "browser-speech";
  readonly isMock = true;
  private current: SpeechSynthesisUtterance | null = null;

  async speak(text: string, opts?: SpeakOptions): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return this.fakeEnvelope(text, opts);
    }

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 0.92;
      utter.volume = 0.9;
      this.current = utter;

      const start = performance.now();
      const total = Math.max(600, text.length * 55); // rough duration estimate
      let raf = 0;
      const tick = () => {
        if (opts?.signal?.aborted) {
          window.speechSynthesis.cancel();
          cancelAnimationFrame(raf);
          opts?.onLevel?.(0);
          resolve();
          return;
        }
        const t = (performance.now() - start) / total;
        if (t >= 1) {
          opts?.onLevel?.(0);
          return;
        }
        // breathy multi-sine envelope
        const level =
          0.45 +
          0.3 * Math.sin(t * 60) * (1 - t) +
          0.2 * Math.sin(t * 17 + 1.2);
        opts?.onLevel?.(Math.max(0.1, Math.min(1, level)));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      utter.onend = () => {
        cancelAnimationFrame(raf);
        opts?.onLevel?.(0);
        resolve();
      };
      utter.onerror = () => {
        cancelAnimationFrame(raf);
        opts?.onLevel?.(0);
        resolve();
      };

      opts?.signal?.addEventListener("abort", () => {
        window.speechSynthesis.cancel();
        cancelAnimationFrame(raf);
        opts?.onLevel?.(0);
        resolve();
      });

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
  }

  stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  private async fakeEnvelope(text: string, opts?: SpeakOptions) {
    const total = Math.max(400, text.length * 50);
    const start = performance.now();
    return new Promise<void>((resolve) => {
      const tick = () => {
        if (opts?.signal?.aborted) {
          opts?.onLevel?.(0);
          return resolve();
        }
        const t = (performance.now() - start) / total;
        if (t >= 1) {
          opts?.onLevel?.(0);
          return resolve();
        }
        opts?.onLevel?.(0.5 + 0.35 * Math.sin(t * 50));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
