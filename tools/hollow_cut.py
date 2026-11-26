"""Cut a building out of a generated picture on a flat grey/cream background.

cut(rgb) -> (rgba float 0..1, info)
- the background is modelled as a smooth field (it has vignettes and light gradients), estimated from
  the pixels connected to the border and filled inwards;
- the building is everything clearly different from that field; smoke and glow that are only partly
  different become semi-transparent and are un-mixed from the background colour;
- the floating rock island most generators put under a building is faded out below its rim, so the
  building stands on the ground of the town picture instead of floating above it.
"""
import numpy as np
from scipy import ndimage


def smooth_fill(vals, mask, sigma):
    """normalised convolution: spread the known values (mask) over the whole image"""
    num = ndimage.gaussian_filter(np.where(mask[..., None], vals, 0), (sigma, sigma, 0))
    den = ndimage.gaussian_filter(mask.astype(np.float32), sigma)[..., None]
    return num / np.maximum(den, 1e-4)


def cut(rgb, keep_island=0.0, island=True):
    a = rgb.astype(np.float32)
    H, W = a.shape[:2]
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    # first guess of the background: bright, unsaturated, connected to the border
    guess = (lum > 120) & (sat < 30)
    lab, _ = ndimage.label(guess)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = np.isin(lab, edge[edge > 0])
    bg = smooth_fill(a, ndimage.binary_erosion(bgm, iterations=3), 25)
    for _ in range(2):   # refine with the better field
        d = np.sqrt(((a - bg) ** 2).sum(2))
        cand = d < 18
        lab, _ = ndimage.label(cand)
        edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        bgm = np.isin(lab, edge[edge > 0])
        bg = smooth_fill(a, ndimage.binary_erosion(bgm, iterations=2), 18)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    bl = bg.mean(2)
    # solid body: strongly different, or saturated
    # light, grey and smooth = background haze (pale stone is textured, so it stays)
    loc0 = ndimage.uniform_filter(lum, 7); std0 = np.sqrt(np.maximum(ndimage.uniform_filter(lum ** 2, 7) - loc0 ** 2, 0))
    haze = (lum > bl - 14) & (sat < 20) & (std0 < 6)
    solid = ((d > 55) | ((sat > 45) & (d > 25))) & ~haze
    solid = ndimage.binary_opening(solid, iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=4))
    if n > 1:
        sz = ndimage.sum(solid, lab, range(1, n + 1)); big = sz.max()
        solid &= np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > big * 0.02])
    solid = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=2))
    # enclosed pockets of background (between spires, cranes and chimneys) are background too
    pocket = ndimage.binary_opening(solid & (d < 16) & (sat < 20), iterations=2)   # compact pale holes, not thin mortar lines
    pl, pn = ndimage.label(pocket)
    if pn:
        ps = ndimage.sum(pocket, pl, range(1, pn + 1))
        solid &= ~np.isin(pl, [i + 1 for i, v in enumerate(ps) if v > 80])
    # soft parts (smoke, glow, thin spikes): partial alpha by how far they are from the background
    darker = np.clip((bl - lum) / np.maximum(bl, 1), 0, 1)
    # smoke is darker than the background; glow is saturated; anything pale and grey is background
    soft = np.where(sat > 35, np.clip((d - 14) / 90, 0, 1), 0)
    soft = np.maximum(soft, np.clip((darker - 0.06) * 1.8, 0, 1))
    near = ndimage.binary_dilation(solid, iterations=60)   # smoke and glow belong near the building
    alpha = np.where(solid, 1.0, np.where(near, soft, 0))
    # smoke plumes: grey, unsaturated and smooth (stone and metal are textured) -> see-through
    loc = ndimage.uniform_filter(lum, 7); std = np.sqrt(np.maximum(ndimage.uniform_filter(lum ** 2, 7) - loc ** 2, 0))
    smoke = solid & (sat < 26) & (std < 7) & (lum > 38)
    smoke = ndimage.binary_opening(smoke, iterations=2)
    sl, sn = ndimage.label(smoke)
    if sn:
        ss = ndimage.sum(smoke, sl, range(1, sn + 1))
        smoke = np.isin(sl, [i + 1 for i, v in enumerate(ss) if v > 150])
    smoke = ndimage.gaussian_filter(smoke.astype(np.float32), 1.5)
    alpha = alpha * (1 - smoke) + smoke * np.clip(darker * 1.5 + 0.1, 0, 0.92)
    alpha = np.where(alpha < 0.06, 0, alpha)
    alpha = np.maximum(alpha, ndimage.gaussian_filter(solid.astype(np.float32), 0.7) * (solid | ~bgm))
    # un-mix the background from semi-transparent pixels
    al3 = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip(bg + (a - bg) / al3, 0, 255)
    col = np.where((alpha > 0.97)[..., None], a, col)
    # smoke cut off by the top of the picture: dissolve it instead of ending in a straight line
    top = np.clip(np.arange(H) / 60, 0, 1)[:, None]
    alpha = alpha * top
    info = {}
    if island:
        # the island rim: the row where the solid body is widest in its lower half; below it, fade out
        rows = solid.sum(1); ys = np.nonzero(rows)[0]
        y0, y1 = ys.min(), ys.max()
        lower = np.arange(H) > (y0 + (y1 - y0) * 0.45)
        rim = int(np.argmax(np.where(lower, rows, 0)))
        fade = max(6, int((y1 - rim) * (0.55 + keep_island)))
        yy = np.arange(H)[:, None]
        k = np.clip(1 - (yy - rim) / fade, 0, 1)
        alpha = alpha * np.where(yy > rim, k ** 1.3, 1)
        info['rim'] = rim
    return np.dstack([col, alpha * 255]).astype(np.uint8), info
