"""Hollow Host town, second art set: volcanic valley backdrop + 23 generated buildings + animated
level-5 Mage Guild. Cuts every building out (tools/hollow_cut.py), sizes and places it on its spot,
grades it into the scene, bakes a contact shadow, extracts a glow layer from fire, magma and magic,
and writes assets/town/hollow/ (base.webp, <key>.webp, <key>_glow.webp, mg5_anim.webp, meta.json).
Run: python3 tools/hollow_town2.py [--preview out.png]"""
import json, os, sys, glob, subprocess, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hollow_cut import cut

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'hollow_town2')
OUT = os.path.join(ROOT, 'assets', 'town', 'hollow')
BW, BH = 1920, 1072
K = BW / 1376

# spot: centre x, ground y, width (in the 1376-wide landscape), how far back (0 front .. 1 back)
SPOTS = {
    'fort':   (660, 178, 300, 1.0),
    'guild':  (990, 124, 145, 1.0),
    'dw5':    (330, 252, 235, 0.85),
    'hall':   (322, 418, 215, 0.55),
    'dw4':    (928, 302, 250, 0.7),
    'dw3':    (1182, 438, 190, 0.5),
    'depot':  (640, 338, 215, 0.6),
    'tavern': (212, 575, 250, 0.2),
    'dw2':    (470, 645, 275, 0.05),
    'dw1':    (705, 590, 300, 0.15),
    'market': (995, 628, 285, 0.1),
}
# building key -> (source file, spot, width factor: earlier levels a little smaller)
KEYS = {
    'fort': ('Fort', 'fort', 0.78), 'citadel': ('Citadel', 'fort', 0.9), 'castle': ('Castle', 'fort', 1.0),
    'hall1': ('Town Hall', 'hall', 0.86), 'hall2': ('City Hall', 'hall', 0.96), 'hall3': ('Capitol', 'hall', 1.06),
    'mg1': ('MAge guild lvl1', 'guild', 0.82), 'mg2': ('MAge guild lvl2', 'guild', 0.87), 'mg3': ('MAge guild lvl3', 'guild', 0.91),
    'mg4': ('MAge guild lvl4', 'guild', 0.96), 'mg5': ('MAge guild lvl5', 'guild', 1.0),
    'tavern': ('Recruitment Office', 'tavern', 1.0), 'market': ('Trade Exchange', 'market', 1.0), 'depot': ('Supply Depot', 'depot', 1.0),
    'dw1': ('Bloodsworn Pits', 'dw1', 0.95), 'dw1u': ('Runescar Pits', 'dw1', 1.02),
    'dw2': ('Reaver Barracks', 'dw2', 0.95), 'dw2u': ('Hellfire Armory', 'dw2', 1.02),
    'dw3': ('Raptor Eyrie', 'dw3', 0.95), 'dw3u': ('Pyre Eyrie', 'dw3', 1.05),
    'dw4': ('Havoc Armoury', 'dw4', 0.95), 'dw4u': ('Hellstorm Armoury', 'dw4', 1.03),
    'dw5': ('Desecrator foundry', 'dw5', 0.95), 'dw5u': ('Pyre Cathedral', 'dw5', 1.04),
}
HAZE = np.array([150, 92, 70], np.float32)


def glow_mask(rgba, magic=False):
    a = rgba[..., :3].astype(np.float32); al = rgba[..., 3] / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fire = (r > 190) & (g > 70) & (r - b > 90) & (al > 0.4)
    fire |= (r > 235) & (g > 190) & (b < 170) & (al > 0.4)
    if magic: fire |= (r > 150) & (b > 160) & (g < 120) & (al > 0.4)
    w = np.where(fire, (r + g) / 510, 0)
    blur = ndimage.gaussian_filter(w, 3) * 2.2 + ndimage.gaussian_filter(w, 9) * 3.0
    col = np.where(magic, 1, 0)
    tint = np.array([255, 150, 60], np.float32)
    out = np.zeros(rgba.shape, np.uint8)
    out[..., :3] = tint if not magic else np.array([255, 150, 60], np.float32)
    if magic:
        purple = ndimage.gaussian_filter(((b > 160) & (g < 120) & (al > 0.4)).astype(np.float32), 6)
        out[..., 0] = np.clip(255 - 40 * np.clip(purple * 3, 0, 1), 0, 255); out[..., 1] = np.clip(150 - 110 * np.clip(purple * 3, 0, 1), 0, 255); out[..., 2] = np.clip(60 + 195 * np.clip(purple * 3, 0, 1), 0, 255)
    out[..., 3] = np.clip(blur * 255, 0, 255).astype(np.uint8)
    return out, fire.sum()


