"""Author the Pitchforks III fork family as native pixel art + authoritative metadata.

Handoff #18 item 3. Replaces the 8x16 (x3 enlarged) placeholder forks. Every pixel is
placed by rule at runtime size, so tine tips, burn stubs and glow masks are derived from
the same raster -- nobody hand-types a coordinate.

Construction (screen orientation, facing the way the villagers carry them):
- the lean is baked into the art on a clean 1:3 pixel slope (18.43 deg) so the renderer
  never rotates pixel art;
- worn ash-wood shaft 3px, iron ferrule, forged yoke, N parallel iron tines 3px wide with
  2px gaps, tapered tips; light from the upper left (1px glint on the lit edge);
- burn state b removes the b highest tine ids down to a charred 2px stub (newest scar keeps
  one ember pixel); glow mask = only the active tine (id N-1-b), pale electric core.

Outputs into <out_dir>: fork_{N}tine_b{b}.png, fork_{N}tine_b{b}_glow.png for N=1..5,
b=0..N, plus forks.json (schemaVersion 2). Usage: python build-fork-family.py <out_dir>
"""
import json
import math
import sys

import numpy as np
from PIL import Image

W, H = 48, 62
PIVOT = (35.5, 60.5)          # handle bottom (source pixel centre); fork rises up-left from here
SLOPE = math.atan2(1, 3)      # 18.43 deg lean baked into the art
SHAFT_LEN = 36.0
FERRULE_LEN = 3.0
YOKE_LEN = 3.0
TINE_LEN = 15.0
TINE_W, TINE_GAP = 4.0, 2.2   # 4px tine = contour|glint|mid|contour, 2px open gap
CURVE = 1.0
GATHER = 0.62
GRIP_U = 13.0

OUTLINE = (22, 18, 16)
WOOD = [(58, 40, 26), (92, 64, 40), (124, 90, 56), (156, 118, 74)]      # dark -> light
IRON = [(38, 42, 46), (70, 76, 82), (108, 116, 122), (170, 180, 186)]    # dark -> glint
CHAR = [(30, 24, 22), (52, 40, 34)]
EMBER = (255, 146, 42)
GLOW_CORE, GLOW_EDGE = (236, 252, 255), (140, 220, 255)

ux, uy = -math.sin(SLOPE), -math.cos(SLOPE)   # along the fork, pointing to the tips
vx, vy = math.cos(SLOPE), -math.sin(SLOPE)    # across the fork (screen right-ish)


def fork_space(x: float, y: float):
    dx, dy = x - PIVOT[0], y - PIVOT[1]
    return dx * ux + dy * uy, dx * vx + dy * vy


def slots(n: int) -> int:
    # a one-tine fork is a two-prong fork with one prong already snapped off,
    # so it never reads as a spear
    return 2 if n == 1 else n


def tine_centres(n: int):
    n = slots(n)
    span = n * TINE_W + (n - 1) * TINE_GAP
    return [-span / 2 + TINE_W / 2 + i * (TINE_W + TINE_GAP) for i in range(n)]


def classify(n: int):
    """Per pixel: part label and tine id (-1 if not a tine)."""
    part = np.full((H, W), '', dtype=object)
    tine = np.full((H, W), -1, dtype=int)
    shade = np.zeros((H, W))  # -1 lit edge .. +1 shadow edge across the member
    # a one-tine fork keeps a stub crossbar so it never reads as a spear
    head_half = (slots(n) * TINE_W + (slots(n) - 1) * TINE_GAP) / 2
    centres = tine_centres(n)
    y_start, y_end = SHAFT_LEN + FERRULE_LEN, SHAFT_LEN + FERRULE_LEN + YOKE_LEN
    for y in range(H):
        for x in range(W):
            u, v = fork_space(x + 0.5, y + 0.5)
            # forged yoke curves: the outer ends sit lower, like a real hay fork
            bend = CURVE * (min(1.0, abs(v) / head_half) ** 2)
            u += bend
            if 0 <= u - bend < SHAFT_LEN and abs(v) <= 1.5:
                u -= bend
                part[y, x], shade[y, x] = 'wood', v / 1.5
            elif SHAFT_LEN <= u - bend < y_start and abs(v) <= 2.0:
                u -= bend
                part[y, x], shade[y, x] = 'ferrule', v / 2.0
            elif y_start <= u < y_end and abs(v) <= head_half * GATHER + 0.5:
                part[y, x], shade[y, x] = 'yoke', (u - y_start) / YOKE_LEN * 2 - 1
            elif y_end <= u < y_end + TINE_LEN:
                t = (u - y_end) / TINE_LEN
                # tines gather into the yoke and spread to parallel within the first third
                spread = GATHER + (1 - GATHER) * min(1.0, t / 0.33)
                for i, c in enumerate(centres):
                    half = TINE_W / 2 * (1 - max(0.0, t - 0.8) * 3.0)   # taper the last 20%
                    if abs(v - c * spread) <= half:
                        part[y, x], tine[y, x], shade[y, x] = 'tine', i, (v - c * spread) / max(half, 0.5)
    return part, tine, shade


