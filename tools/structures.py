"""Map structures: cut every structure picture (flat grey background), normalise its size, extract a
glow layer for fire, beams and glowing crystals, and write assets/sprites/site_<id>.png (+ _glow).
The seven resource structures also replace the mine pictures (mine_<res>.png).
Run: python3 tools/structures.py"""
import json, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'structures')
OUT = os.path.join(ROOT, 'assets', 'sprites')
MAN = os.path.join(ROOT, 'assets', 'sprites.json')
man = json.load(open(MAN))

MINES = {'Auramite Refinery': 'auramite', 'Ceramite Kiln Works': 'ceramite', 'Adamantium Ore Pit': 'adamantium', 'Plasteel Foundry': 'plasteel',
         'Psy-Crystal Excavation': 'psycrystal', 'Wraithbone Ossuary Dig': 'wraithbone', 'Blackstone Quarry': 'blackstone'}
CREATURE = re.compile(r'(attack|move|fly)$|^(Basilisk|Carrion Kite|Maw Spawn|Maw Fiend|Petrifex Basilisk|Plague Kite)$')


def sid(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def cut(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = a.shape[:2]
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    med = np.median(border, 0)
    # vertical gradients: compare against the background colour of each row (left and right edges)
    rowbg = np.median(np.concatenate([a[:, :8], a[:, -8:]], 1), 1)[:, None, :]
    near = (np.minimum(np.sqrt(((a - med) ** 2).sum(2)), np.sqrt(((a - rowbg) ** 2).sum(2))) < 16) & (sat < 16)
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = ndimage.binary_erosion(np.isin(lab, edge[edge > 0]), iterations=2)
    num = ndimage.gaussian_filter(np.where(bgm[..., None], a, 0), (20, 20, 0))
    den = ndimage.gaussian_filter(bgm.astype(np.float32), 20)[..., None]
    bg = np.where(den > 1e-3, num / np.maximum(den, 1e-3), med)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    fg = ndimage.binary_opening((d > 22) | ((sat > 30) & (d > 12)), iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=6))
    sz = ndimage.sum(fg, lab, range(1, n + 1)); big = sz.max()
    fg &= np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > big * 0.05])
    fg = ndimage.binary_fill_holes(ndimage.binary_closing(fg, iterations=2))
    # enclosed background pockets (between towers, under arches)
    pocket = ndimage.binary_opening(fg & (d < 14) & (sat < 12), iterations=2)
    pl, pn = ndimage.label(pocket)
    if pn:
        ps = ndimage.sum(pocket, pl, range(1, pn + 1)); fg &= ~np.isin(pl, [i + 1 for i, v in enumerate(ps) if v > 120])
    # smoke, steam and glow: soft alpha near the structure
    near = ndimage.binary_dilation(fg, iterations=30)
    soft = np.where(near & ~fg, np.clip((d - 8) / 60, 0, 0.9), 0)
    al = np.maximum(ndimage.gaussian_filter(fg.astype(np.float32), 0.8) * fg, soft)
    al = np.where(al < 0.06, 0, al)
    rgb = np.where((al > 0.95)[..., None], a, np.clip(bg + (a - bg) / np.maximum(al, 0.3)[..., None], 0, 255))
    rgba = np.dstack([rgb, al * 255]).astype(np.uint8)
    ys, xs = np.nonzero(al > 0.08)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def glow(rgba, soft=False):
    a = rgba[..., :3].astype(np.float32); al = rgba[..., 3] / 255
    mx = a.max(2); sat = mx - a.min(2)
    hot = ((mx > 175) & (sat > 70) & (al > 0.4)) | ((mx > 228) & (sat > 30) & (al > 0.4))
    if soft:  # dim lanterns, green witch-light, lit windows
        r, gg, b = a[..., 0], a[..., 1], a[..., 2]
        warm = (mx > 140) & (r >= gg) & (gg > b + 10) & (sat > 50)
        green = (gg > 80) & (gg > r + 25) & (gg > b + 10)
        red = (r > 110) & (r > gg + 60)
        hot = (warm | green | red | ((mx > 115) & (sat > 58))) & (al > 0.5)
    w = np.where(hot, mx / 255, 0)
    col = np.where(hot[..., None], a, 0)
    cb = ndimage.gaussian_filter(col, (5, 5, 0)) / np.maximum(ndimage.gaussian_filter(hot.astype(np.float32), 5), 1e-3)[..., None]
    out = np.zeros(rgba.shape, np.uint8)
    out[..., :3] = np.clip(cb * 1.1, 0, 255)
    out[..., 3] = np.clip((ndimage.gaussian_filter(w, 2.5) * 2.2 + ndimage.gaussian_filter(w, 8) * 2.6) * 255, 0, 255)
    return out, int(hot.sum())


done = []
for f in sorted(os.listdir(SRC)):
    name = f[:-4]
    if CREATURE.search(name): continue
    rgba = cut(os.path.join(SRC, f))
    target = 300
    im = Image.fromarray(rgba, 'RGBA')
    k = target / max(im.width, im.height * 1.15)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    key = ('mine_' + MINES[name]) if name in MINES else ('site_' + sid(name))
    im.save(os.path.join(OUT, key + '.png'))
    man[key] = {'kind': 'site', 'w': im.width, 'h': im.height}
    g, n = glow(np.asarray(im))
    if n <= 25: g, n = glow(np.asarray(im), True)
    gk = key + '_glow'
    if n > 25:
        Image.fromarray(g, 'RGBA').save(os.path.join(OUT, gk + '.png'))
        man[gk] = {'kind': 'glow', 'w': im.width, 'h': im.height}
    elif gk in man:
        del man[gk]
    done.append((key, im.size, n > 25))
json.dump(man, open(MAN, 'w'), indent=1)
for d in done: print(*d)
