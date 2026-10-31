"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ParticleFace } from "./ParticleFace";
import { OrbitalRings } from "./OrbitalRings";
import type { JarvisState } from "@/lib/state/types";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface Props {
  state: JarvisState;
  audioLevel: number;
}

/**
 * Reduce particle count on devices with limited hardware concurrency so
 * the humanoid stays smooth on mobile without redesigning it.
 */
function useAdaptiveParticles(reducedMotion: boolean) {
  const [count, setCount] = useState(30000);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
    if (reducedMotion) setCount(8000);
    else if (cores >= 8 && mem >= 8) setCount(60000);
    else if (cores >= 4) setCount(30000);
    else setCount(14000);
  }, [reducedMotion]);
  return count;
}

export function HumanoidScene({ state, audioLevel }: Props) {
  const reducedMotion = useReducedMotion();
  const particles = useAdaptiveParticles(reducedMotion);

  return (
    <Canvas
      camera={{ position: [0, 0.45, 3.6], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false
      }}
      className="absolute inset-0"
    >
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.15} />
      <Suspense fallback={null}>
        <OrbitalRings
          state={state}
          audioLevel={audioLevel}
          reducedMotion={reducedMotion}
        />
        <ParticleFace
          state={state}
          audioLevel={audioLevel}
          particleCount={particles}
          reducedMotion={reducedMotion}
        />
      </Suspense>
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.35}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
