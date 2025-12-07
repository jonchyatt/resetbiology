"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Stars, MeshReflectorMaterial } from "@react-three/drei";

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
    css: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.12) 0, transparent 18%)," +
      "radial-gradient(circle at 80% 40%, rgba(255,255,255,0.08) 0, transparent 14%)," +
      "radial-gradient(circle at 50% 70%, rgba(255,255,255,0.1) 0, transparent 22%)," +
      "radial-gradient(ellipse at center, #030816 0%, #04030d 55%, #02020a 100%)",
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
  { key: "warm", label: "Warm Glow", colorA: "#fff5cc", colorB: "#ff6b1f", description: "Original warm orange" },
  { key: "ethereal", label: "Ethereal Blue", colorA: "#e0f7ff", colorB: "#00bfff", description: "Calm cyan tones" },
  { key: "cosmic", label: "Cosmic Purple", colorA: "#f0e0ff", colorB: "#9b30ff", description: "Deep space violet" },
  { key: "nature", label: "Nature Green", colorA: "#e8ffe8", colorB: "#32cd32", description: "Organic earth tones" },
  { key: "fire", label: "Fire Spirit", colorA: "#ffff99", colorB: "#ff4500", description: "Intense red-orange" },
  { key: "aurora", label: "Aurora Mix", colorA: "#80ffdb", colorB: "#7b2cbf", description: "Green to purple shift" },
  { key: "sunset", label: "Desert Sunset", colorA: "#ffd89b", colorB: "#ff6f61", description: "Warm coral tones" },
  { key: "moonlight", label: "Moonlight", colorA: "#ffffff", colorB: "#b0c4de", description: "Soft silver glow" },
];

// ============================================================================
// AUDIO ANALYSIS (Web Audio API)
// ============================================================================

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private audioElement: HTMLAudioElement | null = null;

  public isPlaying = false;
  public currentAmplitude = 0;
  public isBeat = false;

  private lastAmplitude = 0;
  private beatThreshold = 0.3;
  private beatCooldown = 0;
  private readonly beatCooldownTime = 100; // ms

  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.4;

    this.source = this.audioContext.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.audioElement = audioElement;
  }

  update(): void {
    if (!this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate RMS amplitude from frequency data
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length) / 255;

    // Smooth the amplitude
    this.currentAmplitude = this.currentAmplitude * 0.7 + rms * 0.3;

    // Beat detection
    const now = performance.now();
    if (now > this.beatCooldown) {
      if (this.currentAmplitude > this.beatThreshold &&
          this.currentAmplitude > this.lastAmplitude * 1.2) {
        this.isBeat = true;
        this.beatCooldown = now + this.beatCooldownTime;
      } else {
        this.isBeat = false;
      }
    } else {
      this.isBeat = false;
    }

    this.lastAmplitude = this.currentAmplitude;
  }

  setBeatThreshold(threshold: number): void {
    this.beatThreshold = threshold;
  }

  dispose(): void {
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
  }
}

// ============================================================================
// BREATH TIMING CALCULATOR
// ============================================================================

function computeBreathFactor(time: number, pattern: BreathPattern): number {
  const total = pattern.inhale + pattern.hold + pattern.exhale + pattern.hold2;
  if (total === 0) return 0.5;
  const t = ((time % total) + total) % total;
  const ease = (x: number) => x * x * (3 - 2 * x); // smoothstep

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
  return 0.25;
}

// ============================================================================
// PARTICLE ORB COMPONENT
// ============================================================================

type OrbProps = {
  pattern: BreathPattern;
  particleCount?: number;
  pointSize?: number;
  colorAHex: string;
  colorBHex: string;
  audioAmplitude?: number;
  mode: "breath" | "audio";
  glowIntensity?: number;
  particleSpread?: number;
};

