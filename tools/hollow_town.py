"""Hollow Host town art: locate each building sprite in the reference painting, erase the buildings
with exemplar-based inpainting (Criminisi-style patch filling, sources taken only from untouched
pixels nearby), and export base.webp, building webps and meta.json for the town screen.
Run: python3 tools/hollow_town.py   (several minutes; the inpainting is pure numpy/scipy)"""
import json, os, sys, time
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.signal import fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'hollow_town')
OUT = os.path.join(ROOT, 'assets', 'town', 'hollow')
os.makedirs(OUT, exist_ok=True)

# sprite file -> spot in the town layout
SPOTS = {'castle': 'fort', 'city_hall': 'hall', 'mage_guild': 'guild', 'trading_building': 'market', 'tavern': 'tavern',
         'supply_depot': 'depot', '1_swordsmen_training': 'dw1', '2_archers_training': 'dw2', '3_knights_training': 'dw3',
         '4_mages_training': 'dw4', '5_berserkers_training': 'dw5'}
# every building key that stands on a spot (upgrades reuse the same picture for now)
KEYS = {'fort': ['fort', 'citadel', 'castle'], 'hall': ['hall1', 'hall2', 'hall3'], 'guild': ['mg1', 'mg2', 'mg3', 'mg4', 'mg5'],
        'market': ['market'], 'tavern': ['tavern'], 'depot': ['depot']}
for i in range(1, 6): KEYS['dw%d' % i] = ['dw%d' % i, 'dw%du' % i]

ref = np.asarray(Image.open(os.path.join(SRC, 'reference.webp')).convert('RGB')).astype(np.float32)
H, W = ref.shape[:2]


def locate(spr):
    """Exact position of a sprite cut from the reference (masked sum of squared differences)."""
    s = spr.astype(np.float32) / 255; r = ref / 255
    m = (s[..., 3] > 0.5).astype(np.float32); t = s[..., :3]
    a = fftconvolve((r ** 2).sum(2), m[::-1, ::-1], mode='valid')
    b = sum(fftconvolve(r[..., c], (m * t[..., c])[::-1, ::-1], mode='valid') for c in range(3))
    ssd = a - 2 * b
    y, x = np.unravel_index(np.argmin(ssd), ssd.shape)
    return int(x), int(y)


# The castle (fort) and the city hall are always standing, so they stay painted in the backdrop:
# nothing behind them needs inventing, and their walls can serve as fill sources next to them.
KEEP = {'castle', 'city_hall'}
# The supplied mage-guild sprite covers only the palace's top spires; cut the whole hilltop palace
# instead (outline traced on the painting) so the hill is bare until the guild is built.
GUILD_POLY = [(95, 545), (105, 420), (150, 400), (165, 330), (205, 300), (215, 215), (240, 300), (255, 230), (270, 210),
              (300, 260), (325, 140), (345, 250), (400, 170), (432, 55), (462, 165), (480, 150), (500, 210), (520, 190),
              (530, 120), (540, 70), (565, 85), (575, 140), (595, 250), (605, 290), (625, 330), (660, 315), (685, 350),
              (705, 400), (745, 420), (750, 548), (400, 556)]


def guild_sprite():
    from PIL import ImageDraw
    poly = [(1220 + px / 3, 20 + py / 3) for px, py in GUILD_POLY]
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    m = np.asarray(m) > 0
    m = ndimage.binary_fill_holes(m)
    a = ndimage.gaussian_filter(m.astype(np.float32), 0.8) * 255
    ys, xs = np.nonzero(a > 8)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([ref, a]).astype(np.uint8)[y0:y1, x0:x1]
    return rgba, int(x0), int(y0)


