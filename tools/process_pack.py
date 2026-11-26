"""Prepare the art pack in assets/source/pack (town, terrain, rivers, craters, commanders).

Usage:  python3 tools/process_pack.py
Writes: assets/town/concord/*.webp, assets/ground.png, assets/sprites/{crater_*,pond_*,goo_*,river_strip,commander_*}.png
        and re-tints the older map sprites (kept unchanged in assets/sprites_olive) so their grass edges suit the new ground.
"""
import json, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'assets', 'source', 'pack')
SPR = os.path.join(ROOT, 'assets', 'sprites')
OLIVE = os.path.join(ROOT, 'assets', 'sprites_olive')
TOWN = os.path.join(ROOT, 'assets', 'town', 'concord')
os.makedirs(TOWN, exist_ok=True)
rng = np.random.default_rng(11)


def img(name):
    return Image.open(os.path.join(PACK, name + '.png')).convert('RGBA')


def trim(im, thr=12):
    bb = im.getchannel('A').point(lambda v: 255 if v > thr else 0).getbbox()
    return im.crop(bb) if bb else im


manifest = {}

# ---------------------------------------------------------------- town
TOWN_FILES = {
    'base': 'Town Base image v2',
    'dw1': 'Barracks unupgraded', 'dw1u': 'Barracks upgraded',
    'dw2': 'Archery range unupgraded', 'dw2u': 'Archery range upgraded',
    'dw3': 'War foundry unupgraded', 'dw3u': 'War foundry Upgraded',
    'dw4': 'Beast Pens unupgraded', 'dw4u': 'Beast Pens upgraded',
    'dw5': 'Siege Workshop unupgraded', 'dw5u': 'Siege Workshop upgraded',
    'fort': 'Base Fort', 'citadel': 'Upgraded Fort', 'castle': 'Citadel',
    'hall1': 'Town Hall', 'hall2': 'City hall', 'hall3': 'Capitol',
    'tavern': 'Recruitment Hall', 'market': 'Trade Exchange', 'depot': 'Supply Depot',
    'mg1': 'Mage Guild lvl1', 'mg2': 'Mage Guild lvl2', 'mg3': 'Mage Guild lvl3', 'mg4': 'Mage Guild lvl4', 'mg5': 'Mage Guild lvl5',
}
BASE_CROP_TOP = 0  # full background, as in the layout mockup
town_meta = {}
for key, fname in TOWN_FILES.items():
    im = Image.open(os.path.join(PACK, fname + '.png'))
    if key == 'base':
        im = im.convert('RGB')
        im = im.crop((0, BASE_CROP_TOP, im.width, im.height))
        im.save(os.path.join(TOWN, 'base.webp'), quality=88)
        town_meta['base'] = {'w': im.width, 'h': im.height}
        continue
    im = trim(im.convert('RGBA'))
    ow, oh = im.size
    k = min(1.0, 560 / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(os.path.join(TOWN, key + '.webp'), quality=90, method=6)
    area = int((np.asarray(Image.open(os.path.join(PACK, fname + '.png')).convert('RGBA'))[..., 3] > 128).sum())
    town_meta[key] = {'w': im.width, 'h': im.height, 'ow': ow, 'oh': oh, 'area': area}
with open(os.path.join(TOWN, 'meta.json'), 'w') as f:
    json.dump(town_meta, f, indent=1)

# ---------------------------------------------------------------- commanders (square bust portraits)
for i in (1, 2):
    im = img(f'Commander {i}')
    im = trim(im)
    side = min(im.width, im.height)
    x0 = (im.width - side) // 2
    im = im.crop((x0, 0, x0 + side, side)).resize((256, 256), Image.LANCZOS)
    im.save(os.path.join(SPR, f'commander_{i}.png'))
    manifest[f'commander_{i}'] = {'kind': 'portrait', 'w': 256, 'h': 256}

# ---------------------------------------------------------------- ground texture
tex = np.asarray(img('main map terrain version additional')).astype(np.float32)
H, W = tex.shape[:2]
inner = tex[int(H * 0.08):int(H * 0.92), int(W * 0.08):int(W * 0.92)]
S, P = 512, 72
acc = np.zeros((S, S, 3), np.float32); wsum = np.zeros((S, S), np.float32)
yy, xx = np.mgrid[0:P, 0:P]
wt = np.clip(1 - np.hypot((xx + 0.5) / P * 2 - 1, (yy + 0.5) / P * 2 - 1), 0, 1) ** 1.5 + 1e-4
for _ in range(900):
    py = rng.integers(0, inner.shape[0] - P); px = rng.integers(0, inner.shape[1] - P)
    patch = inner[py:py + P, px:px + P, :3]
    if inner[py:py + P, px:px + P, 3].min() < 200:
        continue
    oy, ox = rng.integers(S), rng.integers(S)
    ys = (np.arange(P) + oy) % S; xs = (np.arange(P) + ox) % S
    acc[np.ix_(ys, xs)] += patch * wt[..., None]; wsum[np.ix_(ys, xs)] += wt
ground = acc / np.maximum(wsum, 1e-3)[..., None]
Image.fromarray(np.clip(ground, 0, 255).astype(np.uint8)).save(os.path.join(ROOT, 'assets', 'ground.png'))
GROUND_MEAN = ground.reshape(-1, 3).mean(axis=0)

# goo patches from the large terrain tile (pools with rocks), soft round edges
big = img('main map terrain version')
for i, (cx, cy) in enumerate([(240, 300), (700, 262), (250, 715), (735, 690)], 1):
    r = 135
    crop = big.crop((cx - r, cy - r, cx + r, cy + r))
    a = np.asarray(crop).astype(np.float32)
    yy, xx = np.mgrid[0:2 * r, 0:2 * r]
    d = np.hypot(xx - r, yy - r) / r
    a[..., 3] *= np.clip((1 - d) / 0.35, 0, 1)
    Image.fromarray(a.astype(np.uint8), 'RGBA').resize((180, 180), Image.LANCZOS).save(os.path.join(SPR, f'goo_{i}.png'))
    manifest[f'goo_{i}'] = {'kind': 'decor', 'w': 180, 'h': 180}

# ---------------------------------------------------------------- craters and ponds (separate pieces on transparent sheets)
def pieces(name, boxes, prefix, start, maxside):
    sheet = img(name); out = []
    for k, (x0, y0, x1, y1) in enumerate(boxes):
        im = trim(sheet.crop((x0, y0, x1, y1)))
        s = min(1.0, maxside / max(im.size))
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        n = f'{prefix}_{start + k}'
        im.save(os.path.join(SPR, n + '.png')); manifest[n] = {'kind': 'decor', 'w': im.width, 'h': im.height}
        out.append(n)
    return out

craters = pieces('Craters version 1', [(528, 300, 673, 440), (152, 442, 383, 671), (668, 519, 972, 850), (49, 834, 170, 955)], 'crater', 1, 200)
craters += pieces('Craters version 2', [(195, 156, 350, 306), (398, 359, 592, 593), (262, 618, 334, 688), (45, 702, 301, 910), (351, 725, 443, 817), (648, 744, 738, 830)], 'crater', 5, 200)
ponds = pieces('River and liquids version1', [(803, 438, 967, 563)], 'pond', 1, 170)
ponds += pieces('River and liquids version2', [(378, 702, 499, 798), (853, 726, 1006, 869)], 'pond', 2, 170)

# ---------------------------------------------------------------- seamless river strip from the straight piece
seg = np.asarray(img('River and liquids version1').crop((597, 537, 695, 777))).astype(np.float32)
band = seg[34:214]              # solid middle, without the faded ends
L, X = 150, 30                  # tile length and cross-fade length
strip = band[:L].copy()
for i in range(X):
    t = i / (X - 1)
    strip[i] = band[L + i] * (1 - t) + band[i] * t
Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(SPR, 'river_strip.png'))
manifest['river_strip'] = {'kind': 'river', 'w': strip.shape[1], 'h': strip.shape[0]}

