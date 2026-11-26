"""Remove flat, unsaturated grey left from the sheet background between branches, chains and wire
on the small obstacle pieces (trees, scrap, ruins). Real bark and stone have texture; the leftover
grey is smooth, so only smooth light-grey patches are cleared."""
import json, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
names = sys.argv[1:] or [f'{p}_{i}' for p in ('ow', 'owb', 'ov') for i in list(range(0, 15)) + list(range(20, 25))]
for n in names:
    path = f'assets/sprites/{n}.png'
    try: a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
    except FileNotFoundError: continue
    rgb, al = a[..., :3], a[..., 3]
    sat = rgb.max(2) - rgb.min(2); lum = rgb.mean(2)
    m = ndimage.uniform_filter(lum, 5); sd = np.sqrt(np.maximum(ndimage.uniform_filter(lum ** 2, 5) - m ** 2, 0))
    grey = (al > 10) & (sat < 12) & (lum > 108) & (lum < 180) & (sd < 6)
    grey = ndimage.binary_opening(grey, iterations=1)
    lab, k = ndimage.label(grey)
    if not k: continue
    sizes = ndimage.sum(grey, lab, range(1, k + 1))
    kill = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 25])
    if kill.sum() < 30: continue
    soft = ndimage.gaussian_filter(kill.astype(np.float32), 0.8)
    a[..., 3] = al * (1 - np.clip(soft * 1.4, 0, 1))
    Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA').save(path)
    print(n, int(kill.sum()))
