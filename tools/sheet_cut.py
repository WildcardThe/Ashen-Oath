"""Cut figures out of loosely gridded animation sheets (grey or white backgrounds, uneven columns).
Each row band is split into figures by connected pieces, every figure is matted against the local
background, and the frames are written to a regular 5-column transparent sheet that
tools/t5h_sprites.anim_sheet turns into a game strip.

  frames_from_sheet(path, rows=[(y0, y1), ...], keep=None) -> list of RGBA arrays
  write_grid(frames, out_path, cell)
"""
import numpy as np
from PIL import Image
from scipy import ndimage


def matte(c, thr=34):
    c = c.astype(np.float32)
    border = np.concatenate([c[:4].reshape(-1, 3), c[-4:].reshape(-1, 3), c[:, :4].reshape(-1, 3), c[:, -4:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = np.sqrt(((c - bg) ** 2).sum(2)); sat = c.max(2) - c.min(2)
    fg = (d > thr) | ((sat > 40) & (d > min(18, thr)))
    fg = ndimage.binary_opening(fg, iterations=1)
    if thr < 20: fg = ndimage.binary_fill_holes(ndimage.binary_closing(fg, iterations=2))   # flat backgrounds: dark outlines close the shape
    return c, bg, d, sat, fg


def cut_figure(c, x0, x1, thr=34):
    """matte the region and keep the figure whose body lies in [x0, x1); flames and glow stay, stray
    projectiles and smoke far from the body go"""
    c, bg, d, sat, fg = matte(c, thr)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=3))
    if n == 0: return None
    sz = ndimage.sum(fg, lab, range(1, n + 1))
    cx = ndimage.center_of_mass(fg, lab, range(1, n + 1))
    best = max(range(n), key=lambda i: sz[i] if x0 <= cx[i][1] < x1 else -1)
    body = lab == best + 1
    fg &= body
    soft = np.clip((d - 14) / 70, 0, 1)
    alpha = np.where(ndimage.binary_dilation(fg, iterations=2), np.maximum(ndimage.gaussian_filter(fg.astype(np.float32), 0.7), soft * (sat > 35)), 0)
    alpha = np.where(alpha < 0.05, 0, alpha)
    rgb = np.clip(bg + (c - bg) / np.maximum(alpha, 0.3)[..., None], 0, 255)
    rgb = np.where((alpha > 0.9)[..., None], c, rgb)
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)


def frames_from_sheet(path, rows, min_area=2500):
    a = np.asarray(Image.open(path).convert('RGB'))
    out = []
    for (y0, y1) in rows:
        band = a[y0:y1]
        _, _, _, _, fg = matte(band)
        # figures: big pieces after joining flames to bodies; split the band at their centres
        lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=6))
        sz = ndimage.sum(fg, lab, range(1, n + 1))
        figs = sorted([ndimage.find_objects(lab)[i] for i in range(n) if sz[i] > min_area], key=lambda s: s[1].start)
        for s in figs:
            xa, xb = max(0, s[1].start - 30), min(a.shape[1], s[1].stop + 30)
            fr = cut_figure(band[:, xa:xb], s[1].start - xa, s[1].stop - xa)
            if fr is not None: out.append(fr)
    return out


def align_frames(frames):
    """Line every frame up on the creature's own feet: the centre of its lower body and its lowest
    opaque row. Removes the drift that comes from figures sitting at different spots in their cells."""
    out = []
    for f in frames:
        a = f[..., 3] > 128
        ys = np.nonzero(a.any(1))[0]
        if not len(ys): out.append((f, 0, 0)); continue
        y0, y1 = ys.min(), ys.max()
        low = a[int(y0 + (y1 - y0) * 0.6):y1 + 1]
        # the biggest solid column run in the lower body = legs/feet (muzzle flash and loose smoke excluded)
        w = low.sum(0).astype(float); w = np.convolve(w, np.ones(9) / 9, 'same')
        xs = np.nonzero(w > w.max() * 0.25)[0]
        cx = (w[xs] * xs).sum() / w[xs].sum() if len(xs) else f.shape[1] / 2
        out.append((f, cx, y1))
    return out