sprites, layout, hole = {}, {}, np.zeros((H, W), bool)
for name, spot in SPOTS.items():
    spr = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'))
    x, y = locate(spr)
    if name == 'mage_guild': spr, x, y = guild_sprite()
    sprites[name] = (spr, x, y)
    h, w = spr.shape[:2]
    m = np.zeros((H, W), bool); m[y:y + h, x:x + w] = spr[..., 3] > 8
    if name not in KEEP: hole |= ndimage.binary_dilation(m, iterations=4)
    if name == 'mage_guild': guild_hole = ndimage.binary_dilation(m, iterations=4)
    layout[spot] = [x + w / 2, y + h, 1.0, False]
    print(name, '->', spot, (x, y, w, h), flush=True)

# ------------------------------------------------------------------ exemplar-based inpainting
P = 7                      # patch half-size (15x15 patches)
WIN = 170                  # source search radius around the patch
img = ref.copy()
known = ~hole
orig_src = known.copy()    # only untouched pixels may be copied from
conf = known.astype(np.float32)
gray = img.mean(2)
lab, n = ndimage.label(hole)
ones = np.ones((2 * P + 1, 2 * P + 1), np.float32)
# a source patch is valid when all its pixels are original
valid_src = fftconvolve((~orig_src).astype(np.float32), ones, mode='same') < 0.5
valid_src[:P, :] = valid_src[-P:, :] = False; valid_src[:, :P] = valid_src[:, -P:] = False

t0 = time.time(); filled_total = 0; total = int(hole.sum())
it = 0
while True:
    unk = ~known
    if not unk.any(): break
    front = unk & ndimage.binary_dilation(known, iterations=1)
    fy, fx = np.nonzero(front)
    # priority = confidence term x data term (isophote strength across the front)
    gy, gx = np.gradient(np.where(known, gray, 0))
    ny, nx = np.gradient(ndimage.gaussian_filter(unk.astype(np.float32), 1.0))
    pri = np.empty(len(fy), np.float32)
    for k in range(len(fy)):
        y, x = fy[k], fx[k]
        y0, y1, x0, x1 = max(0, y - P), min(H, y + P + 1), max(0, x - P), min(W, x + P + 1)
        c = conf[y0:y1, x0:x1].sum() / ((2 * P + 1) ** 2)
        d = abs(-gy[y, x] * nx[y, x] + gx[y, x] * ny[y, x]) / 255 + 0.01
        pri[k] = c * d
    # fill a batch of well-separated high-priority patches per front evaluation
    order = np.argsort(-pri)
    taken = np.zeros((H, W), bool); batch = 0
    for k in order[:400]:
        y, x = int(fy[k]), int(fx[k])
        y = min(max(y, P), H - P - 1); x = min(max(x, P), W - P - 1)
        if taken[y - P:y + P + 1, x - P:x + P + 1].any(): continue
        ys, xs = slice(y - P, y + P + 1), slice(x - P, x + P + 1)
        tk = known[ys, xs].astype(np.float32)
        if tk.sum() == 0: continue
        tp = img[ys, xs]
        wy0, wy1, wx0, wx1 = max(P, y - WIN), min(H - P, y + WIN + 1), max(P, x - WIN), min(W - P, x + WIN + 1)
        reg = img[wy0 - P:wy1 + P, wx0 - P:wx1 + P]
        # SSD over known template pixels for every candidate centre in the window
        k2 = tk[::-1, ::-1]
        a = fftconvolve((reg ** 2).sum(2), k2, mode='valid')
        b = sum(fftconvolve(reg[..., c], (tk * tp[..., c])[::-1, ::-1], mode='valid') for c in range(3))
        ssd = a - 2 * b
        vm = valid_src[wy0:wy1, wx0:wx1]
        if not vm.any(): continue
        ssd = np.where(vm, ssd, np.inf)
        # mild preference for nearby sources keeps the fill coherent with its surroundings
        yy, xx = np.mgrid[wy0:wy1, wx0:wx1]
        ssd = ssd + ((yy - y) ** 2 + (xx - x) ** 2) * 0.02
        by, bx = np.unravel_index(np.argmin(ssd), ssd.shape)
        sy, sx = wy0 + by, wx0 + bx
        src = ref[sy - P:sy + P + 1, sx - P:sx + P + 1]
        fill = ~known[ys, xs]
        img[ys, xs][fill] = src[fill]
        cpatch = conf[ys, xs].sum() / ((2 * P + 1) ** 2)
        conf[ys, xs][fill] = cpatch
        known[ys, xs][fill] = True
        gray[ys, xs][fill] = src[fill].mean(1)
        taken[max(0, y - 2 * P):y + 2 * P + 1, max(0, x - 2 * P):x + 2 * P + 1] = True
        batch += 1
        if batch >= 24: break
    it += 1
    if it % 20 == 0:
        left = int((~known).sum()); print(f'iter {it}: {total - left}/{total} px, {time.time() - t0:.0f}s', flush=True)
    if batch == 0:  # safety: fall back to diffusion for anything unreachable
        img[~known] = ndimage.median_filter(img, size=5)[~known]; known[:] = True