def grade(rgba, depth):
    a = rgba[..., :3].astype(np.float32)
    # warm, slightly darker, a little less saturated, and hazier the further back it stands
    lum = a.mean(2, keepdims=True)
    a = lum + (a - lum) * 0.9
    a = a * np.array([1.0, 0.93, 0.86]) * (0.92 - 0.05 * (1 - depth))
    a = a * (1 - 0.16 * depth) + HAZE * 0.16 * depth
    out = rgba.copy(); out[..., :3] = np.clip(a, 0, 255).astype(np.uint8)
    return out


def place(key, rgba, rim):
    src, spot, f = KEYS[key]
    cx, gy, w, depth = SPOTS[spot]
    al = rgba[..., 3]
    ys, xs = np.nonzero(al > 12)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # the width of the building is measured on its solid body at the rim, not on smoke plumes
    body = al[rim - 2:rim + 3] > 200
    bx = np.nonzero(body.any(0))[0]
    bw = (bx.max() - bx.min()) if len(bx) else (x1 - x0)
    bcx = (bx.max() + bx.min()) / 2 if len(bx) else (x0 + x1) / 2
    k = w * K * f / bw
    crop = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
    tw, th = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
    im = crop.resize((tw, th), Image.LANCZOS)
    X = cx * K - (bcx - x0) * k; Y = gy * K - (rim - y0) * k
    BODY[key] = (w * K * f, (bcx - x0) * k + (X - round(X)))
    return im, round(X), round(Y), depth


