"""Scrapjaw Horde and Deathless Dynasty towns: the empty landscape + 24 buildings on flat grey.
Each building is cut out (tools/hollow_cut.py), its ground patch feathered into the landscape, sized and
placed on a plot, graded into the scene's light, given a contact shadow, and a glow layer is extracted
from everything that should shine (fires, toxic and necrotic green, lamps).
Writes assets/town/<faction>/. Run: python3 tools/faction_town.py scrapjaw|deathless [--preview out.png]"""
import json, os, sys, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hollow_cut import cut
from rust_town import feather_ground, ground_row, glow_layer, shadow_into

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BW, BH = 1920, 1072
SRC_W = 1376

# spot: centre x, ground y (landscape pixels, 1376 wide), ground-patch width, depth (0 front .. 1 back)
# second landscapes: 11 plots in three rows made for our buildings (town_landscape_prompts.txt)
PLOTS2 = {
    # user's corrections: everything except the trade exchange 12.5% bigger, the fort also moved right
    # new painted landscape (assets/source/concord_test/empty.jpg): plots read off it, buildings raised to cover the plateaus
    'concord': {'guild': (345, 268, 215, 1.0), 'fort': (712, 278, 440, 1.0), 'dw5': (1110, 276, 255, 1.0),
                'hall': (225, 478, 240, 0.6), 'tavern': (540, 472, 250, 0.6), 'dw3': (885, 462, 235, 0.6), 'dw4': (1195, 488, 270, 0.6),
                'dw2': (162, 648, 225, 0.1), 'market': (520, 676, 275, 0.1), 'depot': (880, 688, 285, 0.1), 'dw1': (1220, 655, 225, 0.1)},
    # user's corrections: everything 12.5% bigger, the fort also moved up
    'hollow': {'guild': (212, 288, 208, 1.0), 'fort': (650, 270, 472, 1.0), 'dw5': (1125, 292, 242, 1.0),
               'hall': (180, 450, 332, 0.6), 'tavern': (507, 432, 253, 0.6), 'dw3': (815, 438, 276, 0.6), 'dw4': (1160, 465, 338, 0.6),
               'dw2': (170, 668, 332, 0.1), 'market': (497, 680, 332, 0.1), 'depot': (840, 670, 332, 0.1), 'dw1': (1188, 670, 343, 0.1)},
}
_STD = {'guild': (215, 292, 205, 1.0), 'fort': (660, 290, 455, 1.0), 'dw5': (1122, 298, 240, 1.0),
        'hall': (182, 455, 325, 0.6), 'tavern': (505, 438, 250, 0.6), 'dw3': (813, 448, 276, 0.6), 'dw4': (1155, 470, 338, 0.6),
        'dw2': (168, 665, 325, 0.1), 'market': (497, 688, 300, 0.1), 'depot': (843, 667, 320, 0.1), 'dw1': (1190, 675, 338, 0.1)}
for _f in ('rustbound', 'scrapjaw', 'deathless'): PLOTS2[_f] = {k: (x, y - 14, w, d) for k, (x, y, w, d) in _STD.items()}   # user: everything a bit up
PLOTS2['rustbound']['fort'] = (660, 262, 455, 1.0)          # fort further up
PLOTS2['deathless']['dw2'] = (150, 651, 325, 0.1)           # tier 2 slightly left
PLOTS2['palefang'] = {**PLOTS2['deathless'], 'dw2': (168, 651, 325, 0.1), 'fort': (668, 222, 420, 1.0), 'dw5': (1122, 276, 240, 1.0),
                      'hall': (185, 438, 325, 0.6), 'market': (497, 664, 300, 0.1), 'dw3': (805, 470, 250, 0.55)}   # no dw3 plot: the battery stands in the surf
PLOTS2_SCALE = {'concord': {'mg1': 1.2, 'mg2': 1.2, 'mg3': 1.2, 'mg4': 1.2, 'mg5': 1.2,
                            'dw2': 1.18, 'dw2u': 1.18, 'market': 1.18, 'depot': 1.18, 'dw1': 1.28, 'dw1u': 1.28, 'hall1': 1.2},
                'hollow': {'hall3': 0.8, 'hall2': 0.9, 'dw3u': 0.85},
                'rustbound': {'all': 0.85 * 1.175, 'hall3': 0.8, 'hall2': 0.9, 'dw4u': 0.85, 'dw4': 0.9, 'fort': 1.05, 'citadel': 1.05, 'castle': 1.05, 'dw5': 1.15, 'dw5u': 1.15},
                'scrapjaw': {'all': 0.88 * 1.175, 'mg1': 1.1, 'mg2': 1.1, 'mg3': 1.1, 'mg4': 0.99, 'mg5': 0.99, 'tavern': 1.1},
                'palefang': {'all': 0.85 * 1.175},
                'deathless': {'all': 0.84 * 1.175, 'mg1': 1.1, 'mg2': 1.1, 'mg3': 1.1, 'mg4': 0.99, 'mg5': 0.935, 'hall1': 1.1, 'hall2': 1.1, 'hall3': 1.1, 'dw5': 1.1, 'dw5u': 0.99}}
