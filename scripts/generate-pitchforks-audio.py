#!/usr/bin/env python3
"""Generate original, loop-safe 8-bit horror music and Pitchforks III SFX.

All samples are synthesized from code; no third-party recordings are used.
The generated files are dedicated to CC0-1.0 in public/audio/pitchforks/LICENSE.md.
"""
from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio" / "pitchforks"
RATE = 22_050
TAU = math.tau


def clamp(sample: float) -> int:
    return max(-32767, min(32767, round(sample * 32767)))


def write_wav(name: str, samples: list[float]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / name), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(b"".join(struct.pack("<h", clamp(sample)) for sample in samples))


def square(phase: float, duty: float = 0.5) -> float:
    return 1.0 if phase % 1.0 < duty else -1.0


def triangle(phase: float) -> float:
    return 1.0 - 4.0 * abs((phase % 1.0) - 0.5)


def midi(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def music_loop(root: int, bpm: int, pattern: tuple[int, ...], pulse: tuple[int, ...], seed: int) -> list[float]:
    # Exactly eight bars in 4/4; every voice lands on a zero-crossing fade at
    # both ends so HTMLAudio loop boundaries remain silent on phone speakers.
    beats = 32
    duration = beats * 60.0 / bpm
    total = round(duration * RATE)
    rng = random.Random(seed)
    noise_values = [rng.uniform(-1, 1) for _ in range(total)]
    out: list[float] = []
    for index in range(total):
        t = index / RATE
        beat = t * bpm / 60.0
        step = int(beat * 2) % len(pattern)
        bass_note = root + pattern[step]
        upper_note = root + 12 + pulse[int(beat) % len(pulse)]
        bass = square(t * midi(bass_note), 0.38) * 0.12
        lead_gate = 1.0 if (beat * 2) % 2 < 0.68 else 0.0
        lead = triangle(t * midi(upper_note)) * 0.055 * lead_gate
        sub = triangle(t * midi(root - 12)) * 0.08
        # Sparse deterministic noise ticks supply a NES-style percussion lane.
        tick_phase = (beat * 4) % 1.0
        tick = noise_values[index] * (0.045 * max(0.0, 1.0 - tick_phase * 9.0))
        edge = min(1.0, index / 256.0, (total - 1 - index) / 256.0)
        out.append((bass + lead + sub + tick) * max(0.0, edge))
    return out


def swept_tone(duration: float, start_hz: float, end_hz: float, volume: float, shape: str = "square") -> list[float]:
    total = round(duration * RATE)
    phase = 0.0
    out: list[float] = []
    for index in range(total):
        p = index / max(1, total - 1)
        hz = start_hz * ((end_hz / start_hz) ** p)
        phase += hz / RATE
        envelope = math.sin(math.pi * p) ** 1.2
        voice = square(phase, 0.36) if shape == "square" else triangle(phase)
        out.append(voice * envelope * volume)
    return out


def fire(seed: int = 31415) -> list[float]:
    rng = random.Random(seed)
    total = RATE * 2
    low = 0.0
    out: list[float] = []
    for index in range(total):
        raw = rng.uniform(-1, 1)
        low = low * 0.91 + raw * 0.09
        crackle = rng.uniform(-0.65, 0.65) if rng.random() < 0.0025 else 0.0
        edge = min(1.0, index / 180.0, (total - 1 - index) / 180.0)
        out.append((low * 0.24 + crackle) * edge)
    return out


def villager_death() -> list[float]:
    tone = swept_tone(0.72, 410, 58, 0.25, "triangle")
    rng = random.Random(90210)
    for index in range(len(tone)):
        p = index / len(tone)
        tone[index] += rng.uniform(-1, 1) * 0.13 * ((1 - p) ** 2)
    return tone


def main() -> None:
    tracks = {
        "music_dungeon.wav": (38, 82, (0, 0, 3, 0, -2, 0, 5, 3), (0, 3, 7, 6), 11),
        "music_village_gate.wav": (41, 94, (0, 5, 3, 7, 0, 8, 7, 3), (0, 7, 5, 3), 22),
        "music_bell_tower.wav": (45, 108, (0, 7, 12, 7, 3, 10, 7, 5), (12, 7, 15, 10), 33),
        "music_cathedral.wav": (36, 72, (0, 0, 7, 6, 3, 1, -2, 0), (12, 10, 7, 6), 44),
    }
    for name, args in tracks.items():
        write_wav(name, music_loop(*args))
    write_wav("sfx_fire.wav", fire())
    write_wav("sfx_hit.wav", swept_tone(0.24, 150, 48, 0.42))
    write_wav("sfx_villager_death.wav", villager_death())
    write_wav("sfx_lightning.wav", swept_tone(0.46, 1800, 95, 0.34))
    write_wav("sfx_ui.wav", swept_tone(0.13, 540, 760, 0.22, "triangle"))
    print(f"generated {len(tracks) + 5} original WAV files in {OUT}")


if __name__ == "__main__":
    main()
