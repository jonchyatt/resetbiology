# Pitchforks III audio license and provenance

All files in this directory were generated locally by
`scripts/generate-pitchforks-audio.py`. They contain no recordings, samples,
melodies, or stems from third parties.

License: CC0 1.0 Universal (public-domain dedication)
https://creativecommons.org/publicdomain/zero/1.0/

Generated assets:

- `music_dungeon.wav` — original 8-bit dungeon ostinato
- `music_village_gate.wav` — original 8-bit village march
- `music_bell_tower.wav` — original 8-bit bell-tower pulse
- `music_cathedral.wav` — original 8-bit cathedral dirge
- `sfx_fire.wav` — deterministic filtered-noise fire bed
- `sfx_hit.wav` — synthesized impact sweep
- `sfx_villager_death.wav` — synthesized descending death burst
- `sfx_lightning.wav` — synthesized lightning sweep
- `sfx_ui.wav` — synthesized UI confirmation chirp

Reproducibility: run `python scripts/generate-pitchforks-audio.py` from the
repository root. The generator uses only Python's standard library and fixed
random seeds, so the output is deterministic.
