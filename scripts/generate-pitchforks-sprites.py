#!/usr/bin/env python3
"""
Generate Pitchforks sprite atlas — Frankenstein + villagers + pitchforks.

Output: public/images/pitchforks/

Three view modes:
  - side_l : villager faces RIGHT (walking toward Frankenstein on the right)
  - side_r : villager faces LEFT  (walking toward Frankenstein on the left)
  - fps    : front-on view (villager facing camera, 3 distance scales)

All sprites are pixel art, transparent background, NO antialiasing.
Native pixel size — Pitchforks.tsx will scale 3x in canvas.

Frankenstein     : 32x48 (front) , idle + charging strips, 4 frames each
Villager         : 16x24 (side)  , 4-frame walk + burned variants + ash
Pitchforks       : separate layer, 8x16 native for 1-4; staged 5-tine proof is 12x16
FPS villager     : 16x24 (small/far), 24x32 (mid), 32x48 (close)
FPS Frankenstein : 64x96 (centered, big)
"""
import json, os, math, struct, zlib
from pathlib import Path

# ── PIL is preferred but we fall back to a tiny pure-python PNG writer ──
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# ── Paths ──
ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "public" / "images" / "pitchforks"
OUT.mkdir(parents=True, exist_ok=True)

# ── Palette (RGBA) ──
T  = (0,0,0,0)            # transparent
BK = (12,12,18,255)       # outline black
DG = (40,72,40,255)       # frank skin dark
MG = (74,128,72,255)      # frank skin mid
LG = (112,170,98,255)     # frank skin light
HR = (24,24,28,255)       # hair black
SC = (90,40,40,255)       # scar dark
BO = (130,130,140,255)    # bolt grey
B2 = (180,180,195,255)    # bolt highlight
JK = (38,38,58,255)       # jacket dark
J2 = (60,60,90,255)       # jacket mid
SH = (200,200,210,255)    # shirt
EW = (240,240,240,255)    # eye white
EP = (24,24,24,255)       # eye pupil
EG = (255,235,90,255)     # eye glow (charging)
LI = (170,200,255,255)    # lightning hint
PS = (216,170,120,255)    # peasant skin
P2 = (180,130,90,255)     # peasant skin shadow
PB = (118,72,40,255)      # peasant shirt brown
P3 = (160,100,60,255)     # peasant shirt highlight
PP = (50,50,80,255)       # peasant pants
HT = (70,46,22,255)       # hat
H2 = (110,72,32,255)      # hat band
FW = (130,84,40,255)      # fork wood (handle)
F2 = (90,56,24,255)       # fork wood shadow
FM = (180,180,210,255)    # fork metal
F3 = (220,220,240,255)    # fork metal highlight
FB = (255,170,60,255)     # fork burning ember
AS = (80,80,80,255)       # ash grey
A2 = (50,50,50,255)       # ash dark
EM = (255,90,40,255)      # ember red
SK = (140,200,255,255)    # spark cyan

# ──────────────────────────────────────────────────────────────────────────
#  Tiny canvas wrapper — works with PIL OR our minimal PNG writer
# ──────────────────────────────────────────────────────────────────────────
class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[T]*w for _ in range(h)]
    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h and c is not None:
            self.px[y][x] = c
    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.set(x+i, y+j, c)
    def hline(self, x, y, w, c):
        for i in range(w): self.set(x+i, y, c)
    def vline(self, x, y, h, c):
        for j in range(h): self.set(x, y+j, c)
    def line(self, x0, y0, x1, y1, c):
        # Bresenham
        dx = abs(x1-x0); dy = -abs(y1-y0)
        sx = 1 if x0<x1 else -1; sy = 1 if y0<y1 else -1
        err = dx+dy
        while True:
            self.set(x0,y0,c)
            if x0==x1 and y0==y1: break
            e2 = 2*err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy
    def fill_ellipse(self, cx, cy, rx, ry, c):
        for j in range(-ry, ry+1):
            for i in range(-rx, rx+1):
                if (i*i)/(rx*rx if rx else 1) + (j*j)/(ry*ry if ry else 1) <= 1.0:
                    self.set(cx+i, cy+j, c)
    def blit(self, src, x, y):
        for j in range(src.h):
            for i in range(src.w):
                p = src.px[j][i]
                if p[3] > 0:
                    self.set(x+i, y+j, p)
    def flip_h(self):
        out = Canvas(self.w, self.h)
        for j in range(self.h):
            for i in range(self.w):
                out.px[j][self.w-1-i] = self.px[j][i]
        return out
    def to_pil(self):
        if not HAS_PIL: return None
        img = Image.new("RGBA", (self.w, self.h), (0,0,0,0))
        flat = []
        for row in self.px: flat.extend(row)
        img.putdata(flat)
        return img
    def save(self, path):
        if HAS_PIL:
            self.to_pil().save(path, "PNG", optimize=True)
        else:
            write_png(path, self.w, self.h, self.px)

# minimal pure-python PNG writer (used only if PIL missing)
def write_png(path, w, h, px):
    def chunk(t, d):
        return (struct.pack(">I", len(d)) + t + d +
                struct.pack(">I", zlib.crc32(t+d) & 0xffffffff))
    raw = b""
    for row in px:
        raw += b"\x00"
        for (r,g,b,a) in row: raw += bytes((r,g,b,a))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))

def make_strip(frames):
    fw = frames[0].w; fh = frames[0].h
    out = Canvas(fw*len(frames), fh)
    for i,f in enumerate(frames): out.blit(f, i*fw, 0)
    return out

# ──────────────────────────────────────────────────────────────────────────
#  FRANKENSTEIN — 32x48 front view, 4-frame breathe loop
# ──────────────────────────────────────────────────────────────────────────
def draw_frankenstein(charging=False, breathe=0):
    """
    breathe: 0..3 — vertical 1px shift on torso/head
    charging: True → glowing eyes, sparks at bolts, brighter rod
    """
    c = Canvas(32, 48)
    bob = [0,1,1,0][breathe]   # subtle 1px breath
    cy0 = bob

    # ── Lightning rod sticking out of his head ──
    rod_col = LI if charging else B2
    c.vline(16, 0+cy0, 6, BO)
    c.vline(15, 1+cy0, 4, BO)
    c.set(15, 0+cy0, BK)
    c.set(16, 0+cy0, rod_col)   # ROD TIP — anchor point
    if charging:
        # crackle around tip
        c.set(14, 0+cy0, SK); c.set(17, 0+cy0, SK)
        c.set(16, 1+cy0, EG)

    # ── Hair: flat-top ──
    c.rect(8, 5+cy0, 16, 4, HR)
    c.set(7, 6+cy0, HR); c.set(24, 6+cy0, HR)
    c.set(7, 7+cy0, HR); c.set(24, 7+cy0, HR)
    # hair outline
    c.hline(8, 4+cy0, 16, BK)
    c.set(7, 5+cy0, BK); c.set(24, 5+cy0, BK)

    # ── Face / head block ──
    head_top = 9 + cy0
    c.rect(8, head_top, 16, 11, MG)
    # outline
    c.hline(8, head_top, 16, BK)        # under hair
    c.hline(8, head_top+11, 16, BK)     # chin
    c.vline(7, head_top, 11, BK)
    c.vline(24, head_top, 11, BK)
    # cheek shadow
    c.rect(8, head_top+8, 16, 2, DG)
    # forehead highlight
    c.hline(10, head_top+1, 12, LG)
    # scar (stitch line on forehead)
    c.hline(11, head_top+3, 8, SC)
    for i in range(11,19,2): c.set(i, head_top+2, SC)

    # ── Eyes ──
    eye_y = head_top+5
    eye_col = EG if charging else EW
    c.rect(10, eye_y, 3, 2, eye_col)
    c.rect(19, eye_y, 3, 2, eye_col)
    c.set(11, eye_y, EP); c.set(20, eye_y, EP)   # pupils
    if charging:
        c.set(11, eye_y-1, SK); c.set(20, eye_y-1, SK)

    # ── Mouth: grim flat line ──
    c.hline(12, head_top+8, 8, BK)
    c.set(13, head_top+9, SC); c.set(18, head_top+9, SC)

    # ── Neck ──
    c.rect(11, head_top+12, 10, 3, MG)
    c.hline(11, head_top+12, 10, BK)
    c.vline(10, head_top+12, 3, BK)
    c.vline(21, head_top+12, 3, BK)

    # ── Neck bolts (left + right) — anchor points for sparks ──
    bolt_y = head_top+13
    # LEFT bolt
    c.rect(7, bolt_y, 3, 2, BO)
    c.set(7, bolt_y, BK); c.set(9, bolt_y+1, BK)
    c.set(8, bolt_y, B2)
    # RIGHT bolt
    c.rect(22, bolt_y, 3, 2, BO)
    c.set(24, bolt_y, BK); c.set(22, bolt_y+1, BK)
    c.set(23, bolt_y, B2)
    if charging:
        c.set(6, bolt_y-1, SK); c.set(25, bolt_y-1, SK)
        c.set(8, bolt_y-1, EG); c.set(23, bolt_y-1, EG)

    # ── Jacket / torso ──
    torso_top = head_top+15
    c.rect(6, torso_top, 20, 14, JK)
    # collar
    c.hline(6, torso_top, 20, BK)
    c.vline(5, torso_top, 14, BK)
    c.vline(26, torso_top, 14, BK)
    # lapels (V neck)
    c.set(15, torso_top+1, J2); c.set(16, torso_top+1, J2)
    c.set(14, torso_top+2, J2); c.set(17, torso_top+2, J2)
    c.set(13, torso_top+3, SH); c.set(18, torso_top+3, SH)
    c.set(15, torso_top+3, SH); c.set(16, torso_top+3, SH)
    c.set(14, torso_top+4, SH); c.set(17, torso_top+4, SH)
    # buttons
    c.set(16, torso_top+6, B2)
    c.set(16, torso_top+9, B2)

    # ── Arms (hanging) ──
    c.rect(4, torso_top+2, 2, 11, JK)
    c.vline(3, torso_top+2, 11, BK)
    c.rect(26, torso_top+2, 2, 11, JK)
    c.vline(28, torso_top+2, 11, BK)
    # hands
    c.rect(3, torso_top+13, 3, 2, MG)
    c.rect(26, torso_top+13, 3, 2, MG)
    c.set(2, torso_top+13, BK); c.set(2, torso_top+14, BK)
    c.set(29, torso_top+13, BK); c.set(29, torso_top+14, BK)

    # ── Boots (just stumps — bottom of frame) ──
    boot_y = 44
    if boot_y < 48:
        c.rect(9, boot_y, 5, 4, BK)
        c.rect(18, boot_y, 5, 4, BK)
        c.hline(9, boot_y, 5, J2)
        c.hline(18, boot_y, 5, J2)

    return c

