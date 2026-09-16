"""Build the native-resolution rain gutter sprite from the Nano Banana Pro source.

Source: data/pitchforks-rework/consults/2026-09-16-handoff18-items1-4/gutter-concepts/trough-v1.jpg
(jarvis repo). Magenta = empty, pure green = open water channel.

The source trough is ~2.4:1; the in-game span is ~7:1. Instead of squashing it,
the endcaps and the three carved corbels keep true proportions and only the
plain dressed-block runs between them are stretched (long ashlar blocks read
naturally). Output is a hard-alpha, palette-reduced, outlined pixel sprite at
exact runtime size, plus a JSON with the channel rows the renderer fills with water.

Usage: python build-rain-gutter.py <source.jpg> <out_dir> [world]

world: dungeon (default) | village-gate | cathedral | bell-tower. Each world gets
its own stone ramp (sampled from its painted plate) and span, so the cistern is
anchored to that world's architecture instead of one dungeon piece everywhere.
"""
import json
import sys

import numpy as np
from PIL import Image

NATIVE_W, NATIVE_H = 398, 66
SRC_TOP, SRC_BOTTOM = 13, 645
FACE_BOTTOM = 425  # below this only the corbel columns are solid stone
CORBEL_COLUMNS = [(60, 200), (700, 845), (1340, 1490)]
# (source x0, x1, native width, mode): endcap, run, middle corbel, run, endcap.
# 'tile' repeats a two-block source course cut on its mortar joints (both brick
# courses repeat every ~440 source px), so stones keep their authored proportions.
PIECES = [(22, 245, 24, 'fit'), (245, 685, 166, 'tile'), (690, 860, 18, 'fit'), (905, 1345, 166, 'tile'), (1345, 1556, 24, 'fit')]
# Palette lock: stone is gradient-mapped onto the procedural dungeon's own olive
# stone ramp so the cistern reads as the same masonry as the arches.
STONE_RAMP = [(0, (9, 10, 9)), (60, (33, 33, 26)), (115, (62, 61, 48)), (165, (98, 95, 74)), (215, (140, 134, 106)), (255, (184, 176, 142))]
MOSS = np.array([70, 82, 38], dtype=np.float32)


PLATES = 'public/images/pitchforks'
# world: (draw x, native width, plate file, stone sample box in 720x405 space, torch under-light)
WORLDS = {
    'dungeon': (296, 398, None, None, True),
    # spans from the left stone house wall into the gatehouse tower
    'village-gate': (244, 450, 'village_gate_plate.png', (0, 90, 240, 320), False),
    'cathedral': (296, 398, 'cathedral_plate.png', (180, 20, 330, 240), False),
    'bell-tower': (296, 398, 'bell_tower_plate.png', (340, 150, 720, 320), False),
}


def plate_ramp(plate: str, box):
    img = np.array(Image.open(f'{PLATES}/{plate}').convert('RGB').resize((720, 405), Image.NEAREST)).astype(np.float32)
    px = img[box[1]:box[3], box[0]:box[2]].reshape(-1, 3)
    lum = px @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    order = np.argsort(lum)
    stops = []
    for lum_stop, q in zip([0, 60, 115, 165, 215, 255], [0.01, 0.15, 0.4, 0.7, 0.92, 0.995]):
        i = order[int(q * (len(order) - 1))]
        lo, hi = max(0, int(q * len(order)) - 40), min(len(order), int(q * len(order)) + 40)
        stops.append((lum_stop, tuple(px[order[lo:hi]].mean(0))))
    return stops


