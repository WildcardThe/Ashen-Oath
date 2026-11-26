"""Cut game sprites out of the concept sheets in assets/source.

Usage:  python3 tools/extract_sprites.py
Writes: assets/sprites/*.png, assets/ground.png, assets/sprites.json

Each sprite is cropped from the sheet, its grass background is keyed out by comparing
every pixel to a sampled model of the ground colours, and the edge is feathered.
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.spatial import cKDTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'sprites')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

sheet = np.asarray(Image.open(os.path.join(SRC, 'mines-terrain.webp')).convert('RGB')).astype(np.float32)
res_sheet = np.asarray(Image.open(os.path.join(SRC, 'resources.webp')).convert('RGB')).astype(np.float32)

# ---------------------------------------------------------------- ground model
# Rectangles of bare ground (no objects) in the terrain sheet.
GROUND = [(125, 395, 235, 440), (880, 500, 975, 532), (690, 440, 760, 480), (940, 160, 983, 270),
          (0, 160, 25, 330), (216, 150, 264, 185), (60, 440, 110, 470)]
gpix = np.concatenate([sheet[y0:y1, x0:x1].reshape(-1, 3) for x0, y0, x1, y1 in GROUND])
sample = gpix[rng.choice(len(gpix), size=min(4000, len(gpix)), replace=False)]
tree = cKDTree(sample)


def key_ground(crop, lo=10.0, hi=26.0):
    d, _ = tree.query(crop.reshape(-1, 3), k=3)
    d = d.mean(axis=1).reshape(crop.shape[:2])
    return np.clip((d - lo) / (hi - lo), 0, 1)


def ellipse(h, w, cx=0.5, cy=0.55, rx=0.5, ry=0.5, soft=0.18):
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx + 0.5) / w - cx) ** 2 / rx ** 2 + ((yy + 0.5) / h - cy) ** 2 / ry ** 2)
    return np.clip((1 - r) / soft, 0, 1)


def matte(crop, keyfn=None, core=0.0, lo=0, hi=0, feather=0.22, power=3.0):
    """Soft rounded-rectangle mask. The grass kept inside the feather matches the map ground."""
    h, w = crop.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    u = np.abs((xx + 0.5) / w * 2 - 1); v = np.abs((yy + 0.5) / h * 2 - 1)
    r = (u ** power + v ** power) ** (1 / power)
    a = np.clip((1 - r) / feather, 0, 1)
    if keyfn is not None:
        a = np.maximum(a * 0.0, a) if False else a
        k = keyfn(crop, lo, hi)
        a = np.clip(np.maximum(k * np.clip((1 - r) / 0.08, 0, 1), a), 0, 1)
    return a * a * (3 - 2 * a)


def key_matte(crop, a):
    """Alpha from a colour key, cleaned up: drop specks, fill holes, soften the edge."""
    solid = ndimage.binary_opening(a > 0.5, iterations=1)
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= max(30, 0.02 * solid.sum())])
        solid = ndimage.binary_fill_holes(ndimage.binary_closing(keep, iterations=2))
    a = np.maximum(a * ndimage.binary_dilation(solid, iterations=1), solid.astype(np.float32))
    return np.clip(ndimage.gaussian_filter(a, 0.7), 0, 1)


def save(name, img, alpha, scale=1.0):
    rgba = np.dstack([img, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:
        im = im.crop(bb)
    if scale != 1.0:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'))
    return im.size


manifest = {}


def cut(name, box, kind, **kw):
    x0, y0, x1, y1 = box
    crop = sheet[y0:y1, x0:x1].copy()
    if 'fix' in kw:
        kw.pop('fix')(crop)
    kw.pop('core', None); kw.pop('lo', None); kw.pop('hi', None)
    size = save(name, crop, matte(crop, feather=kw.pop('feather', 0.22)))
    manifest[name] = {'kind': kind, 'w': size[0], 'h': size[1], **kw}


def deflag(crop):
    """Paint over the emblem on the Ceramite mine's banner with plain banner red."""
    region = crop[62:108, 134:166]
    red = (region[..., 0] > 110) & (region[..., 1] < 70)
    emblem = ndimage.binary_dilation((region[..., 0] > 130) & (region[..., 1] > 80) & (region[..., 2] < 140), iterations=1)
    emblem &= ndimage.binary_dilation(red, iterations=3)
    if red.any():
        region[emblem] = np.median(region[red], axis=0)


