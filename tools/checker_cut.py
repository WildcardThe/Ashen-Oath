"""Cut images that were exported with a painted transparency checkerboard instead of real alpha.
The two checker colours are measured on the border. Background = unsaturated pixels close to either
colour that connect to the border (the squares touch each other, so the whole board connects).
Semi-transparent glow, mist and smoke get a soft alpha from their distance to the nearer checker
colour and are un-mixed from it, so no checker pattern shows through them."""
import numpy as np
from PIL import Image
from scipy import ndimage


def _two_colours(px):
    l = px.mean(1); a, b = np.percentile(l, 15), np.percentile(l, 85)
    for _ in range(10):
        m = np.abs(l - a) < np.abs(l - b)
        a, b = l[m].mean(), l[~m].mean()
    m = np.abs(l - a) < np.abs(l - b)
    return px[m].mean(0), px[~m].mean(0)


def cut(path, thr=24):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = a.shape[:2]
    border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    c0, c1 = _two_colours(border)
    d0 = np.sqrt(((a - c0) ** 2).sum(2)); d1 = np.sqrt(((a - c1) ** 2).sum(2))
    d = np.minimum(d0, d1); bgc = np.where((d0 < d1)[..., None], c0, c1)
    # pixels on the edge between two squares (jpeg blur) sit between the two colours: also background
    lo, hi = sorted([c0.mean(), c1.mean()]); lum = a.mean(2); sat = a.max(2) - a.min(2)
    between = (lum > lo - 6) & (lum < hi + 6) & (sat < 14)
    cand = ((d < thr) | between)
    lab, _ = ndimage.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = np.isin(lab, edge[edge > 0])
    solid = ndimage.binary_opening(~bgm, iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=4))
    if n > 1:
        sz = ndimage.sum(solid, lab, range(1, n + 1)); big = sz.max()
        solid &= np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > big * 0.01])
    # checker seen through gaps (between masts, cables, under smoke plumes) is enclosed: remove it too
    for _ in range(2):
        pocket = solid & (d < thr) & (sat < 16)
        pl, pn = ndimage.label(pocket)
        if not pn: break
        ps = ndimage.sum(pocket, pl, range(1, pn + 1))
        solid &= ~ndimage.binary_dilation(np.isin(pl, [i + 1 for i, v in enumerate(ps) if v > 25]), iterations=1)
        bgm |= ~solid & ~bgm & (d < thr * 1.4)
    # leftover specks of checker in the upper part (around spires, smoke and masts)
    upper = np.arange(H)[:, None] < H * 0.6
    speck = solid & upper & (d < thr * 0.9) & (sat < 12)
    sl, sn = ndimage.label(speck)
    if sn:
        ss = ndimage.sum(speck, sl, range(1, sn + 1))
        solid &= ~ndimage.binary_dilation(np.isin(sl, [i + 1 for i, v in enumerate(ss) if v > 10]), iterations=1)
    # square size: median run length of light/dark along the border
    runs = []
    for v in (a[2].mean(1), a[-3].mean(1), a[:, 2].mean(1), a[:, -3].mean(1)):
        b = v > (c0.mean() + c1.mean()) / 2; t = np.nonzero(np.diff(b.astype(int)))[0]
        if len(t) > 3: runs += list(np.diff(t))
    sq = int(round(np.median(runs))) if runs else 16
    # smoke and mist painted over the checker: the pattern shows through them. Such pixels look like
    # their neighbour two squares away but not like the one a single square away.
    L = ndimage.gaussian_filter(lum, 1.0)
    def sh(dx, dy): return np.roll(np.roll(L, dy, 0), dx, 1)
    one = (np.abs(L - sh(sq, 0)) + np.abs(L - sh(0, sq)) + np.abs(L - sh(-sq, 0)) + np.abs(L - sh(0, -sq))) / 4
    two = (np.abs(L - sh(2 * sq, 0)) + np.abs(L - sh(0, 2 * sq)) + np.abs(L - sh(-2 * sq, 0)) + np.abs(L - sh(0, -2 * sq))) / 4
    amp = abs(c0.mean() - c1.mean())
    pattern = (one > amp * 0.15) & (two < one * 0.5) & (sat < 30)
    pattern = ndimage.binary_opening(pattern, iterations=2)
    pattern = ndimage.binary_dilation(pattern, iterations=2) & ~bgm
    if pattern.any():
        k = int(sq * 2) | 1
        mx = ndimage.maximum_filter(L, k); mn = ndimage.minimum_filter(L, k)
        a_s = np.clip(1 - (mx - mn) / max(amp, 1), 0.12, 0.92)
        mean_bg = (c0 + c1) / 2
        m = ndimage.uniform_filter(a, (k, k, 1))
        col_s = np.clip(mean_bg + (m - mean_bg) / a_s[..., None], 0, 255)
        a = np.where(pattern[..., None], col_s, a)
        # smoke is kept faint, so any checker residue in it is barely visible over the valley
        smoke_alpha = np.where(pattern, a_s * 0.55, 0)
    else:
        smoke_alpha = np.zeros((H, W))
    # glow / mist over the checker: kept as soft alpha near the building
    near = ndimage.binary_dilation(solid, iterations=30)
    glow = near & bgm & (sat > 18) & (d > 10)
    soft = np.where(glow, np.clip((d - 8) / 60, 0, 0.9), 0)
    alpha = np.maximum(ndimage.gaussian_filter(solid.astype(np.float32), 0.7) * solid, soft)
    alpha = np.where(solid & ndimage.binary_erosion(solid, iterations=1), 1.0, alpha)
    alpha = np.where(pattern, np.minimum(alpha, smoke_alpha) if pattern.any() else alpha, alpha)
    alpha = np.where(alpha < 0.05, 0, alpha)
    rgb = np.clip(bgc + (a - bgc) / np.maximum(alpha, 0.3)[..., None], 0, 255)
    rgb = np.where((alpha > 0.95)[..., None] | pattern[..., None], a, rgb)
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)
