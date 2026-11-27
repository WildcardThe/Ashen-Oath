"""Fit a hand-made town layout: for each spot, the building picture seen in the mockup and a rough box around
it (from looking at the mockup) are given; the exact size, position and mirroring are found by masked
template matching inside that box, and overlaps decide which building is drawn in front.
Writes assets/source/<src>/layout.json: {spot: {key, x, y, s, flip, z}} in landscape pixels (1376 wide).
Run: python3 tools/town_layout_fit.py <faction> <mockup.jpg>"""
import json, os, sys
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from faction_town import TOWNS, KEYS
from town_layout_match import crop_of
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# spot: (building picture used in the mockup, rough box x0, y0, x1, y1)
ASSIGN = {
    'concord': {
        'dw5': ('dw5', (250, 30, 365, 125)), 'fort': ('citadel', (350, 40, 745, 295)), 'guild': ('mg3', (105, 130, 320, 440)),   # the mockup shows two guild towers and no depot:
        'dw1': ('dw1', (345, 265, 530, 385)), 'tavern': ('tavern', (545, 265, 750, 395)), 'dw4': ('dw4', (890, 75, 1345, 365)),
        'market': ('market', (175, 400, 555, 615)), 'dw2': ('dw2', (10, 540, 305, 745)), 'depot': ('mg4', (510, 420, 950, 768)),   # the depot stands where the second tower was
        'dw3': ('dw3', (750, 360, 1050, 550)), 'hall': ('hall2', (995, 395, 1315, 630)),
    },
    'hollow': {
        'dw5': ('dw5u', (10, 170, 300, 400)), 'market': ('market', (300, 210, 480, 345)), 'fort': ('hall3', (395, 15, 735, 300)),
        'guild': ('mg5', (755, 80, 900, 300)), 'dw3': ('dw3u', (930, 95, 1060, 300)), 'dw4': ('dw4u', (1030, 190, 1360, 420)),
        'dw2': ('dw2u', (800, 235, 1040, 470)), 'tavern': ('tavern', (575, 330, 800, 470)), 'depot': ('depot', (225, 330, 590, 640)),
        'hall': ('hall3', (0, 455, 320, 800)), 'dw1': ('dw1u', (795, 415, 1225, 790)),
    },
}


def fit(img, land, crop, box):
    """mockup = landscape + buildings. For a building at (s, x, y, flip) the error over the area around its box is
    const + masked SQDIFF(mockup, building) - CCORR(D, mask), with D = |landscape - mockup|^2: a building too small
    leaves mockup pixels unexplained, one too big covers landscape the mockup still shows"""
    x0, y0, x1, y1 = box; bw = x1 - x0
    al = crop[..., 3] > 160
    xs = np.nonzero(al.any(0))[0]; ys0 = np.nonzero(al.any(1))[0]
    # size from the box: width and height ratios averaged (smoke widens some pictures, spires heighten others)
    s0 = np.sqrt(bw / (xs.max() + 1 - xs.min()) * (y1 - y0) / (ys0.max() + 1 - ys0.min()))
    D = ((land - img) ** 2).sum(2).astype(np.float32)
    pad = 900
    bigI = np.pad(img, ((pad, pad), (pad, pad), (0, 0)), mode='edge'); bigD = np.pad(D, pad)
    best = (9e9, None)
    for flip in (False, True):
        c = crop[:, ::-1] if flip else crop
        for s in s0 * np.linspace(0.88, 1.16, 11):
            tw, th = int(c.shape[1] * s), int(c.shape[0] * s)
            t = cv2.resize(c, (tw, th), interpolation=cv2.INTER_AREA).astype(np.float32)
            m = (t[..., 3] > 160).astype(np.float32)
            if m.sum() < 100: continue
            ys, xs2 = np.nonzero(m)
            # search window: the building's solid part anywhere near the box
            # the building's solid part must lie inside the box, give or take 12% of the box size
            mx, my = 0.12 * bw, 0.12 * (y1 - y0)
            X0 = int(x0 - mx - xs2.min()); X1 = int(x1 + mx - xs2.max())
            Y0 = int(y0 - my - ys.min()); Y1 = int(y1 + my - ys.max())
            if X1 < X0 or Y1 < Y0: continue
            wI = bigI[Y0 + pad:Y1 + pad + th, X0 + pad:X1 + pad + tw]; wD = bigD[Y0 + pad:Y1 + pad + th, X0 + pad:X1 + pad + tw]
            sq = cv2.matchTemplate(np.ascontiguousarray(wI), np.ascontiguousarray(t[..., :3]), cv2.TM_SQDIFF, mask=np.dstack([m] * 3))
            cc = cv2.matchTemplate(np.ascontiguousarray(wD), m, cv2.TM_CCORR)
            e = np.nan_to_num(sq - cc, nan=1e18, posinf=1e18)
            mv, _, ml, _ = cv2.minMaxLoc(e)
            if mv < best[0]: best = (mv, (float(s), X0 + ml[0], Y0 + ml[1], flip))
    return best


