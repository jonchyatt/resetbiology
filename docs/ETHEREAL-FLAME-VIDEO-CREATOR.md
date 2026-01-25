# Ethereal Flame Video Creator - Planning Document

**Status:** Planning Phase
**Created:** January 25, 2026
**Last Updated:** January 25, 2026
**Priority:** High

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Goals & Vision](#goals--vision)
3. [Architecture Overview](#architecture-overview)
4. [Visual System](#visual-system)
5. [Template System](#template-system)
6. [Audio System](#audio-system)
7. [Recording & Export](#recording--export)
8. [Output Formats](#output-formats)
9. [Platform Integration](#platform-integration)
10. [Technical Requirements](#technical-requirements)
11. [Phase Breakdown](#phase-breakdown)
12. [Open Questions](#open-questions)
13. [Reference Materials](#reference-materials)

---

## Project Overview

Build a sophisticated video creation tool that combines:
- The visual elegance of the BreathOrb component (smooth gradients, clean animations)
- The particle lifetime system from the UnityOrb (birth/death cycles, size curves)
- Audio-reactive capabilities from the existing BreathingOrb system
- Template save/load functionality for reproducible results
- Multi-format export for various platforms and viewing modes

### Core User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. SELECT/CREATE TEMPLATE                                       │
│     - Choose preset (Ethereal Flame, Nebula Swirl, Classic Orb) │
│     - Or create custom template with visual editor               │
├─────────────────────────────────────────────────────────────────┤
│  2. UPLOAD AUDIO                                                 │
│     - Drag & drop or file picker                                 │
│     - Audio analysis preview (waveform, frequency bands)         │
├─────────────────────────────────────────────────────────────────┤
│  3. PREVIEW & ADJUST                                             │
│     - Real-time preview with audio                               │
│     - Fine-tune reactivity settings                              │
├─────────────────────────────────────────────────────────────────┤
│  4. SELECT OUTPUT FORMAT(S)                                      │
│     - Multi-select: Mono, Stereo, 360, 360-Stereo, Skybox       │
│     - Quality settings per format                                │
├─────────────────────────────────────────────────────────────────┤
│  5. RENDER                                                       │
│     - Progress tracking                                          │
│     - Queue multiple renders                                     │
├─────────────────────────────────────────────────────────────────┤
│  6. EXPORT & DISTRIBUTE (Future)                                 │
│     - Download locally                                           │
│     - Auto-upload to platforms                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Goals & Vision

### Primary Goals

1. **Visual Excellence** - Combine the best visual elements from existing orb systems
2. **Template Flexibility** - Users can create, save, load, and share templates
3. **Full Automation** - Upload audio → render video → export (eventually auto-upload)
4. **Multi-Format Support** - Single workflow produces multiple output formats
5. **Platform Ready** - Proper metadata/markers for YouTube 360, VR platforms, etc.

### Future Vision

- **Fully Automated Pipeline**: Audio upload triggers automatic rendering and publishing
- **Multi-Platform Distribution**: Auto-upload to YouTube, TikTok, Instagram, etc.
- **AI-Assisted Templates**: Suggest visual settings based on audio genre/mood
- **Batch Processing**: Queue multiple audio files for overnight rendering
- **Collaboration**: Share templates with other users

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VIDEO CREATOR APP                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Template   │  │    Audio     │  │   Renderer   │  │   Exporter   │ │
│  │   Manager    │  │   Analyzer   │  │   Engine     │  │   Service    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         └─────────────────┼─────────────────┼─────────────────┘          │
│                           │                 │                            │
│                    ┌──────┴───────┐  ┌──────┴───────┐                   │
│                    │  Visual Core │  │  Camera Rigs │                   │
│                    │  (Three.js)  │  │  (per format)│                   │
│                    └──────────────┘  └──────────────┘                   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  MongoDB: Templates, User Preferences, Render History                    │
│  LocalStorage: Draft templates, Recent audio files                       │
│  IndexedDB: Large file caching, Render queue                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### File Structure (Proposed)

```
src/
├── components/
│   └── VideoCreator/
│       ├── VideoCreatorPage.tsx        # Main page component
│       ├── TemplatePanel.tsx           # Template selection/editing
│       ├── TemplateEditor.tsx          # Visual template editor
│       ├── AudioUploader.tsx           # Audio file handling
│       ├── AudioWaveform.tsx           # Waveform visualization
│       ├── PreviewCanvas.tsx           # Real-time preview
│       ├── FormatSelector.tsx          # Output format selection
│       ├── RenderQueue.tsx             # Render progress/queue
│       ├── ExportPanel.tsx             # Download/distribute
│       └── index.ts                    # Barrel export
│
├── components/visuals/
│   ├── EtherealFlameOrb.tsx            # NEW: Combined orb visual
│   ├── BreathingOrb.tsx                # Existing (reference)
│   └── shaders/
│       ├── etherealFlame.vert          # Vertex shader
│       ├── etherealFlame.frag          # Fragment shader
│       └── starNest.frag               # Existing skybox shader
│
├── lib/
│   └── videoCreator/
│       ├── templateManager.ts          # CRUD for templates
│       ├── audioAnalyzer.ts            # Enhanced audio analysis
│       ├── renderEngine.ts             # Video rendering logic
│       ├── cameraRigs.ts               # Camera setups per format
│       ├── exportService.ts            # File export utilities
│       └── platformUploader.ts         # Future: API integrations
│
├── types/
│   └── videoCreator.ts                 # TypeScript definitions
│
app/
├── video-creator/
│   └── page.tsx                        # Route: /video-creator
│
└── api/
    └── video-creator/
        ├── templates/
        │   └── route.ts                # GET/POST/PATCH/DELETE templates
        ├── render/
        │   └── route.ts                # Trigger server-side render
        └── upload/
            └── route.ts                # Future: Platform upload
```

---

## Visual System

### EtherealFlameOrb - The New Visual Core

Combines best elements from existing systems:

#### From BreathOrb (Visual Appeal)
- Clean gradient color transitions
- Smooth Framer Motion animations
- Inner glow layering effect
- State-based color themes
- Elegant simplicity

#### From UnityOrb (Particle System)
- Particle birth/death lifecycle
- Size over lifetime curves
- Per-particle color/opacity animation
- Layer-based organization
- Frequency band mapping

#### New Features (Ethereal Flame)
- **Upward Drift**: Particles rise like flame/smoke
- **Flicker Intensity**: Randomized brightness variations
- **Taper Density**: More particles at base, fewer at top
- **Heat Distortion**: Optional refraction effect
- **Color Temperature**: Warm (fire) to cool (spirit) gradient options

### Visual Presets (Built-in Templates)

| Preset Name | Description | Particle Behavior | Color Theme |
|-------------|-------------|-------------------|-------------|
| **Ethereal Flame** | Upward-drifting fire | Rise + flicker | Warm oranges/yellows |
| **Spirit Fire** | Cool ghostly flame | Slow rise + fade | Blues/purples/white |
| **Nebula Swirl** | Outward spiral | Spiral outward | Rainbow/cosmic |
| **Classic Orb** | Original breathing orb | Pulse in/out | Teal/green gradient |
| **Solar Flare** | Explosive bursts | Burst on beat | Yellow/white/red |
| **Ocean Deep** | Underwater bioluminescence | Float + pulse | Deep blue/cyan |
| **Northern Lights** | Aurora effect | Wave + ribbon | Green/purple/pink |
| **Heartbeat** | Pulsing core | Strong pulse | Red/pink |

### Particle System Configuration

```typescript
interface ParticleConfig {
  // Counts
  particleCount: number;           // 1000 - 50000
  layerCount: number;              // 1 - 5 layers

  // Lifetime
  minLifetime: number;             // seconds
  maxLifetime: number;             // seconds

  // Size
  baseSize: number;                // base particle size
  sizeOverLifetime: number[];      // curve: [0, 0.5, 1, 0.8, 0]
  sizeVariation: number;           // randomness 0-1

  // Movement
  driftDirection: 'up' | 'out' | 'spiral' | 'pulse';
  driftSpeed: number;
  driftVariation: number;
  turbulence: number;              // noise-based movement

  // Color
  colorGradient: GradientStop[];   // color over lifetime
  hueShift: number;                // 0-360 degrees
  saturation: number;              // 0-1
  brightness: number;              // 0-2

  // Flame-specific
  flameHeight: number;             // vertical extent
  flameTaper: number;              // how much it narrows at top
  flickerIntensity: number;        // brightness variation
  flickerSpeed: number;            // Hz
}

interface GradientStop {
  position: number;  // 0-1
  color: string;     // hex or rgba
  opacity: number;   // 0-1
}
```

### Audio Reactivity Configuration

```typescript
interface AudioReactivityConfig {
  // Global
  enabled: boolean;
  sensitivity: number;             // 0-2 (multiplier)
  smoothing: number;               // 0-1 (temporal smoothing)

  // Frequency Bands
  bands: {
    subBass: FrequencyBandConfig;  // 20-60 Hz
    bass: FrequencyBandConfig;     // 60-250 Hz
    lowMid: FrequencyBandConfig;   // 250-500 Hz
    mid: FrequencyBandConfig;      // 500-2000 Hz
    highMid: FrequencyBandConfig;  // 2000-4000 Hz
    treble: FrequencyBandConfig;   // 4000-20000 Hz
  };

  // Beat Detection
  beatDetection: {
    enabled: boolean;
    threshold: number;             // 0-1
    cooldownMs: number;            // prevent double-triggers
  };

  // Mapping
  mapping: {
    size: 'none' | 'bass' | 'mid' | 'treble' | 'all';
    brightness: 'none' | 'bass' | 'mid' | 'treble' | 'all';
    speed: 'none' | 'bass' | 'mid' | 'treble' | 'all';
    hue: 'none' | 'bass' | 'mid' | 'treble' | 'all';
  };
}

interface FrequencyBandConfig {
  gain: number;                    // 0-2
  targetProperty: string[];        // ['size', 'brightness', etc.]
  influence: number;               // 0-1
}
```

---

## Template System

### Template Schema

```typescript
interface VideoTemplate {
  // Identity
  id: string;                      // UUID
  name: string;
  description?: string;
  thumbnail?: string;              // base64 or URL

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;               // user ID
  isPublic: boolean;               // shareable?
  tags: string[];

  // Visual Settings
  particleConfig: ParticleConfig;

  // Skybox Settings
  skybox: {
    preset: string;                // StarNest preset name
    rotationSpeed: number;
    brightness: number;
    hueOffset: number;
  };

  // Audio Reactivity
  audioReactivity: AudioReactivityConfig;

  // Camera Defaults
  camera: {
    distance: number;
    fov: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
  };

  // Render Defaults
  renderDefaults: {
    preferredFormats: OutputFormat[];
    preferredQuality: QualityPreset;
  };
}
```

### Template Storage

**MongoDB Collections:**

```javascript
// templates collection
{
  _id: ObjectId,
  userId: ObjectId,              // owner
  name: "Ethereal Flame",
  description: "Warm upward-drifting flame effect",
  config: { /* full template config */ },
  thumbnail: "data:image/png;base64,...",
  isPublic: true,
  tags: ["flame", "warm", "energetic"],
  usageCount: 42,
  createdAt: ISODate,
  updatedAt: ISODate
}

// template_presets collection (system defaults)
{
  _id: ObjectId,
  name: "Classic Orb",
  isSystemPreset: true,
  config: { /* ... */ },
  order: 1                       // display order
}
```

### Template API Endpoints

```
GET    /api/video-creator/templates           # List user's templates
GET    /api/video-creator/templates/presets   # List system presets
GET    /api/video-creator/templates/:id       # Get single template
POST   /api/video-creator/templates           # Create new template
PATCH  /api/video-creator/templates/:id       # Update template
DELETE /api/video-creator/templates/:id       # Delete template
POST   /api/video-creator/templates/:id/clone # Clone template
```

---

## Audio System

### Audio Upload & Processing

```typescript
interface AudioFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;                    // bytes
  duration: number;                // seconds
  sampleRate: number;
  channels: number;
  uploadedAt: Date;

  // Analysis results (computed)
  analysis?: AudioAnalysis;
}

interface AudioAnalysis {
  // Waveform data (for visualization)
  waveform: Float32Array;          // downsampled peaks

  // Frequency analysis
  spectrogramData: Float32Array[]; // time x frequency

  // Beat detection
  beats: number[];                 // timestamps in seconds
  bpm: number;

  // Energy over time
  energyCurve: Float32Array;

  // Per-band energy
  bandEnergy: {
    bass: Float32Array;
    mid: Float32Array;
    treble: Float32Array;
  };
}
```

### Audio Analysis Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  File Upload │───>│  Decode to   │───>│   Analyze    │
│  (MP3/WAV)   │    │  AudioBuffer │    │  (librosa?)  │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                    ┌──────────────────────────┘
                    │
              ┌─────┴─────┐
              │           │
        ┌─────┴───┐ ┌─────┴───┐
        │ Browser │ │ Server  │
        │ Web     │ │ Python  │
        │ Audio   │ │ librosa │
        │ API     │ │         │
        └─────────┘ └─────────┘
        (real-time)  (pre-render)
```

### Existing Infrastructure

Reference: `scripts/visuals/analyze_audio.py` - Already have Python/librosa analysis

```bash
python scripts/visuals/analyze_audio.py input.wav output/analysis.json
```

---

## Recording & Export

### Recording Methods

#### Method 1: Browser MediaRecorder (Real-time)
- **Pros**: Works in browser, no server needed
- **Cons**: Limited to real-time speed, quality limitations
- **Use case**: Quick previews, lower quality exports

```typescript
// Capture canvas stream
const stream = canvas.captureStream(60); // 60 fps
const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9',
  videoBitsPerSecond: 50_000_000 // 50 Mbps
});
```

#### Method 2: Frame-by-Frame Export (Offline)
- **Pros**: Highest quality, any resolution, consistent frame timing
- **Cons**: Slower than real-time
- **Use case**: Final production renders

```typescript
// Export each frame as image
for (let frame = 0; frame < totalFrames; frame++) {
  const time = frame / fps;
  updateScene(time, audioData);
  renderer.render(scene, camera);

  const dataUrl = renderer.domElement.toDataURL('image/png');
  await saveFrame(dataUrl, frame);
}
// Then stitch with ffmpeg
```

#### Method 3: Blender Pipeline (Existing)
- **Pros**: Production quality, handles 8K, stereo, 360
- **Cons**: Requires Blender installation
- **Use case**: Highest quality final renders

Reference: `docs/visuals.md` - Existing Blender pipeline

### Quality Presets

| Preset | Resolution | FPS | Bitrate | Use Case |
|--------|------------|-----|---------|----------|
| **Draft** | 720p | 30 | 5 Mbps | Quick preview |
| **Standard** | 1080p | 30 | 15 Mbps | Social media |
| **HD** | 1080p | 60 | 25 Mbps | YouTube HD |
| **2K** | 1440p | 60 | 40 Mbps | High quality |
| **4K** | 2160p | 60 | 80 Mbps | 4K displays |
| **8K** | 4320p | 30 | 150 Mbps | Maximum quality |

---

## Output Formats

### Format Specifications

#### 1. Monocular (Standard)

```
┌─────────────────────────────┐
│                             │
│      Standard 16:9          │
│      Single camera          │
│                             │
└─────────────────────────────┘
Resolution: 1920x1080 to 7680x4320
Aspect: 16:9
Camera: Single perspective
```

#### 2. Stereoscopic (Side-by-Side)

```
┌──────────────┬──────────────┐
│              │              │
│  Left Eye    │  Right Eye   │
│              │              │
└──────────────┴──────────────┘
Resolution: 3840x1080 (Full SBS) or 1920x1080 (Half SBS)
Eye separation: 65mm (human IPD)
Convergence: Adjustable
YouTube tag: yt3d:enable=true
```

#### 3. 360 Equirectangular

```
┌─────────────────────────────────────────┐
│                                         │
│    Equirectangular projection           │
│    360° horizontal, 180° vertical       │
│                                         │
└─────────────────────────────────────────┘
Resolution: 4096x2048 to 8192x4096
Projection: Equirectangular
YouTube metadata: Spatial media injector required
```

#### 4. 360 Stereoscopic (Top-Bottom)

```
┌─────────────────────────────────────────┐
│         Left Eye (360°)                 │
├─────────────────────────────────────────┤
│         Right Eye (360°)                │
└─────────────────────────────────────────┘
Resolution: 4096x4096 to 8192x8192
Format: Top-bottom equirectangular
YouTube: VR180/VR360 metadata required
```

#### 5. Skybox Auto-Rotate

```
┌─────────────────────────────┐
│                             │
│  Fixed orb, rotating sky    │
│  Creates motion without     │
│  camera movement            │
│                             │
└─────────────────────────────┘
Resolution: Any standard
Effect: Skybox rotates, orb static
Speed: Configurable (degrees/second)
```

### Camera Rig Configurations

```typescript
interface CameraRig {
  type: 'mono' | 'stereo' | 'equirect' | 'equirect_stereo';

  // Mono settings
  fov?: number;
  distance?: number;

  // Stereo settings
  eyeSeparation?: number;          // meters (default 0.065)
  convergenceDistance?: number;    // meters
  stereoFormat?: 'sidebyside' | 'topbottom';

  // 360 settings
  cubeMapSize?: number;            // resolution per face

  // Skybox rotation
  skyboxRotation?: {
    enabled: boolean;
    speed: number;                 // degrees per second
    axis: 'y' | 'x' | 'z';
  };
}
```

### File Naming Convention

```
[template]_[format]_[quality]_[audioName]_[timestamp].[ext]

Examples:
ethereal-flame_mono_4k_epic-dubstep_2026-01-25.mp4
nebula-swirl_stereo-sbs_1080p_ambient-waves_2026-01-25.mp4
classic-orb_360_8k_meditation-bells_2026-01-25.mp4
spirit-fire_360-stereo_4k_synthwave_2026-01-25.mp4
solar-flare_skybox-rotate_1080p_edm-drop_2026-01-25.mp4
```

### Metadata Requirements

#### YouTube 360/VR Metadata

Must inject spatial media metadata using Google's tool or equivalent:

```bash
# Using spatial-media injector
python spatialmedia -i --stereo=top-bottom input.mp4 output_injected.mp4
```

Required metadata fields:
- `Spherical`: true
- `Stitched`: true
- `StitchingSoftware`: "Reset Biology Video Creator"
- `ProjectionType`: "equirectangular"
- `StereoMode`: "top-bottom" (if stereo)

---

## Platform Integration

### Phase 1: Manual Upload (Current)
- Download rendered files
- User manually uploads to platforms

### Phase 2: Assisted Upload
- Generate platform-specific descriptions
- Auto-generate thumbnails
- Copy-ready titles and tags

### Phase 3: Direct Upload (Future)

#### YouTube Integration
```typescript
interface YouTubeUploadConfig {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'private' | 'unlisted' | 'public';

  // 360/VR specific
  projection?: '360' | 'rectangular';
  stereoLayout?: 'mono' | 'leftRight' | 'topBottom';
}
```

#### TikTok Integration
- Resolution: 1080x1920 (9:16 portrait)
- Duration: Max 3 minutes
- Format: MP4

#### Instagram Integration
- Feed: 1080x1080 (1:1) or 1080x1350 (4:5)
- Reels: 1080x1920 (9:16)
- Duration: Feed 60s, Reels 90s
- Format: MP4

#### Platform-Specific Auto-Formatting
```typescript
interface PlatformExport {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter';

  // Auto-adjustments
  cropToAspect: boolean;
  maxDuration?: number;
  addWatermark?: boolean;

  // Metadata
  generateTitle: boolean;
  generateDescription: boolean;
  generateHashtags: boolean;
}
```

---

## Technical Requirements

### Browser Requirements
- WebGL 2.0 support
- Web Audio API
- MediaRecorder API (for real-time capture)
- IndexedDB (for caching)
- Minimum 4GB RAM recommended

### Server Requirements (for Blender pipeline)
- Blender 3.x+ (headless)
- Python 3.9+ with librosa
- ffmpeg
- Sufficient disk space for renders
- GPU recommended (CUDA/OpenCL)

### Dependencies (New)

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.92.0",
    "lamina": "^1.1.23",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/three": "^0.160.0"
  }
}
```

### Existing Dependencies (Already in project)
- React 18
- Next.js 15
- Three.js (via BreathingOrb.tsx)
- Framer Motion

---

## Phase Breakdown

### Phase 1: Foundation (MVP)
- [ ] Create `/video-creator` page route
- [ ] Build basic UI layout (preview + controls)
- [ ] Port EtherealFlameOrb component from existing orbs
- [ ] Implement 3 built-in presets
- [ ] Basic audio upload and Web Audio analysis
- [ ] MediaRecorder-based recording (mono only)
- [ ] Local download export

### Phase 2: Template System
- [ ] Design template schema
- [ ] Create MongoDB models
- [ ] Build template API endpoints
- [ ] Template save/load UI
- [ ] Template editor (sliders, color pickers)
- [ ] Preset gallery view

### Phase 3: Multi-Format Export
- [ ] Implement camera rigs for all formats
- [ ] Add format selector UI
- [ ] Frame-by-frame export for quality
- [ ] ffmpeg integration for stitching
- [ ] Quality preset selector
- [ ] Proper file naming

### Phase 4: 360/VR Support
- [ ] Equirectangular rendering
- [ ] Stereoscopic camera rig
- [ ] Spatial media metadata injection
- [ ] 360 preview (drag to look around)
- [ ] VR preview mode (WebXR)

### Phase 5: Advanced Audio
- [ ] Server-side librosa analysis
- [ ] Beat detection visualization
- [ ] Per-band reactivity fine-tuning
- [ ] Audio waveform preview
- [ ] Sync verification tools

### Phase 6: Platform Integration
- [ ] Auto-generate titles/descriptions
- [ ] Thumbnail generation
- [ ] YouTube API integration
- [ ] TikTok API integration
- [ ] Instagram API integration
- [ ] Batch upload queue

### Phase 7: Full Automation
- [ ] Automated render queue
- [ ] Scheduled publishing
- [ ] Multi-platform simultaneous upload
- [ ] Analytics integration
- [ ] A/B testing for thumbnails

---

## Open Questions

### Visual Design
- [ ] Exact particle shader approach (points vs sprites vs mesh instances)?
- [ ] Should flame presets support background video compositing?
- [ ] Heat distortion effect - worth the performance cost?

### Technical
- [ ] Server-side rendering vs client-only? (8K may need server)
- [ ] Blender pipeline vs pure Three.js for final renders?
- [ ] WebGPU support for future performance gains?

### Business
- [ ] Render credits/quota system needed?
- [ ] Template marketplace for user-created presets?
- [ ] Premium templates as subscription perk?

### Platform
- [ ] Which platform integrations are highest priority?
- [ ] Handle platform-specific content guidelines automatically?
- [ ] Auto-detect copyrighted audio and warn?

---

## Reference Materials

### Existing Codebase
- `src/components/visuals/BreathingOrb.tsx` - Current 3D audio-reactive system
- `src/components/Breath/BreathOrb.tsx` - Clean 2D orb (visual reference)
- `docs/visuals.md` - Existing Blender pipeline documentation
- `scripts/visuals/` - Python audio analysis and Blender scripts

### External Resources
- [Three.js Particle Systems](https://threejs.org/docs/#api/en/objects/Points)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [YouTube 360 Spec](https://support.google.com/youtube/answer/6178631)
- [Spatial Media Metadata Injector](https://github.com/google/spatial-media)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

### Inspiration
- Winamp visualizations (classic reactive patterns)
- Electric Sheep (generative/evolutionary art)
- Plane9 (modern audio visualizer)
- YouTube "musicvideo" genre (clean reactive videos)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-25 | Initial planning document created | Claude |

---

*This is a living document. Update as decisions are made and implementation progresses.*
