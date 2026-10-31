import { JarvisProvider } from "@/lib/state/JarvisProvider";
import { TopBar } from "@/components/HUD/TopBar";
import { StatusReadout } from "@/components/HUD/StatusReadout";
import { CornerBrackets } from "@/components/HUD/CornerBrackets";
import { DockBar } from "@/components/Controls/DockBar";
import { TranscriptPanel } from "@/components/Transcript/TranscriptPanel";
import { SettingsPanel } from "@/components/Settings/SettingsPanel";
import { HumanoidStage } from "@/components/Humanoid/HumanoidStage";

export default function Page() {
  return (
    <JarvisProvider>
      <main className="relative h-screen w-screen overflow-hidden bg-black text-cyan-mist">
        <div className="jarvis-backdrop" />
        <HumanoidStage />
        <div className="jarvis-vignette" />
        <div className="jarvis-scanline" />
        <CornerBrackets />
        <TopBar />
        <SettingsPanel />
        <TranscriptPanel />
        <StatusReadout />
        <DockBar />
      </main>
    </JarvisProvider>
  );
}
