#!/usr/bin/env python3
"""One-pass Pitchforks III art build from one locked NES-horror style reference.

The pass regenerates the gameplay roster through the canonical sprite generator,
then palette-locks every remaining Pitchforks PNG to the same 16-colour ramp.
It also rebuilds the four rain-cistern/roof pieces as carved masonry rather than
a flat beam. No interpolation or antialiasing is used.
"""
from __future__ import annotations

import json
import runpy
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "images" / "pitchforks"
CORE_GENERATOR = ROOT / "scripts" / "generate-pitchforks-sprites.py"

# Single source of truth: 16 colours shared by characters, props, architecture,
# effects, and plates. The first row of style_reference.png is this exact ramp.
PALETTE = [
    (7, 8, 13),       # void
    (18, 19, 27),     # outline
    (35, 37, 48),     # iron shadow
    (59, 61, 70),     # stone
    (92, 91, 88),     # stone light
    (150, 143, 125),  # moonlit stone
    (50, 39, 31),     # wood shadow
    (105, 66, 37),    # wood
    (162, 101, 52),   # warm wood/fire shadow
    (221, 166, 66),   # fire
    (245, 218, 116),  # fire core
    (43, 69, 48),     # monster shadow
    (75, 119, 67),    # monster green
    (118, 159, 88),   # monster light
    (74, 112, 137),   # storm blue
    (169, 222, 224),  # lightning/water
]
WORLD_TINTS = {
    "dungeon": (0, 0, 0),
    "village-gate": (0, 0, 0),
    "bell-tower": (0, 0, 0),
    "cathedral": (0, 0, 0),
}
GUTTER_SPECS = {
    "dungeon": ("rain_gutter", 398, 296),
    "village-gate": ("rain_gutter_village-gate", 450, 244),
    "bell-tower": ("rain_gutter_bell-tower", 398, 296),
    "cathedral": ("rain_gutter_cathedral", 398, 296),
}


