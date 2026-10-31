"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { particleFragment, particleVertex } from "./shaders";
import type { JarvisState } from "@/lib/state/types";

interface Props {
  state: JarvisState;
  audioLevel: number;
  particleCount?: number;
  reducedMotion?: boolean;
}

/**
 * Builds a shoulders-up bust as surface-shell point cloud. We composite
 * three primitives on their surfaces (not volumes) so the silhouette reads
 * as a figure rather than a loose cloud:
 *
 *   • Head  — Fibonacci sphere, slightly y-elongated
 *   • Neck  — vertical cylinder shell
 *   • Bust  — ellipsoid shell shaped like upper torso + shoulders
 */
function buildBustGeometry(count: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const dirs = new Float32Array(count * 3);

  // Budget allocation (sum = 1.0)
  const HEAD = 0.55;
  const NECK = 0.08;
  // remainder goes to bust/shoulders
  const headCount = Math.floor(count * HEAD);
  const neckCount = Math.floor(count * NECK);
  const bustCount = count - headCount - neckCount;

  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  // ---- HEAD: Fibonacci sphere, centre y = 0.6, slight vertical elongation ----
  for (let i = 0; i < headCount; i++) {
    const t = i / Math.max(1, headCount - 1);
    const yUnit = 1 - 2 * t;                // -1..1
    const r = Math.sqrt(1 - yUnit * yUnit);
    const theta = GOLDEN * i;
    const nx = Math.cos(theta) * r;
    const nz = Math.sin(theta) * r;
    const ny = yUnit;

    // small radial jitter so it isn't a perfect sphere
    const rj = 1 + (Math.random() - 0.5) * 0.04;

    const x = nx * 0.52 * rj;
    const y = ny * 0.62 * rj + 0.68;
    const z = nz * 0.5 * rj;

    const idx = i * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    seeds[i] = Math.random();

    const nlen = Math.hypot(nx, ny, nz) || 1;
    dirs[idx] = nx / nlen;
    dirs[idx + 1] = ny / nlen;
    dirs[idx + 2] = nz / nlen;
  }

  // ---- NECK: thin vertical cylinder shell ----
  const neckStart = headCount;
  for (let i = 0; i < neckCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const yParam = Math.random();
    const r = 0.14 + (Math.random() - 0.5) * 0.02;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r * 0.85;
    const y = 0.02 + yParam * 0.24;

    const idx = (neckStart + i) * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    seeds[neckStart + i] = Math.random();

    const nlen = Math.hypot(Math.cos(angle), 0, Math.sin(angle)) || 1;
    dirs[idx] = Math.cos(angle) / nlen;
    dirs[idx + 1] = 0;
    dirs[idx + 2] = Math.sin(angle) / nlen;
  }

  // ---- BUST: ellipsoid shell, wider x than z, shoulders sloping down ----
  const bustStart = headCount + neckCount;
  for (let i = 0; i < bustCount; i++) {
    const t = i / Math.max(1, bustCount - 1);
    const yUnit = 1 - 2 * t;
    const r = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
    const theta = GOLDEN * i + 1.3;

    let nx = Math.cos(theta) * r;
    let nz = Math.sin(theta) * r;
    let ny = yUnit;

    // keep only the lower hemisphere (shoulders), reflect top band into shoulders too
    if (ny > 0.3) ny = 0.3 - (ny - 0.3) * 1.4;

    // shoulder sweep: taper down and out
    const shoulderPinch = 1 - Math.max(0, ny + 0.1) * 0.6;

    const x = nx * 1.15 * shoulderPinch;
    const y = ny * 0.55 - 0.3;
    const z = nz * 0.6;

    // thin the band, drop interior
    const outward = Math.hypot(nx, nz);
    if (outward < 0.72 && Math.random() < 0.55) {
      // retry inside via remap toward the shell
      const sc = 0.9 / Math.max(0.001, outward);
      positions[(bustStart + i) * 3] = nx * sc * 1.15 * shoulderPinch;
      positions[(bustStart + i) * 3 + 1] = y;
      positions[(bustStart + i) * 3 + 2] = nz * sc * 0.6;
    } else {
      positions[(bustStart + i) * 3] = x;
      positions[(bustStart + i) * 3 + 1] = y;
      positions[(bustStart + i) * 3 + 2] = z;
    }
    seeds[bustStart + i] = Math.random();

    const nlen = Math.hypot(nx, ny, nz) || 1;
    dirs[(bustStart + i) * 3] = nx / nlen;
    dirs[(bustStart + i) * 3 + 1] = ny / nlen;
    dirs[(bustStart + i) * 3 + 2] = nz / nlen;
  }

  return { positions, seeds, dirs };
}

