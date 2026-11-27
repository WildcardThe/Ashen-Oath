"""Scrapjaw Horde and Deathless Dynasty creatures: still picture + movement sheet + attack/shoot sheet,
basic and upgraded, all on flat grey 5x5 sheets (assets/source/<faction>/u<tier>[u]_{move,attack,shoot}.jpg).
Writes assets/sprites/unit_<id>.png, anim_<id>_<pose>.png and their entries in assets/sprites.json.
Run: python3 tools/faction_units.py [unit ids...]"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet_cut import grid_frames, write_grid
from hollow_cut import cut as _cut

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'sprites')
MAN = os.path.join(ROOT, 'assets', 'sprites.json')
TMP = os.path.join(SRC, '_cut')
manifest = json.load(open(MAN))

# unit id: (faction folder, source prefix, attack pose, hit/fire frame)
UNITS = {
    'scrapling': ('scrapjaw', 'u1', 'attack', 13), 'scrapling_u': ('scrapjaw', 'u1u', 'attack', 13),
    'blastgob': ('scrapjaw', 'u2', 'shoot', 9), 'blastgob_u': ('scrapjaw', 'u2u', 'shoot', 9),
    'choppa': ('scrapjaw', 'u3', 'attack', 13), 'choppa_u': ('scrapjaw', 'u3u', 'attack', 13),
    'rokkit': ('scrapjaw', 'u4', 'shoot', 8), 'rokkit_u': ('scrapjaw', 'u4u', 'shoot', 8),
    'junkgod': ('scrapjaw', 'u5', 'attack', 13), 'junkgod_u': ('scrapjaw', 'u5u', 'attack', 13),
    'husk': ('deathless', 'u1', 'attack', 13), 'husk_u': ('deathless', 'u1u', 'attack', 13),
    'dwarrior': ('deathless', 'u2', 'shoot', 9), 'dwarrior_u': ('deathless', 'u2u', 'shoot', 9),
    'scarab': ('deathless', 'u3', 'attack', 13), 'scarab_u': ('deathless', 'u3u', 'attack', 13),
    'ark': ('deathless', 'u4', 'shoot', 10), 'ark_u': ('deathless', 'u4u', 'shoot', 10),
    'shard': ('deathless', 'u5', 'attack', 13), 'shard_u': ('deathless', 'u5u', 'attack', 13),
}
# Redrawn Iron Concord (snow-wolf marines) and Hollow Host (hellforge oathbreakers); grids detected per sheet
for _fac, _ids in (('concord_snow', ['levy', 'warden', 'knight', 'walker', 'stormhammer']),
                   ('hollow_forge', ['zealot', 'turncoat', 'flayer', 'hellforge', 'desecrator'])):
    for _t, _id in enumerate(_ids, 1):
        _ranged = os.path.exists(os.path.join(SRC, _fac, f'u{_t}_shoot.jpg'))
        for _sfx, _pre in (('', f'u{_t}'), ('_u', f'u{_t}u')):
            UNITS[_id + _sfx] = (_fac, _pre, 'shoot' if _ranged else 'attack', 9 if _ranged else 13)
for _t, _id in enumerate(['thrall', 'fangreaver', 'harpooner', 'striker', 'drowned'], 1):
    _r = _id == 'harpooner'
    for _sfx, _pre in (('', f'u{_t}'), ('_u', f'u{_t}u')):
        UNITS[_id + _sfx] = ('palefang', _pre, 'shoot' if _r else 'attack', 9 if _r else 13)
AUTO = {'concord_snow', 'hollow_forge', 'palefang'}
# sheet layouts read by eye (rows; figures per row; 'fixed' = equal cells, keeps flames that cross cells)
GRIDS = {
    ('levy_u', 'shoot'): {'nrows': 5, 'cols': [6, 5, 5, 5, 5]}, ('warden_u', 'move'): {'nrows': 4},
    ('warden_u', 'attack'): {'nrows': 5, 'cols': [6, 5, 5, 5, 5]}, ('knight', 'move'): {'nrows': 4},
    ('walker', 'move'): {'nrows': 4}, ('walker_u', 'move'): {'nrows': 4}, ('walker_u', 'shoot'): {'fixed': True},
    ('stormhammer', 'move'): {'nrows': 3}, ('stormhammer_u', 'move'): {'nrows': 4},
    ('zealot', 'move'): {'nrows': 4}, ('turncoat_u', 'move'): {'nrows': 5, 'cols': 7},
    ('hellforge_u', 'move'): {'nrows': 4}, ('desecrator', 'move'): {'nrows': 4},
    ('desecrator', 'shoot'): {'fixed': True, 'rows': 4}, ('desecrator_u', 'shoot'): {'fixed': True},
    ('desecrator_u', 'attack'): {'nrows': 4},
    ('harpooner_u', 'shoot'): {'boxes': [(4, 15, 202, 205), (208, 15, 406, 205), (412, 15, 610, 205), (616, 15, 814, 205), (820, 15, 1018, 205), (30, 220, 225, 410), (225, 220, 425, 410), (425, 220, 650, 410), (650, 220, 1010, 410), (4, 420, 202, 610), (208, 420, 406, 610), (412, 420, 610, 610), (616, 420, 814, 610), (820, 420, 1018, 610), (4, 620, 202, 810), (208, 620, 406, 810), (412, 620, 610, 810), (616, 620, 814, 810), (820, 620, 1018, 810), (4, 820, 202, 1010), (208, 820, 406, 1010), (412, 820, 610, 1010), (616, 820, 814, 1010), (820, 820, 1018, 1010)]}, ('drowned_u', 'move'): {'fixed': True}, ('drowned_u', 'attack'): {'fixed': True},
    ('striker', 'move'): {'fixed': True}, ('striker_u', 'move'): {'fixed': True},
}
# units that shoot and also have their own melee sheet (u<t>_attack.jpg)
DUAL = {'turncoat', 'turncoat_u', 'desecrator', 'desecrator_u'}
# sheets that need help: rows found by even split, or a sheet with only 4 rows
SHEET_OPTS = {('blastgob_u', 'move'): {'nrows': 4}, ('blastgob_u', 'shoot'): {'nrows': 4},
              ('junkgod_u', 'move'): {'nrows': 4}, ('scarab_u', 'move'): {'nrows': 4},
              ('shard', 'attack'): {'lines': True, 'fixed': True, 'inset': 3}, ('rokkit', 'move'): {'fixed': True}}


def erase_grid_lines(path):
    """paint out thin straight cell borders drawn across the whole sheet; returns a cleaned copy's path"""
    from scipy import ndimage
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    med = ndimage.median_filter(lum, size=(1, 15))
    medv = ndimage.median_filter(lum, size=(15, 1))
    line = np.zeros(lum.shape, bool)
    for axis, m in ((0, med), (1, medv)):
        dev = (np.abs(lum - (med if axis == 0 else medv)) > 5) & (sat < 16)
        frac = dev.mean(axis)
        idx = np.nonzero(frac > 0.45)[0]
        for i in idx:
            sl = slice(max(0, i - 1), i + 2)
            if axis == 0: line[:, sl] = True
            else: line[sl, :] = True
    bgm = ~line
    num = ndimage.gaussian_filter(np.where(bgm[..., None], a, 0), (3, 3, 0)); den = ndimage.gaussian_filter(bgm.astype(np.float32), 3)[..., None]
    a = np.where(line[..., None], num / np.maximum(den, 1e-4), a)
    out = os.path.join(TMP, 'nolines_' + os.path.basename(path))
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out, quality=95)
    return out
