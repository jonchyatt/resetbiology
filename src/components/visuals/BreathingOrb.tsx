"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, shaderMaterial } from "@react-three/drei";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type BreathPattern = {
  label: string;
  inhale: number;
  hold: number;
  exhale: number;
  hold2: number;
};

export type BackgroundOption = {
  key: string;
  label: string;
  css: string;
};

export type ColorPreset = {
  key: string;
  label: string;
  colorA: string;
  colorB: string;
  description: string;
};

export const BREATH_PATTERNS: Record<string, BreathPattern> = {
  "4-7-8": { label: "4-7-8 Calming", inhale: 4, hold: 7, exhale: 8, hold2: 0 },
  box: { label: "Box Breathing 4-4-4-4", inhale: 4, hold: 4, exhale: 4, hold2: 4 },
  balanced: { label: "Balanced 5-5-5-1", inhale: 5, hold: 5, exhale: 5, hold2: 1 },
  energize: { label: "Energizing 3-1-3-1", inhale: 3, hold: 1, exhale: 3, hold2: 1 },
  relaxed: { label: "Deep Relaxation 4-6-2", inhale: 4, hold: 0, exhale: 6, hold2: 2 },
  coherent: { label: "Coherent 5-5", inhale: 5, hold: 0, exhale: 5, hold2: 0 },
};

export const BACKGROUNDS: BackgroundOption[] = [
  {
    key: "stars",
    label: "Deep Space Stars",
    css: "radial-gradient(ellipse at center, #030816 0%, #04030d 55%, #02020a 100%)",
  },
  {
    key: "aurora",
    label: "Aurora Veil",
    css: "linear-gradient(135deg, #0b1026 0%, #1c2a4a 30%, #15475c 60%, #293b73 100%)",
  },
  {
    key: "sunset",
    label: "Sunset Glow",
    css: "radial-gradient(circle at 30% 30%, rgba(255,175,110,0.45) 0, transparent 35%), linear-gradient(160deg, #0b0c1c 0%, #3f1d2e 45%, #80413f 100%)",
  },
  {
    key: "canyon",
    label: "Zion Canyon Ember",
    css: "linear-gradient(180deg, #1b0c0a 0%, #2b0f0d 30%, #5a1c12 70%, #a4451f 100%)",
  },
  {
    key: "ocean",
    label: "Deep Ocean",
    css: "linear-gradient(180deg, #0a1628 0%, #0d2137 30%, #0f2847 70%, #1a4a6e 100%)",
  },
  {
    key: "nebula",
    label: "Purple Nebula",
    css: "radial-gradient(ellipse at center, #1a0a2e 0%, #2d1b4e 30%, #1a0a2e 70%, #0a0515 100%)",
  },
];

export const COLOR_PRESETS: ColorPreset[] = [
  { key: "warm", label: "Warm Glow", colorA: "#ffdd77", colorB: "#ff4400", description: "Original warm orange" },
  { key: "ethereal", label: "Ethereal Blue", colorA: "#88ffff", colorB: "#0066ff", description: "Calm cyan tones" },
  { key: "cosmic", label: "Cosmic Purple", colorA: "#ff88ff", colorB: "#6600ff", description: "Deep space violet" },
  { key: "nature", label: "Nature Green", colorA: "#88ff88", colorB: "#00aa00", description: "Organic earth tones" },
  { key: "fire", label: "Fire Spirit", colorA: "#ffff00", colorB: "#ff2200", description: "Intense red-orange" },
  { key: "aurora", label: "Aurora Mix", colorA: "#00ffaa", colorB: "#aa00ff", description: "Green to purple shift" },
  { key: "sunset", label: "Desert Sunset", colorA: "#ffaa66", colorB: "#ff4466", description: "Warm coral tones" },
  { key: "moonlight", label: "Moonlight", colorA: "#ffffff", colorB: "#aaccff", description: "Soft silver glow" },
];

// ============================================================================
// AUDIO ANALYZER - Singleton with global state
// ============================================================================

class AudioAnalyzerSingleton {
  private static instance: AudioAnalyzerSingleton | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private connectedElement: HTMLAudioElement | null = null;

