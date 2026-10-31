"use client";

import { useEffect, useRef } from "react";
import { useJarvis } from "@/lib/state/JarvisProvider";
import { useMicrophone } from "@/lib/audio/useMicrophone";
import { useSpeechRecognition } from "@/lib/audio/useSpeechRecognition";
import { MicButton } from "./MicButton";
import { TextComposer } from "./TextComposer";
import { Waveform } from "./Waveform";

export function DockBar() {
  const { state, toggleMic, submitText, setAudioLevel, send } = useJarvis();
  const listening = state === "listening";

  const mic = useMicrophone(listening);
  const latestFinal = useRef<string>("");

  // feed mic envelope into shared audio level so the humanoid reacts
  useEffect(() => {
    if (listening) setAudioLevel(mic.level);
  }, [listening, mic.level, setAudioLevel]);

  const sr = useSpeechRecognition(listening, {
    onFinal: (text) => {
      if (!text || text === latestFinal.current) return;
      latestFinal.current = text;
      send({ type: "SPEECH_CAPTURED", transcript: text });
      submitText(text);
    }
  });

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 px-4 pb-5 md:px-10 md:pb-7">
      <div className="hud-brackets mx-auto max-w-3xl bg-black/50 backdrop-blur-md px-4 py-3 md:px-6 md:py-4">
        <span className="br-tr" />
        <span className="br-bl" />
        <div className="flex items-center gap-4">
          <MicButton
            active={listening}
            permission={mic.permission}
            onToggle={toggleMic}
          />
          <div className="flex-1 min-w-0">
            <Waveform
              active={listening}
              bins={mic.frequencyBins}
              level={mic.level}
              className="h-9 w-full"
            />
            <div className="mt-2">
              <TextComposer
                disabled={state === "thinking" || state === "speaking"}
                onSubmit={submitText}
              />
            </div>
          </div>
        </div>

        {/* feedback line */}
        <div className="mt-2 flex items-center justify-between text-[10px] tracking-[0.28em] hud-dim">
          <span>SPACE · MIC   /  · TEXT   ESC · CANCEL</span>
          <span>
            {mic.permission === "denied" && (
              <span className="hud-danger">MIC DENIED · USE TEXT</span>
            )}
            {mic.permission === "unsupported" && (
              <span className="hud-dim">MIC UNSUPPORTED</span>
            )}
            {!sr.supported && listening && (
              <span className="hud-amber">SPEECH-TO-TEXT UNSUPPORTED · AUDIO ONLY</span>
            )}
            {sr.interim && <span className="hud">{sr.interim}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