from rust_town import KEYS as RUST_KEYS
TOWNS = {
    'rustbound': {'src': 'rust_town', 'haze': (150, 150, 112), 'warm': (1.0, 0.98, 0.9), 'checker': True,
                  'names': {f'b_{k}': v[0] for k, v in RUST_KEYS.items()}, 'spots': {}},
    'concord': {
        'src': 'concord_snow', 'haze': (150, 165, 180), 'warm': (0.97, 1.0, 1.03), 'scale': {},
        'fallback': {'b_dw4u': 'b_dw4'},   # no upgraded hangar was delivered: the base one, a little bigger
        'spots': {
            'fort': (530, 300, 330, 1.0), 'guild': (195, 418, 120, 0.8), 'dw5': (1160, 430, 220, 0.75),
            'hall': (300, 480, 260, 0.6), 'depot': (620, 455, 180, 0.62), 'dw4': (930, 505, 220, 0.55),
            'dw1': (290, 595, 260, 0.35), 'tavern': (600, 610, 230, 0.3), 'dw3': (1110, 600, 280, 0.35),
            'dw2': (400, 730, 290, 0.05), 'market': (1170, 730, 300, 0.05),
        },
    },
    'hollow': {
        'src': 'hollow_forge', 'haze': (120, 60, 50), 'warm': (1.03, 0.97, 0.92),
        'spots': {
            'fort': (690, 310, 330, 1.0), 'guild': (290, 330, 150, 0.95), 'dw5': (1080, 330, 240, 0.95),
            'hall': (450, 445, 260, 0.7), 'dw4': (960, 445, 230, 0.7), 'depot': (165, 475, 220, 0.6),
            'dw3': (1235, 480, 170, 0.6), 'tavern': (710, 545, 220, 0.5), 'dw1': (300, 625, 280, 0.3),
            'market': (1060, 625, 290, 0.3), 'dw2': (660, 725, 300, 0.05),
        },
    },
    'scrapjaw': {
        'haze': (150, 110, 80), 'warm': (1.0, 0.95, 0.86),
        'spots': {
            'fort': (712, 352, 330, 1.0), 'dw5': (985, 398, 250, 0.9), 'guild': (1195, 430, 150, 0.85),
            'dw4': (560, 392, 190, 0.85), 'hall': (318, 440, 250, 0.75),
            'dw3': (548, 505, 280, 0.55), 'depot': (1150, 512, 250, 0.55),
            'tavern': (215, 612, 280, 0.35), 'dw2': (1010, 676, 320, 0.2),
            'dw1': (735, 748, 270, 0.05), 'market': (318, 738, 290, 0.0),
        },
    },
    'palefang': {'haze': (90, 105, 120), 'warm': (0.95, 0.98, 1.03), 'spots': {}},
    'deathless': {
        'haze': (60, 110, 100), 'warm': (0.92, 1.0, 1.0), 'scale': {'dw4u': 0.8, 'hall3': 0.92},
        'spots': {
            'fort': (680, 322, 300, 1.0), 'dw5': (478, 306, 170, 1.0), 'guild': (1132, 342, 130, 0.95),
            'dw3': (948, 350, 170, 0.95), 'dw4': (455, 405, 290, 0.75), 'hall': (938, 478, 270, 0.6),
            'depot': (150, 430, 230, 0.6), 'tavern': (1235, 560, 230, 0.4), 'market': (200, 585, 280, 0.35),
            'dw2': (905, 742, 390, 0.05), 'dw1': (420, 745, 290, 0.0),
        },
    },
}
# building key: (source file, spot, size factor within the spot)
KEYS = {
    'fort': ('b_fort', 'fort', 0.82), 'citadel': ('b_citadel', 'fort', 0.92), 'castle': ('b_castle', 'fort', 1.0),
    'hall1': ('b_hall1', 'hall', 0.88), 'hall2': ('b_hall2', 'hall', 0.94), 'hall3': ('b_hall3', 'hall', 1.0),
    'mg1': ('b_mg1', 'guild', 0.85), 'mg2': ('b_mg2', 'guild', 0.88), 'mg3': ('b_mg3', 'guild', 0.92),
    'mg4': ('b_mg4', 'guild', 0.96), 'mg5': ('b_mg5', 'guild', 1.0),
    'tavern': ('b_tavern', 'tavern', 1.0), 'market': ('b_market', 'market', 1.0), 'depot': ('b_depot', 'depot', 1.0),
    **{f'dw{i}': (f'b_dw{i}', f'dw{i}', 0.95) for i in range(1, 6)},
    **{f'dw{i}u': (f'b_dw{i}u', f'dw{i}', 1.04) for i in range(1, 6)},
}