  public amplitude = 0;
  public bass = 0;
  public mid = 0;
  public high = 0;

  static getInstance(): AudioAnalyzerSingleton {
    if (!AudioAnalyzerSingleton.instance) {
      AudioAnalyzerSingleton.instance = new AudioAnalyzerSingleton();
    }
    return AudioAnalyzerSingleton.instance;
  }

  async connect(audioElement: HTMLAudioElement): Promise<void> {
    // Don't reconnect if already connected to this element
    if (this.connectedElement === audioElement && this.audioContext) {
      return;
    }

    // Clean up previous connection
    this.disconnect();

    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.7;

      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      this.connectedElement = audioElement;

      console.log("[AudioAnalyzer] Connected successfully");
    } catch (err) {
      console.error("[AudioAnalyzer] Connection failed:", err);
      throw err;
    }
  }

  update(): void {
    if (!this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    const len = this.dataArray.length;

    // Split into frequency bands
    const bassEnd = Math.floor(len * 0.1);
    const midEnd = Math.floor(len * 0.5);

    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;
    let totalSum = 0;

    for (let i = 0; i < len; i++) {
      const val = this.dataArray[i];
      totalSum += val;

      if (i < bassEnd) {
        bassSum += val;
      } else if (i < midEnd) {
        midSum += val;
      } else {
        highSum += val;
      }
    }

    // Normalize to 0-1
    this.bass = (bassSum / bassEnd) / 255;
    this.mid = (midSum / (midEnd - bassEnd)) / 255;
    this.high = (highSum / (len - midEnd)) / 255;
    this.amplitude = (totalSum / len) / 255;
  }

  disconnect(): void {
    if (this.source) {
      try { this.source.disconnect(); } catch {}
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
    }
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.connectedElement = null;
    this.amplitude = 0;
    this.bass = 0;
    this.mid = 0;
    this.high = 0;
  }
}

export const audioAnalyzer = AudioAnalyzerSingleton.getInstance();

// ============================================================================
// BREATH TIMING CALCULATOR
// ============================================================================

function computeBreathFactor(time: number, pattern: BreathPattern): number {
  const total = pattern.inhale + pattern.hold + pattern.exhale + pattern.hold2;
  if (total === 0) return 0.5;
  const t = ((time % total) + total) % total;
  const ease = (x: number) => x * x * (3 - 2 * x);

  if (t < pattern.inhale) {
    return ease(t / pattern.inhale);
  }
  const t2 = t - pattern.inhale;
  if (t2 < pattern.hold) {
    return 1.0;
  }
  const t3 = t2 - pattern.hold;
  if (t3 < pattern.exhale) {
    return 1.0 - ease(t3 / pattern.exhale);
  }
  return 0.0;
}

// ============================================================================
// NEBULA ORB - Volumetric cloud-like particle system
// ============================================================================

type NebulaOrbProps = {
  pattern: BreathPattern;
  particleCount: number;
  colorA: THREE.Color;
  colorB: THREE.Color;
  audioAmplitude: number;
  mode: "breath" | "audio";
  intensity: number;
  turbulence: number;
};

