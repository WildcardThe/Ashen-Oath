"""Cut the obstacle sheet (assets/source/obstacles_sheet.png: mountains, lava pools, volcanic rocks on snow)
into individual transparent sprites: obst_mtn_1..6, obst_lava_1..6, obst_volc_1..6."""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'sprites')
MAN = os.path.join(ROOT, 'assets', 'sprites.json')
a = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'source', 'obstacles_sheet.png')).convert('RGB')).astype(np.float32)
H, W = a.shape[:2]
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = a.mean(2); sat = a.max(2) - a.min(2)
# snow and its blue-grey shadows and footprints: bright, unsaturated, not warm
snow = ((a.min(2) > 168) | ((lum > 132) & (sat < 34) & (b >= r - 4)) | ((b > r + 8) & (b >= g) & (lum > 95)))
obj = ~snow
obj[:16] = False                                   # the wooden border along the top edge
obj = ndimage.binary_opening(obj, iterations=1)
obj = ndimage.binary_fill_holes(ndimage.binary_closing(obj, iterations=2))
lab, n = ndimage.label(obj)
sizes = ndimage.sum(obj, lab, range(1, n + 1))
keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 120])
# group fragments belonging to one object (smoke puffs, loose rocks) by proximity
grp, gn = ndimage.label(ndimage.binary_dilation(keep, iterations=7))
objs = []
for i in range(1, gn + 1):
    m = keep & (grp == i)
    if m.sum() < 600: continue
    ys, xs = np.nonzero(m)
    objs.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, m))
# order by row band then left to right
band = lambda o: 0 if (o[0] + o[1]) / 2 < 135 else 1 if (o[0] + o[1]) / 2 < 245 else 2
names = ['obst_mtn_%d', 'obst_lava_%d', 'obst_volc_%d']
manifest = json.load(open(MAN))
rows = {}
for o in objs: rows.setdefault(band(o), []).append(o)
for k in rows: rows[k].sort(key=lambda o: o[2])
print({k: len(v) for k, v in rows.items()})
for ri, key in enumerate(sorted(rows)):
    for ci, (y0, y1, x0, x1, m) in enumerate(rows[key]):
        al = ndimage.gaussian_filter(m.astype(np.float32), 0.6)
        # soft edge: pixels close to snow colour fade out so no white fringe remains
        whiteness = np.clip((lum - 120) / 80, 0, 1) * np.clip(1 - sat / 40, 0, 1)
        al = al * (1 - 0.85 * whiteness * (ndimage.binary_erosion(m, iterations=2) == 0))
        # smooth light-grey cast shadows (painted onto snow) become a soft dark shadow on any ground
        loc = ndimage.uniform_filter(lum, 5); var = np.sqrt(np.maximum(ndimage.uniform_filter(lum ** 2, 5) - loc ** 2, 0))
        shadow = m & (lum > 112) & (sat < 30) & (var < 14) & (r < 215)
        shadow = ndimage.binary_opening(shadow, iterations=1)
        rgb = a.copy()
        rgb[shadow] = 0
        al = np.where(shadow, al * 0.38, al)
        al = np.where(m & (a.min(2) > 176) & ~shadow, 0, al)       # left-over snow specks
        rgba = np.dstack([rgb, al * 255])[max(0, y0 - 2):y1 + 2, max(0, x0 - 2):x1 + 2]
        im = Image.fromarray(rgba.astype(np.uint8), 'RGBA')
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        # the sheet is low resolution: upscale 2x so the sprites stay crisp at map zoom
        im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
        nm = names[min(ri, 2)] % (ci + 1)
        im.save(os.path.join(OUT, nm + '.png'))
        manifest[nm] = {'kind': 'decor', 'w': im.width, 'h': im.height}
        print(nm, im.size)
json.dump(manifest, open(MAN, 'w'), indent=1)