def palette_image() -> Image.Image:
    pal = Image.new("P", (1, 1))
    flat = [channel for color in PALETTE for channel in color]
    # Pillow considers all 256 palette slots during nearest-colour lookup. Fill
    # unused slots with the first authored colour rather than implicit black,
    # which would silently add a seventeenth colour to dark sprites.
    filler = list(PALETTE[0]) * ((768 - len(flat)) // 3)
    pal.putpalette(flat + filler)
    return pal


def locked_colour(color: tuple[int, int, int], tint: tuple[int, int, int] = (0, 0, 0)) -> tuple[int, int, int]:
    return (
        max(0, min(255, color[0] + tint[0])),
        max(0, min(255, color[1] + tint[1])),
        max(0, min(255, color[2] + tint[2])),
    )


def hard_alpha(value: int) -> int:
    return 255 if value >= 96 else 0


def palette_lock(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    # Every authored source is re-rastered into visible pixel clusters. Plates
    # keep 2x2 scene detail; character poses collapse to 3x3 clusters; props use
    # 2x2. Native 16x24 villagers already sit at the target pixel density.
    if image.width >= 500 and image.height >= 300:
        block = 2
    elif image.width >= 96 or image.height >= 96:
        block = 3
    elif image.width >= 32 or image.height >= 32:
        block = 2
    else:
        block = 1
    if block > 1:
        small = rgb.resize((max(1, image.width // block), max(1, image.height // block)), Image.Resampling.NEAREST)
        rgb = small.resize(image.size, Image.Resampling.NEAREST)
        alpha = alpha.resize((max(1, image.width // block), max(1, image.height // block)), Image.Resampling.NEAREST).resize(image.size, Image.Resampling.NEAREST)
    quantized = rgb.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGBA")
    quantized.putalpha(alpha.point(hard_alpha))
    quantized.save(path, optimize=True)


def build_style_reference() -> None:
    image = Image.new("RGBA", (256, 128), PALETTE[0] + (255,))
    draw = ImageDraw.Draw(image)
    for index, color in enumerate(PALETTE):
        x = (index % 8) * 32
        y = (index // 8) * 16
        draw.rectangle((x, y, x + 31, y + 15), fill=color + (255,))
    # Shared silhouette language: 2px outline, squared heads, planted feet,
    # carved masonry, and cyan lightning. This is the reference consumed by
    # the pass itself and kept beside the shipped atlas for future additions.
    outline, green, light, wood, fire, cyan = PALETTE[1], PALETTE[12], PALETTE[13], PALETTE[7], PALETTE[9], PALETTE[15]
    draw.rectangle((12, 48, 58, 112), fill=outline + (255,))
    draw.rectangle((18, 54, 52, 78), fill=green + (255,))
    draw.rectangle((22, 58, 31, 63), fill=light + (255,))
    draw.rectangle((39, 58, 48, 63), fill=light + (255,))
    draw.rectangle((17, 82, 53, 104), fill=(35, 37, 48, 255))
    draw.rectangle((78, 55, 112, 108), fill=outline + (255,))
    draw.rectangle((84, 62, 106, 78), fill=(162, 101, 52, 255))
    draw.rectangle((84, 82, 106, 99), fill=wood + (255,))
    draw.rectangle((82, 108, 92, 112), fill=outline + (255,))
    draw.rectangle((100, 108, 110, 112), fill=outline + (255,))
    for x in (142, 150, 158, 166):
        draw.rectangle((x, 52, x + 2, 74), fill=light + (255,))
    draw.rectangle((140, 72, 170, 78), fill=outline + (255,))
    draw.rectangle((154, 78, 158, 114), fill=wood + (255,))
    draw.line((190, 52, 207, 69, 198, 80, 218, 96), fill=cyan + (255,), width=3)
    draw.rectangle((184, 104, 238, 112), fill=fire + (255,))
    image.save(OUT / "style_reference.png", optimize=True)


def build_gutter(world: str, filename: str, width: int, draw_x: int) -> None:
    height = 66
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    tint = WORLD_TINTS[world]
    outline = locked_colour(PALETTE[1], tint)
    dark = locked_colour(PALETTE[2], tint)
    mid = locked_colour(PALETTE[3], tint)
    light = locked_colour(PALETTE[4], tint)
    moon = locked_colour(PALETTE[5], tint)
    # Stepped cornice and irregular underside remove the pasted-on rectangle.
    draw.rectangle((5, 5, width - 6, 10), fill=outline + (255,))
    draw.rectangle((1, 9, width - 2, 15), fill=mid + (255,))
    draw.rectangle((8, 15, width - 9, 43), fill=dark + (255,))
    draw.line((8, 15, width - 9, 15), fill=light + (255,), width=2)
    # Two offset ashlar courses share the same chunky 4-6-colour material.
    for row, y in enumerate((17, 29)):
        offset = 0 if row == 0 else 17
        for x in range(10 - offset, width - 8, 38):
            x0, x1 = max(9, x), min(width - 10, x + 34)
            draw.rectangle((x0, y, x1, y + 9), fill=(mid if (x // 38 + row) % 2 == 0 else dark) + (255,))
            draw.line((x0, y, x1, y), fill=light + (255,), width=1)
            draw.line((x1, y, x1, y + 9), fill=outline + (255,), width=1)
    # Open channel: true transparency lets live water sit inside the stone.
    channel_x0, channel_x1, channel_y0, channel_y1 = 20, width - 20, 21, 34
    draw.rectangle((channel_x0, channel_y0, channel_x1 - 1, channel_y1 - 1), fill=(0, 0, 0, 0))
    draw.line((channel_x0, channel_y0, channel_x1 - 1, channel_y0), fill=outline + (255,), width=2)
    # Three corbels taper into the wall, visually carrying the roof weight.
    centers = (18, width // 2, width - 18)
    for center in centers:
        draw.polygon(((center - 11, 42), (center + 11, 42), (center + 7, 55), (center + 3, 63), (center - 3, 63), (center - 7, 55)), fill=mid + (255,))
        draw.line((center - 10, 42, center + 10, 42), fill=moon + (255,), width=1)
        draw.line((center + 7, 44, center + 3, 61), fill=outline + (255,), width=2)
    image.save(OUT / f"{filename}.png", optimize=True)
    meta = {
        "world": world,
        "drawX": draw_x,
        "drawY": 28,
        "torchUnderlight": world == "dungeon",
        "width": width,
        "height": height,
        "channel": {"x0": channel_x0, "x1": channel_x1, "y0": channel_y0, "y1": channel_y1},
        "corbelCentersX": list(centers),
        "source": "public/images/pitchforks/style_reference.png",
        "builder": "scripts/generate-pitchforks-unified-art.py",
    }
    (OUT / f"{filename}.json").write_text(json.dumps(meta, indent=2) + "\n")


def main() -> None:
    # Rebuild every villager tier from the same body rig. Keep the authored
    # Frankenstein/fork dimensions and anchor metadata intact; those runtime
    # contracts are palette-locked below rather than replaced by older atlas
    # geometry from the legacy generator's full-build entry point.
    generator = runpy.run_path(str(CORE_GENERATOR))
    generator["gen_villagers_side"]("r")
    generator["gen_villagers_side"]("l")
    build_style_reference()
    excluded = {"preview.png", "style_reference.png"}
    for path in sorted(OUT.glob("*.png")):
        if path.name not in excluded:
            palette_lock(path)
    for world, (filename, width, draw_x) in GUTTER_SPECS.items():
        build_gutter(world, filename, width, draw_x)
    manifest = {
        "styleReference": "style_reference.png",
        "generator": "scripts/generate-pitchforks-unified-art.py",
        "palette": ["#%02x%02x%02x" % color for color in PALETTE],
        "rules": ["nearest-neighbour only", "hard alpha", "shared 16-colour NES-horror ramp", "forks remain separate runtime layers"],
        "pngCount": len([path for path in OUT.glob("*.png") if path.name != "preview.png"]),
    }
    (OUT / "style_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
