# additive_rainbow – full spec (cleaned from Unity prefab)

This is not code; it’s the distilled parameters from the Unity prefab so another engine can reproduce it. Use an additive, soft-disk particle texture; the material GUID in Unity was `de30bfa008962244abdf4fb543683f7d`.

Core
- Looping, prewarm: on. Duration: 5s. Play on awake: on.
- Max particles: 1000.
- Scaling mode: local (not hierarchical).

Emission
- Rate over time: 40 particles/s. No bursts. No distance emission.

Shape (cone)
- Type: cone.
- Angle: 25°.
- Length: 5.
- Radius: 0.01.
- Radius thickness: 1.0.
- Donut radius: 0.2.
- Arc: 360°.

Initial state
- Start lifetime: 2.0s.
- Start speed: random between 0 and 1.
- Start size: 2.0 (uniform).
- Start color: gradient (times 0–1):
  - t0.0000: (1.00, 0.00, 0.00, 1.0)   # red, opaque
  - t0.1266: (1.00, 0.44, 0.00, 1.0)   # orange, opaque
  - t0.2766: (1.00, 0.85, 0.00, 0.0)   # yellow, fully transparent
  - t0.4383: (0.14, 1.00, 0.07, 0.0)   # green, transparent
  - t0.6030: (0.01, 0.75, 1.00, 0.0)   # cyan, transparent
  - t0.7649: (0.31, 0.13, 0.61, 0.0)   # purple, transparent
  - t0.9066: (0.67, 0.00, 0.82, 0.0)   # magenta, transparent
  - t1.0000: (1.00, 0.00, 0.00, 0.0)   # red, transparent
  (Alpha keys: 1.0 at the first two keys, then 0 afterward.)

Size over lifetime
- Curve (time 0..1 → scale):
  - 0.0 → 0.3737
  - 0.2 → 1.0
  - 1.0 → 0.5

Renderer
- Render mode: billboard.
- Sort mode: distance (Unity sortMode=2).
- Max particle size: 0.5.
- Length scale: 2.0 (mostly ignored for billboard; relevant if using stretched billboards).
- Material: additive-blend soft sprite (Unity material GUID above).

Disabled/irrelevant modules (set to off): rotation over lifetime, velocity over lifetime, force over lifetime, external forces, noise, lights, trails, sub-emitters, collision, trigger, texture sheet animation, color by speed, size by speed, etc. Color over lifetime was effectively flat white (no additional ramp beyond startColor).