def main(src_path: str, out_dir: str, world: str = 'dungeon') -> None:
    global NATIVE_W, PIECES, STONE_RAMP
    draw_x, NATIVE_W, plate, box, underlight = WORLDS[world]
    if plate:
        STONE_RAMP = plate_ramp(plate, box)
    run_total = NATIVE_W - 24 - 18 - 24
    PIECES = [(22, 245, 24, 'fit'), (245, 685, run_total // 2, 'tile'), (690, 860, 18, 'fit'),
              (905, 1345, run_total - run_total // 2, 'tile'), (1345, 1556, 24, 'fit')]
    rgb = np.array(Image.open(src_path).convert('RGB')).astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r > 170) & (g < 110) & (b > 170)
    green = (g > 170) & (r < 120) & (b < 120)
    alpha = (~magenta).astype(np.float32)
    below = np.zeros_like(alpha, dtype=bool)
    below[FACE_BOTTOM:, :] = True
    for x0, x1 in CORBEL_COLUMNS:
        below[FACE_BOTTOM:, x0:x1] = False
    alpha[below] = 0
    # the channel is a hole in the front sprite; water is drawn behind it
    channel = green.astype(np.float32)
    alpha[green] = 0

    rgba = np.dstack([rgb.astype(np.float32) * alpha[..., None], alpha, channel])
    rgba = rgba[SRC_TOP:SRC_BOTTOM]
    scale = NATIVE_H / (SRC_BOTTOM - SRC_TOP)

    stretched = []
    for x0, x1, native_w, mode in PIECES:
        piece = rgba[:, x0:x1]
        target_w = max(1, round(native_w / scale))
        if mode == 'tile':
            reps = -(-target_w // piece.shape[1])
            stretched.append(np.concatenate([piece] * reps, axis=1)[:, :target_w])
            continue
        chans = [np.array(Image.fromarray(piece[..., c]).resize((target_w, piece.shape[0]), Image.LANCZOS))
                 for c in range(piece.shape[2])]
        stretched.append(np.dstack(chans))
    wide = np.concatenate(stretched, axis=1)
    small = np.dstack([np.array(Image.fromarray(wide[..., c]).resize((NATIVE_W, NATIVE_H), Image.BOX))
                       for c in range(wide.shape[2])])

    a = small[..., 3]
    solid = a >= 0.5
    colour = np.where(solid[..., None], small[..., :3] / np.maximum(a, 1e-6)[..., None], 0)
    colour = np.clip(colour, 0, 255).astype(np.uint8)

    # palette-reduce the stone so it reads as authored pixel clusters
    # remove the source's warm-left / cool-right lighting split, then palette-lock
    lum = colour.astype(np.float32) @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    col_mean = np.array([lum[solid[:, x], x].mean() if solid[:, x].any() else 0 for x in range(NATIVE_W)])
    kernel = np.ones(61) / 61
    smooth = np.convolve(np.pad(col_mean, 30, mode='edge'), kernel, mode='valid')
    lum = np.clip(lum * (col_mean[solid.any(0)].mean() / np.maximum(smooth, 1))[None, :], 0, 255)
    stops = np.array([s for s, _ in STONE_RAMP], dtype=np.float32)
    ramp = np.array([c for _, c in STONE_RAMP], dtype=np.float32)
    mapped = np.stack([np.interp(lum, stops, ramp[:, c]) for c in range(3)], axis=-1)
    src = colour.astype(np.float32)
    mossy = (src[..., 1] > src[..., 0] + 12) & (src[..., 1] > src[..., 2] + 12)
    mapped[mossy] = mapped[mossy] * 0.45 + MOSS * (lum[mossy, None] / 90.0) * 0.55
    # Room lighting: the ceiling side sits in near-darkness; the face picks up
    # torchlight from below. (Warm torch under-light is added live in code.)
    row_light = np.interp(np.arange(NATIVE_H), [0, 14, 43, NATIVE_H - 1], [0.5, 0.62, 0.9, 0.72])
    mapped = mapped * row_light[:, None, None]
    colour = np.clip(mapped, 0, 255).astype(np.uint8)
    colour[~solid] = 0
    quant = Image.fromarray(colour).quantize(colors=28, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    colour = np.array(quant).astype(np.float32)

    # 1px dark outline on every silhouette edge (including the channel opening)
    pad = np.pad(solid, 1)
    edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    colour[edge] = colour[edge] * 0.35 + np.array([6, 7, 9]) * 0.65

    out = np.dstack([colour.astype(np.uint8), (solid * 255).astype(np.uint8)])
    name = 'rain_gutter' if world == 'dungeon' else f'rain_gutter_{world}'
    Image.fromarray(out, 'RGBA').save(f'{out_dir}/{name}.png')

    ch = small[..., 4] >= 0.5
    ys, xs = np.where(ch)
    meta = {
        'world': world, 'drawX': draw_x, 'drawY': 28, 'torchUnderlight': underlight,
        'width': NATIVE_W, 'height': NATIVE_H,
        'channel': {'x0': int(xs.min()), 'x1': int(xs.max()) + 1, 'y0': int(ys.min()), 'y1': int(ys.max()) + 1},
        'corbelCentersX': [11, 24 + run_total // 2 + 9, NATIVE_W - 11],
        'source': 'data/pitchforks-rework/consults/2026-09-16-handoff18-items1-4/gutter-concepts/trough-v1.jpg',
        'builder': 'scripts/pitchforks-art-repair/build-rain-gutter.py',
    }
    with open(f'{out_dir}/{name}.json', 'w') as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'dungeon')
