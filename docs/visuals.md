# Audio-Reactive Orb Visuals (No Unity)

This repo now includes a Blender-based offline renderer and a web breathing orb. Three targets:
- High-res standard video (16:9).
- 360 equirectangular (VR-friendly).
- Stereo 3D (side-by-side).

## Prereqs
- Blender (CLI accessible as `blender`).
- Python 3 + `pip install librosa`.
- ffmpeg (for optional stitching).

## Offline Render Pipeline (Blender)
1) Analyze audio:
   ```sh
   python scripts/visuals/analyze_audio.py input.wav scripts/visuals/output/analysis.json
   ```
2) Render (examples):
   - 360 equirectangular 8K:
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-360.mp4 \
       --mode equirect \
       --resolution 7680 --fps 30
     ```
   - Standard 4K 16:9:
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-4k.mp4 \
       --mode perspective \
       --resolution 3840 --resolution-y 2160 --fps 30 --fov 70
     ```
   - Stereo side-by-side 4K:
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-4k-sbs.mp4 \
       --mode perspective \
       --resolution 3840 --resolution-y 2160 --fps 30 \
       --stereo --stereo-format SIDEBYSIDE --stereo-distance 0.065
     ```
   - Use a 360 video sky and mask out the real sky:
     ```sh
     blender -b -P scripts/visuals/blender_generate.py -- \
       --analysis scripts/visuals/output/analysis.json \
       --audio input.wav \
       --out renders/orb-zion.mp4 \
       --mode equirect \
       --background-video path/to/zion-360.mp4 \
       --mask-sky
     ```

3) Optional: if you render image sequences, stitch with ffmpeg:
   ```powershell
   ./scripts/visuals/ffmpeg_stitch.ps1 -Images "frame%05d.png" -Audio input.wav -Out renders/orb.mp4 -Fps 30
   ```

## Key Options
- `--mode equirect` (360) or `--mode perspective` (standard).
- `--stereo` enables stereo 3D; `--stereo-format SIDEBYSIDE|TOPBOTTOM`; `--stereo-distance` controls eye separation.
- `--background-video` swaps the procedural stars for an equirectangular clip; `--mask-sky` keys out the clip’s sky to reveal stars.
- `--use_cycles` for higher quality (slower) or default Eevee for speed.

## Web Breathing Orb (realtime)
- Planned: React-Three-Fiber + additive particles, breath-timer driven (no audio). UI to pick breath pattern and background. (Incoming implementation.)