function NebulaOrb({
  pattern,
  particleCount,
  colorA,
  colorB,
  audioAmplitude,
  mode,
  intensity,
  turbulence,
}: NebulaOrbProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate particle positions with layered spherical distribution
  const { positions, sizes, phases, layers } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const pha = new Float32Array(particleCount);
    const lay = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Multiple layers of particles at different radii
      const layer = Math.floor(Math.random() * 5); // More layers for depth
      const baseRadius = 0.15 + layer * 0.2; // Spread out more
      const radiusVariation = 0.25; // More variation for cloud effect
      const r = baseRadius + (Math.random() - 0.5) * radiusVariation;

      // Spherical distribution with some clustering
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Add some randomness for cloud-like clustering
      const clusterOffset = 0.1;

      pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta) + (Math.random() - 0.5) * clusterOffset;
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.85 + (Math.random() - 0.5) * clusterOffset;
      pos[i * 3 + 2] = r * Math.cos(phi) + (Math.random() - 0.5) * clusterOffset;

      // Varied particle sizes - mix of small and medium for texture
      const sizeVariation = Math.random();
      if (sizeVariation < 0.7) {
        // 70% small particles for fine detail
        siz[i] = (0.2 + Math.random() * 0.4) * (0.7 + layer * 0.1);
      } else {
        // 30% larger particles for glow
        siz[i] = (0.5 + Math.random() * 0.8) * (0.9 + layer * 0.15);
      }

      // Random phase for animation variety
      pha[i] = Math.random() * Math.PI * 2;

      // Store layer info
      lay[i] = layer / 4;
    }

    return { positions: pos, sizes: siz, phases: pha, layers: lay };
  }, [particleCount]);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    const t = clock.elapsedTime;
    let breathValue: number;

    if (mode === "audio") {
      // Audio mode: direct response to amplitude
      breathValue = 0.3 + audioAmplitude * 1.5;
    } else {
      // Breath mode: smooth breathing cycle
      breathValue = computeBreathFactor(t, pattern);
    }

    materialRef.current.uniforms.uTime.value = t;
    materialRef.current.uniforms.uBreath.value = breathValue;
    materialRef.current.uniforms.uIntensity.value = intensity;
    materialRef.current.uniforms.uTurbulence.value = turbulence;
    materialRef.current.uniforms.uColorA.value = colorA;
    materialRef.current.uniforms.uColorB.value = colorB;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aLayer" args={[layers, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uBreath: { value: 0.5 },
          uColorA: { value: colorA },
          uColorB: { value: colorB },
          uIntensity: { value: intensity },
          uTurbulence: { value: turbulence },
        }}
        vertexShader={`
          uniform float uTime;
          uniform float uBreath;
          uniform float uTurbulence;

          attribute float aSize;
          attribute float aPhase;
          attribute float aLayer;

          varying float vAlpha;
          varying float vLayer;
          varying vec2 vUv;

          // Simplex noise function
          vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
          vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
          vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
          vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

          float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);

            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;

            i = mod289(i);
            vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);

            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
          }

          void main() {
            vLayer = aLayer;
            vUv = uv;

            // Breathing scale - expand and contract
            float breathScale = 0.6 + uBreath * 0.8;

            // Turbulent motion using noise
            float noiseScale = 2.0;
            float noiseTime = uTime * 0.3;
            vec3 noisePos = position * noiseScale + noiseTime;

            float nx = snoise(noisePos) * uTurbulence;
            float ny = snoise(noisePos + 100.0) * uTurbulence;
            float nz = snoise(noisePos + 200.0) * uTurbulence;

            // Orbital rotation - different speeds per layer
            float orbitSpeed = 0.15 + aLayer * 0.1;
            float orbit = uTime * orbitSpeed + aPhase;

            vec3 pos = position * breathScale;

            // Add swirling motion
            float swirl = sin(orbit) * 0.1 * (1.0 + uBreath);
            pos.x += cos(orbit) * swirl + nx * 0.15;
            pos.z += sin(orbit) * swirl + nz * 0.15;
            pos.y += ny * 0.1;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            // Size varies with breath and distance
            float distanceScale = 100.0 / length(mvPosition.xyz);
            float breathSizeBoost = 1.0 + uBreath * 0.4;
            gl_PointSize = aSize * distanceScale * breathSizeBoost;

            // Alpha based on layer (inner = brighter core, outer = softer glow)
            float layerAlpha = mix(0.4, 0.15, aLayer); // Inner particles brighter
            vAlpha = layerAlpha * (0.6 + uBreath * 0.4);
          }
        `}
        fragmentShader={`
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uBreath;
          uniform float uIntensity;

          varying float vAlpha;
          varying float vLayer;

          void main() {
            // Soft circular gradient
            vec2 center = gl_PointCoord - 0.5;
            float dist = length(center);

            // Very soft falloff for cloud-like appearance
            float alpha = smoothstep(0.5, 0.0, dist);
            alpha = pow(alpha, 1.2); // Sharper falloff for less bleed

            // Color gradient - inner to outer
            float colorMix = dist * 2.0 + vLayer * 0.4;
            vec3 color = mix(uColorA, uColorB, clamp(colorMix, 0.0, 1.0));

            // Subtle brightness boost at center
            float coreBrightness = exp(-dist * 6.0) * uBreath * 0.3;
            color += uColorA * coreBrightness;

            // Apply intensity (reduced multiplier)
            color *= uIntensity * 0.6;

            // Final alpha - more subtle
            float finalAlpha = alpha * vAlpha;

            gl_FragColor = vec4(color, finalAlpha);
          }
        `}
      />
    </points>
  );
}

