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
Pitchforks       : separate layer, 8x16 native, 2/3/4 tine + burned states
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
def draw_pitchfork(tines=3, burned=0, glow=False):
    """
    The fork hangs vertically. Handle at bottom (attaches to fork_base).
    Tines fan out at the top.
    burned: how many tines have been snapped off (from rightmost first)
    glow: brighten the metal (used as a "target" highlight)
    """
    c = Canvas(8, 16)
    metal = F3 if glow else FM

    # Handle (vertical wood pole)
    c.vline(3, 6, 10, FW)
    c.vline(4, 6, 10, FW)
    c.set(2, 7, F2); c.set(5, 7, F2)        # handle outline shadow
    c.vline(2, 8, 7, BK)
    c.vline(5, 8, 7, BK)
    c.hline(2, 15, 4, BK)

    # Crossbar where tines mount
    c.hline(1, 5, 6, BK)
    c.hline(1, 6, 6, F2)

    # Tines — drawn from leftmost to rightmost
    # tine x positions for each tine count
    layouts = {
        2: [1, 6],
        3: [1, 3, 6],
        4: [0, 2, 5, 7],
    }
    xs = layouts[tines]
    for i, tx in enumerate(xs):
        is_burned = i >= (tines - burned)  # rightmost burns first
        if is_burned:
            # stub: 1 px charred remnant
            c.set(tx, 4, A2)
        else:
            # full tine: 4 pixels tall, with point at top
            c.vline(tx, 1, 4, metal)
            c.set(tx, 0, BK)            # tip outline
            if glow:
                c.set(tx, 0, EG)        # glowing tip
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
#  MAIN
# ──────────────────────────────────────────────────────────────────────────
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
    main()
