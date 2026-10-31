"use client";

import { HumanoidScene } from "./HumanoidScene";
import { useJarvis } from "@/lib/state/JarvisProvider";

export default function HumanoidClient() {
  const { state, audioLevel } = useJarvis();
  return <HumanoidScene state={state} audioLevel={audioLevel} />;
}