def clear_pockets(rgba, src):
    """background enclosed by lightning arcs, crane frames or spires: smooth, unsaturated and the colour of
    the sheet's grey -> transparent"""
    from scipy import ndimage
    a = src.astype(np.float32)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bgc = np.median(border, 0)
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    loc = ndimage.uniform_filter(lum, 9); std = np.sqrt(np.maximum(ndimage.uniform_filter(lum ** 2, 9) - loc ** 2, 0))
    near = np.sqrt(((a - bgc) ** 2).sum(2)) < 22
    m = (rgba[..., 3] > 0) & near & (sat < 16) & (std < 4.5)
    m = ndimage.binary_opening(m, iterations=3)
    lab, n = ndimage.label(m)
    if n:
        sz = ndimage.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 400])
        soft = ndimage.gaussian_filter(m.astype(np.float32), 1.2)
        rgba = rgba.copy(); rgba[..., 3] = (rgba[..., 3] * (1 - np.clip(soft * 1.4, 0, 1))).astype(np.uint8)
    return rgba


def fill_holes(rgba, src, bgc=None):
    """transparent specks inside a building (dark windows, doorways, checker misreads) are part of it: fill every
    enclosed hole smaller than 1.5% of the building from the source picture; larger openings stay only if they
    really look like the sheet background (sky seen between spires)"""
    from scipy import ndimage
    solid = rgba[..., 3] > 128
    holes = ndimage.binary_fill_holes(solid) & ~solid
    lab, n = ndimage.label(holes)
    if not n: return rgba
    area = solid.sum(); out = rgba.copy(); a = src.astype(np.float32)
    sizes = ndimage.sum(holes, lab, range(1, n + 1))
    for i, sz in enumerate(sizes, 1):
        m = lab == i
        if sz > area * 0.015:
            if bgc is None: continue
            if np.sqrt(((a[m] - bgc) ** 2).sum(1)).mean() < 22: continue      # genuine background seen through
        out[m, :3] = src[m]; out[m, 3] = 255
    # soften the seam a little
    al = out[..., 3].astype(np.float32); grow = ndimage.binary_dilation(holes, iterations=1) & ~holes
    out[..., 3] = np.where(grow, np.maximum(al, 200), al).astype(np.uint8)
    return out


def grade(rgba, depth, haze, warm):
    a = rgba[..., :3].astype(np.float32)
    lum = a.mean(2, keepdims=True)
    a = lum + (a - lum) * 0.9
    a = a * np.array(warm) * (0.95 - 0.05 * (1 - depth))
    a = a * (1 - 0.18 * depth) + np.array(haze, np.float32) * 0.18 * depth
    out = rgba.copy(); out[..., :3] = np.clip(a, 0, 255).astype(np.uint8)
    return out