# ---------------------------------------------------------------- mines
cut('mine_adamantium', (28, 6, 218, 152), 'mine')
cut('mine_ceramite', (266, 18, 472, 144), 'mine', fix=deflag)
cut('mine_plasteel', (508, 12, 708, 142), 'mine')
cut('mine_blackstone', (738, 6, 928, 142), 'mine')
cut('mine_auramite', (122, 182, 308, 322), 'mine')
cut('mine_wraithbone', (382, 170, 572, 322), 'mine')
cut('mine_psycrystal', (638, 180, 852, 322), 'mine')

# ---------------------------------------------------------------- obstacles (impassable)
cut('rock_a', (4, 556, 82, 634), 'block')
cut('rock_c', (138, 556, 198, 604), 'block')
cut('rock_d', (108, 598, 152, 642), 'block')
cut('rock_e', (182, 566, 252, 642), 'block')
cut('rock_f', (383, 432, 444, 522), 'block')
cut('rock_g', (4, 360, 80, 405), 'block')
cut('crystal_blue', (284, 574, 337, 642), 'block')
cut('crystal_blue_s', (254, 556, 292, 592), 'block')
cut('crystal_purple', (336, 556, 392, 642), 'block')
cut('spires_black', (412, 552, 484, 642), 'block')
cut('tree_dead', (492, 556, 562, 642), 'block')
cut('tree_teal', (578, 562, 628, 642), 'block')
cut('tree_mushroom', (636, 572, 692, 642), 'block')
cut('tree_orange', (688, 556, 728, 632), 'block')
cut('tree_pine', (440, 382, 492, 462), 'block')
cut('tree_purple', (244, 378, 304, 440), 'block')
cut('ruin_bridge', (742, 558, 858, 628), 'block')
cut('ruin_gate', (862, 552, 968, 642), 'block')
cut('cave_crystal', (762, 356, 972, 492), 'block')

# ---------------------------------------------------------------- decorations (walkable)
cut('crater_big', (542, 388, 668, 440), 'decor', lo=7, hi=18)
cut('crater_small', (628, 452, 668, 482), 'decor', lo=7, hi=18)
cut('skeleton', (658, 482, 742, 524), 'decor', lo=7, hi=18)
cut('bush_purple', (496, 446, 552, 508), 'decor')
cut('bush_green', (572, 482, 608, 528), 'decor')
cut('bush_teal', (440, 352, 480, 380), 'decor')
cut('stones_s', (84, 576, 112, 602), 'decor')

# ---------------------------------------------------------------- resource icons (parchment background)
pbox = [(15, 30, 120, 85), (25, 300, 160, 340)]
ppix = np.concatenate([res_sheet[y0:y1, x0:x1].reshape(-1, 3) for x0, y0, x1, y1 in [(2, 2, 22, 95), (140, 10, 170, 95), (236, 340, 264, 400), (436, 340, 470, 400)]])
ptree = cKDTree(ppix[rng.choice(len(ppix), size=min(3000, len(ppix)), replace=False)])


def key_parch(crop, lo, hi):
    d, _ = ptree.query(crop.reshape(-1, 3), k=3)
    return np.clip((d.mean(axis=1).reshape(crop.shape[:2]) - lo) / (hi - lo), 0, 1)


