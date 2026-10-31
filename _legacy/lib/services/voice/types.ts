export interface SpeakOptions {
  signal?: AbortSignal;
  onLevel?: (level: number) => void; // 0..1 current output envelope
  voice?: string;
}

export interface VoiceProvider {
  readonly label: string;
  readonly isMock: boolean;
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  stop(): void;
}