def gen_frankenstein():
    idle    = make_strip([draw_frankenstein(False, i) for i in range(4)])
    charge  = make_strip([draw_frankenstein(True,  i) for i in range(4)])
    idle.save(OUT/"frankenstein_idle.png")
    charge.save(OUT/"frankenstein_charging.png")
    meta = {
        "frame_w": 32, "frame_h": 48, "frames": 4,
        "rod_tip":     {"x": 16, "y": 0},
        "left_bolt":   {"x": 8,  "y": 23},
        "right_bolt":  {"x": 23, "y": 23},
        "head_center": {"x": 16, "y": 14},
    }
    (OUT/"frankenstein.json").write_text(json.dumps(meta, indent=2))

# ──────────────────────────────────────────────────────────────────────────
#  VILLAGER — 16x24 side view, walking RIGHT (toward Frankenstein on right)
# ──────────────────────────────────────────────────────────────────────────
def draw_villager_side(walk_phase=0, burned=0, total_tines=2):
    """
    walk_phase 0..3 — leg cycle
    burned: 0 = full health
    Sprite faces RIGHT (head/eye on right side).
    Forks are NOT drawn here — they're a separate layer.
    """
    c = Canvas(16, 24)

    # ── Hat (pointed peasant cap) ──
    c.rect(5, 1, 6, 1, HT)
    c.rect(4, 2, 8, 1, HT)
    c.rect(3, 3, 10, 1, HT)
    c.hline(3, 4, 10, H2)             # hat band
    c.set(11, 0, HT); c.set(11, 1, HT)  # tip flopped to right
    # outline
    c.hline(3, 2, 10, BK)
    c.set(2, 3, BK); c.set(13, 3, BK)
    c.set(2, 4, BK); c.set(13, 4, BK)

    # ── Head (facing right) ──
    head_y = 5
    c.rect(5, head_y, 7, 4, PS)
    c.hline(5, head_y, 7, BK)
    c.hline(5, head_y+4, 7, BK)
    c.vline(4, head_y, 4, BK)
    c.vline(12, head_y, 4, BK)
    # cheek shadow on left side (back of head)
    c.vline(5, head_y+2, 2, P2)
    # eye (right side of face)
    c.set(10, head_y+1, EW)
    c.set(10, head_y+2, EP)
    # nose
    c.set(11, head_y+2, P2)
    # mouth
    c.set(9, head_y+3, BK); c.set(10, head_y+3, BK)

    # ── Body (shirt) ──
    body_y = head_y+5
    c.rect(4, body_y, 9, 6, PB)
    c.hline(4, body_y, 9, BK)
    c.vline(3, body_y, 6, BK)
    c.vline(13, body_y, 6, BK)
    # shirt highlight (front, right side)
    c.vline(11, body_y+1, 4, P3)
    c.set(10, body_y+1, P3)
    # belt
    c.hline(4, body_y+5, 9, HT)

    # ── Arms (one back, one forward — holding a fork) ──
    # back arm
    c.rect(3, body_y+1, 1, 4, PB)
    # forward arm — extended toward fork (right side)
    c.rect(13, body_y+1, 1, 5, PB)
    c.set(14, body_y+5, PS)   # hand

    # ── Legs (walk cycle) ──
    leg_y = body_y+6
    # 4-frame cycle: phase 0/2 = neutral, 1 = R fwd, 3 = L fwd
    if walk_phase == 1:
        # right leg forward, left back
        c.rect(7, leg_y, 2, 4, PP)
        c.rect(10, leg_y, 2, 4, PP)
        c.set(9, leg_y+3, PP); c.set(12, leg_y+3, PP)
        # boots
        c.hline(7, leg_y+4, 3, BK)
        c.hline(10, leg_y+4, 3, BK)
    elif walk_phase == 3:
        c.rect(6, leg_y, 2, 4, PP)
        c.rect(9, leg_y, 2, 4, PP)
        c.set(5, leg_y+3, PP); c.set(8, leg_y+3, PP)
        c.hline(5, leg_y+4, 3, BK)
        c.hline(8, leg_y+4, 3, BK)
    else:
        c.rect(7, leg_y, 2, 4, PP)
        c.rect(10, leg_y, 2, 4, PP)
        c.hline(7, leg_y+4, 2, BK)
        c.hline(10, leg_y+4, 2, BK)
    # leg outlines
    c.vline(6, leg_y, 4, BK)
    c.vline(12, leg_y, 4, BK)

    # ── Burned overlay ──
    if burned >= 1:
        # smudge soot on the right shoulder
        c.set(11, body_y+1, A2); c.set(12, body_y+1, A2)
        c.set(11, body_y+2, A2)
    if burned >= 2:
        # whole right arm charred
        c.rect(13, body_y+1, 1, 5, A2)
        c.set(14, body_y+5, A2)
        c.set(11, body_y+1, AS); c.set(12, body_y+1, AS)
    if burned >= 3:
        # face soot
        c.set(10, head_y+1, EM); c.set(10, head_y+2, BK)
        c.set(8, body_y+1, A2); c.set(9, body_y+1, A2)

    return c

def draw_villager_ash():
    """A small pile of ash + a charred fork stub."""
    c = Canvas(16, 24)
    base = 19
    # ash pile
    c.rect(4, base+1, 8, 2, A2)
    c.rect(3, base+2, 10, 1, A2)
    c.hline(4, base, 8, AS)
    c.set(5, base, AS); c.set(10, base, AS)
    c.set(6, base-1, AS); c.set(8, base-1, AS); c.set(9, base-1, AS)
    # ember glow
    c.set(7, base+1, EM); c.set(9, base+1, EM)
    c.set(8, base, EM)
    # charred fork stub poking out
    c.vline(11, base-3, 4, F2)
    c.set(11, base-4, BK)
    c.set(10, base-4, FB); c.set(12, base-4, FB)
    return c

def gen_villagers_side(direction="r"):
    """
    direction = "r" → faces RIGHT (default draw)
    direction = "l" → mirror
    """
    suffix = "" if direction == "r" else "_left"

    for tines in [2, 3, 4]:
        # walk strip (4 frames)
        frames = [draw_villager_side(p, 0, tines) for p in range(4)]
        if direction == "l":
            frames = [f.flip_h() for f in frames]
        strip = make_strip(frames)
        strip.save(OUT/f"villager_{tines}tine_walk{suffix}.png")

        # burned states
        for b in range(1, tines):
            f = draw_villager_side(0, b, tines)
            if direction == "l": f = f.flip_h()
            f.save(OUT/f"villager_{tines}tine_burned_{b}{suffix}.png")

        # ash (only one direction needed — same look)
        ash = draw_villager_ash()
        if direction == "l": ash = ash.flip_h()
        ash.save(OUT/f"villager_{tines}tine_ash{suffix}.png")

        # JSON anchors (only write once for default direction)
        if direction == "r":
            # tine anchors are RELATIVE to the villager sprite — they're where
            # the FORK SPRITE attaches. Pitchforks.tsx will draw the fork at
            # fork_base, with tine offsets used by the bolt routing.
            tine_anchors = [
                {"x": 14, "y": 4},
                {"x": 14, "y": 6},
                {"x": 14, "y": 8},
                {"x": 14, "y": 10},
            ][:tines]
            meta = {
                "frame_w": 16, "frame_h": 24, "walk_frames": 4,
                "facing": "right",
                "fork_base":  {"x": 14, "y": 11},   # where fork handle meets hand
                "fork_tip":   {"x": 14, "y": 2},    # opposite end (top of fork)
                "tines": tine_anchors,
            }
            (OUT/f"villager_{tines}tine.json").write_text(json.dumps(meta, indent=2))


