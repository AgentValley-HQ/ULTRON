export const particleVertex = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uExpand;
  uniform float uBreath;
  uniform float uJitter;
  uniform float uSize;
  attribute float aSeed;
  attribute vec3 aDir;
  varying float vSeed;
  varying float vDepth;

  // low-cost hash noise
  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vSeed = aSeed;

    // Base position lives on an elongated spheroid approximating a head/bust.
    // We displace along the outward normal with a periodic breath and audio drive.
    float breath = sin(uTime * 1.1 + aSeed * 6.2831) * 0.5 + 0.5; // 0..1
    float swirl = sin(uTime * 0.6 + aSeed * 3.14 + position.y * 2.0);

    vec3 p = position;
    float expansion = 1.0
      + uBreath * (breath * 0.04)
      + uExpand * (0.18 + 0.22 * swirl)
      + uLevel * (0.12 + 0.18 * breath);

    p *= expansion;

    // orthogonal jitter so cloud never feels rigid
    vec3 jit = aDir * ((hash(aSeed * 10.0 + uTime * 0.6) - 0.5) * 2.0) * uJitter;
    p += jit * (0.05 + uLevel * 0.08);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    // depth-aware point size, with audio punch — tuned to stay ~2-5px
    // so a dense 30k shell reads as a surface, not a blob.
    gl_PointSize = uSize * (14.0 / max(1.0, -mv.z)) * (0.9 + uLevel * 0.4);
  }
`;

export const particleFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorTip;
  uniform float uTime;
  uniform float uLevel;
  varying float vSeed;
  varying float vDepth;

  void main() {
    // circular soft sprite
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = dot(uv, uv);
    if (d > 1.0) discard;
    float soft = smoothstep(1.0, 0.0, d);

    // blend across cloud + tip highlight
    float mixT = clamp(0.5 + 0.5 * sin(vSeed * 6.283 + uTime * 0.4), 0.0, 1.0);
    vec3 base = mix(uColorA, uColorB, mixT);
    vec3 col = mix(base, uColorTip, pow(soft, 6.0) * (0.6 + uLevel));

    // ~30k points stacked with additive blending — per-sample alpha has
    // to be very low or the surface saturates to white.
    float alpha = soft * (0.08 + uLevel * 0.12);
    gl_FragColor = vec4(col, alpha);
  }
`;

export const ringVertex = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ringFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uLevel;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    // Rings are thin bands anti-aliased along the UV v axis.
    float band = 1.0 - abs(vUv.y - 0.5) * 2.0;
    band = smoothstep(0.0, 1.0, band);
    float pulse = 0.5 + 0.5 * sin(uTime * 1.4 + vUv.x * 12.56);
    float alpha = pow(band, 2.0) * (0.25 + 0.4 * pulse + 0.25 * uLevel);
    gl_FragColor = vec4(uColor, alpha);
  }
`;
