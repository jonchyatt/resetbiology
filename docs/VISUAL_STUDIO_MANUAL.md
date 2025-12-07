# Visual Studio - Audio-Reactive Orb Generator

## Complete User Manual

This guide covers everything you need to create stunning audio-reactive visualizations for meditation, hypnosis scripts, and breathing exercises.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Web Interface Guide](#web-interface-guide)
3. [Creating Breathing Exercise Visuals](#creating-breathing-exercise-visuals)
4. [Creating Audio-Reactive Videos](#creating-audio-reactive-videos)
5. [Offline Video Rendering (Blender)](#offline-video-rendering-blender)
6. [Background Video Setup](#background-video-setup)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Option 1: Web Preview (One-Click)

**Double-click this file:**
```
C:\Users\jonch\reset-biology-website\scripts\visuals\start-visual-studio.bat
```

The script will:
1. Start the development server
2. Automatically open your browser to the Visual Studio

#### Create a Desktop Shortcut (Recommended)

For even easier access, create a desktop shortcut:

1. Navigate to `C:\Users\jonch\reset-biology-website\scripts\visuals\`
2. Right-click on `start-visual-studio.bat`
3. Select **"Create shortcut"**
4. Drag the shortcut to your **Desktop**
5. Right-click the shortcut and select **"Rename"**
6. Name it **"Visual Studio"** or **"Orb Generator"**

Now you can launch Visual Studio from your desktop with one double-click!

### Option 2: High-Quality Video Export

1. Edit `scripts/visuals/run_offline_pipeline.bat`
2. Set your audio file path
3. Double-click the .bat file
4. Wait for Blender to render

---

## Web Interface Guide

The Visual Studio has **4 tabs** on the left side:

### Tab 1: Mode

This is where you choose what drives the orb animation.

| Mode | Description | Use Case |
|------|-------------|----------|
| **Breath Timer** | Orb expands/contracts based on breath pattern | Breathing exercises, meditation |
| **Audio Reactive** | Orb responds to audio file in real-time | Music visualizations, hypnosis scripts |

#### Breath Timer Mode

1. Click "Breath Timer" button
2. Select a pattern from the dropdown:
   - **4-7-8 Calming** - Inhale 4s, Hold 7s, Exhale 8s (Dr. Weil's technique)
   - **Box Breathing** - 4-4-4-4 (Navy SEAL technique)
   - **Balanced** - 5-5-5-1 (general relaxation)
   - **Energizing** - 3-1-3-1 (quick energy boost)
   - **Deep Relaxation** - 4-0-6-2 (slow exhale focus)
   - **Coherent** - 5-5 (heart rate variability)

3. The orb will automatically pulse with the breathing pattern

#### Audio Reactive Mode

1. Click "Audio Reactive" button
2. Click the upload area or drag your audio file (MP3, WAV, OGG)
3. Click the "Play" button
4. Watch the orb respond to the audio!

---

### Tab 2: Orb

Customize the appearance of the glowing particle orb.

#### Color Presets (Quick Selection)

Click any preset to instantly apply:

| Preset | Inner Color | Outer Color | Best For |
|--------|-------------|-------------|----------|
| Warm Glow | Cream | Orange | Original Unity look |
| Ethereal Blue | Light cyan | Deep blue | Calm, peaceful |
| Cosmic Purple | Lavender | Violet | Mystical, spiritual |
| Nature Green | Pale green | Forest green | Grounding |
| Fire Spirit | Yellow | Red-orange | Energy, power |
| Aurora Mix | Teal | Purple | Dynamic, magical |
| Desert Sunset | Peach | Coral | Warm, inviting |
| Moonlight | White | Silver-blue | Nighttime, dreams |

#### Custom Colors

- **Inner Core Color**: The bright center of each particle
- **Outer Glow Color**: The fading edge color

Click the color box to open the color picker, or type a hex code directly.

#### Particle Settings

| Setting | Range | Effect |
|---------|-------|--------|
| **Particle Count** | 2,000 - 50,000 | More = denser, richer look (slower performance) |
| **Point Size** | 2 - 15 | Larger = bigger individual particles |
| **Glow Intensity** | 0.2 - 2.0 | Higher = brighter, more ethereal |
| **Particle Spread** | 0.3 - 1.2 | Higher = larger orb radius |

**Recommended Settings:**
- For web preview: 16,000 particles, size 6
- For recording: 30,000+ particles, size 8

---

### Tab 3: Environment

Control the background, stars, and water reflection.

#### Background Presets

Click to apply:

| Preset | Description |
|--------|-------------|
| **Deep Space Stars** | Dark cosmos with star clusters |
| **Aurora Veil** | Blue-green gradient like northern lights |
| **Sunset Glow** | Warm orange/pink tones |
| **Zion Canyon Ember** | Red rock desert tones (matches your Zion footage) |
| **Deep Ocean** | Dark blue ocean depths |
| **Purple Nebula** | Mystical purple space clouds |

#### Custom Background

Enter a URL to any image. Works best with:
- 360-degree equirectangular images
- High-resolution dark images
- Space/nature photography

#### Background Video

1. Click "Upload Background Video" or enter a URL
2. Supported formats: MP4, WebM
3. Video plays behind the orb on loop
4. Great for your Zion National Park footage!

#### Star Field

| Setting | Effect |
|---------|--------|
| **Enable Stars** | Toggle animated stars on/off |
| **Star Count** | 1,000 - 20,000 stars |
| **Star Speed** | 0 = static, 1 = fast streaming |
| **Star Size Variation** | Higher = more varied star sizes |

**Tip:** When using a background video, reduce stars or turn them off.

#### Water Reflection

| Setting | Effect |
|---------|--------|
| **Enable Water** | Toggle reflective plane below orb |
| **Reflectivity** | 0.1 = subtle, 1.0 = mirror-like |

---

### Tab 4: Export

Configure settings for high-quality offline video rendering.

#### Resolution Options

| Setting | Dimensions | Use Case |
|---------|------------|----------|
| 1080p | 1920 x 1080 | YouTube, quick previews |
| 4K | 3840 x 2160 | High-quality YouTube, presentations |
| 8K | 7680 x 4320 | VR headsets, maximum quality |

#### Format Options

| Format | Description |
|--------|-------------|
| **Standard HD (16:9)** | Normal flat video |
| **360 Equirectangular** | VR-ready spherical video |

#### Frame Rate

- 24 fps: Cinematic feel
- 30 fps: Standard (recommended)
- 60 fps: Smooth motion (larger files)

#### Stereo 3D

Enable for VR headsets that support stereoscopic 3D (side-by-side format).

#### Pipeline Commands

The page shows you the exact commands to run. Click "Copy Render Command" to copy to clipboard.

---

## Creating Breathing Exercise Visuals

### Step-by-Step for Web Embedding

1. **Open Visual Studio**: http://localhost:3001/visuals/breathing

2. **Configure the Orb**:
   - Mode tab: Select "Breath Timer"
   - Choose your breath pattern (e.g., "4-7-8 Calming")

3. **Style the Orb**:
   - Orb tab: Pick "Ethereal Blue" for calm energy
   - Set Particle Count to 20,000

4. **Set the Scene**:
   - Environment tab: Choose "Deep Space Stars"
   - Enable Water with 0.5 reflectivity

5. **The orb is now ready!** It will continuously animate with the breath pattern.

### For Recording

Use screen recording software (OBS, Camtasia) to capture the browser window.

---

## Creating Audio-Reactive Videos

### Step-by-Step for Meditation/Hypnosis Scripts

1. **Prepare Your Audio**:
   - Record your meditation script with background music
   - Export as MP3 or WAV

2. **Open Visual Studio**: http://localhost:3001/visuals/breathing

3. **Switch to Audio Mode**:
   - Mode tab: Click "Audio Reactive"
   - Upload your audio file

4. **Style the Orb**:
   - Orb tab: Choose "Warm Glow" for the original Unity look
   - Increase Particle Count to 25,000
   - Set Glow Intensity to 1.2

5. **Set the Environment**:
   - Environment tab: Upload your Zion canyon video as background
   - Turn off stars (or reduce to 2,000)
   - Enable water reflection

6. **Play and Record**:
   - Click "Play" button
   - Use screen recording to capture
   - The orb will pulse with your voice and music!

---

## Offline Video Rendering (Blender)

For highest quality (8K, 360, stereo), use the Blender pipeline.

### Prerequisites

1. **Install Blender** (free): https://www.blender.org/download/
2. **Install Python libraries**:
   ```bash
   pip install librosa numpy
   ```

### Method 1: One-Click Batch File

1. Open `scripts/visuals/run_offline_pipeline.bat` in Notepad

2. Edit these lines:
   ```batch
   set "AUDIO=C:\path\to\your\meditation.wav"
   set "BACKGROUND=C:\path\to\your\zion-video.mp4"
   set "OUTPUT=C:\Users\jonch\reset-biology-website\renders\my-video.mp4"
   ```

3. Optionally change:
   ```batch
   set "MODE=equirect"      REM Change to "perspective" for normal HD
   set "RES_X=7680"         REM 7680 for 8K, 3840 for 4K, 1920 for 1080p
   ```

4. Double-click the .bat file

5. Wait for rendering (can take hours for 8K)

6. Find your video in the `renders` folder

### Method 2: Manual Commands

**Step 1: Analyze Audio**
```bash
cd C:\Users\jonch\reset-biology-website
python scripts/visuals/analyze_audio.py "C:\path\to\audio.wav" scripts/visuals/output/analysis.json
```

**Step 2: Render Video**
```bash
blender -b -P scripts/visuals/blender_generate.py -- ^
  --analysis scripts/visuals/output/analysis.json ^
  --audio "C:\path\to\audio.wav" ^
  --out "renders/output.mp4" ^
  --mode equirect ^
  --resolution 7680 ^
  --fps 30
```

### Blender Command Options

| Flag | Values | Description |
|------|--------|-------------|
| `--mode` | `perspective` or `equirect` | Normal HD or 360 VR |
| `--resolution` | 1920, 3840, 7680 | Width in pixels |
| `--fps` | 24, 30, 60 | Frames per second |
| `--stereo` | (flag) | Enable stereoscopic 3D |
| `--mask-sky` | (flag) | Replace video sky with stars |
| `--background-video` | path | Your environment video |

---

## Background Video Setup

### Using Your Zion National Park Footage

1. **For Web Preview**:
   - Environment tab > Background Video
   - Click upload and select your Zion video
   - The orb will float over the canyon!

2. **For Blender Rendering**:
   - Set `BACKGROUND` path in the .bat file
   - Add `--mask-sky` flag to replace the sky with animated stars

### Removing People/Equipment from Videos

If your Zion video has people or tripod visible:

**Option A: Static Patch (Quick)**
1. Take a screenshot of a clean area
2. Edit in Photoshop/GIMP to create a patch
3. Use ffmpeg to overlay:
   ```bash
   ffmpeg -i Zion1.mp4 -loop 1 -i patch.png -filter_complex "[1:v]format=rgba[patch];[0:v][patch]overlay=x=0:y=1500" -c:a copy Zion1_clean.mp4
   ```

**Option B: Use Blender Compositor (Better)**
1. Import video as Movie Clip
2. Add mask around unwanted areas
3. Clone/patch with nearby pixels

---

## Troubleshooting

### Web Interface Issues

| Problem | Solution |
|---------|----------|
| Page won't load | Run `npm run dev` first |
| Orb not visible | Wait 5-10 seconds for WebGL to initialize |
| Audio won't play | Click anywhere on page first (browser autoplay policy) |
| Choppy animation | Reduce Particle Count to 10,000 |
| Black screen | Try a different browser (Chrome recommended) |

### Blender Rendering Issues

| Problem | Solution |
|---------|----------|
| "blender not found" | Add Blender to PATH or set BLENDER_EXE in .bat |
| "librosa not found" | Run `pip install librosa` |
| Render crashes | Reduce resolution or use Cycles instead of EEVEE |
| No audio in output | Check audio file path is correct |

### Performance Tips

- **For smooth web preview**: Keep particles under 20,000
- **For recording**: Use 30,000+ particles but expect slower performance
- **For 8K rendering**: Allow several hours, close other programs

---

## File Locations Reference

| File | Purpose |
|------|---------|
| `app/visuals/breathing/page.tsx` | Web interface |
| `src/components/visuals/BreathingOrb.tsx` | Orb component |
| `scripts/visuals/analyze_audio.py` | Audio analysis |
| `scripts/visuals/blender_generate.py` | Blender renderer |
| `scripts/visuals/run_offline_pipeline.bat` | One-click render |
| `renders/` | Output folder for rendered videos |
| `tests/visuals/screenshots/` | Test screenshots |

---

## Quick Reference Card

### One-Click Launch (Recommended)
```
Double-click: scripts\visuals\start-visual-studio.bat
```

### Web URL (once server is running)
```
http://localhost:3000/visuals/breathing
```

### Manual Start (if needed)
```bash
cd C:\Users\jonch\reset-biology-website
npm run dev
```

### Render 4K Video (Quick)
```bash
scripts/visuals/run_offline_pipeline.bat
```

### Render 8K 360 Video (Full Command)
```bash
blender -b -P scripts/visuals/blender_generate.py -- --analysis scripts/visuals/output/analysis.json --audio "meditation.wav" --out "output.mp4" --mode equirect --resolution 7680 --fps 30
```

---

## Need Help?

- Check the `VISUALS_RUNBOOK.md` for technical details
- Review `docs/visuals.md` for additional commands
- Test screenshots are in `tests/visuals/screenshots/`

---

*Created for Reset Biology Visual Studio - Audio-Reactive Orb Generator*
