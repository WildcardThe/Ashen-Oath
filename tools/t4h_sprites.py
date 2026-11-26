"""Hollow tier-4 gunner: cut the 5x5 walk and shoot grids out of the grey-celled sheets
(assets/source/t4h-base-sheet.jpg, t4h-up-sheet.jpg), remove the cell background, and write
transparent 5x5 sheets that t5h_sprites.anim_sheet turns into game strips."""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
CELL = 200

# grid boxes found from the separator lines: (x0, x1) for walk and shoot, (y0, y1) rows
GRIDS = {'t4h-base-sheet.jpg': ((26, 671), (704, 1349), (51, 744)), 't4h-up-sheet.jpg': ((22, 669), (706, 1353), (48, 748))}


def cut(a, x0, y0, x1, y1, ext=None):
    c = a[y0 + 4:y1 - 3, x0 + 4:x1 - 3].astype(np.float32)
    bg = np.median(np.concatenate([c[:3].reshape(-1, 3), c[-3:].reshape(-1, 3), c[:, :3].reshape(-1, 3), c[:, -3:].reshape(-1, 3)]), 0)
    d = np.sqrt(((c - bg) ** 2).sum(2))
    sat = c.max(2) - c.min(2)
    near = d < 16
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = np.isin(lab, edge[edge > 0])
    # grey background also shows through gaps inside the figure (between belt and armour)
    nl = int(lab.max())
    if nl:
        sz = ndimage.sum(near, lab, range(1, nl + 1))
        bgm |= np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 18])
    fg = ~bgm
    # painted muzzle flashes (and their orange glow) overlap neighbouring cells; drop them all,
    # the game draws its own flash at the barrel on the firing frame
    r_, g_, b_ = c[..., 0], c[..., 1], c[..., 2]
    flash = ((r_ > 170) & (g_ > 105) & (r_ - b_ > 60)) | ((r_ > 215) & (g_ > 190))
    flash = ndimage.binary_dilation(flash, iterations=2) & ((r_ - b_ > 25) | (r_ + g_ + b_ > 450))
    # the orange glow and sparks round a neighbour's flash, in the left part of the cell
    lum_ = c.mean(2); left = np.arange(c.shape[1])[None, :] < c.shape[1] * 0.45
    glow = left & (r_ - b_ > 45) & (lum_ > 95)
    flash |= ndimage.binary_dilation(glow, iterations=1) & left & (r_ - b_ > 20) & (lum_ > 70)
    fg &= ~flash
    # grey smoke drifting in from the neighbouring cell's gun, at the left edge
    lum0 = c.mean(2)
    smoke = ((sat < 16) & (np.arange(c.shape[1])[None, :] < c.shape[1] * 0.18)) | \
            ((sat < 34) & (lum0 > 72) & (np.arange(c.shape[1])[None, :] < c.shape[1] * 0.28))
    fg &= ~smoke
    fg = ndimage.binary_opening(fg, iterations=1)
    # keep the gunner only: the muzzle flash and smoke bleeding in from the neighbouring cell,
    # and loose smoke puffs, are separate pieces (the game draws its own muzzle flash)
    lab2, n = ndimage.label(ndimage.binary_dilation(fg, iterations=2))
    if n > 1:
        sz = ndimage.sum(fg, lab2, range(1, n + 1))
        fg &= lab2 == (int(np.argmax(sz)) + 1)
    # smoke wisps: semi-transparent by distance from the background grey
    soft = np.clip((d - 10) / 40, 0, 1)
    alpha = np.where(fg, ndimage.gaussian_filter(fg.astype(np.float32), 0.6), 0)
    # smoke and dull grey hanging off the body fades rather than sitting as solid grey
    alpha = np.where(fg & (sat < 14) & (d < 40), alpha * soft, alpha)
    alpha = np.where(fg & (sat >= 25), np.maximum(alpha, 0.9), alpha)
    rgb = np.clip(bg + (c - bg) / np.maximum(alpha, 0.35)[..., None], 0, 255)
    rgb = np.where((alpha > 0.85)[..., None], c, rgb)
    out = np.dstack([rgb, alpha * 255])
    if ext is not None:
        # this frame's own flash was painted past the cell edge, over the next cell: carry it back
        e = ext.astype(np.float32); el = e.mean(2)
        fl = ((e[..., 0] > 150) & (e[..., 0] - e[..., 2] > 50) & (el > 110)) | (el > 205)
        fl = ndimage.binary_dilation(fl, iterations=1)
        fa = np.where(fl, np.clip((el - 85) / 110, 0, 1), 0)
        out = np.concatenate([out, np.dstack([e, fa * 255])], axis=1)
    return out.astype(np.uint8)


for src, (wx, sx, (y0, y1)) in GRIDS.items():
    a = np.asarray(Image.open(os.path.join(SRC, src)).convert('RGB'))
    tag = 'base' if 'base' in src else 'up'
    for kind, (gx0, gx1) in (('walk', wx), ('shoot', sx)):
        sheet = Image.new('RGBA', (CELL * 5, CELL * 5), (0, 0, 0, 0))
        cw, ch = (gx1 - gx0) / 5, (y1 - y0) / 5
        for r in range(5):
            for c in range(5):
                x0, x1 = round(gx0 + c * cw), round(gx0 + (c + 1) * cw)
                yy0, yy1 = round(y0 + r * ch), round(y0 + (r + 1) * ch)
                ext = None
                if kind == 'shoot':
                    ew = round(cw * 0.42)
                    ext = a[yy0 + 4:yy1 - 3, x1 + 2:min(a.shape[1], x1 + 2 + ew)]
                    if ext.shape[1] < 8: ext = None
                cell = Image.fromarray(cut(a, x0, yy0, x1, yy1, ext), 'RGBA')
                sheet.paste(cell, (c * CELL + 6, r * CELL + CELL - cell.height - 2))
        sheet.save(os.path.join(SRC, f't4h-{tag}-{kind}.png'))
        print('wrote', tag, kind)
