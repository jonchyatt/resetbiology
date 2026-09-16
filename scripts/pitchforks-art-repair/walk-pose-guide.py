"""Render an 8-frame, left-facing walk-cycle pose guide for image generation.

AI image models do not reliably invent a correct walk from a text description
(they repeat one leg or flip facing). This draws the standard contact / down /
passing / up key poses from explicit joint angles on the exact 4x2 cell grid the
sprite builder slices, colour-coding the near leg (light gray) and far leg (dark gray) so
alternation is unambiguous. The model is asked to paint the villager onto it.

Usage: python walk-pose-guide.py <out.png>
"""
import math
import sys

from PIL import Image, ImageDraw

CELL_W, CELL_H, SCALE = 48, 72, 8
COLS, ROWS = 4, 2
HIP_Y, THIGH, SHIN, FOOT = 40, 15, 15, 5
# per-leg phase k: (thigh deg forward of vertical, knee bend deg)
LEG_PHASES = [(25, 0), (15, 15), (0, 5), (-15, 5), (-25, 20), (-10, 45), (10, 60), (25, 25)]
PELVIS_BOB = [1, 2, 0, -1, 1, 2, 0, -1]


def point(origin, angle_deg, length):
    # facing left: "forward" is -x
    a = math.radians(angle_deg)
    return origin[0] - math.sin(a) * length, origin[1] + math.cos(a) * length


def draw_leg(draw, hip, phase, colour):
    thigh, knee = LEG_PHASES[phase]
    knee_pt = point(hip, thigh, THIGH)
    ankle = point(knee_pt, thigh - knee, SHIN)
    toe = (ankle[0] - FOOT, ankle[1])
    for a, b in ((hip, knee_pt), (knee_pt, ankle), (ankle, toe)):
        draw.line([(a[0] * SCALE, a[1] * SCALE), (b[0] * SCALE, b[1] * SCALE)], fill=colour, width=4 * SCALE)


def main(out: str) -> None:
    img = Image.new('RGB', (CELL_W * COLS * SCALE, CELL_H * ROWS * SCALE), (255, 0, 255))
    draw = ImageDraw.Draw(img)
    for frame in range(8):
        ox, oy = (frame % COLS) * CELL_W, (frame // COLS) * CELL_H
        bob = PELVIS_BOB[frame] * 0.6
        hip = (ox + 24, oy + HIP_Y + bob)
        near_thigh = LEG_PHASES[frame][0]
        draw_leg(draw, hip, (frame + 4) % 8, (58, 58, 62))  # far leg first, behind (dark gray)
        # torso + head
        top = oy + 12 + bob
        draw.rectangle([((ox + 18) * SCALE, top * SCALE), ((ox + 30) * SCALE, (hip[1] + 1) * SCALE)], fill=(138, 138, 142))
        draw.ellipse([((ox + 17) * SCALE, (oy + 2 + bob) * SCALE), ((ox + 29) * SCALE, (oy + 13 + bob) * SCALE)], fill=(190, 190, 190))
        draw_leg(draw, hip, frame, (168, 168, 172))  # near leg in front (light gray)
        # back arm swings opposite the near leg; front fist fixed at chest
        shoulder = (ox + 26, top + 3)
        hand = point(shoulder, -near_thigh * 0.7, 16)
        draw.line([(shoulder[0] * SCALE, shoulder[1] * SCALE), (hand[0] * SCALE, hand[1] * SCALE)], fill=(120, 120, 124), width=3 * SCALE)
        front_shoulder = (ox + 21, top + 3)
        fist = (ox + 12, top + 12)
        draw.line([(front_shoulder[0] * SCALE, front_shoulder[1] * SCALE), (fist[0] * SCALE, fist[1] * SCALE)], fill=(205, 205, 208), width=3 * SCALE)
        draw.ellipse([((fist[0] - 2.5) * SCALE, (fist[1] - 2.5) * SCALE), ((fist[0] + 2.5) * SCALE, (fist[1] + 2.5) * SCALE)], fill=(205, 205, 208))
    img.save(out)


if __name__ == '__main__':
    main(sys.argv[1])
