"""Terrain pack: ground textures and the obstacle / mountain / river / pool sprite sheets.
- textures: made seamless (edges cross-faded with a half-offset copy) and saved to assets/terrain/
- sheets on flat grey: cut on their grid, each piece matted against the local grey, saved as
  assets/sprites/<set>_<n>.png with its intended size on the map ('tiles' = width in map tiles)
- rivers: a seamless cross-section strip for acid and for magma rivers, from the straight segments
- pools: acid and magma pools for ponds and lakes
Run: python3 tools/terrain_pack.py"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'terrain2')
OUT = os.path.join(ROOT, 'assets', 'sprites')
TEX = os.path.join(ROOT, 'assets', 'terrain')
MAN = os.path.join(ROOT, 'assets', 'sprites.json')
manifest = json.load(open(MAN))
for k in [k for k in manifest if k.startswith(('mw_', 'mv_', 'ow_', 'ov_', 'pool_'))]: del manifest[k]


TONE = {'ground_bone': 0.72}   # the bone ground is very bright next to the others


def seamless(path, out, size=512):
    t = np.asarray(Image.open(path).convert('RGB').resize((size, size), Image.LANCZOS)).astype(np.float32)
    if out in TONE: m = t.mean(); t = (t - m) * 0.8 + m * TONE[out]
    r = np.roll(np.roll(t, size // 2, 0), size // 2, 1)
    x = np.arange(size); e = np.minimum(x, size - 1 - x) / (size * 0.22)
    w1 = np.clip(1 - e, 0, 1)
    w = np.maximum(w1[None, :], w1[:, None]) ** 1.3
    s = t * (1 - w[..., None]) + r * w[..., None]
    Image.fromarray(np.clip(s, 0, 255).astype(np.uint8)).save(os.path.join(TEX, out + '.webp'), quality=92)


TEXTURES = {
    'ground_scrub': 'tex_soil', 'ground_broken': 'tex_scorched', 'ground_marsh': 'tex_mud', 'ground_bone': 'tex_bone',
    'ground_rock': 'tex_gravel_dark', 'ground_ash': 'tex_ash', 'ground_dust': 'tex_cracked_pale2',
}


def cut_piece(c):
    """matte one cell of a flat-grey sheet; returns the RGBA crop of its main object, or None"""
    c = c.astype(np.float32); lum = c.mean(2); sat = c.max(2) - c.min(2)
    border = np.concatenate([c[:3].reshape(-1, 3), c[-3:].reshape(-1, 3), c[:, :3].reshape(-1, 3), c[:, -3:].reshape(-1, 3)])
    med = np.median(border, 0)
    near = np.sqrt(((c - med) ** 2).sum(2)) < 14
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = ndimage.binary_erosion(np.isin(lab, edge[edge > 0]), iterations=2)
    num = ndimage.gaussian_filter(np.where(bgm[..., None], c, 0), (10, 10, 0))
    den = ndimage.gaussian_filter(bgm.astype(np.float32), 10)[..., None]
    bg = np.where(den > 1e-3, num / np.maximum(den, 1e-3), med)
    d = np.sqrt(((c - bg) ** 2).sum(2))
    fg = ndimage.binary_opening((d > 18) | ((sat > 30) & (d > 10)), iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=6))
    if not n: return None
    sz = ndimage.sum(fg, lab, range(1, n + 1)); big = sz.max()
    keep = [i + 1 for i, s in enumerate(sz) if s > big * 0.08]
    # slivers of the row above that hang into this cell touch its top edge: drop them unless they are the main piece
    top = set(np.unique(lab[:4])) - {0}
    main = int(np.argmax(sz)) + 1
    keep = [i for i in keep if i == main or i not in top]
    fg &= np.isin(lab, keep)
    fg = ndimage.binary_fill_holes(ndimage.binary_closing(fg, iterations=2))
    # soft smoke and glow: partial alpha by distance from the grey
    soft = np.clip((d - 8) / 50, 0, 1) * ndimage.binary_dilation(fg, iterations=12)
    al = np.maximum(ndimage.gaussian_filter(fg.astype(np.float32), 0.8) * fg, soft)
    al = np.where(al < 0.06, 0, al)
    rgb = np.where((al > 0.95)[..., None], c, np.clip(bg + (c - bg) / np.maximum(al, 0.3)[..., None], 0, 255))
    rgba = np.dstack([rgb, al * 255]).astype(np.uint8)
    ys, xs = np.nonzero(al > 0.08)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def cut_sheet(name, cols, rows, prefix, px_per_tile, skip=(), only=None):
    a = np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB'))
    H, W = a.shape[:2]; cw, ch = W / cols, H / rows
    names = []
    for r in range(rows):
        for k in range(cols):
            i = r * cols + k
            if i in skip or (only is not None and i not in only): continue
            cell = a[int(r * ch) + 2:int((r + 1) * ch) - 2, int(k * cw) + 2:int((k + 1) * cw) - 2]
            p = cut_piece(cell)
            if p is None: continue
            nm = f'{prefix}_{i}'
            Image.fromarray(p, 'RGBA').save(os.path.join(OUT, nm + '.png'))
            manifest[nm] = {'kind': 'decor', 'w': p.shape[1], 'h': p.shape[0], 'tiles': round(p.shape[1] / px_per_tile, 2)}
            names.append(nm)
    return names


def river_strip(name, cell_index, cols, rows, out):
    """straight horizontal river segment -> vertical cross-section strip that repeats along its length"""
    a = np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB'))
    H, W = a.shape[:2]; cw, ch = W / cols, H / rows
    r, k = divmod(cell_index, cols)
    cell = a[int(r * ch) + 2:int((r + 1) * ch) - 2, int(k * cw) + 2:int((k + 1) * cw) - 2]
    p = cut_piece(cell)
    al = p[..., 3] > 200
    cols_ok = np.nonzero(al.mean(0) > 0.6)[0]
    x0, x1 = cols_ok.min() + 12, cols_ok.max() - 12      # inner, fully painted part of the segment
    seg = p[:, x0:x1].astype(np.float32)
    L = seg.shape[1]; o = L // 4
    # make it repeat: cross-fade the last quarter into the first
    t = np.linspace(0, 1, o)[None, :, None]
    body = seg[:, :L - o].copy(); body[:, :o] = seg[:, L - o:] * (1 - t) + seg[:, :o] * t
    strip = np.transpose(body, (1, 0, 2))                # rotate: flow runs vertically, banks left and right
    Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, out + '.png'))
    manifest[out] = {'kind': 'decor', 'w': strip.shape[1], 'h': strip.shape[0]}


os.makedirs(TEX, exist_ok=True)
for out, src in TEXTURES.items(): seamless(os.path.join(SRC, src + '.jpg'), out)
sets = {
    # wasteland obstacles (5x5): scrap, wrecks, trees, acid pools, ruins
    'ow': cut_sheet('obst_waste_a.jpg', 5, 5, 'ow', 150) + cut_sheet('obst_waste_b.jpg', 5, 5, 'owb', 150),
    # volcanic obstacles (5x5): boulders, formations, trees, magma pools, ruins
    'ov': cut_sheet('obst_volc.jpg', 5, 5, 'ov', 150),
    # mountain ranges (4x4): ridges, peaks, foothills
    'mw': cut_sheet('mtn_waste_a.jpg', 4, 4, 'mw', 125) + cut_sheet('mtn_waste_b.jpg', 4, 4, 'mwb', 125),
    'mv': cut_sheet('mtn_volc_a.jpg', 4, 4, 'mv', 125) + cut_sheet('mtn_volc_b.jpg', 4, 4, 'mvb', 125),
    # pools (bottom row of the river sheets)
    'pool': cut_sheet('rivers_a.jpg', 5, 5, 'pool', 150, only=range(20, 25)) + cut_sheet('rivers_b.jpg', 5, 5, 'poolb', 150, only=range(20, 25)),
}
river_strip('rivers_a.jpg', 10, 5, 5, 'river_acid')
river_strip('rivers_a.jpg', 0, 5, 5, 'river_lava')
json.dump(manifest, open(MAN, 'w'), indent=1)
print({k: len(v) for k, v in sets.items()})
