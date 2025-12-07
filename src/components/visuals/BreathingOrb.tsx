"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
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

// Orb type selector - allows switching between different orb implementations
export type OrbType = "rainbow" | "unity";

export const ORB_TYPES: { key: OrbType; label: string; description: string }[] = [
  { key: "rainbow", label: "Rainbow Orb", description: "Audio-reactive rainbow particle system" },
  { key: "unity", label: "Unity Orb", description: "Unity-style particle system (customizable)" },
];

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

  // Audio levels (0-1)
  public amplitude = 0;
  public bass = 0;
  public mid = 0;
  public high = 0;

  // ========================================
  // BEAT DETECTION (from Unity AudioSyncScale)
  // ========================================
  // Beat detection parameters - LOWERED threshold for easier triggering
  public bias = 0.5;           // Threshold multiplier (lowered from 1.0)
  public timeStep = 0.08;      // Min cooldown between beats (seconds)
  public timeToBeat = 0.08;    // How quickly to register a beat
  public restSmoothTime = 0.5; // Time to return to rest scale (faster)
  public beatScale = 1.8;      // Scale multiplier on beat
  public restScale = 1.0;      // Normal rest scale (1.0 instead of 0.9)

  // Beat state
  private previousBass = 0;
  private lastBeatTime = 0;
  public isBeat = false;           // True for one frame when beat detected
  public currentScale = 1.0;       // Current smoothed scale (rest -> beat -> rest)
  public timeSinceLastBeat = 999;  // Seconds since last beat

  // Global hue for rainbow effect (0-1, cycles through spectrum)
  public globalHue = 0;
  private hueSpeed = 0.15;  // Faster hue cycling (was 0.05)
  public hueJumpOnBeat = 0.12; // Jump hue by this amount on each beat (was 0.08)

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

  update(deltaTime: number = 0.016): void {
    if (!this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    const len = this.dataArray.length;

    // Split into frequency bands
    // Sub-bass (0-60Hz) is roughly the first 2-3% of bins for 44.1kHz sample rate
    const subBassEnd = Math.floor(len * 0.025); // ~60Hz
    const bassEnd = Math.floor(len * 0.1);       // ~250Hz
    const midEnd = Math.floor(len * 0.5);

    let subBassSum = 0;
    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;
    let totalSum = 0;

    for (let i = 0; i < len; i++) {
      const val = this.dataArray[i];
      totalSum += val;

      if (i < subBassEnd) {
        subBassSum += val;
      }
      if (i < bassEnd) {
        bassSum += val;
      } else if (i < midEnd) {
        midSum += val;
      } else {
        highSum += val;
      }
    }

    // Normalize to 0-1
    const subBass = subBassEnd > 0 ? (subBassSum / subBassEnd) / 255 : 0;
    this.bass = (bassSum / bassEnd) / 255;
    this.mid = (midSum / (midEnd - bassEnd)) / 255;
    this.high = (highSum / (len - midEnd)) / 255;
    this.amplitude = (totalSum / len) / 255;

    // ========================================
    // BEAT DETECTION (Threshold Crossing)
    // ========================================
    const now = performance.now() / 1000;
    this.timeSinceLastBeat = now - this.lastBeatTime;
    this.isBeat = false;

    // Use combined bass signal for beat detection
    const beatSignal = Math.max(subBass, this.bass * 0.7);
    const threshold = 0.05; // VERY LOW threshold - any bass triggers

    // Detect rising edge crossing threshold with cooldown
    if (beatSignal > threshold &&
        this.previousBass <= threshold &&
        this.timeSinceLastBeat > this.timeStep) {
      this.isBeat = true;
      this.lastBeatTime = now;
      this.currentScale = this.beatScale;
      this.globalHue = (this.globalHue + this.hueJumpOnBeat) % 1.0;
      console.log(`[BEAT!] signal=${beatSignal.toFixed(3)} hue=${this.globalHue.toFixed(2)} scale=${this.currentScale}`);
    }

    this.previousBass = beatSignal;

    // Scale responds to amplitude directly (continuous, not just beats)
    const amplitudeScale = this.restScale + this.amplitude * 0.8;
    const lerpFactor = Math.min(1, deltaTime * 8); // Fast response

    // If beat just happened, use beatScale, otherwise lerp toward amplitude-based scale
    if (this.isBeat) {
      this.currentScale = this.beatScale;
    } else {
      this.currentScale = this.currentScale + (amplitudeScale - this.currentScale) * lerpFactor;
    }

    // ALWAYS cycle hue continuously (rainbow effect regardless of beats)
    this.globalHue = (this.globalHue + this.hueSpeed * Math.max(deltaTime, 0.016)) % 1.0;
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
  // New props for beat detection and rainbow
  beatScale?: number;      // Current scale from beat detector (0.9 rest -> 1.8 beat)
  globalHue?: number;      // Global hue for rainbow effect (0-1)
  useRainbowMode?: boolean; // Enable rainbow coloring
};

// Helper: Convert HSV to RGB (for rainbow effect)
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [r, g, b];
}

