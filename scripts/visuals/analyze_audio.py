"""
Pre-analyze audio for the Blender generator.

Outputs a compact JSON file with a smoothed RMS envelope and detected beat frames.
Run with a normal Python interpreter (not Blender):

    python scripts/visuals/analyze_audio.py input.wav analysis.json

Requires: librosa (pip install librosa)
"""

import argparse
import json
from pathlib import Path
from typing import List

import librosa
import numpy as np


def exponential_moving_average(values: np.ndarray, alpha: float = 0.4) -> np.ndarray:
    """Light smoothing to remove jitter from the raw RMS curve."""
    if len(values) == 0:
        return values
    smoothed = np.zeros_like(values)
    smoothed[0] = values[0]
    for i in range(1, len(values)):
        smoothed[i] = alpha * values[i] + (1.0 - alpha) * smoothed[i - 1]
    return smoothed


def analyze_audio(audio_path: Path, hop_length: int = 512, frame_length: int = 2048):
    y, sr = librosa.load(audio_path, mono=True)
    rms = librosa.feature.rms(y=y, hop_length=hop_length, frame_length=frame_length)[0]
    beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length)[1]
    rms_smooth = exponential_moving_average(rms)

    # Normalize RMS to 0..1 for convenient mapping in Blender
    rms_norm = rms_smooth / (np.max(rms_smooth) + 1e-8)

    return {
        "sample_rate": int(sr),
        "hop_length": int(hop_length),
        "frame_length": int(frame_length),
        "rms_normalized": rms_norm.tolist(),
        "beat_frames": beats.tolist(),
        "duration_seconds": float(len(y) / sr),
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze audio for Blender-driven animation.")
    parser.add_argument("audio", type=Path, help="Input audio file (.wav/.mp3).")
    parser.add_argument("out", type=Path, help="Where to write the analysis JSON.")
    parser.add_argument("--hop-length", type=int, default=512, help="Librosa hop length.")
    parser.add_argument("--frame-length", type=int, default=2048, help="Librosa frame length.")
    args = parser.parse_args()

    data = analyze_audio(args.audio, hop_length=args.hop_length, frame_length=args.frame_length)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, indent=2))
    print(f"Wrote analysis to {args.out} (frames: {len(data['rms_normalized'])})")


if __name__ == "__main__":
    main()