# ---------------------------------------------------------------- re-tint grass edges of the older map sprites
if not os.path.isdir(OLIVE):
    shutil.copytree(SPR, OLIVE, ignore=shutil.ignore_patterns('crater_*', 'pond_*', 'goo_*', 'river_*', 'commander_*', 'icon_*', 'unit_*', 'town_*'))
target = GROUND_MEAN / max(1.0, GROUND_MEAN.mean())
for fn in sorted(os.listdir(OLIVE)):
    if not fn.endswith('.png') or fn.startswith(('icon_', 'unit_', 'town_')):
        continue
    a = np.asarray(Image.open(os.path.join(OLIVE, fn)).convert('RGBA')).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    lum = rgb.mean(axis=2); sat = (mx - mn) / np.maximum(mx, 1)
    grass = (g >= r * 0.95) & (g > b * 1.08) & (lum < 150) & (sat < 0.6)
    fringe = al < 0.97
    if fn.startswith('mine_') or fn.startswith(('cave_', 'ruin_')):
        # Buildings carry grass inside their crop too; only bright, saturated greens (glowing crystals) are kept.
        sel = grass | (fringe & (sat < 0.5))
    else:
        sel = grass & ndimage.binary_dilation(fringe, iterations=6)
    tinted = lum[..., None] * target[None, None, :]
    w = np.where(sel, 0.85, 0.0)[..., None]
    rgb2 = rgb * (1 - w) + tinted * w
    out = np.dstack([np.clip(rgb2, 0, 255), a[..., 3]]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(SPR, fn))

# merge into the sprite manifest
mp = os.path.join(ROOT, 'assets', 'sprites.json')
m = json.load(open(mp))
for k in [k for k in m if k.startswith(('crater_', 'pond_', 'goo_', 'commander_')) or k in ('crater_big', 'crater_small')]:
    m.pop(k, None)
m.update(manifest)
json.dump(m, open(mp, 'w'), indent=1)
print('town', len(town_meta), 'pieces', len(manifest))

# ---------------------------------------------------------------- main menu art
mc = trim(img('Commander 1'))
mc = mc.resize((820, round(mc.height * 820 / mc.width)), Image.LANCZOS)
ma = np.asarray(mc).copy(); ma[..., 3] = np.where(ma[..., 3] < 40, 0, ma[..., 3])
Image.fromarray(ma).save(os.path.join(ROOT, 'assets', 'menu_commander.webp'), quality=90)

# head-focused commander portraits (overrides the plain crops above)
exec(open(os.path.join(ROOT, 'tools', 'commander_crops.py')).read())