def paint(part, tine, shade, n: int, burn: int):
    img = np.zeros((H, W, 4), dtype=np.uint8)
    removed = set(range(n - burn, n))
    newest = n - burn if burn else None
    y_end = SHAFT_LEN + FERRULE_LEN + YOKE_LEN
    for y in range(H):
        for x in range(W):
            p = part[y, x]
            if not p:
                continue
            s = shade[y, x]
            u, v = fork_space(x + 0.5, y + 0.5)
            ub = u + CURVE * (min(1.0, abs(v) / max(4.5, (n * TINE_W + (n - 1) * TINE_GAP) / 2)) ** 2)
            if p == 'wood':
                idx = 3 if s < -0.55 else 2 if s < 0.1 else 1 if s < 0.7 else 0
                if int(u) % 7 == 3 and idx > 0:
                    idx -= 1  # grain
                c = WOOD[idx]
            elif p in ('ferrule', 'yoke'):
                idx = 3 if s < -0.6 else 2 if s < 0.1 else 1
                c = IRON[idx]
                if p == 'yoke' and burn:
                    # the yoke breaks back to the surviving tines; a leftover arm reads as a hook
                    cs = tine_centres(n)
                    keep = (cs[n - burn - 1] + TINE_W / 2) * GATHER + 0.8 if burn < n else 2.2
                    if v > keep:
                        if v <= keep + 1.6:
                            c = EMBER if abs(u - (SHAFT_LEN + FERRULE_LEN + YOKE_LEN / 2)) < 0.9 else CHAR[0]
                        else:
                            continue
                    elif burn == n:
                        c = CHAR[1]
            else:
                if tine[y, x] in removed:
                    continue  # struck tines are gone; the broken yoke end carries the scar
                    c = CHAR[1] if s < 0 else CHAR[0]
                    if tine[y, x] == newest and abs(s) < 0.5:
                        c = EMBER
                elif n == 1 and tine[y, x] == 1:
                    if ub >= y_end + 2:   # the long-ago snapped prong: cold dark stub, no ember
                        continue
                    c = IRON[0]
                else:
                    c = OUTLINE if abs(s) > 0.62 else IRON[3] if s < -0.1 else IRON[2] if s < 0.3 else IRON[1]
            img[y, x, :3] = c
            img[y, x, 3] = 255
    # 1px dark outline on the outside of the silhouette
    solid = img[..., 3] > 0
    pad = np.pad(solid, 1)
    ring = ~solid & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
    # keep the gaps between tines open: tines carry their own contour
    head_half = (slots(n) * TINE_W + (slots(n) - 1) * TINE_GAP) / 2
    for y, x in zip(*np.nonzero(ring)):
        u, v = fork_space(x + 0.5, y + 0.5)
        if y_end + 1 <= u < y_end + TINE_LEN + 1 and abs(v) < head_half - 0.5:
            ring[y, x] = False
    img[ring, :3] = OUTLINE
    img[ring, 3] = 255
    return img


def tips(tine_map, img, n: int, burn: int):
    out = []
    for i in range(n - burn):  # slot 1 of a one-tine fork is never a target
        ys, xs = np.nonzero((tine_map == i) & (img[..., 3] > 0))
        us = [fork_space(x + 0.5, y + 0.5)[0] for x, y in zip(xs, ys)]
        k = int(np.argmax(us))
        out.append({'id': i, 'tip': {'x': float(xs[k]) + 0.5, 'y': float(ys[k]) + 0.5}})
    return out


def glow(tine_map, n: int, burn: int, base=None):
    g = np.zeros((H, W, 4), dtype=np.uint8)
    if burn >= n:
        return g
    active = n - 1 - burn
    # glow the free length of the tine only; where tines gather into the yoke they share pixels
    free = np.zeros_like(tine_map, dtype=bool)
    y_free = SHAFT_LEN + FERRULE_LEN + YOKE_LEN + TINE_LEN * 0.33
    for y in range(H):
        for x in range(W):
            free[y, x] = fork_space(x + 0.5, y + 0.5)[0] >= y_free
    body = (tine_map == active) & free
    if base is not None:
        body &= base[..., 3] > 0
    g[body, :3] = GLOW_CORE
    g[body, 3] = 255
    pad = np.pad(body, 1)
    halo = ~body & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]) & (tine_map < 0)
    if base is not None:
        halo &= base[..., 3] == 0  # the halo only lights open air, never the yoke or a neighbour
    g[halo, :3] = GLOW_EDGE
    g[halo, 3] = 255
    return g


def main(out_dir: str) -> None:
    families = {}
    for n in range(1, 6):
        part, tine_map, shade = classify(n)
        states = []
        for b in range(n + 1):
            img = paint(part, tine_map, shade, n, b)
            Image.fromarray(img, 'RGBA').save(f'{out_dir}/fork_{n}tine_b{b}.png')
            Image.fromarray(glow(tine_map, n, b, img), 'RGBA').save(f'{out_dir}/fork_{n}tine_b{b}_glow.png')
            remaining = tips(tine_map, img, n, b)
            for t in remaining:  # contract: every emitted tip is an opaque tine pixel
                assert img[int(t['tip']['y']), int(t['tip']['x']), 3] == 255
            states.append({
                'burn': b,
                'image': f'fork_{n}tine_b{b}.png',
                'glow': f'fork_{n}tine_b{b}_glow.png',
                'remaining_tines': remaining,
                'active_tine_id': n - 1 - b if b < n else None,
            })
        families[f'{n}tine'] = {
            'source_size': {'w': W, 'h': H},
            # the villager's hand grips a third of the way up the shaft, not at its end
            'handle_pivot': {'x': round(PIVOT[0] + GRIP_U * ux, 2), 'y': round(PIVOT[1] + GRIP_U * uy, 2)},
            'lean_deg': 0,
            'baked_lean_deg': round(math.degrees(SLOPE), 2),
            'states': states,
        }
    meta = {
        'schemaVersion': 2,
        'units': 'source-pixel-centers; drawn at native size, unrotated, unmirrored (lean baked in)',
        'builder': 'scripts/pitchforks-art-repair/build-fork-family.py',
        'families': families,
    }
    with open(f'{out_dir}/forks.json', 'w') as f:
        json.dump(meta, f, indent=2)
    print('ok', {k: len(v['states']) for k, v in families.items()})


if __name__ == '__main__':
    main(sys.argv[1])