function NebulaOrb({
  pattern,
  particleCount,
  colorA,
  colorB,
  audioAmplitude,
  mode,
  intensity,
  turbulence,
  beatScale = 1.0,
  globalHue = 0,
  useRainbowMode = false,
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

  // Track local hue for animation when props don't update fast enough
  const localHueRef = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!materialRef.current) return;

    const t = clock.elapsedTime;
    let breathValue: number;

    if (mode === "audio") {
      // Audio mode: direct response to amplitude
      breathValue = 0.3 + audioAmplitude * 1.5;

      // ALWAYS animate hue locally in audio mode (don't rely on props)
      localHueRef.current = (localHueRef.current + 0.003) % 1.0; // Steady cycle

      // Add extra hue jump based on amplitude spikes
      if (audioAmplitude > 0.3) {
        localHueRef.current = (localHueRef.current + audioAmplitude * 0.02) % 1.0;
      }
    } else {
      // Breath mode: smooth breathing cycle
      breathValue = computeBreathFactor(t, pattern);
    }

    materialRef.current.uniforms.uTime.value = t;
    materialRef.current.uniforms.uBreath.value = breathValue;
    materialRef.current.uniforms.uIntensity.value = intensity;
    materialRef.current.uniforms.uTurbulence.value = turbulence;

    // RAINBOW MODE: Use local hue animation (more reliable than prop-based)
    if (useRainbowMode || mode === "audio") {
      // Use local hue animation for smooth color cycling
      const hue = localHueRef.current;

      // Convert hue (0-1) to RGB using HSV
      const [r, g, b] = hsvToRgb(hue, 0.95, 1.0);
      materialRef.current.uniforms.uColorA.value.setRGB(r, g, b);

      // Secondary color is offset hue
      const [r2, g2, b2] = hsvToRgb((hue + 0.2) % 1.0, 0.85, 0.95);
      materialRef.current.uniforms.uColorB.value.setRGB(r2, g2, b2);
    } else {
      // Breath mode - use preset colors
      materialRef.current.uniforms.uColorA.value.copy(colorA);
      materialRef.current.uniforms.uColorB.value.copy(colorB);
    }

    // BEAT SCALE: Apply scale based on amplitude in audio mode
    if (mode === "audio") {
      const dynamicScale = 1.0 + audioAmplitude * 0.8;
      materialRef.current.uniforms.uBeatScale.value = dynamicScale;
    } else {
      materialRef.current.uniforms.uBeatScale.value = 1.0;
    }
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
          uBeatScale: { value: 1.0 },
        }}
        vertexShader={`
          uniform float uTime;
          uniform float uBreath;
          uniform float uTurbulence;
          uniform float uBeatScale;

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
            // Multiply by uBeatScale for beat punch effect (0.9 rest -> 1.8 on beat)
            float breathScale = (0.6 + uBreath * 0.8) * uBeatScale;

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
// UNITY ORB - Dual-layer particle system matching Unity's behavior
// TWO LAYERS: simple_rainbow (fine mist) + additive_rainbow (main particles)
// Features: birth/death cycle, size over lifetime, alpha fade, rainbow at birth
// ============================================================================

type UnityOrbProps = {
  pattern: BreathPattern;
  particleCount: number;
  colorA: THREE.Color;
  colorB: THREE.Color;
  audioAmplitude: number;
  mode: "breath" | "audio";
  intensity: number;
  turbulence: number;
  beatScale?: number;
  globalHue?: number;
  useRainbowMode?: boolean;
};

// Unity rainbow gradient (8 colors from prefab)
const RAINBOW_GRADIENT = [
  { t: 0.0000, r: 1.00, g: 0.00, b: 0.00 }, // red
  { t: 0.1266, r: 1.00, g: 0.44, b: 0.00 }, // orange
  { t: 0.2766, r: 1.00, g: 0.85, b: 0.00 }, // yellow
  { t: 0.4383, r: 0.14, g: 1.00, b: 0.07 }, // green
  { t: 0.6030, r: 0.01, g: 0.75, b: 1.00 }, // cyan
  { t: 0.7649, r: 0.31, g: 0.13, b: 0.61 }, // purple
  { t: 0.9066, r: 0.67, g: 0.00, b: 0.82 }, // magenta
  { t: 1.0000, r: 1.00, g: 0.00, b: 0.00 }, // red (loop)
];

// Get color from rainbow gradient at position t (0-1)
function getRainbowColor(t: number): [number, number, number] {
  t = ((t % 1) + 1) % 1; // Wrap to 0-1
  let i = 0;
  while (i < RAINBOW_GRADIENT.length - 1 && RAINBOW_GRADIENT[i + 1].t < t) i++;
  const c1 = RAINBOW_GRADIENT[i];
  const c2 = RAINBOW_GRADIENT[Math.min(i + 1, RAINBOW_GRADIENT.length - 1)];
  const range = c2.t - c1.t;
  const f = range > 0 ? (t - c1.t) / range : 0;
  return [
    c1.r + (c2.r - c1.r) * f,
    c1.g + (c2.g - c1.g) * f,
    c1.b + (c2.b - c1.b) * f,
  ];
}

// Frequency band for audio reactivity
export type FrequencyBand = "all" | "bass" | "mids" | "treble";

// Layer configuration - EXPORTED so page.tsx can manage state
export type ParticleLayerConfig = {
  id: string;               // Unique ID for React keys
  name: string;             // Display name
  enabled: boolean;         // Toggle layer on/off
  particleCount: number;    // Number of particles in this layer
  baseSize: number;         // Base particle size (0.01 - 1.0)
  spawnRadius: number;      // How far from center (0.001 - 0.5)
  maxSpeed: number;         // Outward velocity (0 - 0.2)
  lifetime: number;         // Seconds (0.5 - 5.0)
  audioReactivity: number;  // How much audio affects this layer (0 - 2.0)
  frequencyBand: FrequencyBand; // Which frequencies to react to
  sizeAtBirth: number;      // Size multiplier at birth (0.01 - 0.5)
  sizeAtPeak: number;       // Size multiplier at peak (0.5 - 1.5)
  sizeAtDeath: number;      // Size multiplier at death (0.01 - 0.5)
  peakLifetime: number;     // When peak size occurs (0.3 - 0.9)
};

// Default layer configurations - Tuned for beautiful ethereal nebula effect
// Settings from user testing - smaller sizes with proper scaling work best
export const DEFAULT_UNITY_LAYERS: ParticleLayerConfig[] = [
  // Layer 1: Core Glow - Dense bright center, bass-reactive
  {
    id: "additive-1",
    name: "Core Glow",
    enabled: true,
    particleCount: 1500,
    baseSize: 0.20,          // Smaller particles with proper scaling
    spawnRadius: 0.05,       // Tight center spawn
    maxSpeed: 0.04,          // Slow outward drift
    lifetime: 2.0,
    audioReactivity: 0.50,
    frequencyBand: "bass",
    sizeAtBirth: 0.02,       // 2% at birth
    sizeAtPeak: 1.0,         // 100% at peak
    sizeAtDeath: 0.07,       // 7% at death
    peakLifetime: 0.4,       // Peak at 40% lifetime
  },
  // Layer 2: Ethereal Mist - Soft diffuse outer cloud, mids-reactive
  {
    id: "simple-1",
    name: "Ethereal Mist",
    enabled: true,
    particleCount: 1000,
    baseSize: 0.20,          // Same size as core
    spawnRadius: 0.20,       // Wider spawn for mist effect
    maxSpeed: 0.01,          // Very slow drift
    lifetime: 2.0,
    audioReactivity: 0.60,
    frequencyBand: "mids",
    sizeAtBirth: 0.02,       // 2% at birth
    sizeAtPeak: 1.0,         // 100% at peak
    sizeAtDeath: 0.02,       // 2% at death
    peakLifetime: 0.7,       // Peak at 70% lifetime
  },
];

// Single particle layer component
function UnityParticleLayer({
  config,
  audioAmplitude,
  bassAmplitude,
  midsAmplitude,
  trebleAmplitude,
  mode,
  intensity,
  pattern,
  globalHueRef,
}: {
  config: ParticleLayerConfig;
  audioAmplitude: number;
  bassAmplitude: number;
  midsAmplitude: number;
  trebleAmplitude: number;
  mode: "breath" | "audio";
  intensity: number;
  pattern: BreathPattern;
  globalHueRef: React.MutableRefObject<number>;
}) {
  // Get amplitude based on frequency band
  const getAmplitudeForBand = useCallback(() => {
    if (mode !== "audio") return 0;
    switch (config.frequencyBand) {
      case "bass": return bassAmplitude;
      case "mids": return midsAmplitude;
      case "treble": return trebleAmplitude;
      default: return audioAmplitude;
    }
  }, [mode, config.frequencyBand, bassAmplitude, midsAmplitude, trebleAmplitude, audioAmplitude]);

  const particleCount = config.particleCount;
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Particle state refs (mutable without re-render)
  const stateRef = useRef<{
    birthTimes: Float32Array;
    lifetimes: Float32Array;
    birthHues: Float32Array;
    velocities: Float32Array;
    birthPositions: Float32Array;
    baseSizes: Float32Array;
  } | null>(null);

  // Initialize particle buffers and state
  const { positions, sizes, colors, alphas } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const siz = new Float32Array(particleCount);
    const col = new Float32Array(particleCount * 3);
    const alp = new Float32Array(particleCount);

    const birthTimes = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);
    const birthHues = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);
    const birthPositions = new Float32Array(particleCount * 3);
    const baseSizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Random direction on sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Spawn radius based on layer config
      const r = config.spawnRadius + Math.random() * config.spawnRadius * 0.5;

      const dirX = Math.sin(phi) * Math.cos(theta);
      const dirY = Math.sin(phi) * Math.sin(theta);
      const dirZ = Math.cos(phi);

      const x = dirX * r;
      const y = dirY * r;
      const z = dirZ * r;

      birthPositions[i * 3] = x;
      birthPositions[i * 3 + 1] = y;
      birthPositions[i * 3 + 2] = z;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Outward velocity (much slower: 0 to maxSpeed)
      const speed = Math.random() * config.maxSpeed;
      velocities[i * 3] = dirX * speed;
      velocities[i * 3 + 1] = dirY * speed;
      velocities[i * 3 + 2] = dirZ * speed;

      // Stagger birth times across the lifetime
      birthTimes[i] = -Math.random() * config.lifetime;
      lifetimes[i] = config.lifetime + (Math.random() - 0.5) * 0.4;

      // Random initial hue
      birthHues[i] = Math.random();

      // Base size with some variation
      baseSizes[i] = config.baseSize * (0.7 + Math.random() * 0.6);
      siz[i] = baseSizes[i] * 0.02; // Start at 2%

      // Initial color
      const [cr, cg, cb] = getRainbowColor(birthHues[i]);
      col[i * 3] = cr;
      col[i * 3 + 1] = cg;
      col[i * 3 + 2] = cb;
      alp[i] = 0.0; // Start invisible
    }

    stateRef.current = { birthTimes, lifetimes, birthHues, velocities, birthPositions, baseSizes };
    return { positions: pos, sizes: siz, colors: col, alphas: alp };
  }, [particleCount, config]);

  // Animation loop
  useFrame(({ clock }) => {
    if (!materialRef.current || !geometryRef.current || !stateRef.current) return;

    const t = clock.elapsedTime;
    const state = stateRef.current;
    const posAttr = geometryRef.current.attributes.position as THREE.BufferAttribute;
    const sizeAttr = geometryRef.current.attributes.aSize as THREE.BufferAttribute;
    const colorAttr = geometryRef.current.attributes.aColor as THREE.BufferAttribute;
    const alphaAttr = geometryRef.current.attributes.aAlpha as THREE.BufferAttribute;

    // Get amplitude for this layer's frequency band
    const bandAmplitude = getAmplitudeForBand();
    const reactivity = config.audioReactivity;

    // Calculate breath/beat scale using layer-specific reactivity
    const breathValue = mode === "audio"
      ? 0.3 + bandAmplitude * reactivity * 0.7
      : computeBreathFactor(t, pattern);
    const beatMult = mode === "audio" ? (1.0 + bandAmplitude * reactivity * 0.8) : 1.0;

    // Size curve parameters from config
    const { sizeAtBirth, sizeAtPeak, sizeAtDeath, peakLifetime } = config;

    for (let i = 0; i < particleCount; i++) {
      const age = t - state.birthTimes[i];
      const lifetime = state.lifetimes[i];

      // Respawn if dead
      if (age > lifetime) {
        state.birthTimes[i] = t;
        state.birthHues[i] = globalHueRef.current;

        // New spawn position
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = config.spawnRadius + Math.random() * config.spawnRadius * 0.5;

        const dirX = Math.sin(phi) * Math.cos(theta);
        const dirY = Math.sin(phi) * Math.sin(theta);
        const dirZ = Math.cos(phi);

        state.birthPositions[i * 3] = dirX * r;
        state.birthPositions[i * 3 + 1] = dirY * r;
        state.birthPositions[i * 3 + 2] = dirZ * r;

        // New velocity
        const speed = Math.random() * config.maxSpeed;
        state.velocities[i * 3] = dirX * speed;
        state.velocities[i * 3 + 1] = dirY * speed;
        state.velocities[i * 3 + 2] = dirZ * speed;

        continue;
      }

      // Normalized age (0 = birth, 1 = death)
      const normAge = Math.max(0, age) / lifetime;

      // Position: birth + velocity * age
      const bx = state.birthPositions[i * 3];
      const by = state.birthPositions[i * 3 + 1];
      const bz = state.birthPositions[i * 3 + 2];
      const vx = state.velocities[i * 3];
      const vy = state.velocities[i * 3 + 1];
      const vz = state.velocities[i * 3 + 2];

      const scale = (0.5 + breathValue * 0.5) * beatMult;
      posAttr.setXYZ(
        i,
        (bx + vx * age) * scale,
        (by + vy * age) * scale,
        (bz + vz * age) * scale
      );

      // SIZE OVER LIFETIME using config values
      let sizeMult: number;
      if (normAge < peakLifetime) {
        // Birth to peak: grow from sizeAtBirth to sizeAtPeak
        sizeMult = sizeAtBirth + (sizeAtPeak - sizeAtBirth) * (normAge / peakLifetime);
      } else {
        // Peak to death: shrink from sizeAtPeak to sizeAtDeath
        sizeMult = sizeAtPeak - (sizeAtPeak - sizeAtDeath) * ((normAge - peakLifetime) / (1 - peakLifetime));
      }
      sizeAttr.setX(i, state.baseSizes[i] * sizeMult * (0.5 + breathValue * 0.5));

      // ALPHA: Fade in first 10%, full 10-70%, fade out last 30%
      let alpha: number;
      if (normAge < 0.1) {
        alpha = normAge / 0.1; // Fade in
      } else if (normAge < 0.7) {
        alpha = 1.0; // Full opacity
      } else {
        alpha = 1.0 - ((normAge - 0.7) / 0.3); // Fade out
      }
      alphaAttr.setX(i, alpha);

      // Color from birth hue
      const [cr, cg, cb] = getRainbowColor(state.birthHues[i]);
      colorAttr.setXYZ(i, cr, cg, cb);
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    materialRef.current.uniforms.uIntensity.value = intensity;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aAlpha" args={[alphas, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uIntensity: { value: intensity },
        }}
        vertexShader={`
          attribute float aSize;
          attribute vec3 aColor;
          attribute float aAlpha;

          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            vColor = aColor;
            vAlpha = aAlpha;

            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            float distanceScale = 100.0 / length(mvPosition.xyz);
            gl_PointSize = aSize * distanceScale;
          }
        `}
        fragmentShader={`
          uniform float uIntensity;

          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            vec2 center = gl_PointCoord - 0.5;
            float dist = length(center);

            // Ethereal soft glow - very smooth falloff for nebula effect
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            alpha = pow(alpha, 0.8); // Softer falloff for more glow

            // Bright core with soft bloom
            float core = exp(-dist * 4.0) * 0.8;
            float bloom = exp(-dist * 1.5) * 0.3;

            // Add subtle outer halo
            float halo = exp(-dist * 8.0) * 0.4;

            vec3 color = vColor * uIntensity * (1.0 + core + bloom);
            float finalAlpha = (alpha + halo) * vAlpha * 0.85;

            gl_FragColor = vec4(color, finalAlpha);
          }
        `}
      />
    </points>
  );
}

// Extended UnityOrb props with layers and frequency bands
type UnityOrbExtendedProps = UnityOrbProps & {
  layers?: ParticleLayerConfig[];
  bassAmplitude?: number;
  midsAmplitude?: number;
  trebleAmplitude?: number;
};

// Main UnityOrb - renders all particle layers
function UnityOrb({
  pattern,
  audioAmplitude,
  mode,
  intensity,
  layers = DEFAULT_UNITY_LAYERS,
  bassAmplitude = 0,
  midsAmplitude = 0,
  trebleAmplitude = 0,
}: UnityOrbExtendedProps) {
  // Shared global hue for rainbow cycling
  const globalHueRef = useRef(0);

  // Update global hue each frame
  useFrame(() => {
    globalHueRef.current = (globalHueRef.current + 0.003) % 1.0;
    if (mode === "audio" && audioAmplitude > 0.2) {
      globalHueRef.current = (globalHueRef.current + audioAmplitude * 0.015) % 1.0;
    }
  });

  // Filter to only enabled layers
  const enabledLayers = layers.filter(l => l.enabled);

  return (
    <group>
      {/* Render all enabled particle layers */}
      {enabledLayers.map((config) => (
        <UnityParticleLayer
          key={config.id}
          config={config}
          audioAmplitude={audioAmplitude}
          bassAmplitude={bassAmplitude}
          midsAmplitude={midsAmplitude}
          trebleAmplitude={trebleAmplitude}
          mode={mode}
          intensity={intensity}
          pattern={pattern}
          globalHueRef={globalHueRef}
        />
      ))}
    </group>
  );
}

// ============================================================================
// STAR NEST SKYBOX - By Pablo Román Andrioli (Shadertoy XlfGRj)
// Unity 5.x shader adaptation by Jonathan Cohen
// Ported to React Three Fiber / GLSL ES
// ============================================================================

// Star Nest preset type - based on Unity .mat files
export type StarNestPreset = {
  key: string;
  label: string;
  iterations: number;
  volsteps: number;
  formuparam: number;
  stepSize: number;
  tile: number;
  brightness: number;
  darkmatter: number;
  distfading: number;
  saturation: number;
  color: [number, number, number];
  center: [number, number, number, number];
  scroll: [number, number, number, number];
  rotation: [number, number, number, number];
  // HSV Version parameters (optional - from StarNestSkybox_HSV.shader)
  hueShift?: number;      // 0-1 range for hue rotation
  hueSpeed?: number;      // Speed of animated hue cycling (0 = static)
  postSaturation?: number; // -1 to 1 additional saturation adjustment
};

// Presets extracted from Unity .mat files
export const STAR_NEST_PRESETS: StarNestPreset[] = [
  // ==========================================
  // 1DARKWORLD1 - THE GLORIOUS ONE
  // Exact parameters from 1DarkWorld1.mat
  // This is the primary skybox the user wants!
  // ==========================================
  {
    key: "darkWorld1",
    label: "1DarkWorld1 (THE ONE)",
    iterations: 16, // _Iterations: 15.7 rounded
    volsteps: 15,
    formuparam: 420.2,
    stepSize: 312.2,
    tile: 796.96,
    brightness: 0.63,
    darkmatter: 40,
    distfading: 50,
    saturation: 62,
    color: [1, 1, 1],
    center: [0, 0.3, 0.5, 0],
    scroll: [0.1, 0.1, -0.3, 0], // Note: w=0 means no scroll animation
    rotation: [1, 10, 0, 0.5],
  },
  // STAR NEST FX - From StarNest.shader defaults (17 iterations, 20 volsteps!)
  {
    key: "starNestFX",
    label: "Star Nest FX (2D Surface)",
    iterations: 17,
    volsteps: 20,
    formuparam: 530,
    stepSize: 130,
    tile: 700,
    brightness: 2.0,
    darkmatter: 25,
    distfading: 68,
    saturation: 85,
    color: [1, 1, 1],
    center: [1, 0.3, 0.5, 0],
    scroll: [3, 1, 0.6, 0.01],
    rotation: [35, 25, 75, 0.1],
  },
  // HIGH QUALITY - 20 iterations, 18 volsteps from HighQuality.mat
  {
    key: "highQuality",
    label: "High Quality",
    iterations: 20,
    volsteps: 18,
    formuparam: 420,
    stepSize: 300,
    tile: 850,
    brightness: 0.5,
    darkmatter: 40,
    distfading: 50,
    saturation: 62,
    color: [1, 1, 1],
    center: [1, 0.3, 0.5, 0],
    scroll: [1.3, 1, 0.6, 0.01],
    rotation: [0, 0, 0, 0.01],
  },
  // Crazy Fractal - Wild and intense
  {
    key: "crazyFractal",
    label: "Crazy Fractal",
    iterations: 15,
    volsteps: 8,
    formuparam: 998,
    stepSize: 498.1,
    tile: 1046,
    brightness: 2.4,
    darkmatter: 349,
    distfading: 173.3,
    saturation: 58.29,
    color: [0.588, 0.069, 0.069],
    center: [1, 0.3, 0.5, 0],
    scroll: [1.3, 1, 0.6, 0.01],
    rotation: [0, 0, 0, 0.01],
  },
  // Normal - The standard Star Nest look (exactly as per original defaults)
  {
    key: "normal",
    label: "Normal (Original)",
    iterations: 15,
    volsteps: 8,
    formuparam: 420,
    stepSize: 355,
    tile: 700,
    brightness: 0.5,
    darkmatter: 555,
    distfading: 55,
    saturation: 77,
    color: [1, 1, 1],
    center: [1, 0.3, 0.5, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
  },
  {
    key: "darkWorld",
    label: "Dark World",
    iterations: 15,
    volsteps: 15,
    formuparam: 420.2,
    stepSize: 312.2,
    tile: 796.96,
    brightness: 0.63,
    darkmatter: 40,
    distfading: 50,
    saturation: 62,
    color: [1, 1, 1],
    center: [0, 0.3, 0.5, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [1, 10, 0, 0.5],
  },
  {
    key: "purple",
    label: "Purple Nebula",
    iterations: 15,
    volsteps: 8,
    formuparam: 483,
    stepSize: 278.6,
    tile: 897.1,
    brightness: 0.5,
    darkmatter: 738.21,
    distfading: 100.3,
    saturation: 88.1,
    color: [0.757, 0.267, 0.602],
    center: [1, 0.3, 0.5, 8.09],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
  },
  {
    key: "hotSuns",
    label: "Hot Suns",
    iterations: 15,
    volsteps: 8,
    formuparam: 591,
    stepSize: 380.2,
    tile: 1605,
    brightness: 0.5,
    darkmatter: 120,
    distfading: 80,
    saturation: 77,
    color: [1, 1, 1],
    center: [1, 0.63, 0.8, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
  },
  {
    key: "galaxies",
    label: "Galaxies",
    iterations: 15,
    volsteps: 8,
    formuparam: 550.1,
    stepSize: 420,
    tile: 553,
    brightness: 1.5,
    darkmatter: 300,
    distfading: 50,
    saturation: 77,
    color: [1, 1, 1],
    center: [1, 0.63, 0.8, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
  },
  // ==========================================
  // MORE MATERIALS FROM HOLDING FOLDER
  // ==========================================
  {
    key: "green1",
    label: "Green Nebula 1",
    iterations: 15,
    volsteps: 8,
    formuparam: 465.2,
    stepSize: 254.6,
    tile: 1194.6,
    brightness: 0.1,
    darkmatter: 181.8,
    distfading: 147.1,
    saturation: 135.8,
    color: [0.308, 0.809, 0.149], // Green tint
    center: [1, 0.63, 0.8, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
  },
  {
    key: "green2",
    label: "Green Nebula 2",
    iterations: 15,
    volsteps: 8,
    formuparam: 603.81,
    stepSize: 583,
    tile: 1253,
    brightness: 23.14,
    darkmatter: 0,
    distfading: 18.7,
    saturation: 27.58,
    color: [0.15, 0.478, 0.046], // Deeper green
    center: [1, 0.63, 0.8, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
  },
  {
    key: "darkWorld2",
    label: "Dark World 2",
    iterations: 15,
    volsteps: 8,
    formuparam: 484.4,
    stepSize: 335,
    tile: 565.85,
    brightness: -3.9, // Negative brightness!
    darkmatter: 179.6,
    distfading: -70, // Negative fade
    saturation: 55.9,
    color: [0.256, 0.175, 0.581], // Purple tint
    center: [-0.1, 0.1, -0.3, -3000],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 3, 0, 0.01],
  },
  {
    key: "darkWorld3",
    label: "Dark World 3",
    iterations: 15,
    volsteps: 8,
    formuparam: 543.6,
    stepSize: 407.6,
    tile: 609.4,
    brightness: -20.5, // Very negative
    darkmatter: 535.88,
    distfading: -37.9,
    saturation: 55.9,
    color: [0.256, 0.175, 0.581], // Purple tint
    center: [-0.1, 0.1, -0.3, -3000],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 3, 0, 0.01],
  },
  {
    key: "yellow",
    label: "Yellow Nebula",
    iterations: 15,
    volsteps: 8,
    formuparam: 439.7,
    stepSize: 532.8,
    tile: 734.1,
    brightness: -9.3, // Negative
    darkmatter: 300,
    distfading: 29.7,
    saturation: 48.4,
    color: [0.545, 0.676, 0.174], // Yellow-green
    center: [1, 0.63, 0.8, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
  },
  {
    key: "rotating",
    label: "Rotating (Same as DarkWorld1)",
    iterations: 16,
    volsteps: 15,
    formuparam: 420.2,
    stepSize: 312.2,
    tile: 796.96,
    brightness: 0.63,
    darkmatter: 40,
    distfading: 50,
    saturation: 62,
    color: [1, 1, 1],
    center: [0, 0.3, 0.5, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [1, 10, 0, 0.5], // Has rotation!
  },
  // ========================================
  // HSV VERSION PRESETS - With hue cycling
  // From StarNestSkybox_HSV.shader ("Skybox/StarNestHue")
  // ========================================
  {
    key: "hsvRainbow",
    label: "HSV Rainbow Cycle",
    iterations: 17,
    volsteps: 15,
    formuparam: 530,
    stepSize: 200,
    tile: 700,
    brightness: 1.5,
    darkmatter: 40,
    distfading: 60,
    saturation: 90,
    color: [1, 1, 1],
    center: [1, 0.3, 0.5, 0],
    scroll: [1.3, 1, 0.6, 0.01],
    rotation: [10, 5, 15, 0.05],
    hueShift: 0,
    hueSpeed: 0.1, // Slow rainbow cycling
    postSaturation: 0.3,
  },
  {
    key: "hsvNormal",
    label: "HSV Normal (Animated Hue)",
    iterations: 15,
    volsteps: 8,
    formuparam: 420,
    stepSize: 355,
    tile: 700,
    brightness: 0.5,
    darkmatter: 555,
    distfading: 55,
    saturation: 77,
    color: [1, 1, 1],
    center: [1, 0.3, 0.5, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [0, 0, 0, 0.01],
    hueShift: 0,
    hueSpeed: 0.05, // Subtle hue cycling
    postSaturation: 0,
  },
  {
    key: "hsvGreen",
    label: "HSV Green Nebula",
    iterations: 17,
    volsteps: 14,
    formuparam: 498,
    stepSize: 280,
    tile: 800,
    brightness: 1.2,
    darkmatter: 50,
    distfading: 60,
    saturation: 85,
    color: [0.3, 1, 0.5],
    center: [1, 0.3, 0.5, 0],
    scroll: [1, 0.8, 0.4, 0.01],
    rotation: [5, 10, 0, 0.03],
    hueShift: 0.33, // Start at green
    hueSpeed: 0.02, // Very slow shift
    postSaturation: 0.2,
  },
  {
    key: "hsvDarkWorld",
    label: "HSV Dark World",
    iterations: 15,
    volsteps: 15,
    formuparam: 420.2,
    stepSize: 312.2,
    tile: 796.96,
    brightness: 0.63,
    darkmatter: 40,
    distfading: 50,
    saturation: 62,
    color: [1, 1, 1],
    center: [0, 0.3, 0.5, 0],
    scroll: [0.1, 0.1, -0.3, 0],
    rotation: [1, 10, 0, 0.5],
    hueShift: 0.7, // Start at purple/blue
    hueSpeed: 0.08,
    postSaturation: 0.4,
  },
  {
    key: "hsvCrazyFractal",
    label: "HSV Crazy Fractal",
    iterations: 15,
    volsteps: 8,
    formuparam: 998,
    stepSize: 498.1,
    tile: 1046,
    brightness: 2.4,
    darkmatter: 349,
    distfading: 173.3,
    saturation: 58.29,
    color: [1, 1, 1], // White base, hue will color it
    center: [1, 0.3, 0.5, 0],
    scroll: [1.3, 1, 0.6, 0.01],
    rotation: [0, 0, 0, 0.01],
    hueShift: 0,
    hueSpeed: 0.15, // Fast psychedelic cycling
    postSaturation: 0.5,
  },
];

type StarNestSkyboxProps = {
  preset?: StarNestPreset;
  audioAmplitude?: number;
  audioReactive?: boolean;
};

function StarNestSkybox({
  preset = STAR_NEST_PRESETS[0],
  audioAmplitude = 0,
  audioReactive = false,
}: StarNestSkyboxProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Use refs to avoid stale closure issues
  const presetRef = useRef(preset);
  const audioAmplitudeRef = useRef(audioAmplitude);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    audioAmplitudeRef.current = audioAmplitude;
  }, [audioAmplitude]);

  // Check if this is an HSV preset
  const isHSV = preset.hueSpeed !== undefined && preset.hueSpeed > 0;

  // CRITICAL: Memoize uniforms so they're only created once
  // This prevents React from recreating the uniforms object on re-render
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIterations: { value: preset.iterations },
    uVolsteps: { value: preset.volsteps },
    uFormuparam: { value: preset.formuparam },
    uStepSize: { value: preset.stepSize },
    uTile: { value: preset.tile },
    uBrightness: { value: preset.brightness },
    uDarkmatter: { value: preset.darkmatter },
    uDistfading: { value: preset.distfading },
    uSaturation: { value: preset.saturation },
    uColor: { value: new THREE.Vector3(...preset.color) },
    uCenter: { value: new THREE.Vector4(...preset.center) },
    uScroll: { value: new THREE.Vector4(...preset.scroll) },
    uRotation: { value: new THREE.Vector4(...preset.rotation) },
    uHueShift: { value: preset.hueShift ?? 0 },
    uHueSpeed: { value: preset.hueSpeed ?? 0 },
    uPostSaturation: { value: preset.postSaturation ?? 0 },
  }), []); // Empty deps - only create once, useFrame will update values

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const currentPreset = presetRef.current;
    const currentAudio = audioAmplitudeRef.current;

    // Update time
    materialRef.current.uniforms.uTime.value = clock.elapsedTime;

    // CRITICAL FIX: Update ALL preset uniforms every frame
    // This ensures preset switching actually changes the shader
    materialRef.current.uniforms.uIterations.value = currentPreset.iterations;
    materialRef.current.uniforms.uVolsteps.value = currentPreset.volsteps;
    materialRef.current.uniforms.uFormuparam.value = currentPreset.formuparam;
    materialRef.current.uniforms.uStepSize.value = currentPreset.stepSize;
    materialRef.current.uniforms.uTile.value = currentPreset.tile;
    materialRef.current.uniforms.uDarkmatter.value = currentPreset.darkmatter;
    materialRef.current.uniforms.uDistfading.value = currentPreset.distfading;
    materialRef.current.uniforms.uColor.value.set(...currentPreset.color);
    materialRef.current.uniforms.uCenter.value.set(...currentPreset.center);
    materialRef.current.uniforms.uScroll.value.set(...currentPreset.scroll);
    materialRef.current.uniforms.uRotation.value.set(...currentPreset.rotation);
    materialRef.current.uniforms.uHueShift.value = currentPreset.hueShift ?? 0;
    materialRef.current.uniforms.uPostSaturation.value = currentPreset.postSaturation ?? 0;

    // Brightness, saturation, and hue speed - with audio reactivity if enabled
    if (audioReactive && currentAudio > 0) {
      materialRef.current.uniforms.uBrightness.value =
        currentPreset.brightness + currentAudio * 0.5;
      materialRef.current.uniforms.uSaturation.value =
        currentPreset.saturation + currentAudio * 20;
      materialRef.current.uniforms.uHueSpeed.value =
        (currentPreset.hueSpeed ?? 0) + currentAudio * 0.1;
    } else {
      // Non-audio mode: use preset values directly
      materialRef.current.uniforms.uBrightness.value = currentPreset.brightness;
      materialRef.current.uniforms.uSaturation.value = currentPreset.saturation;
      materialRef.current.uniforms.uHueSpeed.value = currentPreset.hueSpeed ?? 0;
    }
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vRayDir;

          void main() {
            vRayDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          // Star Nest by Pablo Román Andrioli
          // Ported from Shadertoy: https://www.shadertoy.com/view/XlfGRj
          // HSV version ported from StarNestSkybox_HSV.shader

          uniform float uTime;
          uniform float uIterations;
          uniform float uVolsteps;
          uniform float uFormuparam;
          uniform float uStepSize;
          uniform float uTile;
          uniform float uBrightness;
          uniform float uDarkmatter;
          uniform float uDistfading;
          uniform float uSaturation;
          uniform vec3 uColor;
          uniform vec4 uCenter;
          uniform vec4 uScroll;
          uniform vec4 uRotation;
          // HSV parameters
          uniform float uHueShift;
          uniform float uHueSpeed;
          uniform float uPostSaturation;

          varying vec3 vRayDir;

          // ==========================================
          // HSV Conversion Functions (from hsv.cginc)
          // ==========================================
          vec3 toHSV(vec3 rgb) {
            float maxC = max(rgb.r, max(rgb.g, rgb.b));
            float minC = min(rgb.r, min(rgb.g, rgb.b));
            float delta = maxC - minC;

            vec3 hsv;
            hsv.z = maxC; // Value

            if (delta < 0.00001) {
              hsv.x = 0.0;
              hsv.y = 0.0;
              return hsv;
            }

            hsv.y = delta / maxC; // Saturation

            // Hue calculation
            if (rgb.r >= maxC) {
              hsv.x = (rgb.g - rgb.b) / delta;
            } else if (rgb.g >= maxC) {
              hsv.x = 2.0 + (rgb.b - rgb.r) / delta;
            } else {
              hsv.x = 4.0 + (rgb.r - rgb.g) / delta;
            }

            hsv.x /= 6.0;
            if (hsv.x < 0.0) hsv.x += 1.0;

            return hsv;
          }

          vec3 toRGB(vec3 hsv) {
            if (hsv.y <= 0.0) {
              return vec3(hsv.z);
            }

            float h = hsv.x * 6.0;
            float c = hsv.z * hsv.y;
            float x = c * (1.0 - abs(mod(h, 2.0) - 1.0));
            float m = hsv.z - c;

            vec3 rgb;
            if (h < 1.0) rgb = vec3(c, x, 0.0);
            else if (h < 2.0) rgb = vec3(x, c, 0.0);
            else if (h < 3.0) rgb = vec3(0.0, c, x);
            else if (h < 4.0) rgb = vec3(0.0, x, c);
            else if (h < 5.0) rgb = vec3(x, 0.0, c);
            else rgb = vec3(c, 0.0, x);

            return rgb + m;
          }

          void main() {
            vec3 dir = normalize(vRayDir);
            float time = uCenter.w + uTime * 0.05;

            // Scale parameters (Unity shader scales these)
            float brightness = uBrightness / 1000.0;
            float stepSize = uStepSize / 1000.0;
            vec3 tile = abs(vec3(uTile)) / 1000.0;
            float formparam = uFormuparam / 1000.0;
            float darkmatter = uDarkmatter / 100.0;
            float distFade = uDistfading / 100.0;

            vec3 from = uCenter.xyz;

            // Scroll over time
            from += uScroll.xyz * uScroll.w * time;

            // Apply rotation if enabled
            vec3 rot = uRotation.xyz * uRotation.w * time * 0.1;
            if (length(rot) > 0.0) {
              float cx = cos(rot.x), sx = sin(rot.x);
              float cy = cos(rot.y), sy = sin(rot.y);
              float cz = cos(rot.z), sz = sin(rot.z);

              // Z rotation
              mat2 rz = mat2(cz, sz, -sz, cz);
              dir.xy = rz * dir.xy;
              from.xy = rz * from.xy;

              // Y rotation
              mat2 ry = mat2(cy, sy, -sy, cy);
              dir.xz = ry * dir.xz;
              from.xz = ry * from.xz;

              // X rotation
              mat2 rx = mat2(cx, sx, -sx, cx);
              dir.yz = rx * dir.yz;
              from.yz = rx * from.yz;
            }

            // Volumetric rendering
            float s = 0.1;
            float fade = 1.0;
            vec3 v = vec3(0.0);

            int volsteps = int(uVolsteps);
            int iterations = int(uIterations);

            for (int r = 0; r < 20; r++) {
              if (r >= volsteps) break;

              vec3 p = abs(from + s * dir * 0.5);
              p = abs(tile - mod(p, tile * 2.0));

              float pa = 0.0;
              float a = 0.0;

              for (int i = 0; i < 30; i++) {
                if (i >= iterations) break;
                p = abs(p) / dot(p, p) - formparam;
                a += abs(length(p) - pa);
                pa = length(p);
              }

              // Dark matter
              float dm = max(0.0, darkmatter - a * a * 0.001);
              if (r > 6) {
                fade *= 1.0 - dm;
              }

              a *= a * a; // Add contrast

              v += fade;

              // Coloring based on distance
              v += vec3(s, s*s, s*s*s*s) * a * brightness * fade;

              // Distance fading
              fade *= distFade;
              s += stepSize;
            }

            float len = length(v);
            // Saturation
            v = mix(vec3(len), v, uSaturation / 100.0);
            v *= uColor * 0.01;

            // ==========================================
            // HSV Post-Processing (from StarNestSkybox_HSV)
            // ==========================================
            if (uHueSpeed > 0.0 || uHueShift != 0.0) {
              // Convert to HSV
              vec3 hsv = toHSV(v);

              // Apply animated hue shift
              float animatedHue = uHueShift + uTime * uHueSpeed;
              hsv.x = fract(hsv.x + animatedHue);

              // Apply post-saturation adjustment
              hsv.y = clamp(hsv.y + uPostSaturation, 0.0, 1.0);

              // Convert back to RGB
              v = toRGB(hsv);
            }

            gl_FragColor = vec4(v, 1.0);
          }
        `}
      />
    </mesh>
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
  // Star Nest Skybox props
  skyboxEnabled?: boolean;
  skyboxPreset?: StarNestPreset;
  skyboxPresetKey?: string;
  waterEnabled?: boolean;
  waterColor?: string;
  waterReflectivity?: number;
  videoUrl?: string;
  // Audio-reactive rainbow mode props
  beatScale?: number;      // Current scale from beat detector (0.9 rest -> 1.8 beat)
  globalHue?: number;      // Global hue for rainbow effect (0-1)
  useRainbowMode?: boolean; // Enable rainbow particle coloring
  // Orb type selection
  orbType?: OrbType;       // Which orb to render (rainbow or unity)
  // Unity Orb layer customization
  unityLayers?: ParticleLayerConfig[];
  // Frequency band amplitudes for per-layer reactivity
  bassAmplitude?: number;
  midsAmplitude?: number;
  trebleAmplitude?: number;
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
  skyboxEnabled = true,
  skyboxPreset,
  skyboxPresetKey = "galaxies",
  waterEnabled = false,
  waterColor = "#0a1828",
  waterReflectivity = 0.4,
  videoUrl,
  // Audio-reactive rainbow mode
  beatScale = 1.0,
  globalHue = 0,
  useRainbowMode = false,
  // Orb type selection
  orbType = "rainbow",
  // Unity Orb layers
  unityLayers,
  // Frequency band amplitudes
  bassAmplitude = 0,
  midsAmplitude = 0,
  trebleAmplitude = 0,
}: BreathingOrbCanvasProps) {
  const pattern = BREATH_PATTERNS[patternKey] ?? BREATH_PATTERNS["4-7-8"];
  const colorAObj = useMemo(() => new THREE.Color(colorA), [colorA]);
  const colorBObj = useMemo(() => new THREE.Color(colorB), [colorB]);

  // Get preset by key or use provided preset
  const activePreset = useMemo(() => {
    if (skyboxPreset) return skyboxPreset;
    return STAR_NEST_PRESETS.find(p => p.key === skyboxPresetKey) || STAR_NEST_PRESETS[0]; // highQuality default
  }, [skyboxPreset, skyboxPresetKey]);

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden"
      style={{ background: skyboxEnabled ? "#000" : background.css }}
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
        camera={{ position: [0, 0.5, 3], fov: 60 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Star Nest Skybox - rendered first as background */}
        {skyboxEnabled && (
          <StarNestSkybox
            preset={activePreset}
            audioAmplitude={audioAmplitude}
            audioReactive={mode === "audio"}
          />
        )}

        <ambientLight intensity={0.1} />

        <group position={[0, 0.2, 0]}>
          {/* Conditionally render orb based on orbType */}
          {orbType === "unity" ? (
            <UnityOrb
              pattern={pattern}
              particleCount={particleCount}
              colorA={colorAObj}
              colorB={colorBObj}
              audioAmplitude={audioAmplitude}
              mode={mode}
              intensity={intensity}
              turbulence={turbulence}
              beatScale={beatScale}
              globalHue={globalHue}
              useRainbowMode={useRainbowMode}
              layers={unityLayers}
              bassAmplitude={bassAmplitude}
              midsAmplitude={midsAmplitude}
              trebleAmplitude={trebleAmplitude}
            />
          ) : (
            <NebulaOrb
              pattern={pattern}
              particleCount={particleCount}
              colorA={colorAObj}
              colorB={colorBObj}
              audioAmplitude={audioAmplitude}
              mode={mode}
              intensity={intensity}
              turbulence={turbulence}
              beatScale={beatScale}
              globalHue={globalHue}
              useRainbowMode={useRainbowMode}
            />
          )}
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
