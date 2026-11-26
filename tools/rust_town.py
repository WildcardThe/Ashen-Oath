"""Rustbound town: the wasteland valley backdrop + 24 buildings (checkerboard-backed jpgs).
Each building is cut out (tools/checker_cut.py), its ground patch feathered into the valley floor,
sized and placed on its spot, graded into the scene's smoggy light, given a contact shadow, and a glow
layer is extracted from everything that should shine: fire, toxic green, void blue, red sanctums.
Writes assets/town/rustbound/. Run: python3 tools/rust_town.py [--preview out.png]"""
import json, os, sys, glob
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checker_cut import cut

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'rust_town')
OUT = os.path.join(ROOT, 'assets', 'town', 'rustbound')
BW, BH = 1920, 1072
K = BW / 2000

# spot: centre x, ground y (landscape pixels, 2000 wide), ground-patch width, depth (0 front .. 1 back)
SPOTS = {
    'fort':   (965, 352, 470, 1.0),
    'guild':  (1465, 272, 175, 1.0),
    'dw5':    (560, 392, 240, 0.9),
    'hall':   (335, 545, 300, 0.55),
    'dw4':    (1400, 475, 255, 0.6),
    'dw3':    (1290, 668, 330, 0.4),
    'depot':  (775, 588, 330, 0.45),   # 13% larger, nudged right
    'tavern': (370, 760, 320, 0.25),
    'dw2':    (520, 975, 380, 0.05),
    'dw1':    (835, 858, 360, 0.15),
    'market': (1445, 915, 380, 0.1),
}
KEYS = {
    'fort': ('Fort', 'fort', 0.82), 'citadel': ('Citadel', 'fort', 0.92), 'castle': ('Castle', 'fort', 1.0),
    'hall1': ('Town Hall', 'hall', 0.88), 'hall2': ('City Hall', 'hall', 0.92), 'hall3': ('Capitol', 'hall', 0.92),
    'mg1': ('Mage Guild level 1', 'guild', 0.85), 'mg2': ('Mage Guild level 2', 'guild', 0.88), 'mg3': ('Mage Guild level 3', 'guild', 0.92),
    'mg4': ('Mage Guild level 4', 'guild', 0.96), 'mg5': ('Mage Guild level 5', 'guild', 1.0),
    'tavern': ('Recruitment Office', 'tavern', 1.0), 'market': ('Trade Exchange', 'market', 1.0), 'depot': ('Supply Depot', 'depot', 1.0),
    'dw1': ('Thrall Workshop', 'dw1', 0.95), 'dw1u': ('Overseer Foundry', 'dw1', 1.03),
    'dw2': ('Raider Camp', 'dw2', 0.95), 'dw2u': ('Warboss Stronghold', 'dw2', 1.03),
    'dw3': ('Mutant Pens', 'dw3', 0.95), 'dw3u': ('Warlord Pit', 'dw3', 1.03),
    'dw4': ('Void Shrine', 'dw4', 0.95), 'dw4u': ('Revenant Crypt', 'dw4', 1.04),
    'dw5': ('Maw Spire', 'dw5', 0.95), 'dw5u': ('Archon Throne', 'dw5', 1.04),
}
HAZE = np.array([150, 150, 112], np.float32)    # yellow-grey smog


def feather_ground(rgba):
    """soften the outline of the painted ground patch so it melts into the valley floor"""
    al = rgba[..., 3].astype(np.float32) / 255
    solid = al > 0.5
    ys = np.nonzero(solid.any(1))[0]; y0, y1 = ys.min(), ys.max()
    low = np.arange(al.shape[0])[:, None] > y0 + (y1 - y0) * 0.45
    dist = ndimage.distance_transform_edt(solid)
    feather = np.clip(dist / 14, 0, 1)
    al = np.where(low, np.minimum(al, feather), al)
    out = rgba.copy(); out[..., 3] = (al * 255).astype(np.uint8)
    return out


# Front buildings whose painted ground slab spills over the landscape's scrap and road edges:
# the slab is pulled in from its outline by this share of its width, with a soft edge.
TRIM = {'tavern': 0.05, 'dw2': 0.05, 'market': 0.05}


def trim_ground(rgba, shrink):
    al = rgba[..., 3].astype(np.float32) / 255
    solid = al > 0.5
    ys = np.nonzero(solid.any(1))[0]; y0, y1 = ys.min(), ys.max()
    yy = np.arange(al.shape[0])[:, None]
    # only the ground band: lower part of the picture, fading in so walls and roofs are never touched
    band = np.clip((yy - (y0 + (y1 - y0) * 0.62)) / ((y1 - y0) * 0.12), 0, 1)
    dist = ndimage.distance_transform_edt(solid)
    keep = np.clip((dist - shrink * 0.75) / (shrink * 0.5), 0, 1)
    # tall structures standing near the slab's edge (posts, cranes, banners) stay: keep anything dark or saturated
    c = rgba[..., :3].astype(np.float32); sat = c.max(2) - c.min(2); lum = c.mean(2)
    structure = ndimage.binary_dilation((sat > 45) | (lum < 45), iterations=2)
    keep = np.where(structure & (dist > shrink * 0.35), np.maximum(keep, 0.85), keep)
    al = al * (1 - band * (1 - keep))
    out = rgba.copy(); out[..., 3] = (al * 255).astype(np.uint8)
    return out


