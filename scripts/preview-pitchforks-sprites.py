#!/usr/bin/env python3
"""Build a single composite preview PNG of every Pitchforks sprite, scaled 6x."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC  = ROOT / "public" / "images" / "pitchforks"
OUT  = ROOT / "data" / "pitchforks-sprite-preview.png"
OUT.parent.mkdir(parents=True, exist_ok=True)

SCALE = 6
PAD   = 16
BG    = (24,24,36,255)
LBL   = (200,200,220,255)

def load_scaled(name):
    p = SRC / name
    if not p.exists(): return None
    img = Image.open(p).convert("RGBA")
    return img.resize((img.width*SCALE, img.height*SCALE), Image.NEAREST)

# Group: (label, [filenames])
groups = [
    ("FRANKENSTEIN — side view", [
        "frankenstein_idle.png",
        "frankenstein_charging.png",
    ]),
    ("FRANKENSTEIN — fps view (64x96)", [
        "frankenstein_fps.png",
    ]),
    ("VILLAGER 2-TINE — right + left walks, burned, ash", [
        "villager_2tine_walk.png",
        "villager_2tine_walk_left.png",
        "villager_2tine_burned_1.png",
        "villager_2tine_ash.png",
    ]),
    ("VILLAGER 3-TINE", [
        "villager_3tine_walk.png",
        "villager_3tine_walk_left.png",
        "villager_3tine_burned_1.png",
        "villager_3tine_burned_2.png",
        "villager_3tine_ash.png",
    ]),
    ("VILLAGER 4-TINE", [
        "villager_4tine_walk.png",
        "villager_4tine_walk_left.png",
        "villager_4tine_burned_1.png",
        "villager_4tine_burned_2.png",
        "villager_4tine_burned_3.png",
        "villager_4tine_ash.png",
    ]),
    ("FORK 2-TINE — full → burned, normal + glow", [
        "fork_2tine_b0.png", "fork_2tine_b0_glow.png",
        "fork_2tine_b1.png", "fork_2tine_b2.png",
    ]),
    ("FORK 3-TINE", [
        "fork_3tine_b0.png", "fork_3tine_b0_glow.png",
        "fork_3tine_b1.png", "fork_3tine_b2.png", "fork_3tine_b3.png",
    ]),
    ("FORK 4-TINE", [
        "fork_4tine_b0.png", "fork_4tine_b0_glow.png",
        "fork_4tine_b1.png", "fork_4tine_b2.png", "fork_4tine_b3.png", "fork_4tine_b4.png",
    ]),
    ("FPS VILLAGER — far, mid, near", [
        "villager_fps_far.png",
        "villager_fps_mid.png",
        "villager_fps_near.png",
    ]),
]

# Layout
LABEL_H = 28
ROW_H = 0
rows = []
for label, names in groups:
    imgs = [load_scaled(n) for n in names]
    imgs = [(n,i) for n,i in zip(names, imgs) if i is not None]
    if not imgs: continue
    h = max(i.height for _,i in imgs)
    w = sum(i.width for _,i in imgs) + PAD*(len(imgs)+1)
    rows.append((label, imgs, w, h + LABEL_H + PAD))

W = max(r[2] for r in rows) + PAD*2
H = sum(r[3] for r in rows) + PAD*2

canvas = Image.new("RGBA", (W, H), BG)
draw = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype("arial.ttf", 18)
    small = ImageFont.truetype("arial.ttf", 12)
except:
    font = ImageFont.load_default()
    small = font

y = PAD
for label, imgs, rw, rh in rows:
    draw.text((PAD, y), label, fill=LBL, font=font)
    y += LABEL_H
    x = PAD
    row_max_h = max(i.height for _,i in imgs)
    for name, im in imgs:
        # baseline-bottom align inside row
        canvas.paste(im, (x, y + (row_max_h - im.height)), im)
        draw.text((x, y + row_max_h + 2), name.replace(".png",""), fill=(140,140,160,255), font=small)
        x += im.width + PAD
    y += row_max_h + PAD + 12

canvas.save(OUT)
print(f"Wrote {OUT}  ({W}x{H})")
