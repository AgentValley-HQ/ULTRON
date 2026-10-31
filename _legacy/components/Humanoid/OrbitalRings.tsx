"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ringFragment, ringVertex } from "./shaders";
import type { JarvisState } from "@/lib/state/types";

interface Props {
  state: JarvisState;
  audioLevel: number;
  reducedMotion?: boolean;
}

interface RingSpec {
  radius: number;
  tube: number;
  tilt: [number, number, number];
  speed: number;
  color: string;
}

// Tight concentric rings framing the head rather than wrapping the whole scene.
// Mostly upright (small tilts) so they read as faint discs behind, not Saturn.
const RINGS: RingSpec[] = [
  { radius: 0.95, tube: 0.004, tilt: [0.12, 0.0, 0.15], speed: 0.08, color: "#9fd8e8" },
  { radius: 1.15, tube: 0.0035, tilt: [-0.08, 0.3, -0.1], speed: -0.05, color: "#19ddff" },
  { radius: 1.4, tube: 0.003, tilt: [0.05, -0.2, 0.25], speed: 0.03, color: "#bfeeff" }
];

export function OrbitalRings({ state, audioLevel, reducedMotion = false }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const matsRef = useRef<THREE.ShaderMaterial[]>([]);

  const items = useMemo(
    () =>
      RINGS.map((r) => {
        const geo = new THREE.TorusGeometry(r.radius, r.tube, 16, 220);
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uLevel: { value: 0 },
            uColor: { value: new THREE.Color(r.color) }
          },
          vertexShader: ringVertex,
          fragmentShader: ringFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide
        });
        return { geo, mat, spec: r };
      }),
    []
  );

  useFrame((_, dt) => {
    const speedK = reducedMotion ? 0.0 : state === "thinking" ? 2.2 : state === "executing_tool" ? 2.8 : 1;
    items.forEach((it, i) => {
      it.mat.uniforms.uTime.value += dt;
      it.mat.uniforms.uLevel.value +=
        (audioLevel - it.mat.uniforms.uLevel.value) * Math.min(1, dt * 10);

      if (groupRef.current && groupRef.current.children[i]) {
        const mesh = groupRef.current.children[i] as THREE.Mesh;
        mesh.rotation.z += dt * it.spec.speed * speedK;
      }
    });
  });

  // Store materials ref for cleanup
  matsRef.current = items.map((i) => i.mat);

  return (
    // Centre the ring group on the head (y=0.6) so they frame it, not the torso.
    <group ref={groupRef} position={[0, 0.6, 0]}>
      {items.map((it, i) => (
        <mesh
          key={i}
          geometry={it.geo}
          material={it.mat}
          rotation={it.spec.tilt}
        />
      ))}
    </group>
  );
}