# ──────────────────────────────────────────────────────────────────────────
#  PITCHFORKS — separate layer, 8x16 native, drawn over villager
# ──────────────────────────────────────────────────────────────────────────
def _fork_geometry(tines):
    """Return the smallest countable native fork geometry for a tine count."""
    geometries = {
        1: {"width": 8, "handle_x": 3, "crossbar": (2, 3), "tine_xs": [3]},
        2: {"width": 8, "handle_x": 3, "crossbar": (1, 6), "tine_xs": [1, 6]},
        3: {"width": 8, "handle_x": 3, "crossbar": (1, 6), "tine_xs": [1, 3, 6]},
        4: {"width": 8, "handle_x": 3, "crossbar": (1, 6), "tine_xs": [0, 2, 5, 7]},
        # ponytail: 12px is the smallest honest frame with five 1px tines,
        # four 1px gaps, and room for the existing one-pixel glow language.
        # A future integration can widen further only if real-phone proof fails.
        5: {"width": 12, "handle_x": 5, "crossbar": (1, 10), "tine_xs": [1, 3, 5, 7, 9]},
    }
    if tines not in geometries:
        raise ValueError("pitchfork renderer supports 1 through 5 tines")
    return geometries[tines]


def draw_pitchfork(tines=3, burned=0, glow=False):
    """
    The fork hangs vertically. Handle at bottom (attaches to fork_base).
    Tines fan out at the top.
    burned: how many tines have been snapped off (from rightmost first)
    glow: burning-ember tip + brightened shaft (the "target" highlight)

    C3 Q2 (procedural ladder, no AI-sourcing — forks are a small geometric
    object, and burn-ladder frame-to-frame consistency is exactly what
    procedural guarantees and AI generation doesn't; see CW consult-27).
    """
    if burned < 0 or burned > tines:
        raise ValueError("burned tine count must be between zero and total tines")
    geometry = _fork_geometry(tines)
    c = Canvas(geometry["width"], 16)
    handle_x = geometry["handle_x"]

    # Handle (vertical wood pole)
    c.vline(handle_x, 6, 10, FW)
    c.vline(handle_x + 1, 6, 10, FW)
    c.set(handle_x - 1, 7, F2); c.set(handle_x + 2, 7, F2)  # handle outline shadow
    c.vline(handle_x - 1, 8, 7, BK)
    c.vline(handle_x + 2, 8, 7, BK)
    c.hline(handle_x - 1, 15, 4, BK)

    # Crossbar where tines mount
    crossbar_x, crossbar_width = geometry["crossbar"]
    c.hline(crossbar_x, 5, crossbar_width, BK)
    c.hline(crossbar_x, 6, crossbar_width, F2)

    # Tines — drawn from leftmost to rightmost
    # tine x positions for each tine count
    xs = geometry["tine_xs"]
    for i, tx in enumerate(xs):
        is_burned = i >= (tines - burned)  # rightmost burns first
        if is_burned:
            # charred stub: soot cap + dark remnant — 2px, reads as "snapped off"
            # distinctly from a live tine at any burn stage (sharper falloff than
            # the prior single flat pixel)
            c.set(tx, 3, BK)
            c.set(tx, 4, A2)
        else:
            # full tine: 4px shaft with a real highlight->shadow gradient
            # (metal-tine shading) instead of a flat single-color line
            hi = F3 if glow else FM
            lo = FM if glow else F2
            c.set(tx, 1, hi)
            c.set(tx, 2, hi)
            c.set(tx, 3, lo)
            c.set(tx, 4, lo)
            # tip: dedicated fork-ember color when glowing (not the frank
            # eye-glow color — palette-correct per CW's cohesion ask),
            # plain outline otherwise
            c.set(tx, 0, FB if glow else BK)
            if glow:
                # soft ember halo flanking the tip — reads as glowing,
                # not just a brighter solid color
                if tx - 1 >= 0:
                    c.set(tx - 1, 0, EM)
                if tx + 1 < c.w:
                    c.set(tx + 1, 0, EM)
    return c

def gen_pitchforks():
    forks_meta = {}
    for tines in [2, 3, 4]:
        for b in range(0, tines+1):
            f = draw_pitchfork(tines, b, False)
            f.save(OUT/f"fork_{tines}tine_b{b}.png")
            f2 = draw_pitchfork(tines, b, True)
            f2.save(OUT/f"fork_{tines}tine_b{b}_glow.png")
        forks_meta[f"{tines}tine"] = {
            "frame_w": 8, "frame_h": 16,
            "handle_base": {"x": 3, "y": 15},   # attaches at villager.fork_base
            "tine_tips": {
                2: [{"x":1,"y":0},{"x":6,"y":0}],
                3: [{"x":1,"y":0},{"x":3,"y":0},{"x":6,"y":0}],
                4: [{"x":0,"y":0},{"x":2,"y":0},{"x":5,"y":0},{"x":7,"y":0}],
            }[tines],
        }
    (OUT/"forks.json").write_text(json.dumps(forks_meta, indent=2))


def generate_staged_fork_proof(tines, out_dir):
    """Emit a non-production 1/5-tine burn ladder plus future anchor metadata."""
    if tines not in (1, 5):
        raise ValueError("staged fork proof is limited to the missing 1- and 5-tine tiers")
    target_dir = Path(out_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    geometry = _fork_geometry(tines)
    for burned in range(tines + 1):
        draw_pitchfork(tines, burned, False).save(target_dir / f"fork_{tines}tine_b{burned}.png")
        draw_pitchfork(tines, burned, True).save(target_dir / f"fork_{tines}tine_b{burned}_glow.png")
    metadata = {
        "schemaVersion": "1.0.0",
        "status": "STAGING_ONLY_NOT_INTEGRATED",
        "tines": tines,
        "frame_w": geometry["width"],
        "frame_h": 16,
        "handle_base": {"x": geometry["handle_x"], "y": 15},
        "tine_tips": [{"x": x, "y": 0} for x in geometry["tine_xs"]],
        "burnFrameCount": tines - 1,
        "burnLadder": [f"b{burned}" for burned in range(tines + 1)],
    }
    meta_path = target_dir / f"fork_{tines}tine.json"
    meta_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"generated staged {tines}-tine fork proof in {target_dir}")
    return meta_path

