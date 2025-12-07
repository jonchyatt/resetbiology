# Visuals Runbook (Offline + Web)

This repo ships three visual targets:
- Offline renders (Blender): HD 16:9, 360 equirectangular, and stereo side-by-side/top-bottom.
- Web breathing orb (React-Three-Fiber): realtime additive particles driven by breath timing.

## Prerequisites
- Blender with CLI (`blender` on PATH).
- Python 3 + `pip install librosa`.
- ffmpeg (optional, for stitching).
- Node 18+ (for the web app).

## Offline Pipeline (Blender)
1) Analyze audio → JSON:
   ```sh
   python scripts/visuals/analyze_audio.py input.wav scripts/visuals/output/analysis.json
   ```
2) Render (pick one):
   - 8K 360:
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-360.mp4 \
       --mode equirect \
       --resolution 7680 --fps 30
     ```
   - 4K HD (standard):
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-4k.mp4 \
       --mode perspective \
       --resolution 3840 --resolution-y 2160 --fps 30 --fov 70
     ```
   - 4K Stereo side-by-side:
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-4k-sbs.mp4 \
       --mode perspective \
       --resolution 3840 --resolution-y 2160 --fps 30 \
       --stereo --stereo-format SIDEBYSIDE --stereo-distance 0.065
     ```
   - Swap in a 360 sky clip and key out its sky:
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-zion.mp4 \
       --mode equirect \
       --background-video path/to/zion-360.mp4 \
       --mask-sky
     ```
3) If rendering image sequences, stitch:
   ```powershell
   ./scripts/visuals/ffmpeg_stitch.ps1 -Images "frame%05d.png" -Audio input.wav -Out renders/orb.mp4 -Fps 30
   ```

4) One-click batch (Windows): edit paths in `scripts/visuals/run_offline_pipeline.bat` (set `AUDIO`, `BACKGROUND`, `OUTPUT`) and double-click it. It runs analysis + Blender render in one go.

## Web Breathing Orb (Realtime)
- Route: `/visuals/breathing`
- Component: `src/components/visuals/BreathingOrb.tsx`
- Features:
  - GPU particle orb (additive blending) driven by breath timers (no audio).
  - UI: choose breath pattern (4-7-8, box, etc.), particle density, and background.
  - Backgrounds: built-in gradients (stars/aurora/sunset/canyon) or paste a custom image/360 URL.
  - Orbit controls enabled for light interaction.

Run locally:
```sh
npm install
npm run dev
# open http://localhost:3000/visuals/breathing
```

## Backgrounds / Sky Options
- Procedural starfield background in Blender (default).
- Custom 360 sky/video: `--background-video` in Blender; add `--mask-sky` to key out the real sky and reveal stars.
- Web: preset gradients for quick use; custom image/360 URL input to approximate your skyboxes. For fidelity, use the Blender pipeline to composite with real 360 skies.
- Web controls: breath patterns, particle density, orb inner/outer colors, optional background MP4/WebM (looped), stars overlay with density/speed/variation sliders.

## Defaults
- Breath web orb: 16k particles, additive blending, 55° FOV camera.
- Blender: Eevee by default for speed; add `--use_cycles` for quality. Equirect camera for 360, perspective for HD. Stereo uses parallel convergence with configurable IO distance.

## Notes
- Audio in Blender renders is embedded via the sequencer strip.
- HD, 360, and stereo share the same pipeline; swap `--mode` and stereo flags.
- For Zion/canyon skies with star overlays, feed your equirectangular canyon clip via `--background-video` and enable `--mask-sky`.
