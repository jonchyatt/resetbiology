"""Build single 48x72 burned/ash sprites from a generated 3x2 lifecycle sheet.

Cells (left-to-right, top-to-bottom): burned 1, 2, 3, burned 4, ash, (empty).
Uses the walk-strip builder's keying + palette lock. One shared scale taken from
burned stage 1 (upright) so the whole lifecycle matches the walk strip's size;
cells are inset to drop any grid lines the model drew.

Usage: python build-lifecycle-cells.py <sheet.jpg> <palette_ref.png> <out_dir> <villager N> [stage1_h]
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location('walk', os.path.join(HERE, 'build-walk-strip.py'))
walk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(walk)

CELL_W, CELL_H, BASELINE = 48, 72, 70
NAMES = ['burned_1', 'burned_2', 'burned_3', 'burned_4', 'ash']


def main(sheet_path: str, palette_ref: str, out_dir: str, villager: int, stage1_h: int = 69) -> None:
    sheet = Image.open(sheet_path).convert('RGB')
    W, H = sheet.size
    cw, ch = W // 3, H // 2
    inset = max(4, cw // 40)
    cells = []
    for i in range(5):
        box = ((i % 3) * cw + inset, (i // 3) * ch + inset, (i % 3 + 1) * cw - inset, (i // 3 + 1) * ch - inset)
        rgb = np.array(sheet.crop(box))
        comp = walk.largest_component(walk.key_mask(rgb[::4, ::4]))
        mask = walk.key_mask(rgb) & np.kron(comp, np.ones((4, 4), dtype=bool))[:rgb.shape[0], :rgb.shape[1]]
        if i == 4:  # ash pile: keep loose embers too, not only the biggest blob
            mask = walk.key_mask(rgb)
            dark_edge = rgb.sum(-1) < 40
            mask &= ~dark_edge | np.kron(comp, np.ones((4, 4), dtype=bool))[:rgb.shape[0], :rgb.shape[1]]
        ys, xs = np.nonzero(mask)
        cells.append((rgb, mask, ys.min(), ys.max(), xs.min(), xs.max()))
    scale = stage1_h / float(cells[0][3] - cells[0][2] + 1)

    ref = np.array(Image.open(palette_ref).convert('RGBA')).reshape(-1, 4)
    uniq = np.unique(ref[ref[:, 3] > 200][:, :3], axis=0)
    pal_img = Image.new('P', (1, 1))
    pal_src = Image.fromarray(uniq.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=min(56, len(uniq)), method=Image.MEDIANCUT)
    pal_img.putpalette(pal_src.getpalette())

    for i, (rgb, mask, y0, y1, x0, x1) in enumerate(cells):
        sub = rgb[y0:y1 + 1, x0:x1 + 1].astype(np.float32)
        m = mask[y0:y1 + 1, x0:x1 + 1].astype(np.float32)
        nw, nh = max(1, round(sub.shape[1] * scale)), max(1, round(sub.shape[0] * scale))
        nw, nh = min(nw, CELL_W), min(nh, CELL_H - 1)
        prem = np.dstack([sub * m[..., None], m])
        chans = [np.array(Image.fromarray(prem[..., c]).resize((nw, nh), Image.BOX)) for c in range(4)]
        solid = chans[3] >= 0.5
        colour = np.clip(np.dstack(chans[:3]) / np.maximum(chans[3], 1e-6)[..., None], 0, 255).astype(np.uint8)
        q = np.array(Image.fromarray(colour).quantize(palette=pal_img, dither=Image.NONE).convert('RGB'))
        # Embers are the damage read: box-downscaling averages them away, so
        # max-pool the glowing source pixels and stamp them back as hot pixels.
        ember_src = ((sub[..., 0] > 190) & (sub[..., 1] > 80) & (sub[..., 1] < 200) & (sub[..., 2] < 90) & (m > 0)).astype(np.float32)
        ember = np.array(Image.fromarray(ember_src * 255).resize((nw, nh), Image.BOX)) > 40
        q[ember & solid] = (255, 146, 42)
        if i < 4:
            head = solid[: max(1, int(nh * 0.18))]
            cols = np.nonzero(head.any(0))[0]
            cx = (cols.min() + cols.max()) / 2
        else:
            cx = nw / 2
        cell = np.zeros((CELL_H, CELL_W, 4), dtype=np.uint8)
        ox = int(round(CELL_W / 2 - cx))
        oy = BASELINE + 1 - nh
        sprite = np.dstack([q, solid.astype(np.uint8) * 255])
        dst_x0, dst_x1 = max(0, ox), min(CELL_W, ox + nw)
        src_x0 = dst_x0 - ox
        cell[oy:oy + nh, dst_x0:dst_x1] = sprite[:, src_x0:src_x0 + (dst_x1 - dst_x0)]
        img = Image.fromarray(cell, 'RGBA')
        img.save(f'{out_dir}/villager_{villager}tine_{NAMES[i]}_left.png')
        img.transpose(Image.FLIP_LEFT_RIGHT).save(f'{out_dir}/villager_{villager}tine_{NAMES[i] if NAMES[i] != "ash" else "ash"}.png')
        print(NAMES[i], nw, nh)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]) if len(sys.argv) > 5 else 69)
