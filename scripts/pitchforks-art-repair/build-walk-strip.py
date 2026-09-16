"""Turn a 4x2 generated walk sheet into a runtime 8-frame villager walk strip.

- slices the 4x2 grid, chroma-keys magenta, keeps each cell's largest figure
- one shared scale for all eight frames (median figure height -> TARGET_H)
- feet on one baseline; body anchored by the torso centre so it never drifts
- palette-locked to the villager's shipped walk art so identity/colour match
- writes <out>.png (8 x 48x72) and a 4x preview GIF for motion review

Usage: python build-walk-strip.py <sheet.jpg> <palette_ref.png> <out_basename> [target_h]
"""
import sys

import numpy as np
from PIL import Image

CELL_W, CELL_H, FRAMES = 48, 72, 8
BASELINE = 70  # last foot row inside the 72px cell (matches shipped strips)


def key_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    magenta = (r > 150) & (b > 150) & (g < 120) & (np.abs(r - b) < 90)
    # JPEG fringe where the figure outline blends into the key: purple-tinted
    fringe = (r - g > 55) & (b - g > 55)
    return ~(magenta | fringe)


def largest_component(mask: np.ndarray) -> np.ndarray:
    from collections import deque
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    best = None
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        comp, q = [], deque([(y0, x0)])
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if best is None or len(comp) > len(best):
            best = comp
    out = np.zeros_like(mask, dtype=bool)
    if best:
        ys, xs = zip(*best)
        out[list(ys), list(xs)] = True
    return out


def main(sheet_path: str, palette_ref: str, out_base: str, target_h: int = 66) -> None:
    sheet = Image.open(sheet_path).convert('RGB')
    W, H = sheet.size
    cw, ch = W // 4, H // 2
    cells = []
    for f in range(FRAMES):
        box = ((f % 4) * cw, (f // 4) * ch, (f % 4 + 1) * cw, (f // 4 + 1) * ch)
        rgb = np.array(sheet.crop(box))
        small_mask = key_mask(rgb[::4, ::4])
        comp = largest_component(small_mask)
        mask = key_mask(rgb) & np.kron(comp, np.ones((4, 4), dtype=bool))[:rgb.shape[0], :rgb.shape[1]]
        ys, xs = np.nonzero(mask)
        cells.append((rgb, mask, ys.min(), ys.max(), xs.min(), xs.max()))

    heights = [c[3] - c[2] + 1 for c in cells]
    scale = target_h / float(np.median(heights))

    ref = Image.open(palette_ref).convert('RGBA')
    ref_px = np.array(ref).reshape(-1, 4)
    ref_px = ref_px[ref_px[:, 3] > 200][:, :3]
    pal_img = Image.new('P', (1, 1))
    uniq = np.unique(ref_px, axis=0)
    # median-cut the shipped art down to a 48-colour palette to lock identity
    pal_src = Image.fromarray(uniq.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=min(48, len(uniq)), method=Image.MEDIANCUT)
    pal_img.putpalette(pal_src.getpalette())

    strip = Image.new('RGBA', (CELL_W * FRAMES, CELL_H), (0, 0, 0, 0))
    for f, (rgb, mask, y0, y1, x0, x1) in enumerate(cells):
        sub = rgb[y0:y1 + 1, x0:x1 + 1].astype(np.float32)
        m = mask[y0:y1 + 1, x0:x1 + 1].astype(np.float32)
        nw, nh = max(1, round(sub.shape[1] * scale)), max(1, round(sub.shape[0] * scale))
        prem = np.dstack([sub * m[..., None], m])
        chans = [np.array(Image.fromarray(prem[..., c]).resize((nw, nh), Image.BOX)) for c in range(4)]
        a = chans[3]
        solid = a >= 0.5
        colour = np.dstack(chans[:3]) / np.maximum(a, 1e-6)[..., None]
        colour = np.clip(colour, 0, 255).astype(np.uint8)
        q = np.array(Image.fromarray(colour).quantize(palette=pal_img, dither=Image.NONE).convert('RGB'))
        # body anchor: x-centre of the head (top 18% of the figure); arms and legs
        # swing, the head should not drift
        top_rows = solid[: max(1, int(nh * 0.18))]
        cols = np.nonzero(top_rows.any(0))[0]
        torso_cx = (cols.min() + cols.max()) / 2
        ox = f * CELL_W + round(CELL_W / 2 - torso_cx)
        oy = BASELINE + 1 - nh
        cell = np.zeros((nh, nw, 4), dtype=np.uint8)
        cell[..., :3] = q
        cell[..., 3] = solid * 255
        layer = Image.new('RGBA', strip.size, (0, 0, 0, 0))
        layer.paste(Image.fromarray(cell, 'RGBA'), (ox, oy))
        # clip to this frame's cell so nothing bleeds into a neighbour
        clip = Image.new('L', strip.size, 0)
        clip.paste(255, (f * CELL_W, 0, (f + 1) * CELL_W, CELL_H))
        strip = Image.composite(Image.alpha_composite(strip, layer), strip, clip)
        print(f'frame {f + 1}: figure {nw}x{nh} torso_cx={torso_cx:.1f} offset_x={ox - f * CELL_W}')

    strip.save(out_base + '.png')

    # Grip point per frame: the leading fist is the leftmost skin cluster at chest
    # height. Offset calibrated on the shipped strips, whose fork_base (14,11)
    # sits 1px outside and 1.5px below the detected fist.
    arr = np.array(strip)
    grips = []
    for f in range(FRAMES):
        cell = arr[:, f * CELL_W:(f + 1) * CELL_W]
        rgb = cell[..., :3].astype(int)
        skin = (cell[..., 3] > 0) & (rgb[..., 0] > 150) & (rgb[..., 0] > rgb[..., 2] + 40) & (rgb[..., 1] > 90)
        ys, xs = np.nonzero(skin[20:50, :24])
        if len(xs) == 0:
            grips.append({'x': 14, 'y': 11})
            continue
        x0 = xs.min()
        fist_y = ys[xs <= x0 + 5].mean() + 20
        grips.append({'x': round((CELL_W - (x0 - 1)) / 3, 2), 'y': round((fist_y + 1.5) / 3, 2)})
    import json
    with open(out_base + '-grips.json', 'w') as fh:
        json.dump(grips, fh)
    print('grips', grips)
    frames = []
    for f in range(FRAMES):
        fr = Image.new('RGBA', (CELL_W, CELL_H), (60, 58, 48, 255))
        fr.alpha_composite(strip.crop((f * CELL_W, 0, (f + 1) * CELL_W, CELL_H)))
        frames.append(fr.convert('RGB').resize((CELL_W * 4, CELL_H * 4), Image.NEAREST))
    frames[0].save(out_base + '-preview.gif', save_all=True, append_images=frames[1:], duration=110, loop=0)
    print('scale', round(scale, 4))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 66)