// ============================================================================
// ANIMATED STAR FIELD BACKGROUND
// ============================================================================

function AnimatedStarField({
  count = 3000,
  speed = 0.3,
  colorful = true
}: {
  count?: number;
  speed?: number;
  colorful?: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors, sizes, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const vel = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute stars in a large sphere
      const radius = 30 + Math.random() * 70;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Random star colors if colorful
      if (colorful && Math.random() > 0.7) {
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
        col[i * 3 + 0] = color.r;
        col[i * 3 + 1] = color.g;
        col[i * 3 + 2] = color.b;
      } else {
        col[i * 3 + 0] = 1;
        col[i * 3 + 1] = 1;
        col[i * 3 + 2] = 1;
      }

      siz[i] = 0.5 + Math.random() * 2;
      vel[i] = 0.5 + Math.random() * 1.5;
    }

    return { positions: pos, colors: col, sizes: siz, velocities: vel };
  }, [count, colorful]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const t = clock.elapsedTime * speed;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Gentle rotation around Y axis
      const x = positions[idx];
      const z = positions[idx + 2];
      const angle = t * velocities[i] * 0.02;
      pos[idx + 0] = x * Math.cos(angle) - z * Math.sin(angle);
      pos[idx + 2] = x * Math.sin(angle) + z * Math.cos(angle);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.slice(), 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        uniforms={{}}
        vertexShader={`
          attribute float size;
          varying vec3 vColor;

          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = size * (200.0 / length(mvPosition.xyz));
          }
        `}
        fragmentShader={`
          varying vec3 vColor;

          void main() {
            float dist = length(gl_PointCoord - 0.5);
            float alpha = smoothstep(0.5, 0.0, dist);
            alpha = pow(alpha, 1.5);
            gl_FragColor = vec4(vColor, alpha * 0.8);
          }
        `}
      />
    </points>
  );
}

// ============================================================================
// WATER PLANE WITH WAVES
// ============================================================================