def main():
    fac, mock = sys.argv[1], sys.argv[2]
    T = TOWNS[fac]; src_dir = os.path.join(ROOT, 'assets', 'source', T.get('src', fac))
    img = np.asarray(Image.open(mock).convert('RGB').resize((1376, 768), Image.LANCZOS)).astype(np.float32)
    land = np.asarray(Image.open(os.path.join(src_dir, 'landscape.jpg')).convert('RGB').resize((1376, 768), Image.LANCZOS)).astype(np.float32)
    out, R = {}, {}
    for spot, (key, box) in ASSIGN[fac].items():
        crop = crop_of(src_dir, KEYS[key][0])
        err, (s, x, y, flip) = fit(img, land, crop, box)
        out[spot] = {'key': key, 'x': x, 'y': y, 's': round(s, 4), 'flip': flip, 'err': round(float(err) / 1e6, 2)}
        c = crop[:, ::-1] if flip else crop
        tw, th = int(c.shape[1] * s), int(c.shape[0] * s)
        cc = cv2.resize(c, (tw, th), interpolation=cv2.INTER_AREA).astype(np.float32)
        full = np.zeros((768 + 2 * 900, 1376 + 2 * 900, 4), np.float32); full[y + 900:y + 900 + th, x + 900:x + 900 + tw] = cc
        R[spot] = full[900:900 + 768, 900:900 + 1376]
        print(spot, out[spot], flush=True)
    # who is in front: in each overlap, the building whose pixels the mockup shows
    front = {k: set() for k in out}
    ks = list(out)
    for i, a in enumerate(ks):
        for b in ks[i + 1:]:
            ov = (R[a][..., 3] > 200) & (R[b][..., 3] > 200)
            if ov.sum() < 80: continue
            da = np.abs(R[a][..., :3][ov] - img[ov]).mean(); db = np.abs(R[b][..., :3][ov] - img[ov]).mean()
            if da < db: front[a].add(b)
            else: front[b].add(a)
    gy = {k: out[k]['y'] + R[k].shape[0] for k in out}
    gy = {k: out[k]['y'] + np.nonzero(R[k][..., 3].max(1) > 128)[0].max() for k in out}
    order = sorted(out, key=lambda k: gy[k])
    for _ in range(len(order) ** 2):
        moved = False
        for i in range(len(order) - 1):
            a, b = order[i], order[i + 1]
            if b in front[a] and a not in front[b]: order[i], order[i + 1] = b, a; moved = True
        if not moved: break
    for z, k in enumerate(order): out[k]['z'] = z
    json.dump(out, open(os.path.join(src_dir, 'layout.json'), 'w'), indent=1)
    print('back to front:', order)
    # preview: the fitted pictures over the landscape, side by side with the mockup
    base = Image.open(os.path.join(src_dir, 'landscape.jpg')).convert('RGBA').resize((1376, 768))
    for k in order: base.alpha_composite(Image.fromarray(R[k].astype(np.uint8), 'RGBA'))
    prev = Image.new('RGB', (1376, 1536)); prev.paste(Image.open(mock).convert('RGB').resize((1376, 768)), (0, 0)); prev.paste(base.convert('RGB'), (0, 768))
    prev.save(sys.argv[3] if len(sys.argv) > 3 else f'/tmp/layout_{fac}.jpg', quality=85)


if __name__ == '__main__':
    main()