def shadow_into(im, rim_y, depth):
    """soft dark contact shadow under the building's footprint, baked under the picture"""
    W, H = im.size
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    a = np.zeros((H, W), np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    ry = max(6, W * 0.12)
    a = np.clip(1 - (((xx - W / 2) / (W * 0.5)) ** 2 + ((yy - rim_y) / ry) ** 2), 0, 1) ** 1.5 * 0.55
    sh = Image.fromarray(np.dstack([np.zeros((H, W, 3)), a * 255]).astype(np.uint8), 'RGBA')
    sh.alpha_composite(im)
    return sh


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*')): os.remove(f)
    base = Image.open(os.path.join(SRC, 'landscape.jpg')).convert('RGB').resize((BW, BH), Image.LANCZOS)
    base.save(os.path.join(OUT, 'base.webp'), quality=92)
    meta = {'base': {'w': BW, 'h': BH}}
    placed = {}
    for key, (src, spot, f) in KEYS.items():
        rgb = np.asarray(Image.open(os.path.join(SRC, src + '.jpg')).convert('RGB'))
        rgba, info = cut(rgb, keep_island=0.1 if spot == 'dw3' else 0.0)
        glow, nfire = glow_mask(rgba, magic=spot == 'guild')
        im, X, Y, depth = place(key, grade(rgba, SPOTS[spot][3]), info['rim'])
        rim_y = SPOTS[spot][1] * K - Y
        im = shadow_into(im, rim_y, depth)
        im.save(os.path.join(OUT, key + '.webp'), quality=92)
        m = {'w': im.width, 'h': im.height, 'ow': im.width, 'oh': im.height, 'area': int((np.asarray(im)[..., 3] > 128).sum()), 'x': X, 'y': Y, 'gy': round(SPOTS[spot][1] * K)}
        if nfire > 30:
            ys, xs = np.nonzero(rgba[..., 3] > 12)
            g = Image.fromarray(glow[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA').resize(im.size, Image.LANCZOS)
            g.save(os.path.join(OUT, key + '_glow.webp'), quality=88)
            m['glow'] = 1
        meta[key] = m; placed[key] = (im, X, Y)
        print(key, m['x'], m['y'], im.size, 'glow' if m.get('glow') else '', flush=True)
    anim = mg5_animation(meta['mg5'])
    if anim: meta['mg5']['anim'] = anim
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        for sel, suffix in ((['fort', 'hall1', 'tavern', 'dw1'], '_start'), (['castle', 'hall3', 'mg5', 'tavern', 'market', 'depot', 'dw1u', 'dw2u', 'dw3u', 'dw4u', 'dw5u'], '_full'), (['citadel', 'hall2', 'mg3', 'tavern', 'market', 'depot', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5'], '_mid')):
            c = base.convert('RGBA')
            for key in sorted(sel, key=lambda k: meta[k]['gy']):
                im, X, Y = placed[key]; c.alpha_composite(im, (X, Y))
            c.convert('RGB').save(out.replace('.png', suffix + '.png'))


def mg5_animation(m):
    """Level-5 guild video: cut every frame, cancel the camera's slow zoom, loop the storm part."""
    vid = os.path.join(SRC, 'MAge guild lvl5 animated.mp4')
    if not os.path.exists(vid): return None
    tmp = tempfile.mkdtemp()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vid, '-vf', 'fps=12', os.path.join(tmp, 'f%03d.png')], check=True)
    files = sorted(glob.glob(os.path.join(tmp, 'f*.png')))[40:]
    W, H = m['w'], m['h']
    bw, bcx = BODY['mg5']
    rim_in = m['gy'] - m['y']
    # pass 1: measure the island in every frame near its very bottom (lightning never reaches there),
    # then smooth the measurements over time: the camera zoom is slow and steady
    cuts, meas = [], []
    for f in files:
        rgba, info = cut(np.asarray(Image.open(f).convert('RGB')), island=False)
        solid = rgba[..., 3] > 200
        ys = np.nonzero(solid.any(1))[0]; ybot = ys.max()
        tower = np.nonzero(solid[:, :].any(0))[0]
        row = int(ybot - (ybot - ys.min()) * 0.1)
        xs = np.nonzero(solid[row - 2:row + 3].any(0))[0]
        cuts.append(rgba); meas.append((xs.max() - xs.min(), (xs.max() + xs.min()) / 2, row))
    t = np.arange(len(meas)); M = np.array(meas, np.float64)
    fit = [np.polyval(np.polyfit(t, M[:, j], 2), t) for j in range(3)]
    # the still's island measured the same way
    st = np.asarray(Image.open(os.path.join(OUT, 'mg5.webp')))[..., 3] > 200
    ys = np.nonzero(st.any(1))[0]; srow = int(ys.max() - (ys.max() - ys.min()) * 0.1)
    sx = np.nonzero(st[srow - 2:srow + 3].any(0))[0]
    sw, scx = sx.max() - sx.min(), (sx.max() + sx.min()) / 2
    sheet = []
    for i, rgba in enumerate(cuts):
        k = sw / fit[0][i]
        im = Image.fromarray(grade(rgba, SPOTS['guild'][3]), 'RGBA')
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        ox = scx - fit[1][i] * k; oy = srow - fit[2][i] * k + PAD
        frame = Image.new('RGBA', (W, H + PAD), (0, 0, 0, 0))
        frame.paste(im, (round(ox), round(oy)), im)
        # fade the island underside like the still
        a_ = np.asarray(frame).copy(); yy = np.arange(H + PAD)[:, None]
        fade = np.clip(1 - (yy - (rim_in + PAD)) / 18, 0, 1); a_[..., 3] = (a_[..., 3] * np.where(yy > rim_in + PAD, fade, 1)).astype(np.uint8)
        sheet.append(Image.fromarray(a_, 'RGBA'))
    n, X = len(sheet), 8
    loop = [Image.blend(sheet[n - X + i], sheet[i], (i + 1) / (X + 1)) if i < X else sheet[i] for i in range(n - X)]
    loop = [shadow_into(fr, rim_in + PAD, SPOTS['guild'][3]) for fr in loop]
    out = Image.new('RGBA', (W * len(loop), H + PAD))
    for i, fr in enumerate(loop): out.paste(fr, (i * W, 0))
    out.save(os.path.join(OUT, 'mg5_anim.webp'), quality=88)
    return {'n': len(loop), 'fps': 12, 'dy': -PAD, 'h': H + PAD}


BODY = {}
PAD = 70
if __name__ == '__main__':
    main()
