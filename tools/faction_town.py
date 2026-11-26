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
TOWNS = {
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


def grade(rgba, depth, haze, warm):
    a = rgba[..., :3].astype(np.float32)
    lum = a.mean(2, keepdims=True)
    a = lum + (a - lum) * 0.9
    a = a * np.array(warm) * (0.95 - 0.05 * (1 - depth))
    a = a * (1 - 0.18 * depth) + np.array(haze, np.float32) * 0.18 * depth
    out = rgba.copy(); out[..., :3] = np.clip(a, 0, 255).astype(np.uint8)
    return out


def main():
    fac = sys.argv[1]; T = TOWNS[fac]
    SRC = os.path.join(ROOT, 'assets', 'source', fac); OUT = os.path.join(ROOT, 'assets', 'town', fac)
    K = BW / SRC_W
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*')): os.remove(f)
    base = Image.open(os.path.join(SRC, 'landscape.jpg')).convert('RGB').resize((BW, BH), Image.LANCZOS)
    base.save(os.path.join(OUT, 'base.webp'), quality=92)
    meta = {'base': {'w': BW, 'h': BH}}
    placed = {}
    for key, (src, spot, f) in KEYS.items():
        srgb = np.asarray(Image.open(os.path.join(SRC, src + '.jpg')).convert('RGB'))
        rgba, _ = cut(srgb, island=False)
        rgba = feather_ground(clear_pockets(rgba, srgb))
        r, gx0, gx1 = ground_row(rgba)
        ys, xs = np.nonzero(rgba[..., 3] > 10)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        cx, gy, w, depth = T['spots'][spot]
        k = w * K * f * T.get('scale', {}).get(key, 1) / (gx1 - gx0)
        crop = rgba[y0:y1, x0:x1]
        glow, nhot = glow_layer(crop)
        im = Image.fromarray(grade(crop, depth, T['haze'], T['warm']), 'RGBA')
        size = (max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k)))
        im = im.resize(size, Image.LANCZOS)
        X = round(cx * K - ((gx0 + gx1) / 2 - x0) * k); Y = round(gy * K - (r - y0) * k)
        im = shadow_into(im, (r - y0) * k)
        im.save(os.path.join(OUT, key + '.webp'), quality=90)
        m = {'w': im.width, 'h': im.height, 'ow': im.width, 'oh': im.height, 'area': int((np.asarray(im)[..., 3] > 128).sum()), 'x': X, 'y': Y, 'gy': round(gy * K)}
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