# ──────────────────────────────────────────────────────────────────────────
#  FPS VIEW — front-facing villagers + bigger Frankenstein
# ──────────────────────────────────────────────────────────────────────────
def draw_villager_front(scale="mid", walk_phase=0):
    """
    scale: 'far' 16x24, 'mid' 24x32, 'near' 32x48
    Front view — villager facing camera, holding fork up overhead.
    """
    sizes = {"far": (16,24), "mid": (24,32), "near": (32,48)}
    w, h = sizes[scale]
    c = Canvas(w, h)
    s = {"far": 1, "mid": 1.5, "near": 2}[scale]

    cx = w // 2

    # Hat (front view — wider, dome)
    hat_w = max(6, int(8*s))
    hat_h = max(2, int(3*s))
    c.rect(cx-hat_w//2, 1, hat_w, hat_h, HT)
    c.hline(cx-hat_w//2-1, hat_h+1, hat_w+2, H2)
    # outline
    c.rect(cx-hat_w//2-1, 0, 1, hat_h+1, BK)
    c.rect(cx+hat_w//2, 0, 1, hat_h+1, BK)
    c.hline(cx-hat_w//2, 0, hat_w, BK)

    # Face
    head_y = hat_h + 2
    head_w = max(5, int(7*s))
    head_h = max(4, int(5*s))
    c.rect(cx-head_w//2, head_y, head_w, head_h, PS)
    c.rect(cx-head_w//2, head_y, head_w, 1, BK)
    c.rect(cx-head_w//2, head_y+head_h, head_w, 1, BK)
    c.vline(cx-head_w//2-1, head_y, head_h, BK)
    c.vline(cx+head_w//2, head_y, head_h, BK)
    # two eyes
    c.set(cx-2, head_y+head_h//2, EW); c.set(cx-2, head_y+head_h//2+1, EP)
    c.set(cx+1, head_y+head_h//2, EW); c.set(cx+1, head_y+head_h//2+1, EP)
    # mouth
    c.hline(cx-1, head_y+head_h-1, 3, BK)

    # Body
    body_y = head_y + head_h + 2
    body_w = max(7, int(10*s))
    body_h = max(6, int(9*s))
    c.rect(cx-body_w//2, body_y, body_w, body_h, PB)
    c.rect(cx-body_w//2, body_y, body_w, 1, BK)
    c.vline(cx-body_w//2-1, body_y, body_h, BK)
    c.vline(cx+body_w//2, body_y, body_h, BK)
    # belt
    c.hline(cx-body_w//2, body_y+body_h-1, body_w, HT)

    # Both arms raised holding fork ABOVE the head
    arm_x_l = cx - body_w//2
    arm_x_r = cx + body_w//2 - 1
    for y in range(0, body_y - 1):
        c.set(arm_x_l, y+head_y, PB)
        c.set(arm_x_r, y+head_y, PB)
    c.set(arm_x_l, head_y, PS)  # hand
    c.set(arm_x_r, head_y, PS)

    # Legs
    leg_y = body_y + body_h
    leg_h = max(3, int(4*s))
    leg_w = max(2, int(2*s))
    if walk_phase % 2 == 0:
        c.rect(cx-leg_w-1, leg_y, leg_w, leg_h, PP)
        c.rect(cx+1, leg_y, leg_w, leg_h, PP)
    else:
        c.rect(cx-leg_w-1, leg_y, leg_w, leg_h-1, PP)
        c.rect(cx+1, leg_y, leg_w, leg_h, PP)
    c.hline(cx-leg_w-1, leg_y+leg_h, leg_w, BK)
    c.hline(cx+1, leg_y+leg_h, leg_w, BK)

    return c

def draw_frankenstein_front_big():
    """64x96 — Frankenstein, FPS view, much bigger."""
    c = Canvas(64, 96)

    # Lightning rod — taller and more central
    for y in range(0, 14):
        c.set(32, y, BO)
        c.set(33, y, BO)
    c.set(32, 0, B2); c.set(33, 0, B2)

    # Hair / flat top
    c.rect(16, 14, 32, 8, HR)
    c.hline(16, 13, 32, BK)
    c.vline(15, 14, 8, BK); c.vline(48, 14, 8, BK)

    # Face — big block
    c.rect(16, 22, 32, 24, MG)
    c.hline(16, 22, 32, BK); c.hline(16, 46, 32, BK)
    c.vline(15, 22, 24, BK); c.vline(48, 22, 24, BK)
    # forehead highlight
    c.rect(18, 24, 28, 2, LG)
    # scar
    c.hline(20, 28, 22, SC)
    for x in range(20, 42, 3):
        c.set(x, 27, SC); c.set(x, 29, SC)
    # eyes
    c.rect(20, 32, 6, 4, EW); c.rect(38, 32, 6, 4, EW)
    c.rect(22, 32, 3, 4, EP); c.rect(40, 32, 3, 4, EP)
    # nose shadow
    c.vline(31, 36, 4, DG); c.vline(32, 36, 4, DG)
    # mouth — big grim line + stitches
    c.hline(22, 42, 20, BK)
    for x in range(24, 41, 3): c.set(x, 41, SC); c.set(x, 43, SC)

    # Neck + bolts
    c.rect(24, 47, 16, 6, MG)
    c.hline(24, 47, 16, BK)
    c.rect(12, 49, 4, 4, BO)
    c.rect(48, 49, 4, 4, BO)
    c.rect(12, 49, 4, 1, BK); c.rect(48, 49, 4, 1, BK)
    c.rect(12, 53, 4, 1, BK); c.rect(48, 53, 4, 1, BK)
    c.set(13, 50, B2); c.set(49, 50, B2)

    # Jacket / torso
    c.rect(8, 53, 48, 36, JK)
    c.hline(8, 53, 48, BK)
    c.vline(7, 53, 36, BK); c.vline(56, 53, 36, BK)
    # collar V
    for i in range(8):
        c.set(28+i, 54+i, J2); c.set(35-i, 54+i, J2)
    c.rect(28, 60, 8, 6, SH)
    # buttons
    c.set(32, 70, B2); c.set(32, 76, B2); c.set(32, 82, B2)

    # Arms
    c.rect(4, 56, 4, 28, JK); c.vline(3, 56, 28, BK)
    c.rect(56, 56, 4, 28, JK); c.vline(60, 56, 28, BK)
    # hands
    c.rect(3, 84, 5, 4, MG); c.rect(56, 84, 5, 4, MG)

    # Boots peeking
    c.rect(16, 89, 12, 6, BK); c.rect(36, 89, 12, 6, BK)
    return c

def gen_fps():
    # Front Frankenstein
    big = draw_frankenstein_front_big()
    big.save(OUT/"frankenstein_fps.png")
    (OUT/"frankenstein_fps.json").write_text(json.dumps({
        "frame_w": 64, "frame_h": 96, "frames": 1,
        "rod_tip":     {"x": 32, "y": 0},
        "left_bolt":   {"x": 14, "y": 51},
        "right_bolt":  {"x": 50, "y": 51},
        "head_center": {"x": 32, "y": 34},
    }, indent=2))

    # Front villagers — far / mid / near
    for scale in ["far", "mid", "near"]:
        frames = [draw_villager_front(scale, p) for p in range(4)]
        strip = make_strip(frames)
        strip.save(OUT/f"villager_fps_{scale}.png")
    (OUT/"villager_fps.json").write_text(json.dumps({
        "scales": {
            "far":  {"frame_w": 16, "frame_h": 24, "frames": 4, "z": 0.3},
            "mid":  {"frame_w": 24, "frame_h": 32, "frames": 4, "z": 0.6},
            "near": {"frame_w": 32, "frame_h": 48, "frames": 4, "z": 1.0},
        },
        "fork_overhead": True,
        "note": "FPS villagers hold fork overhead. Bolt routes from rod_tip down to fork tine top.",
    }, indent=2))

# ──────────────────────────────────────────────────────────────────────────
#  MASTER ATLAS METADATA
# ──────────────────────────────────────────────────────────────────────────
def write_atlas_index():
    idx = {
        "generated_by": "scripts/generate-pitchforks-sprites.py",
        "scale_in_canvas": 3,
        "views": {
            "side": {
                "description": "Default arcade view. Frankenstein center-back, villagers walk in from sides.",
                "frankenstein": {
                    "idle":     "frankenstein_idle.png",
                    "charging": "frankenstein_charging.png",
                    "meta":     "frankenstein.json",
                },
                "villagers": {
                    "facing_right": "villager_<n>tine_walk.png",
                    "facing_left":  "villager_<n>tine_walk_left.png",
                    "burned":       "villager_<n>tine_burned_<k>.png",
                    "ash":          "villager_<n>tine_ash.png",
                    "meta":         "villager_<n>tine.json",
                },
                "forks": {
                    "normal": "fork_<n>tine_b<k>.png",
                    "glow":   "fork_<n>tine_b<k>_glow.png",
                    "meta":   "forks.json",
                },
            },
            "fps": {
                "description": "Camera-toward-Frankenstein view. Villagers approach from depth.",
                "frankenstein": "frankenstein_fps.png",
                "frankenstein_meta": "frankenstein_fps.json",
                "villagers": "villager_fps_<scale>.png",
                "villagers_meta": "villager_fps.json",
            },
        },
        "notes_for_artist": [
            "All sprites are AI-generated placeholders. Recognizable shapes — polish the pixel art later.",
            "Native pixel size only (no pre-scaling). Canvas scales x3 at draw time.",
            "Forks are SEPARATE layer — change tine count / burn state without touching the villager.",
            "fork_base in villager.json = where the fork handle attaches (handle_base in forks.json).",
            "rod_tip in frankenstein.json = the bolt routing pivot. Every lightning bolt bounces here.",
        ],
    }
    (OUT/"atlas.json").write_text(json.dumps(idx, indent=2))

# ──────────────────────────────────────────────────────────────────────────
#  ASSEMBLER MODE (C2, Karpathy row 22) — ingest an externally-generated
#  4-frame walk-cycle source image (AI-generated, chroma-keyed magenta bg)
#  and deterministically assemble it into the villager_2tine_walk.png slot,
#  replacing the procedural draw_villager_side() output for THIS variant only.
#
#  Why deterministic, not another model call: a model asked to hit the exact
#  16x24 pixel grid reintroduces the fringe/blur defect from the row-6
#  gpt-image-2 test. Here the MODEL emits a larger, readable source image;
#  this function (the SCRIPT) emits the sprite — chroma-key -> per-frame
#  alpha bbox crop -> LANCZOS downscale into the frozen 16x24 contract ->
#  re-strip. Scope: 2-tine walk-cycle ONLY (VANGUARD-SPEC-C2-villager-batch1.md)
#  — burned/ash states + 3/4-tine variants are untouched (still procedural).
#  fork_base/fork_tip/tines anchors in villager_2tine.json are left UNCHANGED;
#  visually verify the fork still lands near the grip after assembling.
# ──────────────────────────────────────────────────────────────────────────
def assemble_villager_2tine_from_source(source_path, out_dir=None):
    # CW review (cw-consult-16) caught: LANCZOS violates the rail's own "pixel art =
    # nearest-neighbor ONLY" hard blocker AND produces a very high opaque-color count
    # (measured 160 unique colors / 1536px + 428px of partial alpha on the first pass —
    # the definition of the anti-aliased "blur" the row-6 gpt-image-2 test already
    # failed on). Switched to NEAREST + a two-stage chroma-key (pre-crop generous key,
    # POST-resize magenta-ish cleanup) so resampling never reintroduces fringe that a
    # single pre-resize key pass would miss once pixels get resampled together.
    if not HAS_PIL:
        raise RuntimeError("assembler mode requires Pillow (PIL) — not available in this environment")
    import colorsys
    src = Image.open(source_path).convert("RGBA")
    w, h = src.size
    n_frames = 4
    frame_w_src = w // n_frames
    FRAME_W, FRAME_H = 16, 24
    MAGENTA = (255, 0, 255)
    THRESH = 60

    def chroma_key(im, thresh):
        # RGB-distance pass — catches pixels close to pure magenta.
        p = im.load()
        iw, ih = im.size
        for y in range(ih):
            for x in range(iw):
                r, g, b, a = p[x, y]
                if abs(r - MAGENTA[0]) < thresh and abs(g - MAGENTA[1]) < thresh and abs(b - MAGENTA[2]) < thresh:
                    p[x, y] = (r, g, b, 0)

    def chroma_key_hue(im, hue_lo=0.80, hue_hi=0.92, min_sat=0.35):
        # Hue-band pass — catches magenta-FAMILY fringe (anti-aliased blends toward
        # magenta) that RGB-distance can miss once resampling shifts exact values.
        # Magenta hue ~0.833 (300deg/360deg) in colorsys's 0-1 space.
        p = im.load()
        iw, ih = im.size
        for y in range(ih):
            for x in range(iw):
                r, g, b, a = p[x, y]
                if a == 0:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if hue_lo <= hh <= hue_hi and ss >= min_sat:
                    p[x, y] = (r, g, b, 0)

    chroma_key(src, THRESH)

    out_frames = []
    for i in range(n_frames):
        frame = src.crop((i * frame_w_src, 0, (i + 1) * frame_w_src, h))
        bbox = frame.getbbox()
        if bbox is None:
            raise RuntimeError(f"assembler: frame {i} fully transparent after chroma-key — aborting, source unusable")
        cropped = frame.crop(bbox)
        cw, ch = cropped.size
        # Fit height to 22px (2px floor+headroom margin), cap width at frame width — preserve aspect.
        scale = min(22 / ch, FRAME_W / cw)
        new_w = max(1, round(cw * scale))
        new_h = max(1, round(ch * scale))
        resized = cropped.resize((new_w, new_h), Image.NEAREST)
        # Second cleanup pass AFTER resize, by HUE not RGB-distance: NEAREST can still
        # select a source pixel that was semi-magenta-tinted near an edge (didn't cross
        # the RGB THRESH pre-resize but reads as visible fringe post-resize at native
        # sprite scale). Hue-band catches the whole magenta FAMILY regardless of exact
        # brightness/saturation, which a fixed RGB threshold missed (measured: 4 residual
        # magenta-ish opaque pixels visible at native scale before this pass was added).
        chroma_key(resized, 90)
        chroma_key_hue(resized)
        canvas = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        # Bias +2px right of dead-center: villager_2tine.json's fork_base (grip anchor,
        # where the separately-composited fork attaches) sits at x=14, near the right
        # edge of the 16-wide frame — nudging the character right tightens the gap
        # between the drawn fist and that anchor without touching the frozen JSON.
        paste_x = min(FRAME_W - new_w, (FRAME_W - new_w) // 2 + 2)
        paste_y = FRAME_H - new_h - 1  # 1px floor margin, matches procedural sprites' ground contact
        canvas.paste(resized, (paste_x, paste_y), resized)
        out_frames.append(canvas)

    strip = Image.new("RGBA", (FRAME_W * n_frames, FRAME_H), (0, 0, 0, 0))
    for i, f in enumerate(out_frames):
        strip.paste(f, (i * FRAME_W, 0), f)

    target_dir = Path(out_dir) if out_dir else OUT
    right_path = target_dir / "villager_2tine_walk.png"
    left_path = target_dir / "villager_2tine_walk_left.png"
    strip.save(right_path, "PNG", optimize=True)
    strip.transpose(Image.FLIP_LEFT_RIGHT).save(left_path, "PNG", optimize=True)
    print(f"assembled {right_path.name} + {left_path.name} from {source_path} ({n_frames} frames, {FRAME_W}x{FRAME_H} each)")
    return right_path

def assemble_villager_2tine_damage_from_source(source_path, state, out_dir=None):
    """Assemble one AI-sourced static 2-tine damage pose into both directions."""
    if not HAS_PIL:
        raise RuntimeError("assembler mode requires Pillow (PIL) — not available in this environment")
    import colorsys
    state_names = {
        "burned_1": "villager_2tine_burned_1",
        "burned_2": "villager_2tine_burned_2",
        "ash": "villager_2tine_ash",
    }
    if state not in state_names:
        raise ValueError(f"unknown 2-tine damage state: {state!r}")

    src = Image.open(source_path).convert("RGBA")
    FRAME_W, FRAME_H = 16, 24
    MAGENTA = (255, 0, 255)
    THRESH = 60

    def chroma_key(im, thresh):
        p = im.load()
        iw, ih = im.size
        for y in range(ih):
            for x in range(iw):
                r, g, b, a = p[x, y]
                if abs(r - MAGENTA[0]) < thresh and abs(g - MAGENTA[1]) < thresh and abs(b - MAGENTA[2]) < thresh:
                    p[x, y] = (r, g, b, 0)

    def chroma_key_hue(im, hue_lo=0.80, hue_hi=0.92, min_sat=0.35):
        p = im.load()
        iw, ih = im.size
        for y in range(ih):
            for x in range(iw):
                r, g, b, a = p[x, y]
                if a == 0:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if hue_lo <= hh <= hue_hi and ss >= min_sat:
                    p[x, y] = (r, g, b, 0)

    # Match the proven single-pose Frankenstein assembler exactly: key first,
    # crop to the alpha bbox, NEAREST-resize, then clean RGB + hue fringe again.
    chroma_key(src, THRESH)
    bbox = src.getbbox()
    if bbox is None:
        raise RuntimeError("assembler: source fully transparent after chroma-key — aborting, source unusable")
    cropped = src.crop(bbox)
    cw, ch = cropped.size
    scale = min((FRAME_H - 2) / ch, FRAME_W / cw)
    new_w = max(1, round(cw * scale))
    new_h = max(1, round(ch * scale))
    resized = cropped.resize((new_w, new_h), Image.NEAREST)
    chroma_key(resized, 90)
    chroma_key_hue(resized)

    frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    paste_x = (FRAME_W - new_w) // 2
    paste_y = FRAME_H - new_h - 1
    frame.paste(resized, (paste_x, paste_y), resized)

    target_dir = Path(out_dir) if out_dir else OUT
    stem = state_names[state]
    right_path = target_dir / f"{stem}.png"
    left_path = target_dir / f"{stem}_left.png"
    frame.save(right_path, "PNG", optimize=True)
    frame.transpose(Image.FLIP_LEFT_RIGHT).save(left_path, "PNG", optimize=True)
    print(f"assembled {right_path.name} + {left_path.name} from {source_path} ({FRAME_W}x{FRAME_H})")
    return right_path

def assemble_frankenstein_idle_from_source(source_path, out_dir=None):
    # C5 proof-of-contract (single AI-sourced idle pose, matching the C2 villager
    # discipline: one asset proves the contract before any bulk commitment).
    # Unlike the villager, this is ONE static pose, not 4 independently-generated
    # walk frames — CW's "procedural guarantees frame-to-frame consistency, AI
    # doesn't" principle applies here too: the 4-frame strip's subtle breathing
    # motion is synthesized procedurally (a few px of vertical bob), not AI-drawn,
    # so there is zero risk of the character drifting between frames.
    # `frankenstein_charging.png` is intentionally left untouched this pass —
    # idle-only, same scope discipline as C2's "walk-cycle ONLY, burned/ash later."
    if not HAS_PIL:
        raise RuntimeError("assembler mode requires Pillow (PIL) — not available in this environment")
    import colorsys
    src = Image.open(source_path).convert("RGBA")
    FRAME_W, FRAME_H = 32, 48
    N_FRAMES = 4
    MAGENTA = (255, 0, 255)
    THRESH = 60

    def chroma_key(im, thresh):
        p = im.load()
        iw, ih = im.size
        for y in range(ih):
            for x in range(iw):
                r, g, b, a = p[x, y]
                if abs(r - MAGENTA[0]) < thresh and abs(g - MAGENTA[1]) < thresh and abs(b - MAGENTA[2]) < thresh:
                    p[x, y] = (r, g, b, 0)

    def chroma_key_hue(im, hue_lo=0.80, hue_hi=0.92, min_sat=0.35):
        p = im.load()
        iw, ih = im.size
        for y in range(ih):
            for x in range(iw):
                r, g, b, a = p[x, y]
                if a == 0:
                    continue
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if hue_lo <= hh <= hue_hi and ss >= min_sat:
                    p[x, y] = (r, g, b, 0)

    chroma_key(src, THRESH)
    bbox = src.getbbox()
    if bbox is None:
        raise RuntimeError("assembler: source fully transparent after chroma-key — aborting, source unusable")
    cropped = src.crop(bbox)
    cw, ch = cropped.size
    # Fit to frame with a 1px floor margin + slight headroom, preserve aspect.
    scale = min((FRAME_H - 2) / ch, FRAME_W / cw)
    new_w = max(1, round(cw * scale))
    new_h = max(1, round(ch * scale))
    resized = cropped.resize((new_w, new_h), Image.NEAREST)
    chroma_key(resized, 90)
    chroma_key_hue(resized)

    base_x = (FRAME_W - new_w) // 2
    base_y = FRAME_H - new_h - 1  # 1px floor margin, matches villager ground contact

    # Procedural breathing bob (0, -1, 0, +1px) — the ONLY thing that varies
    # frame-to-frame; the character pixels themselves are identical every frame.
    bob = [0, -1, 0, 1]
    strip = Image.new("RGBA", (FRAME_W * N_FRAMES, FRAME_H), (0, 0, 0, 0))
    for i, dy in enumerate(bob):
        frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        y = max(0, min(FRAME_H - new_h, base_y + dy))
        frame.paste(resized, (base_x, y), resized)
        strip.paste(frame, (i * FRAME_W, 0), frame)

    target_dir = Path(out_dir) if out_dir else OUT
    idle_path = target_dir / "frankenstein_idle.png"
    strip.save(idle_path, "PNG", optimize=True)
    print(f"assembled {idle_path.name} from {source_path} ({N_FRAMES} frames, {FRAME_W}x{FRAME_H} each, procedural breathing bob)")
    return idle_path

# ──────────────────────────────────────────────────────────────────────────
#  MAIN
# ──────────────────────────────────────────────────────────────────────────
def _is_magenta_family(rgb):
    """C11c flat-key rejection predicate; shared by keying and final validation."""
    import colorsys
    r, g, b = rgb
    near_key = (r - 255) ** 2 + g ** 2 + (b - 255) ** 2 < 90 ** 2
    hue, saturation, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return near_key or (0.78 <= hue <= 0.95 and saturation >= 0.50)


def _extract_opaque_palette(paths):
    palette = set()
    for path in paths:
        image = Image.open(path).convert("RGBA")
        for r, g, b, a in image.getdata():
            if a and not _is_magenta_family((r, g, b)):
                palette.add((r, g, b))
    if not palette:
        raise RuntimeError("palette lock has no opaque colors")
    return tuple(sorted(palette))


def _opaque_components(image):
    """Return opaque connected components as (area, bbox), largest first."""
    width, height = image.size
    opaque = image.getchannel("A").load()
    visited = bytearray(width * height)
    components = []

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index] or opaque[start_x, start_y] == 0:
                continue
            visited[start_index] = 1
            stack = [(start_x, start_y)]
            area = 0
            min_x = max_x = start_x
            min_y = max_y = start_y
            while stack:
                x, y = stack.pop()
                area += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    index = ny * width + nx
                    if visited[index] or opaque[nx, ny] == 0:
                        continue
                    visited[index] = 1
                    stack.append((nx, ny))
            components.append((area, (min_x, min_y, max_x + 1, max_y + 1)))

    return sorted(components, key=lambda component: component[0], reverse=True)


def _dominant_opaque_bbox(image):
    """Return the largest connected opaque subject, ignoring neighboring-cell bleed."""
    components = _opaque_components(image)
    return components[0][1] if components else None


def _key_fit_palette_lock(cell, frame_size, palette, right_bias=0):
    """Key one generated cell, NEAREST-fit it, then optionally lock its opaque RGB palette."""
    frame_w, frame_h = frame_size
    cell = cell.convert("RGBA")
    # Verification fixtures are already-native transparent atlas cells. Returning
    # them unchanged proves the sheet split/strip/mirror path cannot drift shipped pixels.
    if cell.size == frame_size and any(a == 0 for _, _, _, a in cell.getdata()):
        return cell
    pixels = cell.load()
    for y in range(cell.height):
        for x in range(cell.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            pixels[x, y] = (r, g, b, 0 if _is_magenta_family((r, g, b)) else 255)

    bbox = _dominant_opaque_bbox(cell)
    if bbox is None:
        raise RuntimeError("roster assembler cell is empty after chroma-key")
    cropped = cell.crop(bbox)
    scale = min((frame_h - 2) / cropped.height, frame_w / cropped.width)
    new_w = max(1, round(cropped.width * scale))
    new_h = max(1, round(cropped.height * scale))
    resized = cropped.resize((new_w, new_h), Image.NEAREST)
    frame = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    paste_x = min(frame_w - new_w, max(0, (frame_w - new_w) // 2 + right_bias))
    paste_y = frame_h - new_h - 1
    frame.paste(resized, (paste_x, paste_y), resized)

    if palette is None:
        return frame

    locked = frame.load()
    for y in range(frame_h):
        for x in range(frame_w):
            r, g, b, a = locked[x, y]
            if a == 0:
                locked[x, y] = (0, 0, 0, 0)
                continue
            nearest = min(
                palette,
                key=lambda color: (
                    (color[0] - r) ** 2 + (color[1] - g) ** 2 + (color[2] - b) ** 2
                ),
            )
            locked[x, y] = (*nearest, 255)
    return frame


def normalize_lifecycle_source_sheet(source_path, tines, output_path):
    """Re-grid model output without redrawing it; fail if the expected actors are absent."""
    if not HAS_PIL:
        raise RuntimeError("source normalization requires Pillow (PIL)")
    if tines not in (1, 5):
        raise ValueError("source normalization is limited to staged 1/5-tine proofs")
    columns = 6 if tines == 5 else 5
    target_columns_by_row = (
        [0, 1, 2, 3],
        [0, 1, 2, 3, 5] if tines == 5 else [0, 1],
    )
    source = Image.open(source_path).convert("RGBA")
    keyed = source.copy()
    pixels = keyed.load()
    for y in range(keyed.height):
        for x in range(keyed.width):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (r, g, b, 0 if a == 0 or _is_magenta_family((r, g, b)) else 255)

    components = _opaque_components(keyed)
    if not components:
        raise RuntimeError("source normalizer found no opaque actors")
    largest = components[0][0]
    body_components = [
        component for component in components
        if component[0] >= largest * 0.08
        and component[1][3] - component[1][1] >= keyed.height * 0.12
    ]
    actors_by_row = [[], []]
    for area, bbox in body_components:
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        actors_by_row[0 if center_y < keyed.height / 2 else 1].append((area, bbox, center_x))

    normalized = Image.new("RGBA", keyed.size, (255, 0, 255, 255))
    for row, target_columns in enumerate(target_columns_by_row):
        expected = len(target_columns)
        actors = actors_by_row[row]
        if len(actors) < expected:
            raise RuntimeError(f"source normalizer found {len(actors)} actors in row {row + 1}, expected {expected}")
        actors = sorted(sorted(actors, reverse=True)[:expected], key=lambda actor: actor[2])
        centers = [actor[2] for actor in actors]
        row_top = round(row * keyed.height / 2)
        row_bottom = round((row + 1) * keyed.height / 2)
        for index, (_, _, center_x) in enumerate(actors):
            left = 0 if index == 0 else round((centers[index - 1] + center_x) / 2)
            right = keyed.width if index == expected - 1 else round((center_x + centers[index + 1]) / 2)
            region = keyed.crop((left, row_top, right, row_bottom))
            bbox = region.getbbox()
            if bbox is None:
                raise RuntimeError(f"source normalizer actor {index + 1} in row {row + 1} is empty")
            actor = region.crop(bbox)
            target_column = target_columns[index]
            cell_left = round(target_column * keyed.width / columns)
            cell_right = round((target_column + 1) * keyed.width / columns)
            cell_width = cell_right - cell_left
            if actor.width > cell_width * 0.9 or actor.height > (row_bottom - row_top) * 0.94:
                scale = min(cell_width * 0.9 / actor.width, (row_bottom - row_top) * 0.94 / actor.height)
                actor = actor.resize((max(1, round(actor.width * scale)), max(1, round(actor.height * scale))), Image.NEAREST)
            paste_x = cell_left + (cell_width - actor.width) // 2
            paste_y = row_bottom - actor.height - max(2, round(keyed.height * 0.01))
            normalized.paste(actor, (paste_x, paste_y), actor)

    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(target, "PNG", optimize=True)
    print(f"normalized {tines}-tine source sheet into strict {columns}x2 grid: {target}")
    return target


def assemble_villager_lifecycle_sheet(source_path, tines, out_dir=None):
    """Assemble a 5x2 (1-4 tine) or 6x2 (5 tine) lifecycle source sheet."""
    if not HAS_PIL:
        raise RuntimeError("assembler mode requires Pillow (PIL) - not available in this environment")
    if tines not in (1, 2, 3, 4, 5):
        raise ValueError("roster lifecycle assembler supports 1 through 5 tines")
    if tines in (1, 5) and out_dir is None:
        raise ValueError("1/5-tine proofs require an explicit staging directory")

    src = Image.open(source_path).convert("RGBA")
    target_dir = Path(out_dir) if out_dir else OUT
    target_dir.mkdir(parents=True, exist_ok=True)
    grid_columns = 6 if tines == 5 else 5
    palette = _extract_opaque_palette([
        OUT / "villager_2tine_walk.png",
        OUT / "villager_2tine_burned_1.png",
        OUT / "villager_2tine_ash.png",
    ])

    def source_cell(column, row):
        # Built-in image generation may return odd dimensions; rounded proportional
        # boundaries retain the strict layout without resampling the source sheet.
        left = round(column * src.width / grid_columns)
        right = round((column + 1) * src.width / grid_columns)
        top = round(row * src.height / 2)
        bottom = round((row + 1) * src.height / 2)
        return src.crop((left, top, right, bottom))

    walk_frames = [
        _key_fit_palette_lock(source_cell(i, 0), (16, 24), palette, right_bias=2)
        for i in range(4)
    ]
    walk_strip = Image.new("RGBA", (64, 24), (0, 0, 0, 0))
    for i, frame in enumerate(walk_frames):
        walk_strip.paste(frame, (i * 16, 0), frame)

    walk_path = target_dir / f"villager_{tines}tine_walk.png"
    walk_left_path = target_dir / f"villager_{tines}tine_walk_left.png"
    walk_strip.save(walk_path, "PNG", optimize=True)
    walk_strip.transpose(Image.FLIP_LEFT_RIGHT).save(walk_left_path, "PNG", optimize=True)

    # Runtime loads k < totalTines and transitions the final strike straight to ash.
    for burn_index in range(1, tines):
        frame = _key_fit_palette_lock(source_cell(burn_index - 1, 1), (16, 24), palette)
        right_path = target_dir / f"villager_{tines}tine_burned_{burn_index}.png"
        left_path = target_dir / f"villager_{tines}tine_burned_{burn_index}_left.png"
        frame.save(right_path, "PNG", optimize=True)
        frame.transpose(Image.FLIP_LEFT_RIGHT).save(left_path, "PNG", optimize=True)

    ash = _key_fit_palette_lock(source_cell(tines, 1), (16, 24), palette)
    ash_path = target_dir / f"villager_{tines}tine_ash.png"
    ash_left_path = target_dir / f"villager_{tines}tine_ash_left.png"
    ash.save(ash_path, "PNG", optimize=True)
    ash.transpose(Image.FLIP_LEFT_RIGHT).save(ash_left_path, "PNG", optimize=True)
    if tines in (1, 5):
        staging_meta = {
            "schemaVersion": "1.0.0",
            "status": "STAGING_ONLY_NOT_INTEGRATED",
            "tines": tines,
            "frame_w": 16,
            "frame_h": 24,
            "walk_frames": 4,
            "facing": "right",
            "sourceGridColumns": grid_columns,
            "burnFrameCount": tines - 1,
            "ashOnStrike": tines,
            "fork_base": {"x": 14, "y": 11},
        }
        (target_dir / f"villager_{tines}tine.json").write_text(json.dumps(staging_meta, indent=2) + "\n")
    print(f"assembled complete {tines}-tine lifecycle from {source_path} into {target_dir}")
    return walk_path


def verify_roster_assembler():
    """Round-trip the shipped 2-tine lifecycle through the generic C11c contract."""
    import tempfile
    source_paths = {
        "walk": OUT / "villager_2tine_walk.png",
        "walk_left": OUT / "villager_2tine_walk_left.png",
        "burned_1": OUT / "villager_2tine_burned_1.png",
        "burned_1_left": OUT / "villager_2tine_burned_1_left.png",
        "ash": OUT / "villager_2tine_ash.png",
        "ash_left": OUT / "villager_2tine_ash_left.png",
    }
    sheet = Image.new("RGBA", (80, 48), (0, 0, 0, 0))
    walk = Image.open(source_paths["walk"]).convert("RGBA")
    for i in range(4):
        frame = walk.crop((i * 16, 0, (i + 1) * 16, 24))
        sheet.paste(frame, (i * 16, 0), frame)
    for i, state in ((0, "burned_1"), (2, "ash")):
        frame = Image.open(source_paths[state]).convert("RGBA")
        sheet.paste(frame, (i * 16, 24), frame)

    with tempfile.TemporaryDirectory(prefix="pitchforks-roster-") as tmp:
        tmp_dir = Path(tmp)
        fixture = tmp_dir / "2tine-fixture.png"
        sheet.save(fixture, "PNG")
        assemble_villager_lifecycle_sheet(fixture, 2, tmp_dir)
        emitted = {
            "walk": tmp_dir / "villager_2tine_walk.png",
            "walk_left": tmp_dir / "villager_2tine_walk_left.png",
            "burned_1": tmp_dir / "villager_2tine_burned_1.png",
            "burned_1_left": tmp_dir / "villager_2tine_burned_1_left.png",
            "ash": tmp_dir / "villager_2tine_ash.png",
            "ash_left": tmp_dir / "villager_2tine_ash_left.png",
        }
        mismatches = []
        for key, expected_path in source_paths.items():
            expected = Image.open(expected_path).convert("RGBA")
            actual = Image.open(emitted[key]).convert("RGBA")
            if expected.size != actual.size or expected.tobytes() != actual.tobytes():
                mismatches.append(key)
        if mismatches:
            raise RuntimeError(f"roster assembler round-trip drift: {', '.join(mismatches)}")
    print("roster assembler fixture PASS: 6/6 runtime-used 2-tine outputs pixel-identical")

    bleed_fixture = Image.new("RGBA", (100, 100), (255, 0, 255, 255))
    bleed_pixels = bleed_fixture.load()
    for y in range(20, 80):
        for x in range(20, 40):
            bleed_pixels[x, y] = (90, 70, 50, 255)
    for y in range(45, 50):
        for x in range(92, 97):
            bleed_pixels[x, y] = (90, 70, 50, 255)
    fitted = _key_fit_palette_lock(bleed_fixture, (16, 24), None)
    if fitted.getbbox()[3] - fitted.getbbox()[1] != 22:
        raise RuntimeError("dominant-subject fixture shrank because neighboring-cell bleed entered the fit")
    print("roster assembler bleed fixture PASS: dominant subject retains 22px fitted height")


def verify_roster_outputs():
    """Validate every runtime-used C11c output against the frozen native contract."""
    palette = set(_extract_opaque_palette([
        OUT / "villager_2tine_walk.png",
        OUT / "villager_2tine_burned_1.png",
        OUT / "villager_2tine_ash.png",
    ]))
    checked = 0
    for tines in (2, 3, 4):
        stems = [f"villager_{tines}tine_walk"]
        stems += [f"villager_{tines}tine_burned_{index}" for index in range(1, tines)]
        stems += [f"villager_{tines}tine_ash"]
        for stem in stems:
            right = Image.open(OUT / f"{stem}.png").convert("RGBA")
            left = Image.open(OUT / f"{stem}_left.png").convert("RGBA")
            expected_size = (64, 24) if stem.endswith("_walk") else (16, 24)
            if right.size != expected_size or left.size != expected_size:
                raise RuntimeError(f"{stem}: expected {expected_size}, got {right.size}/{left.size}")
            if left.tobytes() != right.transpose(Image.FLIP_LEFT_RIGHT).tobytes():
                raise RuntimeError(f"{stem}: left output is not an exact mirror")
            for image in (right, left):
                for r, g, b, a in image.getdata():
                    if a not in (0, 255):
                        raise RuntimeError(f"{stem}: partial alpha survived")
                    if a and (_is_magenta_family((r, g, b)) or (r, g, b) not in palette):
                        raise RuntimeError(f"{stem}: opaque pixel escaped key/palette lock")
            if "_ash" not in stem:
                bbox = right.getbbox()
                if bbox is None or bbox[3] - bbox[1] < 18:
                    raise RuntimeError(f"{stem}: subject collapsed below 18px native height")
            checked += 2
    print(f"roster output verification PASS: {checked}/24 runtime assets")


def verify_staged_roster_outputs(out_dir, tines):
    """Validate staged 1/5-tine outputs without touching the production atlas."""
    if tines not in (1, 5):
        raise ValueError("staged roster verification is limited to 1 and 5 tines")
    target_dir = Path(out_dir)
    palette = set(_extract_opaque_palette([
        OUT / "villager_2tine_walk.png",
        OUT / "villager_2tine_burned_1.png",
        OUT / "villager_2tine_ash.png",
    ]))
    stems = [f"villager_{tines}tine_walk"]
    stems += [f"villager_{tines}tine_burned_{index}" for index in range(1, tines)]
    stems += [f"villager_{tines}tine_ash"]
    for stem in stems:
        right = Image.open(target_dir / f"{stem}.png").convert("RGBA")
        left = Image.open(target_dir / f"{stem}_left.png").convert("RGBA")
        expected_size = (64, 24) if stem.endswith("_walk") else (16, 24)
        if right.size != expected_size or left.size != expected_size:
            raise RuntimeError(f"{stem}: expected {expected_size}, got {right.size}/{left.size}")
        if left.tobytes() != right.transpose(Image.FLIP_LEFT_RIGHT).tobytes():
            raise RuntimeError(f"{stem}: left output is not an exact mirror")
        for image in (right, left):
            for r, g, b, a in image.getdata():
                if a not in (0, 255):
                    raise RuntimeError(f"{stem}: partial alpha survived")
                if a and (_is_magenta_family((r, g, b)) or (r, g, b) not in palette):
                    raise RuntimeError(f"{stem}: opaque pixel escaped key/palette lock")
        if "_ash" not in stem:
            bbox = right.getbbox()
            if bbox is None or bbox[3] - bbox[1] < 18:
                raise RuntimeError(f"{stem}: subject collapsed below 18px native height")

    meta = json.loads((target_dir / f"villager_{tines}tine.json").read_text())
    if meta.get("burnFrameCount") != tines - 1 or meta.get("ashOnStrike") != tines:
        raise RuntimeError(f"villager_{tines}tine metadata violates burned=N-1 lifecycle law")
    print(f"staged {tines}-tine roster verification PASS: {len(stems) * 2} assets")


def verify_p4_1_5_proof_tooling():
    """Prove the new staging-only extremes while preserving every shipped pixel."""
    import hashlib
    import tempfile

    def production_digest():
        digest = hashlib.sha256()
        for path in sorted(OUT.glob("*")):
            if path.is_file():
                digest.update(path.name.encode("utf-8"))
                digest.update(path.read_bytes())
        return digest.hexdigest()

    before = production_digest()
    verify_roster_assembler()

    # The generalized renderer must remain pixel-identical for the shipped fork tiers.
    for tines in (2, 3, 4):
        for burned in range(tines + 1):
            for glow in (False, True):
                suffix = "_glow" if glow else ""
                expected = Image.open(OUT / f"fork_{tines}tine_b{burned}{suffix}.png").convert("RGBA")
                actual = draw_pitchfork(tines, burned, glow).to_pil()
                if expected.size != actual.size or expected.tobytes() != actual.tobytes():
                    raise RuntimeError(f"shipped fork drift: {tines}tine b{burned}{suffix}")

    def make_source(path, tines):
        columns = 6 if tines == 5 else 5
        cell_w, cell_h = 80, 128
        sheet = Image.new("RGBA", (columns * cell_w, 2 * cell_h), (255, 0, 255, 255))

        def subject(column, row, width=30, height=92, color=(90, 70, 50, 255)):
            block = Image.new("RGBA", (width, height), color)
            x = column * cell_w + (cell_w - width) // 2
            y = row * cell_h + cell_h - height - 8
            sheet.paste(block, (x, y), block)

        for column in range(4):
            subject(column, 0, width=28 + column % 2, color=(90 + column * 4, 70, 50, 255))
        if tines == 1:
            subject(0, 1, width=30, height=82, color=(65, 60, 48, 255))  # unused strike-flash reference
            subject(1, 1, width=34, height=44, color=(50, 50, 50, 255))  # ash
        else:
            for column in range(4):
                subject(column, 1, width=30, height=86 - column * 5, color=(72 - column * 4, 58, 44, 255))
            subject(5, 1, width=38, height=42, color=(50, 50, 50, 255))  # ash
        sheet.save(path, "PNG")

    with tempfile.TemporaryDirectory(prefix="pitchforks-p4-extremes-") as tmp:
        tmp_dir = Path(tmp)
        for tines in (1, 5):
            source = tmp_dir / f"source-{tines}.png"
            normalized = tmp_dir / f"source-{tines}-normalized.png"
            output = tmp_dir / f"out-{tines}"
            make_source(source, tines)
            normalize_lifecycle_source_sheet(source, tines, normalized)
            assemble_villager_lifecycle_sheet(normalized, tines, output)
            verify_staged_roster_outputs(output, tines)
            fork_dir = output / "forks"
            meta_path = generate_staged_fork_proof(tines, fork_dir)
            meta = json.loads(meta_path.read_text())
            if meta["burnFrameCount"] != tines - 1 or len(meta["tine_tips"]) != tines:
                raise RuntimeError(f"staged {tines}-tine fork metadata violates lifecycle/anchor contract")
            expected_size = (12, 16) if tines == 5 else (8, 16)
            fork = Image.open(fork_dir / f"fork_{tines}tine_b0.png").convert("RGBA")
            if fork.size != expected_size:
                raise RuntimeError(f"staged {tines}-tine fork has wrong native size: {fork.size}")
            if tines == 5:
                row = [fork.getpixel((x, 1))[3] > 0 for x in range(fork.width)]
                runs = sum(opaque and (index == 0 or not row[index - 1]) for index, opaque in enumerate(row))
                if runs != 5:
                    raise RuntimeError(f"5-tine fork row has {runs} countable tines, expected 5")
                glow = Image.open(fork_dir / "fork_5tine_b0_glow.png").convert("RGBA")
                if not any(glow.getpixel((x, 0))[3] for x in range(glow.width)):
                    raise RuntimeError("5-tine glow proof has no visible tip halo")

    after = production_digest()
    if before != after:
        raise RuntimeError("staging-only proof mutated public/images/pitchforks")
    print("P4 1/5-tine proof tooling PASS: staged extremes valid; shipped atlas byte-identical")


def main():
    print(f"Generating into {OUT}")
    gen_frankenstein()
    gen_villagers_side("r")
    gen_villagers_side("l")
    gen_pitchforks()
    gen_fps()
    write_atlas_index()
    files = sorted(OUT.glob("*"))
    print(f"  wrote {len(files)} files:")
    for f in files: print(f"    {f.name}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) == 2 and sys.argv[1] == "--verify-roster-assembler":
        verify_roster_assembler()
    elif len(sys.argv) == 2 and sys.argv[1] == "--verify-roster-outputs":
        verify_roster_outputs()
    elif len(sys.argv) == 2 and sys.argv[1] == "--verify-p4-1-5-proof-tooling":
        verify_p4_1_5_proof_tooling()
    elif len(sys.argv) == 4 and sys.argv[1] == "--verify-staged-roster":
        verify_staged_roster_outputs(sys.argv[3], int(sys.argv[2]))
    elif len(sys.argv) == 5 and sys.argv[1] == "--normalize-lifecycle-source":
        normalize_lifecycle_source_sheet(sys.argv[3], int(sys.argv[2]), sys.argv[4])
    elif len(sys.argv) >= 3 and sys.argv[1] == "--assemble-2tine":
        assemble_villager_2tine_from_source(sys.argv[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == "--assemble-2tine-damage":
        assemble_villager_2tine_damage_from_source(sys.argv[3], sys.argv[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == "--assemble-roster-lifecycle":
        assemble_villager_lifecycle_sheet(sys.argv[3], int(sys.argv[2]), sys.argv[4] if len(sys.argv) >= 5 else None)
    elif len(sys.argv) == 4 and sys.argv[1] == "--generate-staged-fork-proof":
        generate_staged_fork_proof(int(sys.argv[2]), sys.argv[3])
    else:
        main()