const UNIFORMS_BY_STATE: Record<
  JarvisState,
  { expand: number; jitter: number; breath: number; size: number }
> = {
  idle: { expand: 0.0, jitter: 0.25, breath: 1.0, size: 1.0 },
  listening: { expand: 0.08, jitter: 0.5, breath: 1.0, size: 1.15 },
  processing: { expand: -0.05, jitter: 0.9, breath: 0.6, size: 1.0 },
  thinking: { expand: 0.18, jitter: 1.1, breath: 0.4, size: 1.15 },
  executing_tool: { expand: 0.12, jitter: 0.9, breath: 0.5, size: 1.1 },
  speaking: { expand: 0.06, jitter: 0.55, breath: 0.9, size: 1.3 },
  error: { expand: 0.0, jitter: 1.6, breath: 0.1, size: 1.0 }
};

const COLORS_BY_STATE: Record<
  JarvisState,
  { a: THREE.Color; b: THREE.Color; tip: THREE.Color }
> = {
  idle: {
    a: new THREE.Color("#19ddff"),
    b: new THREE.Color("#9fd8e8"),
    tip: new THREE.Color("#d8fbff")
  },
  listening: {
    a: new THREE.Color("#19ddff"),
    b: new THREE.Color("#bfeeff"),
    tip: new THREE.Color("#ffffff")
  },
  processing: {
    a: new THREE.Color("#22d3ee"),
    b: new THREE.Color("#9fd8e8"),
    tip: new THREE.Color("#d8fbff")
  },
  thinking: {
    a: new THREE.Color("#22d3ee"),
    b: new THREE.Color("#9fd8e8"),
    tip: new THREE.Color("#ffd98a")
  },
  executing_tool: {
    a: new THREE.Color("#f5a623"),
    b: new THREE.Color("#ffb54d"),
    tip: new THREE.Color("#ffd98a")
  },
  speaking: {
    a: new THREE.Color("#19ddff"),
    b: new THREE.Color("#ffb54d"),
    tip: new THREE.Color("#ffd98a")
  },
  error: {
    a: new THREE.Color("#ff4444"),
    b: new THREE.Color("#f5a623"),
    tip: new THREE.Color("#ffffff")
  }
};

export function ParticleFace({
  state,
  audioLevel,
  particleCount = 4096,
  reducedMotion = false
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const { positions, seeds, dirs } = buildBustGeometry(particleCount);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("aDir", new THREE.BufferAttribute(dirs, 3));
    return g;
  }, [particleCount]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uExpand: { value: 0 },
      uBreath: { value: 1 },
      uJitter: { value: 0.25 },
      uSize: { value: 1.0 },
      uColorA: { value: COLORS_BY_STATE.idle.a.clone() },
      uColorB: { value: COLORS_BY_STATE.idle.b.clone() },
      uColorTip: { value: COLORS_BY_STATE.idle.tip.clone() }
    }),
    []
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
    [uniforms]
  );

  useFrame((_, dt) => {
    uniforms.uTime.value += reducedMotion ? dt * 0.1 : dt;

    const target = UNIFORMS_BY_STATE[state];
    const lerpK = Math.min(1, dt * 4.5);

    uniforms.uExpand.value += (target.expand - uniforms.uExpand.value) * lerpK;
    uniforms.uJitter.value += (target.jitter - uniforms.uJitter.value) * lerpK;
    uniforms.uBreath.value += (target.breath - uniforms.uBreath.value) * lerpK;
    uniforms.uSize.value += (target.size - uniforms.uSize.value) * lerpK;
    uniforms.uLevel.value += (audioLevel - uniforms.uLevel.value) * Math.min(1, dt * 10);

    const col = COLORS_BY_STATE[state];
    (uniforms.uColorA.value as THREE.Color).lerp(col.a, lerpK);
    (uniforms.uColorB.value as THREE.Color).lerp(col.b, lerpK);
    (uniforms.uColorTip.value as THREE.Color).lerp(col.tip, lerpK);

    // slow idle rotation + gentle bob
    if (groupRef.current) {
      const t = uniforms.uTime.value;
      groupRef.current.rotation.y = Math.sin(t * 0.15) * 0.14;
      groupRef.current.rotation.x = Math.sin(t * 0.21) * 0.05;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geometry} material={material} />
    </group>
  );
}