FIRE = {'ark': 9, 'ark_u': 9}   # the arks glow while charging: the beam itself starts later
GROUND_STRIP = {('rokkit', 'move')}    # painted ground line under each frame


def fixed_grid_frames(path, cols=5, rows=5, inset=2, noshadow=False, boxes=None):
    """cut a sheet into exactly cols x rows equal cells; inside each cell keep the figure and every
    sizeable piece near it (muzzle flashes, beams and sparks painted apart from the body)"""
    from scipy import ndimage
    from sheet_cut import sheet_matte
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = a.shape[:2]
    bg, d, sat, fg, shadow = sheet_matte(a)
    out = []
    cells = boxes or [(round(c * W / cols) + inset, round(r * H / rows) + inset, round((c + 1) * W / cols) - inset, round((r + 1) * H / rows) - inset)
                      for r in range(rows) for c in range(cols)]
    for X0, Y0, X1, Y1 in cells:
        if True:
            if noshadow:   # dark poles look like flat shadows to the matte: flat background from the cell's border
                cell = a[Y0:Y1, X0:X1]
                ring = np.concatenate([cell[:3].reshape(-1, 3), cell[-3:].reshape(-1, 3), cell[:, :3].reshape(-1, 3), cell[:, -3:].reshape(-1, 3)])
                bgc = np.median(ring, 0)
                bg[Y0:Y1, X0:X1] = bgc
                d[Y0:Y1, X0:X1] = np.sqrt(((cell - bgc) ** 2).sum(2))
                fg[Y0:Y1, X0:X1] = ndimage.binary_opening(d[Y0:Y1, X0:X1] > 26, iterations=1)
            f = ndimage.binary_fill_holes(ndimage.binary_closing(fg[Y0:Y1, X0:X1], iterations=2))
            pocket = ndimage.binary_opening(f & (d[Y0:Y1, X0:X1] < 14) & (sat[Y0:Y1, X0:X1] < 16), iterations=1)
            pl, pn = ndimage.label(pocket)
            if pn:
                ps = ndimage.sum(pocket, pl, range(1, pn + 1)); f &= ~np.isin(pl, [i + 1 for i, v in enumerate(ps) if v > 30])
            lab, m = ndimage.label(ndimage.binary_dilation(f, iterations=3))
            if not m: continue
            sz = ndimage.sum(f, lab, range(1, m + 1))
            dd = d[Y0:Y1, X0:X1]; ss = sat[Y0:Y1, X0:X1]
            lf = np.where(f, lab, 0)   # measure each piece on its own pixels, not its dilated surroundings
            md = ndimage.mean(dd, lf, range(1, m + 1)); ms = ndimage.mean(ss, lf, range(1, m + 1))
            # pale flat patches (uneven background, vignette corners) are only faintly different: drop them
            f &= np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > sz.max() * 0.04 and not (md[i] < 38 and ms[i] < 16)])
            al = ndimage.gaussian_filter(f.astype(np.float32), 0.7); al = np.where(al < 0.08, 0, al)
            cc = a[Y0:Y1, X0:X1]; b = bg[Y0:Y1, X0:X1]
            rgb = np.where((al > 0.9)[..., None], cc, np.clip(b + (cc - b) / np.maximum(al, 0.3)[..., None], 0, 255))
            out.append(np.dstack([rgb, al * 255]).astype(np.uint8))
    return out