def main():
    fac = sys.argv[1]; T = dict(TOWNS[fac])
    SRC = os.path.join(ROOT, 'assets', 'source', T.get('src', fac)); OUT = os.path.join(ROOT, 'assets', 'town', fac)
    LAND = 'landscape.jpg'
    if fac in PLOTS2 and '--v1' not in sys.argv:   # plotted landscape (default now): fixed plots, no mockup layout
        T['spots'] = PLOTS2[fac]; T['scale'] = PLOTS2_SCALE.get(fac, {}); LAND = 'landscape2.jpg'; sys.argv.append('--no-layout')
    if '--out' in sys.argv: OUT = sys.argv[sys.argv.index('--out') + 1]
    K = BW / SRC_W
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*')): os.remove(f)
    base = Image.open(os.path.join(SRC, LAND)).convert('RGB').resize((BW, BH), Image.LANCZOS)
    base.save(os.path.join(OUT, 'base.webp'), quality=92)
    meta = {'base': {'w': BW, 'h': BH}}
    placed = {}
    lp = os.path.join(SRC, 'layout.json')
    layout = json.load(open(lp)) if os.path.exists(lp) and '--no-layout' not in sys.argv else None
    ref_geo = {}
    if layout:   # ground point and solid width of each spot's mockup picture, in landscape (1376) pixels
        from town_layout_match import crop_of
        for spot, L in layout.items():
            c = crop_of(SRC, KEYS[L['key']][0])
            if L['flip']: c = c[:, ::-1]
            sol = c[..., 3] > 160; sx = np.nonzero(sol.any(0))[0]; sy = np.nonzero(sol.any(1))[0]
            ref_geo[spot] = {'cx': L['x'] + (sx.min() + sx.max() + 1) / 2 * L['s'], 'by': L['y'] + (sy.max() + 1) * L['s'],
                             'sw': (sx.max() + 1 - sx.min()) * L['s']}
    for key, (src, spot, f) in KEYS.items():
        src = T.get('names', {}).get(src, src)
        if not os.path.exists(os.path.join(SRC, src + '.jpg')): src = T['fallback'][src]
        srgb = np.asarray(Image.open(os.path.join(SRC, src + '.jpg')).convert('RGB'))
        if T.get('checker'):
            from checker_cut import cut as ccut
            rgba = feather_ground(fill_holes(ccut(os.path.join(SRC, src + '.jpg')), srgb))
        else:
            rgba, _ = cut(srgb, island=False, solid_dark=True)
            border = np.concatenate([srgb[:4].reshape(-1, 3), srgb[-4:].reshape(-1, 3), srgb[:, :4].reshape(-1, 3), srgb[:, -4:].reshape(-1, 3)])
            rgba = feather_ground(fill_holes(clear_pockets(rgba, srgb), srgb, np.median(border, 0).astype(np.float32)))
        r, gx0, gx1 = ground_row(rgba)
        ys, xs = np.nonzero(rgba[..., 3] > 10)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = rgba[y0:y1, x0:x1]
        if layout and spot in layout:
            # placed as in the user's mockup (tools/town_layout_fit.py): the picture seen there sets size and
            # mirroring; every level of the spot stands on the same ground point (bottom centre of its solid part)
            L = layout[spot]
            if L['flip']: crop = crop[:, ::-1].copy()
            sol = crop[..., 3] > 160; sx = np.nonzero(sol.any(0))[0]; sy = np.nonzero(sol.any(1))[0]
            bcx, bby = (sx.min() + sx.max() + 1) / 2, sy.max() + 1
            ref = ref_geo[spot]
            if KEYS[L['key']][1] == spot: k1 = min(L['s'], ref['sw'] * 1.2 / (sx.max() + 1 - sx.min()))   # same scale, never much wider than the mockup's
            else: k1 = ref['sw'] / (sx.max() + 1 - sx.min())               # stand-in picture in the mockup: match its width
            k1 *= T.get('scale', {}).get(key, 1)
            k = k1 * K
            Xc, Yb = ref['cx'] * K, ref['by'] * K
            X = round(Xc - bcx * k); Y = round(Yb - bby * k)
            depth = float(np.clip((640 - ref['by']) / 420, 0, 1)); gyv = 10000 + L['z']   # z order from the mockup
            r = bby
        else:
            cx, gy, w, depth = T['spots'][spot]
            k = w * K * f * T.get('scale', {}).get(key, 1) * T.get('scale', {}).get('all', 1) / (gx1 - gx0)
            X = round(cx * K - ((gx0 + gx1) / 2 - x0) * k); Y = round(gy * K - (r - y0) * k)
            gyv = round(gy * K); r = r - y0
        glow, nhot = glow_layer(crop)
        im = Image.fromarray(grade(crop, depth, T['haze'], T['warm']), 'RGBA')
        size = (max(1, round(crop.shape[1] * k)), max(1, round(crop.shape[0] * k)))
        im = im.resize(size, Image.LANCZOS)
        im = shadow_into(im, r * k)
        im.save(os.path.join(OUT, key + '.webp'), quality=90)
        m = {'w': im.width, 'h': im.height, 'ow': im.width, 'oh': im.height, 'area': int((np.asarray(im)[..., 3] > 128).sum()), 'x': X, 'y': Y, 'gy': gyv}
        if nhot > 40:
            Image.fromarray(glow, 'RGBA').resize(size, Image.LANCZOS).save(os.path.join(OUT, key + '_glow.webp'), quality=88)
            m['glow'] = 1
        meta[key] = m; placed[key] = (im, X, Y)
        print(key, X, Y, im.size, 'glow' if m.get('glow') else '', flush=True)
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        for sel, suffix in ((['fort', 'hall1', 'tavern', 'dw1'], '_start'),
                            (['castle', 'hall3', 'mg5', 'tavern', 'market', 'depot', 'dw1u', 'dw2u', 'dw3u', 'dw4u', 'dw5u'], '_full'),
                            (['citadel', 'hall2', 'mg3', 'tavern', 'market', 'depot', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5'], '_mid')):
            c = base.convert('RGBA')
            for key in sorted(sel, key=lambda k: meta[k]['gy']):
                im, X, Y = placed[key]; c.alpha_composite(im, (X, Y)) if X >= 0 and Y >= 0 else c.paste(im, (X, Y), im)
                if meta[key].get('glow'):
                    g = Image.open(os.path.join(OUT, key + '_glow.webp')).convert('RGBA')
                    g.putalpha(g.getchannel('A').point(lambda v: v * 45 // 100))
                    c.paste(g, (X, Y), g)
            c.convert('RGB').save(out.replace('.png', suffix + '.png'))


if __name__ == '__main__':
    main()