def icon(name, box, fix=None):
    x0, y0, x1, y1 = box
    crop = res_sheet[y0:y1, x0:x1].copy()
    if fix:
        fix(crop)
    a = key_matte(crop, key_parch(crop, 9, 22))
    rgba = np.dstack([crop, a * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(bb) if bb else im
    side = max(im.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'icon_' + name + '.png'))


def plain_ceramite(crop):
    """Remove the emblem stamped on the ceramite plates."""
    region = crop[0:40, 35:95]
    plate = (region[..., 0] > 120) & (region[..., 1] < 85)
    mark = (region[..., 1] > 95) & (region[..., 0] > 140)
    if plate.any():
        region[ndimage.binary_dilation(mark, iterations=1)] = np.median(region[plate], axis=0)


icon('adamantium', (22, 12, 120, 92))
icon('ceramite', (188, 8, 308, 98), fix=plain_ceramite)
icon('plasteel', (360, 16, 468, 98))
icon('blackstone', (522, 4, 628, 98))
icon('auramite', (62, 326, 178, 402))
icon('wraithbone', (272, 332, 382, 402))
icon('psycrystal', (492, 330, 592, 402))

# ---------------------------------------------------------------- tileable ground
S = 512
acc = np.zeros((S, S, 3), np.float32)
wsum = np.zeros((S, S), np.float32)
P = 40
patches = []
for x0, y0, x1, y1 in GROUND:
    for _ in range(60):
        if x1 - x0 < 12 or y1 - y0 < 12:
            break
        w = min(P, x1 - x0); h = min(P, y1 - y0)
        px = rng.integers(x0, x1 - w + 1); py = rng.integers(y0, y1 - h + 1)
        patches.append(sheet[py:py + h, px:px + w])
for _ in range(1400):
    p = patches[rng.integers(len(patches))]
    h, w = p.shape[:2]
    wt = ellipse(h, w, cy=0.5, rx=0.5, ry=0.5, soft=0.6) + 1e-4
    ox, oy = rng.integers(S), rng.integers(S)
    ys = (np.arange(h) + oy) % S; xs = (np.arange(w) + ox) % S
    acc[np.ix_(ys, xs)] += p * wt[..., None]
    wsum[np.ix_(ys, xs)] += wt
ground = acc / np.maximum(wsum, 1e-3)[..., None]
Image.fromarray(np.clip(ground, 0, 255).astype(np.uint8)).save(os.path.join(ROOT, 'assets', 'ground.png'))

with open(os.path.join(ROOT, 'assets', 'sprites.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
print(len(manifest), 'sprites written')

# ---------------------------------------------------------------- unit sprites (already transparent)
def unit_sprite(src, name, height=240):
    im = Image.open(os.path.join(SRC, src)).convert('RGBA')
    a = np.asarray(im).copy()
    white = (a[..., 0] > 232) & (a[..., 1] > 232) & (a[..., 2] > 232)
    edge = ndimage.binary_dilation(a[..., 3] < 30, iterations=2)
    a[white & edge, 3] = 0
    im = Image.fromarray(a, 'RGBA')
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'))
    manifest[name] = {'kind': 'unit', 'w': im.width, 'h': im.height}


unit_sprite('t1-base.png', 'unit_levy')
unit_sprite('t1-upgraded.png', 'unit_levy_u')
unit_sprite('t3-base.webp', 'unit_knight')
unit_sprite('t3-upgraded.png', 'unit_knight_u')
unit_sprite('town-concord.webp', 'town_concord', height=320)
unit_sprite('t5-base.webp', 'unit_stormhammer')
unit_sprite('t5-upgraded.webp', 'unit_stormhammer_u')
with open(os.path.join(ROOT, 'assets', 'sprites.json'), 'w') as f:
    json.dump(manifest, f, indent=1)

# ---------------------------------------------------------------- adventure-map sites (transparent concept sheet)
SITE_BOXES = {
    'site_riftgate': (78, 6, 486, 348), 'site_observatory': (587, 6, 995, 342), 'site_citadel': (1081, 10, 1484, 363),
    'site_reactor': (39, 362, 461, 690), 'site_foundry': (551, 353, 979, 676), 'site_arena': (1030, 391, 1512, 676),
    'site_shrine': (76, 698, 509, 1013), 'site_turbine': (560, 678, 990, 1013), 'site_penal': (1057, 673, 1517, 1015),
}
_sites = Image.open(os.path.join(SRC, 'map-sites.webp')).convert('RGBA')
for name, box in SITE_BOXES.items():
    im = _sites.crop(box)
    a = np.asarray(im).copy()
    # keep only the largest opaque piece (drops slivers of neighbouring structures)
    m = ndimage.binary_closing(a[..., 3] > 40, iterations=4)
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = ndimage.binary_dilation(lab == (int(np.argmax(sizes)) + 1), iterations=3)
        a[..., 3] = np.where(keep, a[..., 3], 0)
    a[..., 3] = np.where(a[..., 3] < 30, 0, a[..., 3])
    im = Image.fromarray(a, 'RGBA').transpose(Image.FLIP_LEFT_RIGHT)   # face down-left like the mines
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    k = 240 / im.width
    im = im.resize((240, round(im.height * k)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'))
    manifest[name] = {'kind': 'site', 'w': im.width, 'h': im.height}
with open(os.path.join(ROOT, 'assets', 'sprites.json'), 'w') as f:
    json.dump(manifest, f, indent=1)

# ---------------------------------------------------------------- unit sprites on white backgrounds (jpg)
def white_unit(src, name, height=240):
    a = np.asarray(Image.open(os.path.join(SRC, src)).convert('RGB')).astype(np.float32)
    lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2)
    light = (a.min(axis=2) > 175) | ((lum > 165) & (sat < 60))      # paper white and pale ground shadow
    lab, _ = ndimage.label(light)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    keep = ndimage.binary_opening(~bg, iterations=1)
    lab2, k2 = ndimage.label(keep)
    if k2 > 1:
        sizes = ndimage.sum(keep, lab2, range(1, k2 + 1))
        keep = np.isin(lab2, [i + 1 for i, v in enumerate(sizes) if v > 0.01 * keep.sum()])
    alpha = ndimage.gaussian_filter(keep.astype(np.float32), 0.7) * 255
    im = Image.fromarray(np.dstack([a, alpha]).astype(np.uint8), 'RGBA')
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox())
    im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'))
    manifest[name] = {'kind': 'unit', 'w': im.width, 'h': im.height}


white_unit('t2c-base.jpg', 'unit_dread')
white_unit('t2c-up.jpg', 'unit_dread_u')
white_unit('t2h-base.jpg', 'unit_berserker')
white_unit('t2h-up.jpg', 'unit_berserker_u')
with open(os.path.join(ROOT, 'assets', 'sprites.json'), 'w') as f:
    json.dump(manifest, f, indent=1)

# ---------------------------------------------------------------- map chest (white background)
_c = np.asarray(Image.open(os.path.join(SRC, 'chest.png')).convert('RGBA')).astype(np.float32)
_light = _c[..., :3].min(axis=2) > 225
_lab, _ = ndimage.label(_light)
_b = np.unique(np.concatenate([_lab[0], _lab[-1], _lab[:, 0], _lab[:, -1]]))
_c[..., 3] = ndimage.gaussian_filter((~np.isin(_lab, _b[_b > 0])).astype(np.float32), 0.7) * 255
_ci = Image.fromarray(_c.astype(np.uint8), 'RGBA')
_ci = _ci.crop(_ci.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox())
_ci.thumbnail((160, 160), Image.LANCZOS)
_ci.save(os.path.join(OUT, 'chest_map.png'))
manifest['chest_map'] = {'kind': 'decor', 'w': _ci.width, 'h': _ci.height}
with open(os.path.join(ROOT, 'assets', 'sprites.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