def ground_row(rgba):
    al = rgba[..., 3] > 128; rows = al.sum(1); ys = np.nonzero(rows)[0]
    y0, y1 = ys.min(), ys.max()
    lower = np.arange(len(rows)) > y0 + (y1 - y0) * 0.5
    r = int(np.argmax(np.where(lower, rows, 0)))
    xs = np.nonzero(al[r - 2:r + 3].any(0))[0]
    return r, xs.min(), xs.max()


def grade(rgba, depth):
    a = rgba[..., :3].astype(np.float32)
    lum = a.mean(2, keepdims=True)
    a = lum + (a - lum) * 0.88
    a = a * np.array([1.0, 0.98, 0.9]) * (0.93 - 0.05 * (1 - depth))
    a = a * (1 - 0.2 * depth) + HAZE * 0.2 * depth
    out = rgba.copy(); out[..., :3] = np.clip(a, 0, 255).astype(np.uint8)
    return out


def glow_layer(rgba):
    """everything bright and saturated glows in its own colour: fire, toxic green, void blue, red light"""
    a = rgba[..., :3].astype(np.float32); al = rgba[..., 3] / 255
    mx = a.max(2); sat = mx - a.min(2)
    hot = (mx > 175) & (sat > 70) & (al > 0.4)
    hot |= (mx > 225) & (sat > 35) & (al > 0.4)
    w = np.where(hot, mx / 255, 0)
    col = np.where(hot[..., None], a, 0)
    b1 = ndimage.gaussian_filter(w, 3); b2 = ndimage.gaussian_filter(w, 10)
    cb = ndimage.gaussian_filter(col, (6, 6, 0)) / np.maximum(ndimage.gaussian_filter(hot.astype(np.float32), 6), 1e-3)[..., None]
    out = np.zeros(rgba.shape, np.uint8)
    out[..., :3] = np.clip(cb * 1.1, 0, 255)
    out[..., 3] = np.clip((b1 * 2.0 + b2 * 2.6) * 255, 0, 255)
    return out, int(hot.sum())


def shadow_into(im, gy):
    W, H = im.size
    yy, xx = np.mgrid[0:H, 0:W]
    a = np.clip(1 - (((xx - W / 2) / (W * 0.48)) ** 2 + ((yy - gy) / max(6, W * 0.1)) ** 2), 0, 1) ** 1.5 * 0.45
    sh = Image.fromarray(np.dstack([np.zeros((H, W, 3)), a * 255]).astype(np.uint8), 'RGBA')
    sh.alpha_composite(im)
    return sh


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*')): os.remove(f)
    base = Image.open(os.path.join(SRC, 'landscape.jpg')).convert('RGB').resize((BW, BH), Image.LANCZOS)
    base.save(os.path.join(OUT, 'base.webp'), quality=92)
    meta = {'base': {'w': BW, 'h': BH}}
    placed = {}
    for key, (src, spot, f) in KEYS.items():
        rgba = feather_ground(cut(os.path.join(SRC, src + '.jpg')))
        r, gx0, gx1 = ground_row(rgba)
        if spot in TRIM: rgba = trim_ground(rgba, (gx1 - gx0) * TRIM[spot])   # measured before trimming, so the size stays
        ys, xs = np.nonzero(rgba[..., 3] > 10)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        cx, gy, w, depth = SPOTS[spot]
        k = w * K * f * 1.1 / (gx1 - gx0)    # +10%: buildings read better against the wide valley
        crop = rgba[y0:y1, x0:x1]
        glow, nhot = glow_layer(crop)
        im = Image.fromarray(grade(crop, depth), 'RGBA')
        size = (max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k)))
        im = im.resize(size, Image.LANCZOS)
        X = round(cx * K - ((gx0 + gx1) / 2 - x0) * k); Y = round(gy * K - (r - y0) * k)
        im = shadow_into(im, (r - y0) * k)
        im.save(os.path.join(OUT, key + '.webp'), quality=92)
        m = {'w': im.width, 'h': im.height, 'ow': im.width, 'oh': im.height, 'area': int((np.asarray(im)[..., 3] > 128).sum()), 'x': X, 'y': Y, 'gy': round(gy * K)}
        if nhot > 40:
            Image.fromarray(glow, 'RGBA').resize(size, Image.LANCZOS).save(os.path.join(OUT, key + '_glow.webp'), quality=88)
            m['glow'] = 1
        meta[key] = m; placed[key] = (im, X, Y)
        print(key, X, Y, im.size, 'glow' if m.get('glow') else '', flush=True)
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        for sel, suffix in ((['fort', 'hall1', 'tavern', 'dw1'], '_start'),
                            (['castle', 'hall3', 'mg5', 'tavern', 'market', 'depot', 'dw1u', 'dw2u', 'dw3u', 'dw4u', 'dw5u'], '_full'),
                            (['citadel', 'hall2', 'mg3', 'tavern', 'market', 'depot', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5'], '_mid')):
            c = base.convert('RGBA')
            for key in sorted(sel, key=lambda k: meta[k]['gy']):
                im, X, Y = placed[key]; c.alpha_composite(im, (X, Y))
                if meta[key].get('glow'):
                    g = Image.open(os.path.join(OUT, key + '_glow.webp')).convert('RGBA')
                    g.putalpha(g.getchannel('A').point(lambda v: v * 45 // 100))
                    c.alpha_composite(g, (X, Y))
            c.convert('RGB').save(out.replace('.png', suffix + '.png'))


if __name__ == '__main__':
    main()
