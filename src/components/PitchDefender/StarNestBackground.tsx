'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─── GLSL Fragment Shader (inlined to avoid webpack loader) ──────────────────
const FRAG_SHADER = /* glsl */ `
#define MAX_ITERATIONS 20
#define MAX_VOLSTEPS 20

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
uniform float uHueShift;
uniform float uHueSpeed;
uniform float uPostSaturation;

varying vec3 vRayDir;

vec3 toHSV(vec3 rgb) {
  float maxC = max(rgb.r, max(rgb.g, rgb.b));
  float minC = min(rgb.r, min(rgb.g, rgb.b));
  float delta = maxC - minC;
  vec3 hsv;
  hsv.z = maxC;
  if (delta < 0.00001) { hsv.x = 0.0; hsv.y = 0.0; return hsv; }
  hsv.y = delta / maxC;
  if (rgb.r >= maxC) hsv.x = (rgb.g - rgb.b) / delta;
  else if (rgb.g >= maxC) hsv.x = 2.0 + (rgb.b - rgb.r) / delta;
  else hsv.x = 4.0 + (rgb.r - rgb.g) / delta;
  hsv.x /= 6.0;
  if (hsv.x < 0.0) hsv.x += 1.0;
  return hsv;
}

vec3 toRGB(vec3 hsv) {
  if (hsv.y <= 0.0) return vec3(hsv.z);
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
  float brightness = uBrightness / 1000.0;
  float stepSize = uStepSize / 1000.0;
  vec3 tile = abs(vec3(uTile)) / 1000.0;
  float formparam = uFormuparam / 1000.0;
  float darkmatter = uDarkmatter / 100.0;
  float distFade = uDistfading / 100.0;
  vec3 from = uCenter.xyz;
  from += uScroll.xyz * uScroll.w * time;

  vec3 rot = uRotation.xyz * uRotation.w * time * 0.1;
  if (length(rot) > 0.0) {
    float cx = cos(rot.x), sx = sin(rot.x);
    float cy = cos(rot.y), sy = sin(rot.y);
    float cz = cos(rot.z), sz = sin(rot.z);
    mat2 rz = mat2(cz, sz, -sz, cz);
    dir.xy = rz * dir.xy; from.xy = rz * from.xy;
    mat2 ry = mat2(cy, sy, -sy, cy);
    dir.xz = ry * dir.xz; from.xz = ry * from.xz;
    mat2 rx = mat2(cx, sx, -sx, cx);
    dir.yz = rx * dir.yz; from.yz = rx * from.yz;
  }

  float s = 0.1;
  float fade = 1.0;
  vec3 v = vec3(0.0);
  int volsteps = int(uVolsteps);
  int iterations = int(uIterations);

  for (int r = 0; r < MAX_VOLSTEPS; r++) {
    if (r >= volsteps) break;
    vec3 p = abs(from + s * dir * 0.5);
    p = abs(tile - mod(p, tile * 2.0));
    float pa = 0.0;
    float a = 0.0;
    for (int i = 0; i < MAX_ITERATIONS; i++) {
      if (i >= iterations) break;
      p = abs(p) / dot(p, p) - formparam;
      a += abs(length(p) - pa);
      pa = length(p);
    }
    float dm = max(0.0, darkmatter - a * a * 0.001);
    if (r > 6) fade *= 1.0 - dm;
    a *= a * a;
    v += fade;
    v += vec3(s, s*s, s*s*s*s) * a * brightness * fade;
    fade *= distFade;
    s += stepSize;
  }

  float len = length(v);
  v = mix(vec3(len), v, uSaturation / 100.0);
  v *= uColor * 0.01;

  if (uHueSpeed > 0.0 || uHueShift != 0.0) {
    vec3 hsv = toHSV(v);
    hsv.x = fract(hsv.x + uHueShift + uTime * uHueSpeed);
    hsv.y = clamp(hsv.y + uPostSaturation, 0.0, 1.0);
    v = toRGB(hsv);
  }

  gl_FragColor = vec4(v, 1.0);
}
`

