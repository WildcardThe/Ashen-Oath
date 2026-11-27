"""Siege art (batch 6): city walls, gates, towers, keeps and moats per faction, plus siege cannons.
Sources: assets/source/siege/<faction>_<piece>.jpg — each a block of ground seen from a high angle, running from the
top of the picture (far end) to the bottom (near end), the wall along its right side.
1. matte the block off its grey background
2. keystone-rectify its top face: each row is stretched between the block's left and right edges, so the wall becomes a
   straight vertical band and pieces stack end to end; rows above the far edge (towers, battlements, smoke) follow the
   extrapolated edges
3. keep only the band the battle draws (wall and inner ground, or the moat channel) -> assets/siege/<faction>_<piece>.webp
Cannons: the still and the firing sheet cut into frames -> one strip per faction.
Run: python3 tools/siege_art.py [faction ...]"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'siege')
OUT = os.path.join(ROOT, 'assets', 'siege')
FACTIONS = ['concord', 'hollow', 'rustbound', 'scrapjaw', 'deathless', 'palefang']
BLOCKS = ['wall', 'wall_d', 'wall_x', 'gate', 'gate_d', 'gate_x', 'tower', 'tower_x', 'keep', 'keep_x', 'moat']
RW, RH, ABOVE = 600, 1000, 700      # rectified width, top-face length, room kept above the far edge


def matte(a):
    c = a.astype(np.float32)
    border = np.concatenate([c[:8].reshape(-1, 3), c[-8:].reshape(-1, 3), c[:, :8].reshape(-1, 3), c[:, -8:].reshape(-1, 3)])
    med = np.median(border, 0)
    d = np.sqrt(((c - med) ** 2).sum(2)); sat = c.max(2) - c.min(2)
    fg = ndimage.binary_opening((d > 20) | ((sat > 28) & (d > 10)), iterations=2)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=4))
    sz = ndimage.sum(fg, lab, range(1, n + 1)); keep = [i + 1 for i, s in enumerate(sz) if s > sz.max() * 0.02]
    fg = ndimage.binary_fill_holes(ndimage.binary_closing(fg & np.isin(lab, keep), iterations=3))
    soft = np.clip((d - 8) / 40, 0, 1) * ndimage.binary_dilation(fg, iterations=10)    # smoke and sparks
    al = np.maximum(ndimage.gaussian_filter(fg.astype(np.float32), 0.8) * fg, soft)
    return np.where(al < 0.05, 0, al), fg, med


def edges(fg):
    """block edges: left and right silhouette lines over the middle of the block, the far and near rows"""
    H, W = fg.shape
    rows = np.nonzero(fg.sum(1) > W * 0.3)[0]          # rows crossing the block (not just a tower or smoke)
    y0, y1 = rows.min(), rows.max()
    xl = np.array([np.nonzero(fg[y])[0].min() if fg[y].any() else -1 for y in range(H)])
    xr = np.array([np.nonzero(fg[y])[0].max() if fg[y].any() else -1 for y in range(H)])
    span = np.arange(int(y0 + (y1 - y0) * 0.35), int(y0 + (y1 - y0) * 0.7))
    pl = np.polyfit(span, xl[span], 1); pr = np.polyfit(span, xr[span], 1)
    # near edge: below it the front face has vertical sides, so the left silhouette stops following the slanted line
    near = y1
    for y in range(int(span[-1]), y1):
        if xl[y] - np.polyval(pl, y) > 6: near = y; break
    far = y0
    for y in range(y0, int(span[0])):
        if abs(xl[y] - np.polyval(pl, y)) < 5 and abs(xl[y + 6] - np.polyval(pl, y + 6)) < 5: far = y; break
    return pl, pr, far, near


def rectify(path):
    a = np.asarray(Image.open(path).convert('RGB'))
    al, fg, _ = matte(a)
    pl, pr, far, near = edges(fg)
    # output row v (-ABOVE..RH) <- source row y (linear between far and near), column u <- between the edge lines
    v = np.arange(-ABOVE, RH)
    y = far + (v / RH) * (near - far)
    u = np.arange(RW)
    YY = np.repeat(y[:, None], RW, 1)
    XL = np.polyval(pl, YY); XR = np.polyval(pr, YY)
    XX = XL + (u[None, :] / (RW - 1)) * (XR - XL)
    rgba = np.dstack([a, (al * 255).astype(np.uint8)])
    from scipy.ndimage import map_coordinates
    out = np.stack([map_coordinates(rgba[..., k].astype(np.float32), [YY, XX], order=1, mode='constant', cval=0) for k in range(4)], -1)
    # the near edge is the bottom of the rectified tile: the front face is dropped
    return np.clip(out, 0, 255).astype(np.uint8)


# firing-sheet frame boxes (x0, y0, x1, y1) in the 1376x768 sheets, in play order
def _grid(cols, rows, ys=None):
    ys = ys or [(int(r * 768 / rows), int((r + 1) * 768 / rows)) for r in range(rows)]
    return [(int(c * 1376 / cols), y0, int((c + 1) * 1376 / cols), y1) for (y0, y1) in ys for c in range(cols)]
K = 1.72
def _row(xs, y0, y1, ox=0, oy=0): return [(int((a - ox) * K), int((y0 - oy) * K), int((b - ox) * K), int((y1 - oy) * K)) for a, b in xs]
FIRE = {
    'concord': _grid(5, 2), 'deathless': _grid(5, 2),
    'hollow': _grid(5, 2),
    'rustbound': _row([(20, 185), (205, 370), (375, 600), (590, 800)], 40, 180) + _row([(15, 185), (185, 340), (335, 490), (490, 640), (640, 795)], 205, 425),
    'scrapjaw': _row([(15, 165), (170, 325), (335, 535), (540, 795)], 0, 195) + _row([(10, 165), (165, 320), (320, 475), (475, 630), (630, 795)], 215, 435),
    'palefang': _row([(0, 160), (160, 320), (320, 480)], 0, 110) + _row([(480, 640)], 110, 222) + _row([(640, 800)], 0, 222)
                + _row([(0, 160), (160, 320), (320, 480)], 222, 445) + _row([(480, 640), (640, 800)], 335, 445),
}


def cannon(fac):
    """still -> trimmed sprite; firing sheet -> frames aligned on the carriage (bottom and rear), on one canvas size"""
    st = np.asarray(Image.open(os.path.join(SRC, f'{fac}_cannon.jpg')).convert('RGB'))
    al, fg, _ = matte(st)
    ys, xs = np.nonzero(al > 0.1)
    still = Image.fromarray(np.dstack([st, (al * 255).astype(np.uint8)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
    sh = np.asarray(Image.open(os.path.join(SRC, f'{fac}_cannon_fire.jpg')).convert('RGB'))
    frames = []
    for (x0, y0, x1, y1) in FIRE[fac]:
        c = sh[y0 + 3:y1 - 3, x0 + 3:x1 - 3]
        a, f, _ = matte(c)
        if not f.any(): continue
        # drop slivers of the neighbouring cell's flash or smoke: keep the machine and what overlaps it horizontally
        lab, n = ndimage.label(ndimage.binary_dilation(a > 0.05, iterations=3))
        if n > 1:
            sz = ndimage.sum(f, lab, range(1, n + 1)); main = int(np.argmax(sz)) + 1
            mx = np.nonzero((lab == main).any(0))[0]; keep = np.zeros_like(f)
            for i in range(1, n + 1):
                xs_i = np.nonzero((lab == i).any(0))[0]
                if i == main or (xs_i.min() >= mx.min() - 4 and sz[i - 1] > 0): keep |= lab == i
            a = np.where(keep, a, 0); f &= keep
        # anchor: lowest solid row (ground contact) and the rearmost solid column in the bottom fifth
        fy, fx = np.nonzero(f); bot = fy.max(); low = fx[fy > bot - (fy.max() - fy.min()) * 0.2]
        frames.append((np.dstack([c, (a * 255).astype(np.uint8)]), bot, low.min()))
    # common canvas: every frame placed so the anchors coincide
    up = max(b for _, b, _ in frames); left = max(l for _, _, l in frames)
    right = max(fr.shape[1] - l for fr, _, l in frames); down = max(fr.shape[0] - b for fr, b, _ in frames)
    W, H = left + right, up + down
    out = []
    for fr, b, l in frames:
        cv = Image.new('RGBA', (W, H)); cv.alpha_composite(Image.fromarray(fr, 'RGBA'), (left - l, up - b)); out.append(cv)
    return still, out


def yard(fac):
    from terrain_pack import seamless
    tmp = os.path.join(OUT, f'_yard_{fac}')
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import terrain_pack
    t = terrain_pack.TEX; terrain_pack.TEX = OUT
    seamless(os.path.join(SRC, f'{fac}_yard.jpg'), f'_yard_{fac}', 384)
    terrain_pack.TEX = t
    return Image.open(tmp + '.webp').convert('RGBA')


# which part of the rectified tile each piece keeps (u range), and whether to fade the ground edges (the keep stands alone)
BAND = {'wall': (0.46, 1.0), 'gate': (0.45, 1.0), 'tower': (0.28, 0.92), 'keep': (0.22, 0.92), 'moat': (0.2, 0.62)}
BASE = 720   # rect row a little below a tower's foot: the ground beyond it is faded out
SCALE = 0.5


def piece_image(fac, piece):
    r = np.asarray(Image.open(os.path.join(OUT, f'_rect_{fac}_{piece}.png'))).copy()
    kind = piece.split('_')[0]
    u0, u1 = BAND[kind]
    r = r[:, int(u0 * RW):int(u1 * RW)]
    if kind == 'moat': r = r[ABOVE:]          # only the channel's own ground
    if kind in ('tower', 'keep'):             # keep the structure, fade the square of ground around it
        h, w = r.shape[:2]; a = r[..., 3].astype(np.float32)
        fx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w * 0.22), 0, 1)
        fy = np.clip((ABOVE + BASE + 60 - np.arange(h)) / 120, 0, 1)
        r[..., 3] = (a * fx[None, :] * fy[:, None]).astype(np.uint8)
        r = r[:ABOVE + BASE + 60]
    rows = np.nonzero(r[..., 3].max(1) > 8)[0]; top = int(rows.min())
    im = Image.fromarray(r[top:], 'RGBA')
    im = im.resize((max(1, int(im.width * SCALE)), max(1, int(im.height * SCALE))), Image.LANCZOS)
    v0 = (0 if kind == 'moat' else -ABOVE) + top        # rect row of the image's first row
    return im, {'u0': u0, 'u1': u1, 'v0': v0}


def pack(fac):
    items = {p: piece_image(fac, p) for p in BLOCKS}
    still, frames = cannon(fac)
    still.thumbnail((360, 360), Image.LANCZOS)
    fw = 300; frames = [f.resize((fw, int(f.height * fw / f.width)), Image.LANCZOS) for f in frames]
    yd = yard(fac)
    ims = [(k, im) for k, (im, _) in items.items()] + [('cannon', still), ('yard', yd)] + [(f'fire{i}', f) for i, f in enumerate(frames)]
    ims.sort(key=lambda t: -t[1].height)
    W = 2048; x = y = rowh = 0; pos = {}
    for n, im in ims:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    sheet = Image.new('RGBA', (W, y + rowh))
    for n, im in ims: sheet.alpha_composite(im, pos[n])
    sheet.save(os.path.join(OUT, f'{fac}.webp'), quality=88, method=6)
    rect = lambda n, im: [pos[n][0], pos[n][1], im.width, im.height]
    m = {'scale': SCALE, 'pieces': {k: {**mt, 'r': rect(k, im)} for k, (im, mt) in items.items()},
         'cannon': rect('cannon', still), 'yard': rect('yard', yd), 'fire': [rect(f'fire{i}', f) for i, f in enumerate(frames)]}
    print(fac, sheet.size, len(frames), 'frames', os.path.getsize(os.path.join(OUT, f'{fac}.webp')) // 1024, 'KB')
    return m


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = [a for a in sys.argv[1:] if not a.startswith('-')] or FACTIONS
    meta = json.load(open(os.path.join(OUT, 'meta.json'))) if os.path.exists(os.path.join(OUT, 'meta.json')) else {}
    for fac in only:
        for piece in BLOCKS:
            if '--pack' in sys.argv: break
            r = rectify(os.path.join(SRC, f'{fac}_{piece}.jpg'))
            Image.fromarray(r, 'RGBA').save(os.path.join(OUT, f'_rect_{fac}_{piece}.png'))
        print(fac, 'rectified')
        meta[fac] = pack(fac)
    meta['_'] = {'RW': RW, 'RH': RH, 'ABOVE': ABOVE}
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'))