def drop_ground(f):
    """remove a painted ground strip: the bottom rows that run across nearly the whole frame"""
    al = f[..., 3] > 100; W = f.shape[1]
    cov = al.sum(1) / W
    y = f.shape[0] - 1
    while y > 0 and cov[y] < 0.05: y -= 1
    top = y
    while top > f.shape[0] * 0.6 and cov[top] > 0.9: top -= 1
    if y - top > 3:
        f = f.copy(); f[top + 1:, :, 3] = 0
        # the rows just above the strip fade out a little, where dust was painted against the wheels
    return f


def detect_grid(path):
    """rows from gaps in the foreground's vertical profile, figures per row from gaps in each band's horizontal
    profile; None when the sheet does not split cleanly"""
    from scipy import ndimage
    from sheet_cut import sheet_matte
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    fg = sheet_matte(a)[3]
    def runs(prof, minlen, gap):
        on = prof > max(2, prof.max() * 0.02); out = []; i = 0; n = len(on)
        while i < n:
            if on[i]:
                j = i
                while j < n and (on[j] or (j + gap < n and on[j:j + gap].any())): j += 1
                if j - i >= minlen: out.append((i, j))
                i = j
            else: i += 1
        return out
    rows = runs(ndimage.uniform_filter1d(fg.sum(1).astype(np.float32), 5), 40, 4)
    if not 3 <= len(rows) <= 6: return None
    cols = []
    for y0, y1 in rows:
        c = runs(ndimage.uniform_filter1d(fg[y0:y1].sum(0).astype(np.float32), 3), 25, 3)
        cols.append(len(c))
    if any(not 3 <= c <= 8 for c in cols): return None
    return len(rows), cols


def first_flash(frames, default):
    """first frame with a muzzle flash or beam: many very bright yellow-white or green pixels"""
    def hot(f):
        c = f[..., :3].astype(int); al = f[..., 3] > 150
        return int((al & (((c[..., 0] > 235) & (c[..., 1] > 205)) | ((c[..., 1] > 225) & (c[..., 0] < 200)))).sum())
    h = [hot(f) for f in frames]
    base = np.median(h[:3])
    for i, v in enumerate(h):
        if v > base + 300 and i > 2: return i
    return default