function OrbPoints({
  pattern,
  particleCount = 16000,
  pointSize = 6,
  colorAHex,
  colorBHex,
  audioAmplitude = 0,
  mode,
  glowIntensity = 1.0,
  particleSpread = 0.6,
}: OrbProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const colorA = useMemo(() => new THREE.Color(colorAHex), [colorAHex]);
  const colorB = useMemo(() => new THREE.Color(colorBHex), [colorBHex]);

  const { positions, alphas, velocities } = useMemo(() => {
    const posArr = new Float32Array(particleCount * 3);
    const alphaArr = new Float32Array(particleCount);
    const velArr = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Volumetric sphere distribution
      const r = Math.cbrt(Math.random()) * particleSpread;
      const u = Math.random() * 2 * Math.PI;
      const v = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - v * v);

      posArr[i * 3 + 0] = r * s * Math.cos(u);
      posArr[i * 3 + 1] = r * s * Math.sin(u);
      posArr[i * 3 + 2] = r * v;

      alphaArr[i] = 0.5 + Math.random() * 0.5;

      // Random velocity for particle drift
      velArr[i * 3 + 0] = (Math.random() - 0.5) * 0.02;
      velArr[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velArr[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    return { positions: posArr, alphas: alphaArr, velocities: velArr };
  }, [particleCount, particleSpread]);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;

    const t = clock.elapsedTime;
    let intensity: number;

    if (mode === "audio") {
      // Audio-reactive mode: use amplitude
      intensity = 0.3 + audioAmplitude * 0.7;
    } else {
      // Breath mode: use breath pattern
      intensity = computeBreathFactor(t, pattern);
    }

    mat.uniforms.uBreath.value = intensity;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uGlowIntensity.value = glowIntensity;
  });

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uColorA.value = colorA;
    materialRef.current.uniforms.uColorB.value = colorB;
  }, [colorA, colorB]);

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-alpha" args={[alphas, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uBreath: { value: 0 },
          uColorA: { value: colorA },
          uColorB: { value: colorB },
          uPointSize: { value: pointSize },
          uGlowIntensity: { value: glowIntensity },
        }}
        vertexShader={`
          uniform float uBreath;
          uniform float uPointSize;
          uniform float uTime;
          attribute float alpha;
          varying float vAlpha;
          varying float vDistance;

          void main() {
            // Breathing scale with slight noise
            float noise = sin(position.x * 10.0 + uTime) * 0.05;
            float scale = mix(0.5, 1.6, uBreath) + noise;
            vec3 p = position * scale;

            // Slight orbital drift
            float angle = uTime * 0.1 + length(position) * 2.0;
            p.x += sin(angle) * 0.02 * uBreath;
            p.z += cos(angle) * 0.02 * uBreath;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;

            float dist = length(mv.xyz);
            vDistance = dist;
            gl_PointSize = uPointSize * mix(0.4, 2.0, uBreath) * (1.0 / max(0.15, dist));
            vAlpha = alpha * mix(0.5, 1.2, uBreath);
          }
        `}
        fragmentShader={`
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uGlowIntensity;
          uniform float uBreath;
          varying float vAlpha;
          varying float vDistance;

          void main() {
            float d = length(gl_PointCoord - 0.5);

            // Soft glow falloff
            float feather = smoothstep(0.5, 0.0, d);
            float glow = exp(-d * 3.0) * uGlowIntensity;

            // Color gradient from center
            vec3 color = mix(uColorA, uColorB, d * 1.5);

            // Add extra brightness at core during high intensity
            color += uColorA * glow * uBreath * 0.5;

            float finalAlpha = vAlpha * (feather + glow * 0.5);
            gl_FragColor = vec4(color, finalAlpha);
          }
        `}
      />
    </points>
  );
}

// ============================================================================
// WATER REFLECTION PLANE
// ============================================================================

function WaterPlane({ enabled = true, reflectivity = 0.6 }: { enabled?: boolean; reflectivity?: number }) {
  if (!enabled) return null;

  return (
    <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={512}
        mixBlur={1.5}
        mixStrength={reflectivity}
        roughness={0.3}
        depthScale={0.8}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#0a1520"
        metalness={0.4}
        mirror={0}
      />
    </mesh>
  );
}

// ============================================================================
// MAIN CANVAS COMPONENT
// ============================================================================

export type BreathingOrbCanvasProps = {
  // Mode
  mode: "breath" | "audio";

  // Breath settings
  patternKey: string;

  // Audio settings
  audioAmplitude?: number;

  // Visual settings
  background: BackgroundOption;
  particleCount?: number;
  colorA?: string;
  colorB?: string;
  pointSize?: number;
  glowIntensity?: number;
  particleSpread?: number;

  // Stars
  starEnabled?: boolean;
  starCount?: number;
  starSpeed?: number;
  starFactor?: number;

  // Water
  waterEnabled?: boolean;
  waterReflectivity?: number;

  // Background video/image
  videoUrl?: string;

  // Camera
  cameraPosition?: [number, number, number];
  fov?: number;
};

export function BreathingOrbCanvas({
  mode = "breath",
  patternKey,
  audioAmplitude = 0,
  background,
  particleCount = 16000,
  colorA = "#fff5cc",
  colorB = "#ff6b1f",
  pointSize = 6,
  glowIntensity = 1.0,
  particleSpread = 0.6,
  starEnabled = true,
  starCount = 5000,
  starSpeed = 0.2,
  starFactor = 2.0,
  waterEnabled = true,
  waterReflectivity = 0.6,
  videoUrl,
  cameraPosition = [0, 0.5, 3.5],
  fov = 55,
}: BreathingOrbCanvasProps) {
  const pattern = BREATH_PATTERNS[patternKey] ?? BREATH_PATTERNS["4-7-8"];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl"
      style={{ minHeight: 520, background: background.css }}
    >
      {videoUrl && (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      <Canvas
        camera={{ position: cameraPosition, fov }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "relative", zIndex: 1 }}
      >
        {starEnabled && (
          <Stars
            radius={80}
            depth={40}
            count={starCount}
            factor={starFactor}
            saturation={0}
            fade
            speed={starSpeed}
          />
        )}

        <ambientLight intensity={0.15} />
        <pointLight position={[2, 2, 2]} intensity={0.3} color="#ffffff" />
        <pointLight position={[-2, -1, 2]} intensity={0.15} color={colorB} />

        <group position={[0, 0.3, 0]}>
          <OrbPoints
            pattern={pattern}
            particleCount={particleCount}
            pointSize={pointSize}
            colorAHex={colorA}
            colorBHex={colorB}
            audioAmplitude={audioAmplitude}
            mode={mode}
            glowIntensity={glowIntensity}
            particleSpread={particleSpread}
          />
        </group>

        <WaterPlane enabled={waterEnabled} reflectivity={waterReflectivity} />

        <OrbitControls
          enablePan={false}
          minDistance={2}
          maxDistance={10}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
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
        setProgress((elapsed - pattern.inhale) / pattern.hold);
      } else if (elapsed < pattern.inhale + pattern.hold + pattern.exhale) {
        setPhase("exhale");
        setProgress((elapsed - pattern.inhale - pattern.hold) / pattern.exhale);
      } else {
        setPhase("hold2");
        setProgress((elapsed - pattern.inhale - pattern.hold - pattern.exhale) / pattern.hold2);
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
            style={{ width: `${Math.min(amplitude * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