const VERT_SHADER = /* glsl */ `
varying vec3 vRayDir;
void main() {
  vRayDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// ─── Presets ─────────────────────────────────────────────────────────────────

export interface StarNestPreset {
  key: string
  iterations: number; volsteps: number; formuparam: number
  stepSize: number; tile: number; brightness: number
  darkmatter: number; distfading: number; saturation: number
  color: [number, number, number]
  center: [number, number, number, number]
  scroll: [number, number, number, number]
  rotation: [number, number, number, number]
  hueShift?: number; hueSpeed?: number; postSaturation?: number
}

export const PRESETS: Record<string, StarNestPreset> = {
  darkWorld1: {
    key: 'darkWorld1', iterations: 16, volsteps: 15,
    formuparam: 420.2, stepSize: 312.2, tile: 796.96,
    brightness: 0.63, darkmatter: 40, distfading: 50, saturation: 62,
    color: [1, 1, 1], center: [0, 0.3, 0.5, 0],
    scroll: [0.1, 0.1, -0.3, 0], rotation: [1, 10, 0, 0.5],
  },
  galaxies: {
    key: 'galaxies', iterations: 15, volsteps: 8,
    formuparam: 550.1, stepSize: 420, tile: 553,
    brightness: 1.5, darkmatter: 300, distfading: 50, saturation: 77,
    color: [1, 1, 1], center: [1, 0.63, 0.8, 0],
    scroll: [0.1, 0.1, -0.3, 0], rotation: [0, 0, 0, 0.01],
  },
  crazyFractal: {
    key: 'crazyFractal', iterations: 15, volsteps: 8,
    formuparam: 998, stepSize: 498.1, tile: 1046,
    brightness: 2.4, darkmatter: 349, distfading: 173.3, saturation: 58.29,
    color: [0.588, 0.069, 0.069], center: [1, 0.3, 0.5, 0],
    scroll: [1.3, 1, 0.6, 0.01], rotation: [0, 0, 0, 0.01],
  },
  purple: {
    key: 'purple', iterations: 15, volsteps: 8,
    formuparam: 483, stepSize: 278.6, tile: 897.1,
    brightness: 0.5, darkmatter: 738.21, distfading: 100.3, saturation: 88.1,
    color: [0.757, 0.267, 0.602], center: [1, 0.3, 0.5, 8.09],
    scroll: [0.1, 0.1, -0.3, 0], rotation: [0, 0, 0, 0.01],
  },
  hsvRainbow: {
    key: 'hsvRainbow', iterations: 17, volsteps: 15,
    formuparam: 530, stepSize: 200, tile: 700,
    brightness: 1.5, darkmatter: 40, distfading: 60, saturation: 90,
    color: [1, 1, 1], center: [1, 0.3, 0.5, 0],
    scroll: [1.3, 1, 0.6, 0.01], rotation: [10, 5, 15, 0.05],
    hueShift: 0, hueSpeed: 0.1, postSaturation: 0.3,
  },
}

// ─── Skybox Mesh ─────────────────────────────────────────────────────────────

function SkyboxMesh({ preset }: { preset: StarNestPreset }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const { camera } = useThree()
  const timeRef = useRef(0)
  const lastRef = useRef(0)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    if (meshRef.current) meshRef.current.position.copy(camera.position)

    const dt = clock.elapsedTime - lastRef.current
    lastRef.current = clock.elapsedTime
    timeRef.current += dt
    matRef.current.uniforms.uTime.value = timeRef.current

    // Update preset values every frame for smooth transitions
    const p = preset
    matRef.current.uniforms.uIterations.value = p.iterations
    matRef.current.uniforms.uVolsteps.value = p.volsteps
    matRef.current.uniforms.uFormuparam.value = p.formuparam
    matRef.current.uniforms.uStepSize.value = p.stepSize
    matRef.current.uniforms.uTile.value = p.tile
    matRef.current.uniforms.uBrightness.value = p.brightness
    matRef.current.uniforms.uDarkmatter.value = p.darkmatter
    matRef.current.uniforms.uDistfading.value = p.distfading
    matRef.current.uniforms.uSaturation.value = p.saturation
    matRef.current.uniforms.uColor.value.set(...p.color)
    matRef.current.uniforms.uCenter.value.set(...p.center)
    matRef.current.uniforms.uScroll.value.set(...p.scroll)
    matRef.current.uniforms.uRotation.value.set(...p.rotation)
    matRef.current.uniforms.uHueShift.value = p.hueShift ?? 0
    matRef.current.uniforms.uHueSpeed.value = p.hueSpeed ?? 0
    matRef.current.uniforms.uPostSaturation.value = p.postSaturation ?? 0
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[100, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={VERT_SHADER}
        fragmentShader={FRAG_SHADER}
      />
    </mesh>
  )
}

// ─── Exported Component ──────────────────────────────────────────────────────

export default function StarNestBackground({ presetKey = 'darkWorld1' }: { presetKey?: string }) {
  const preset = PRESETS[presetKey] ?? PRESETS.darkWorld1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 0.01], fov: 90 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#000' }}
      >
        <SkyboxMesh preset={preset} />
      </Canvas>
    </div>
  )
}