def write_grid(frames, out, cell=None, align=False):
    if align:
        al = align_frames(frames)
        L = max(cx for _, cx, _ in al); R = max(f.shape[1] - cx for f, cx, _ in al)
        T = max(y1 for _, _, y1 in al)
        W = int(np.ceil(L + R)) + 4; Hh = int(T) + 4
        fixed = []
        for f, cx, y1 in al:
            c = np.zeros((Hh, W, 4), np.uint8)
            ox, oy = int(round(L - cx)) + 2, int(T - y1) + 2
            h, w = min(f.shape[0], Hh - oy), min(f.shape[1], W - ox)
            c[oy:oy + h, ox:ox + w] = f[:h, :w]
            fixed.append(c)
        frames = fixed
        cell = max(W, Hh) + 8
    hs = [f.shape[0] for f in frames]; ws = [f.shape[1] for f in frames]
    cell = cell or max(max(hs), max(ws)) + 8
    n = len(frames); rows = (n + 4) // 5
    sheet = Image.new('RGBA', (cell * 5, cell * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im = Image.fromarray(f, 'RGBA')
        bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
        # keep the vertical position inside the band so feet stay on one line; centre horizontally on the body
        sheet.paste(im, ((i % 5) * cell + (cell - im.width) // 2, (i // 5) * cell + cell - im.height - 4), im)
    sheet.save(out)
    return n


def cut_gradient(c, x0, x1, thr=30):
    """like cut_figure, for backgrounds with a light gradient: the background is a smooth field
    estimated from the grey pixels connected to the border"""
    c = c.astype(np.float32); lum = c.mean(2); sat = c.max(2) - c.min(2)
    grey = sat < 16
    lab, _ = ndimage.label(grey)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = ndimage.binary_erosion(np.isin(lab, edge[edge > 0]), iterations=2)
    num = ndimage.gaussian_filter(np.where(bgm[..., None], c, 0), (12, 12, 0))
    den = ndimage.gaussian_filter(bgm.astype(np.float32), 12)[..., None]
    bg = num / np.maximum(den, 1e-4)
    d = np.sqrt(((c - bg) ** 2).sum(2))
    fg = (d > thr) | ((sat > 40) & (d > 16))
    fg = ndimage.binary_opening(fg, iterations=1)
    fg = ndimage.binary_fill_holes(ndimage.binary_closing(fg, iterations=2))
    # background showing between the legs and arms: enclosed grey pockets close to the background colour
    pocket = ndimage.binary_opening(fg & (d < thr * 0.8) & (sat < 18), iterations=1)
    pl, pn = ndimage.label(pocket)
    if pn:
        ps = ndimage.sum(pocket, pl, range(1, pn + 1))
        fg &= ~np.isin(pl, [i + 1 for i, v in enumerate(ps) if v > 25])
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=3))
    if n == 0: return None
    sz = ndimage.sum(fg, lab, range(1, n + 1)); cx = ndimage.center_of_mass(fg, lab, range(1, n + 1))
    best = max(range(n), key=lambda i: sz[i] if x0 <= cx[i][1] < x1 else -1)
    fg &= lab == best + 1
    alpha = ndimage.gaussian_filter(fg.astype(np.float32), 0.7) * fg + 0.0
    alpha = np.maximum(alpha, ndimage.gaussian_filter(fg.astype(np.float32), 0.7) * 0.9)
    alpha = np.where(alpha < 0.08, 0, alpha)
    rgb = np.where((alpha > 0.9)[..., None], c, np.clip(bg + (c - bg) / np.maximum(alpha, 0.3)[..., None], 0, 255))
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)


def auto_frames(path, min_frac=0.25, pad=10):
    """Find every figure on a light, loosely laid-out sheet: rows from the vertical profile of the
    foreground, figures from connected pieces in each row (pieces much smaller than the biggest -
    labels, sparks, dust - are left out). Returns RGBA frames in reading order."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = a.shape[:2]
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    grey = sat < 16
    lab, _ = ndimage.label(grey)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = ndimage.binary_erosion(np.isin(lab, edge[edge > 0]), iterations=2)
    num = ndimage.gaussian_filter(np.where(bgm[..., None], a, 0), (25, 25, 0))
    den = ndimage.gaussian_filter(bgm.astype(np.float32), 25)[..., None]
    bg = num / np.maximum(den, 1e-4)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    fg = ndimage.binary_opening((d > 30) | ((sat > 40) & (d > 16)), iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=5))
    sz = ndimage.sum(fg, lab, range(1, n + 1)); big = sz.max()
    objs = ndimage.find_objects(lab)
    figs = [(objs[i], sz[i]) for i in range(n) if sz[i] > big * min_frac]
    # reading order: group into rows by vertical centre
    figs.sort(key=lambda f: (f[0][0].start + f[0][0].stop) / 2)
    rows, cur = [], []
    for f in figs:
        cy = (f[0][0].start + f[0][0].stop) / 2; h = f[0][0].stop - f[0][0].start
        if cur and abs(cy - np.mean([(g[0][0].start + g[0][0].stop) / 2 for g in cur])) > h * 0.5:
            rows.append(cur); cur = []
        cur.append(f)
    if cur: rows.append(cur)
    out = []
    for r in rows:
        for (s, _) in sorted(r, key=lambda f: f[0][1].start):
            y0, y1 = max(0, s[0].start - pad), min(H, s[0].stop + pad); x0, x1 = max(0, s[1].start - pad), min(W, s[1].stop + pad)
            f = cut_gradient(a[y0:y1, x0:x1].astype(np.uint8), pad, x1 - x0 - pad)
            if f is not None: out.append(f)
    return out


def sheet_matte(a, grey_figure=False):
    """background field and foreground mask for a whole sheet on a light, slightly uneven background"""
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    grey = (sat < 14) & (lum > np.percentile(lum, 40) - 8)
    lab, _ = ndimage.label(grey)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = ndimage.binary_erosion(np.isin(lab, edge[edge > 0]), iterations=3)
    num = ndimage.gaussian_filter(np.where(bgm[..., None], a, 0), (30, 30, 0))
    den = ndimage.gaussian_filter(bgm.astype(np.float32), 30)[..., None]
    bg = num / np.maximum(den, 1e-4)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    darker = (bg.mean(2) - lum)
    # soft ground shadows are only a little darker than the background and unsaturated: not figure
    shadow = (sat < 14) & (darker > 0) & (darker < 70)
    if grey_figure:   # grey creature on a mid-grey sheet: only flat, smooth patches count as shadow
        shadow = np.zeros_like(shadow)
    # flat dark ground shadows painted under the feet: wide, smooth, unsaturated
    loc = ndimage.uniform_filter(lum, 9); std = np.sqrt(np.maximum(ndimage.uniform_filter(lum ** 2, 9) - loc ** 2, 0))
    shadow |= (sat < 12) & (std < (3 if grey_figure else 6)) & (darker > 0) & (darker < (30 if grey_figure else 130))
    fg = ((d > (12 if grey_figure else 28)) | ((sat > 35) & (d > 14))) & ~shadow
    fg = ndimage.binary_opening(fg, iterations=2 if grey_figure else 1)
    return bg, d, sat, fg, shadow


def grid_frames(path, cols, nrows=None, pad=6, even=False, grey_figure=False):
    """Regularly spaced figures on a light background. Row bands come from gaps in the foreground
    profile (falling back to an even split); each band is split evenly into its number of columns
    across the foreground's width. cols: int, or a list with the count for each row."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = a.shape[:2]
    bg, d, sat, fg, shadow = sheet_matte(a, grey_figure)
    nrows = nrows or (len(cols) if isinstance(cols, list) else 5)
    prof = ndimage.uniform_filter1d(fg.sum(1).astype(np.float32), 5)
    on = prof > max(3, prof.max() * 0.03)
    runs, y = [], 0
    while y < H:
        if on[y]:
            y2 = y
            while y2 < H and on[y2]: y2 += 1
            if y2 - y > 25: runs.append((y, y2))
            y = y2
        else: y += 1
    if even or len(runs) != nrows:
        # rows touch (smoke, flames, wings): cut at the emptiest line near each even split
        ys = np.nonzero(fg.any(1))[0]; t, b = ys.min(), ys.max() + 1
        step = (b - t) / nrows; cuts = [t]
        for i in range(1, nrows):
            c0 = t + i * step; lo, hi = int(c0 - step * 0.3), int(c0 + step * 0.3)
            cuts.append(lo + int(np.argmin(prof[lo:hi])))
        cuts.append(b)
        runs = [(cuts[i], cuts[i + 1]) for i in range(nrows)]
    out = []
    for r, (y0, y1) in enumerate(runs):
        n = cols[r] if isinstance(cols, list) else cols
        xs = np.nonzero(fg[y0:y1].any(0))[0]; l, rr = xs.min(), xs.max() + 1
        cw = (rr - l) / n
        for k in range(n):
            xa, xb = round(l + k * cw), round(l + (k + 1) * cw)
            X0, X1 = max(0, xa - pad - 20), min(W, xb + pad + 20); Y0, Y1 = max(0, y0 - pad), min(H, y1 + pad)
            f = fg[Y0:Y1, X0:X1].copy()
            f = ndimage.binary_fill_holes(ndimage.binary_closing(f, iterations=4 if grey_figure else 2))
            dd = d[Y0:Y1, X0:X1]; ss = sat[Y0:Y1, X0:X1]
            pocket = ndimage.binary_opening(f & (dd < (7 if grey_figure else 22)) & (ss < 14), iterations=2 if grey_figure else 1)
            pl, pn = ndimage.label(pocket)
            if pn:
                ps = ndimage.sum(pocket, pl, range(1, pn + 1)); f &= ~np.isin(pl, [i + 1 for i, v in enumerate(ps) if v > 20])
            lab, m = ndimage.label(ndimage.binary_dilation(f, iterations=3))
            if not m: continue
            sz = ndimage.sum(f, lab, range(1, m + 1)); cxs = ndimage.center_of_mass(f, lab, range(1, m + 1))
            lo, hi = xa - X0, xb - X0
            best = max(range(m), key=lambda i: sz[i] if lo <= cxs[i][1] < hi else -1)
            f &= lab == best + 1
            al = ndimage.gaussian_filter(f.astype(np.float32), 0.7)
            al = np.where(al < 0.08, 0, al)
            c = a[Y0:Y1, X0:X1]; b = bg[Y0:Y1, X0:X1]
            rgb = np.where((al > 0.9)[..., None], c, np.clip(b + (c - b) / np.maximum(al, 0.3)[..., None], 0, 255))
            out.append(np.dstack([rgb, al * 255]).astype(np.uint8))
    return out
