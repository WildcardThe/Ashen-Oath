"""Test: a town painted as one picture. built.jpg (all buildings on the land) and empty.jpg (the same land, empty plots)
from assets/source/concord_test. Each building is cut out of built.jpg where the two differ, split into its spot by
position, and written as a layer that sits on empty.jpg at the exact spot it was painted.
Writes previews to the folder given as argument: the empty town, the full town and a mid-game town."""
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage
S = 'assets/source/concord_test'
OUT = sys.argv[1]
B = np.asarray(Image.open(f'{S}/built.jpg').convert('RGB')).astype(np.float32)
E = np.asarray(Image.open(f'{S}/empty.jpg').convert('RGB')).astype(np.float32)
H, W = B.shape[:2]
d = np.sqrt(((ndimage.gaussian_filter(B, (1.5, 1.5, 0)) - ndimage.gaussian_filter(E, (1.5, 1.5, 0))) ** 2).sum(2))
m = ndimage.binary_opening(d > 34, iterations=2)
m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=4))
lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
m = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 1500])
# spots: (key, x centre, ground y) in the 1376x768 picture, back to front; each mask pixel goes to its nearest spot,
# measured mostly sideways inside its row band
SPOTS = [('guild', 345, 290), ('fort', 715, 320), ('dw5', 1135, 300),
         ('hall', 225, 445), ('tavern', 540, 495), ('dw3', 880, 490), ('dw4', 1190, 520),
         ('dw2', 160, 690), ('market', 530, 715), ('depot', 880, 720), ('dw1', 1225, 700)]
ROWS = [(0, 330), (330, 540), (540, 768)]
yy, xx = np.mgrid[0:H, 0:W]
owner = np.full((H, W), -1)
for r, (y0, y1) in enumerate(ROWS):
    idx = [i for i, sp in enumerate(SPOTS) if y0 <= sp[2] <= y1 + 20 and (r == 0 and i < 3 or r == 1 and 3 <= i < 7 or r == 2 and i >= 7)]
    band = (yy >= y0) & (yy < y1) & m
    best = np.full((H, W), 1e9)
    for i in idx:
        dist = np.abs(xx - SPOTS[i][1])
        sel = band & (dist < best); owner[sel] = i; best[sel] = dist[sel]
# soft edges
alpha = ndimage.gaussian_filter(m.astype(np.float32), 1.0)
layers = {}
for i, (k, cx, gy) in enumerate(SPOTS):
    om = owner == i
    if not om.any(): continue
    ys, xs = np.nonzero(om); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    a = np.where(ndimage.binary_dilation(om, iterations=2), alpha, 0)[y0:y1, x0:x1]
    rgba = np.dstack([B[y0:y1, x0:x1], a * 255]).astype(np.uint8)
    layers[k] = (Image.fromarray(rgba, 'RGBA'), (int(x0), int(y0)))
def town(keys, name):
    im = Image.fromarray(E.astype(np.uint8)).convert('RGBA')
    for k, _, _ in SPOTS:                      # back to front
        if k in keys and k in layers: im.alpha_composite(layers[k][0], layers[k][1])
    im.convert('RGB').save(os.path.join(OUT, name), quality=88)
town(set(), 'tt_empty.jpg')
town({k for k, _, _ in SPOTS}, 'tt_full.jpg')
town({'fort', 'hall', 'tavern', 'dw1', 'dw2', 'guild'}, 'tt_mid.jpg')
print(sorted(layers), {k: v[0].size for k, v in layers.items()})