function WaterPlane({
  color = "#0a1828",
  reflectivity = 0.4
}: {
  color?: string;
  reflectivity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
      <planeGeometry args={[100, 100, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uReflectivity: { value: reflectivity },
        }}
        vertexShader={`
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            vUv = uv;

            vec3 pos = position;

            // Multiple wave layers
            float wave1 = sin(pos.x * 0.5 + uTime * 0.5) * 0.1;
            float wave2 = sin(pos.y * 0.3 + uTime * 0.3) * 0.08;
            float wave3 = sin((pos.x + pos.y) * 0.2 + uTime * 0.4) * 0.05;

            pos.z += wave1 + wave2 + wave3;
            vWave = (wave1 + wave2 + wave3) * 2.0;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uReflectivity;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            // Base water color
            vec3 color = uColor;

            // Add wave highlights
            float highlight = smoothstep(0.0, 0.2, vWave) * uReflectivity;
            color += vec3(0.2, 0.3, 0.4) * highlight;

            // Distance fade
            float dist = length(vUv - 0.5) * 2.0;
            float alpha = smoothstep(1.0, 0.3, dist) * 0.7;

            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
}

// ============================================================================
// MAIN CANVAS COMPONENT
// ============================================================================

export type BreathingOrbCanvasProps = {
  mode: "breath" | "audio";
  patternKey: string;
  audioAmplitude?: number;
  background: BackgroundOption;
  particleCount?: number;
  colorA?: string;
  colorB?: string;
  intensity?: number;
  turbulence?: number;
  starEnabled?: boolean;
  starCount?: number;
  starSpeed?: number;
  starColorful?: boolean;
  waterEnabled?: boolean;
  waterColor?: string;
  waterReflectivity?: number;
  videoUrl?: string;
};

export function BreathingOrbCanvas({
  mode = "breath",
  patternKey,
  audioAmplitude = 0,
  background,
  particleCount = 25000,
  colorA = "#ffdd77",
  colorB = "#ff4400",
  intensity = 1.5,
  turbulence = 0.4,
  starEnabled = true,
  starCount = 4000,
  starSpeed = 0.3,
  starColorful = true,
  waterEnabled = true,
  waterColor = "#0a1828",
  waterReflectivity = 0.4,
  videoUrl,
}: BreathingOrbCanvasProps) {
  const pattern = BREATH_PATTERNS[patternKey] ?? BREATH_PATTERNS["4-7-8"];
  const colorAObj = useMemo(() => new THREE.Color(colorA), [colorA]);
  const colorBObj = useMemo(() => new THREE.Color(colorB), [colorB]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl"
      style={{ minHeight: 520, background: background.css }}
    >
      {videoUrl && (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      <Canvas
        camera={{ position: [0, 0.8, 4], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ position: "relative", zIndex: 1 }}
      >
        {starEnabled && (
          <AnimatedStarField
            count={starCount}
            speed={starSpeed}
            colorful={starColorful}
          />
        )}

        <ambientLight intensity={0.1} />

        <group position={[0, 0.2, 0]}>
          <NebulaOrb
            pattern={pattern}
            particleCount={particleCount}
            colorA={colorAObj}
            colorB={colorBObj}
            audioAmplitude={audioAmplitude}
            mode={mode}
            intensity={intensity}
            turbulence={turbulence}
          />
        </group>

        {waterEnabled && (
          <WaterPlane color={waterColor} reflectivity={waterReflectivity} />
        )}

        <OrbitControls
          enablePan={false}
          minDistance={2}
          maxDistance={12}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>
    </div>
  );
}

// ============================================================================
// BREATH INDICATOR COMPONENT
// ============================================================================

export function BreathIndicator({
  patternKey,
  showPhase = true
}: {
  patternKey: string;
  showPhase?: boolean;
}) {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale" | "hold2">("inhale");
  const [progress, setProgress] = useState(0);
  const pattern = BREATH_PATTERNS[patternKey] ?? BREATH_PATTERNS["4-7-8"];

  useEffect(() => {
    const total = pattern.inhale + pattern.hold + pattern.exhale + pattern.hold2;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000) % total;

      if (elapsed < pattern.inhale) {
        setPhase("inhale");
        setProgress(elapsed / pattern.inhale);
      } else if (elapsed < pattern.inhale + pattern.hold) {
        setPhase("hold");
        setProgress((elapsed - pattern.inhale) / Math.max(pattern.hold, 0.001));
      } else if (elapsed < pattern.inhale + pattern.hold + pattern.exhale) {
        setPhase("exhale");
        setProgress((elapsed - pattern.inhale - pattern.hold) / pattern.exhale);
      } else {
        setPhase("hold2");
        setProgress((elapsed - pattern.inhale - pattern.hold - pattern.exhale) / Math.max(pattern.hold2, 0.001));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [pattern]);

  if (!showPhase) return null;

  const phaseLabels = {
    inhale: "Breathe In",
    hold: "Hold",
    exhale: "Breathe Out",
    hold2: "Hold",
  };

  const phaseColors = {
    inhale: "from-cyan-400 to-blue-500",
    hold: "from-purple-400 to-purple-600",
    exhale: "from-orange-400 to-red-500",
    hold2: "from-gray-400 to-gray-600",
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
      <div className="flex flex-col items-center gap-2">
        <span className="text-lg font-medium text-white drop-shadow-lg">
          {phaseLabels[phase]}
        </span>
        <div className="w-48 h-2 bg-slate-800/60 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${phaseColors[phase]} transition-all duration-100`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AUDIO AMPLITUDE DISPLAY
// ============================================================================

export function AudioAmplitudeDisplay({ amplitude }: { amplitude: number }) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-slate-300">Audio Level</span>
        <div className="w-48 h-3 bg-slate-800/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-75"
            style={{ width: `${Math.min(amplitude * 150, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