def anim_sheet(path, name, frames, height=240, fire=None, hit=None):
    """grid of aligned frames -> one horizontal strip with foot anchor, body height and muzzle point"""
    from scipy import ndimage
    sheet = Image.open(path).convert('RGBA')
    c = sheet.width // 5
    cells = [sheet.crop(((i % 5) * c, (i // 5) * c, (i % 5) * c + c, (i // 5) * c + c)) for i in range(frames)]
    alphas = [np.asarray(x.getchannel('A')) > 20 for x in cells]
    union = np.any(alphas, axis=0)
    ys, xs = np.nonzero(union)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    k = height / (y1 - y0)
    fw, fh = round((x1 - x0) * k), height
    strip = Image.new('RGBA', (fw * frames, fh))
    for i, x in enumerate(cells):
        strip.paste(x.crop((x0, y0, x1, y1)).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    strip.save(os.path.join(OUT, name + '.png'))
    a0 = alphas[0]; r_ys, r_xs = np.nonzero(a0)
    fy = r_ys.max() + 1; ft = a0[int(fy - (fy - r_ys.min()) * 0.12):fy]
    fx = np.nonzero(ft.any(axis=0))[0].mean(); body = fy - r_ys.min(); ay = (fy - y0) / (y1 - y0)
    meta = {'kind': 'anim', 'w': strip.width, 'h': fh, 'n': frames, 'fw': fw, 'fh': fh,
            'ax': round(float((fx - x0) / (x1 - x0)), 4), 'ay': round(float(ay), 4), 'body': round(float(body / (y1 - y0)), 4),
            'src': int(y1 - y0)}
    if hit is not None: meta['hit'] = hit
    if fire is not None:
        a = alphas[max(0, fire - 1)][y0:y1, x0:x1]
        lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=2))
        if n > 1: a = a & (lab == (int(np.argmax(ndimage.sum(a, lab, range(1, n + 1)))) + 1))
        cols = np.nonzero(a.any(axis=0))[0]; mx = cols.max()
        my = np.nonzero(a[:, mx - 3:mx + 1].any(axis=1))[0].mean()
        meta.update({'fire': fire, 'mx': round(mx / (x1 - x0), 4), 'my': round(my / (y1 - y0), 4)})
    manifest[name] = meta


def main():
    os.makedirs(TMP, exist_ok=True)
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    for uid, (fac, pre, pose, hit) in UNITS.items():
        if only and uid not in only: continue
        d = os.path.join(SRC, fac)
        rgba, _ = _cut(np.asarray(Image.open(os.path.join(d, pre + '.jpg')).convert('RGB')), island=False)
        im = Image.fromarray(rgba, 'RGBA'); im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        im = im.resize((round(im.width * 260 / im.height), 260), Image.LANCZOS)
        im.save(os.path.join(OUT, f'unit_{uid}.png'))
        manifest[f'unit_{uid}'] = {'kind': 'unit', 'w': im.width, 'h': im.height}
        counts = {}
        for kind in ('move', pose) + (('attack',) if uid in DUAL else ()):
            o = SHEET_OPTS.get((uid, kind), {})
            src = os.path.join(d, f'{pre}_{kind}.jpg')
            if o.get('lines'): src = erase_grid_lines(src)
            if fac in AUTO and not o: o = GRIDS.get((uid, kind), {})
            grey = fac in ('concord_snow', 'palefang')   # grey armour, snow camouflage and white wolves on a grey sheet: no shadow guessing
            if o.get('fixed') or o.get('boxes'): fr = fixed_grid_frames(src, 5, o.get('rows', 5), inset=o.get('inset', 2), noshadow=grey, boxes=o.get('boxes'))
            else: fr = grid_frames(src, o.get('cols', 5), o.get('nrows', 5), even=o.get('even', False), grey_figure=grey)
            if (uid, kind) in GROUND_STRIP: fr = [drop_ground(f) for f in fr]
            counts[kind] = len(fr)
            g = os.path.join(TMP, f'{uid}_{kind}.png')
            write_grid(fr, g, max(max(f.shape[:2]) for f in fr) + 8, align=True)
            if kind == 'shoot': hit = FIRE.get(uid) or first_flash(fr, hit)
            extra = {'fire': hit} if kind == 'shoot' else {'hit': 13 if kind == 'attack' and pose == 'shoot' else hit}
            anim_sheet(g, f'anim_{uid}_{kind}', len(fr), **extra)
        mv_ = manifest[f'anim_{uid}_move']
        for k_ in {pose} | ({'attack'} if uid in DUAL else set()):
            at_ = manifest[f'anim_{uid}_{k_}']; at_['body'] = round(mv_['body'] * mv_['src'] / at_['src'], 4)
        print(uid, im.size, counts, flush=True)
    json.dump(manifest, open(MAN, 'w'), indent=1)


if __name__ == '__main__':
    main()