# Sky and far mountains behind the hilltop palace are smooth: patches look blocky there, so fill that band
# row by row between the untouched sky on either side (the palace's blue glow halo goes with it).
Yg, Xg = np.mgrid[0:H, 0:W]
halo = (Xg > 1325) & (Xg < 1405) & (Yg < 100)
band = (guild_hole | halo) & (Yg < 152)
# just above the treeline the far mountains also came out blocky: take pale, bluish filled pixels there too
lum_f = img.mean(2)
haze = guild_hole & (Yg >= 152) & (Yg < 192) & (lum_f > 105) & (img[..., 2] >= img[..., 0] - 6)
haze = ndimage.binary_closing(haze, iterations=2) & guild_hole
band |= haze
src_ok = ~hole & ~halo
for y in np.unique(np.nonzero(band)[0]):
    row = band[y]; xs = np.nonzero(row)[0]
    # split into runs and interpolate across each one
    runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
    for r in runs:
        l, rr = r[0] - 1, r[-1] + 1
        while l > 0 and not src_ok[y, l]: l -= 1
        while rr < W - 1 and not src_ok[y, rr]: rr += 1
        t = ((r - l) / max(1, rr - l))[:, None]
        img[y, r] = ref[y, l] * (1 - t) + ref[y, rr] * t
sm = ndimage.gaussian_filter(np.where(band[..., None], img, 0), (3, 3, 0))
wt = ndimage.gaussian_filter(band.astype(np.float32), 3)[..., None]
img[band] = (sm / np.maximum(wt, 1e-3))[band] + np.random.default_rng(3).normal(0, 1.2, (int(band.sum()), 3))
# blend the band into the patch-filled hill below it
seam = ndimage.binary_dilation(band, iterations=3) & ~band & guild_hole
img[seam] = ndimage.gaussian_filter(img, (2, 2, 0))[seam]

# soften the seams a touch: blend a thin band along every hole edge
edge = ndimage.binary_dilation(hole, iterations=2) & ~ndimage.binary_erosion(hole, iterations=2)
blur = ndimage.uniform_filter(img, size=(3, 3, 1))
img[edge] = blur[edge]
base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')
base.save(os.path.join(OUT, 'base.webp'), quality=92)

meta = {'base': {'w': W, 'h': H}}
for name, spot in SPOTS.items():
    spr, x, y = sprites[name]
    im = Image.fromarray(spr, 'RGBA')
    area = int((spr[..., 3] > 128).sum())
    for key in KEYS[spot]:
        im.save(os.path.join(OUT, key + '.webp'), lossless=True)
        meta[key] = {'w': im.width, 'h': im.height, 'ow': im.width, 'oh': im.height, 'area': area}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
json.dump(layout, open(os.path.join(OUT, 'layout.json'), 'w'), indent=1)
print('done', time.time() - t0)
