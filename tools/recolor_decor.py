"""Recolour map decorations painted for the old purple ground to suit the brown/tan ground textures.
Craters: luminance remapped onto an earth ramp. Acid pools and goo: purple/magenta stone and halos
turned into weathered brown stone; the green acid is left alone. Reads assets/source/decor_purple."""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'decor_purple')
OUT = os.path.join(ROOT, 'assets', 'sprites')


def rgb_to_hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6; h[gg] = (b - r)[gg] / d[gg] + 2; h[bb] = (r - g)[bb] / d[bb] + 4
    return h * 60, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx


def hsv_to_rgb(h, s, v):
    c = v * s; x = c * (1 - np.abs((h / 60) % 2 - 1)); m = v - c
    z = np.zeros_like(h); k = (h // 60).astype(int) % 6
    r = np.choose(k, [c, x, z, z, x, c]); g = np.choose(k, [x, c, c, x, z, z]); b = np.choose(k, [z, z, x, c, c, x])
    return np.stack([r + m, g + m, b + m], -1)


EARTH = np.array([[30, 22, 17], [72, 54, 42], [128, 100, 78], [176, 146, 116], [212, 186, 154]], np.float32) / 255


def crater(name):
    a = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')).astype(np.float32) / 255
    lum = a[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32)
    lo, hi = np.percentile(lum[a[..., 3] > 0.5], [2, 98])
    t = np.clip((lum - lo) / max(1e-3, hi - lo), 0, 1) * (len(EARTH) - 1)
    i = np.minimum(t.astype(int), len(EARTH) - 2); f = (t - i)[..., None]
    rgb = EARTH[i] * (1 - f) + EARTH[i + 1] * f
    return np.dstack([rgb, a[..., 3:]])


def pool(name):
    a = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')).astype(np.float32) / 255
    h, s, v = rgb_to_hsv(a[..., :3])
    purple = ((h > 230) & (h < 345)) & (s > 0.08)
    h2 = np.where(purple, 26.0, h); s2 = np.where(purple, np.minimum(s, 0.35) * 0.8, s); v2 = np.where(purple, v * 0.82, v)
    rgb = hsv_to_rgb(h2, s2, v2)
    # the soft outer halo (semi-transparent) fades out further so it reads as a damp stain, not a glow
    al = a[..., 3]; al = np.where(purple & (al < 0.7), al * 0.6, al)
    return np.dstack([rgb, al])


for n in ['crater_%d' % i for i in range(1, 11)]:
    Image.fromarray((crater(n) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, n + '.png'))
for n in ['goo_1', 'goo_2', 'goo_3', 'goo_4', 'pond_1', 'pond_2', 'pond_3', 'river_strip']:
    Image.fromarray((np.clip(pool(n), 0, 1) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, n + '.png'))
print('recoloured')
