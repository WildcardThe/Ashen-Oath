"""Find where each building stands in a hand-made town layout (the user's mockup: buildings placed on the
landscape, some mirrored). Every building picture is cut exactly as tools/faction_town.py cuts it, then
searched in the mockup over scale and mirroring (masked template matching). Overlaps decide which building
is in front. Writes assets/source/<src>/layout.json: {key: {x, y, s, flip, score, z}} in landscape pixels.
Run: python3 tools/town_layout_match.py <faction> <mockup.jpg>"""
import json, os, sys
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from faction_town import TOWNS, KEYS, clear_pockets
from hollow_cut import cut
from rust_town import feather_ground
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def crop_of(src_dir, src):
    srgb = np.asarray(Image.open(os.path.join(src_dir, src + '.jpg')).convert('RGB'))
    rgba, _ = cut(srgb, island=False)
    rgba = feather_ground(clear_pockets(rgba, srgb))
    ys, xs = np.nonzero(rgba[..., 3] > 10)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def cost_map(img, unch, t):
    """per-position cost: mean squared colour error under the mask + penalty for covering untouched landscape"""
    m = (t[..., 3] > 128).astype(np.float32); n = m.sum()
    if n < 80: return None
    rgb = np.ascontiguousarray(t[..., :3])
    sq = cv2.matchTemplate(img, rgb, cv2.TM_SQDIFF, mask=np.dstack([m] * 3)) / (n * 3 * 255.0 ** 2)
    un = cv2.matchTemplate(unch, m, cv2.TM_CCORR) / n
    return sq * 6 + un * 0.6


def search(img, unch, crop, flip, smin, smax, step, coarse, win=None):
    c = crop[:, ::-1] if flip else crop
    H, W = img.shape[:2]
    if coarse != 1:
        img = cv2.resize(img, (int(W * coarse), int(H * coarse)), interpolation=cv2.INTER_AREA)
        unch = cv2.resize(unch, (int(W * coarse), int(H * coarse)), interpolation=cv2.INTER_AREA)
    best = (9e9, None); s = smin
    while s <= smax * 1.0001:
        k = s * coarse; tw, th = int(c.shape[1] * k), int(c.shape[0] * k)
        if 8 <= tw < img.shape[1] and 8 <= th < img.shape[0]:
            t = cv2.resize(c, (tw, th), interpolation=cv2.INTER_AREA).astype(np.float32)
            if win:
                x0, y0 = int(max(0, win[0] - 24)), int(max(0, win[1] - 24))
                x1, y1 = int(min(img.shape[1], win[0] + tw + 24)), int(min(img.shape[0], win[1] + th + 24))
                if x1 - x0 < tw or y1 - y0 < th: s *= step; continue
                cm = cost_map(img[y0:y1, x0:x1], unch[y0:y1, x0:x1], t)
            else: cm, x0, y0 = cost_map(img, unch, t), 0, 0
            if cm is not None:
                cm = np.nan_to_num(cm, nan=9, posinf=9, neginf=9)
                mv, _, ml, _ = cv2.minMaxLoc(cm)
                if mv < best[0]: best = (mv, (s, (x0 + ml[0]) / coarse, (y0 + ml[1]) / coarse))
        s *= step
    return best


def main():
    fac, mock = sys.argv[1], sys.argv[2]
    T = TOWNS[fac]; src_dir = os.path.join(ROOT, 'assets', 'source', T.get('src', fac))
    img = np.asarray(Image.open(mock).convert('RGB').resize((1376, 768), Image.LANCZOS)).astype(np.float32)
    base = np.asarray(Image.open(os.path.join(src_dir, 'landscape.jpg')).convert('RGB').resize((1376, 768))).astype(np.float32)
    changed = np.abs(img - base).mean(2) > 18          # where the mockup differs from the bare landscape
    unch = (~changed).astype(np.float32)
    crops = {}
    for key, (src, spot, f) in KEYS.items():
        p = os.path.join(src_dir, src + '.jpg')
        if not os.path.exists(p): continue
        crops[key] = crop_of(src_dir, src)
    hits = {}
    for key, c in crops.items():
        res = []
        for flip in (False, True):
            sc, loc = search(img, unch, c, flip, 140 / c.shape[1], 900 / c.shape[1], 1.05, 0.33)
            if loc: res.append((sc, flip, loc))
        sc, flip, (s, x, y) = min(res, key=lambda t: t[0])
        sc2, (s, x, y) = search(img, unch, c, flip, s / 1.08, s * 1.08, 1.015, 1.0, win=(x, y))
        # share of the building's pixels that sit where the mockup really has something new
        tw, th = int(c.shape[1] * s), int(c.shape[0] * s)
        cc = cv2.resize(c[:, ::-1] if flip else c, (tw, th))
        m = cc[..., 3] > 128
        sub = changed[int(y):int(y) + th, int(x):int(x) + tw]
        cover = float(sub[m[:sub.shape[0], :sub.shape[1]]].mean()) if sub.size else 0
        hits[key] = {'x': round(x, 1), 'y': round(y, 1), 's': round(s, 4), 'flip': flip, 'score': round(float(sc2), 4), 'cover': round(cover, 3)}
        print(key, hits[key], flush=True)
    # one building per spot: the level with the best score is the one shown in the mockup
    chosen = {}
    for key, h in hits.items():
        spot = KEYS[key][1]
        q = h['score']
        if spot not in chosen or q < chosen[spot][1]: chosen[spot] = (key, q)
    out = {spot: dict(hits[k], key=k) for spot, (k, q) in chosen.items()}
    # front/back: for each overlapping pair, the one whose pixels match the mockup in the overlap is in front
    def render(k):
        h = out[k]; c = crops[h['key']]; c = c[:, ::-1] if h['flip'] else c
        tw, th = int(c.shape[1] * h['s']), int(c.shape[0] * h['s'])
        cc = cv2.resize(c, (tw, th)).astype(np.float32)
        full = np.zeros((768, 1376, 4), np.float32)
        x, y = int(h['x']), int(h['y'])
        X1, Y1 = min(1376, x + tw), min(768, y + th)
        full[y:Y1, x:X1] = cc[:Y1 - y, :X1 - x]
        return full
    R = {k: render(k) for k in out}
    front = {k: set() for k in out}       # k is in front of these
    ks = list(out)
    for i, a in enumerate(ks):
        for b in ks[i + 1:]:
            ov = (R[a][..., 3] > 200) & (R[b][..., 3] > 200)
            if ov.sum() < 60: continue
            da = np.abs(R[a][..., :3][ov] - img[ov]).mean(); db = np.abs(R[b][..., :3][ov] - img[ov]).mean()
            (front[a] if da < db else front[b]).add(b if da < db else a)
    # z: depth order consistent with the pairwise results, ground line as tie-break
    gy = {k: out[k]['y'] + crops[out[k]['key']].shape[0] * out[k]['s'] for k in out}
    order = sorted(out, key=lambda k: gy[k])
    for _ in range(len(order) ** 2):
        moved = False
        for i in range(len(order) - 1):
            a, b = order[i], order[i + 1]
            if b in front[a]: order[i], order[i + 1] = b, a; moved = True
        if not moved: break
    for z, k in enumerate(order): out[k]['z'] = z
    json.dump(out, open(os.path.join(src_dir, 'layout.json'), 'w'), indent=1)
    for k in order: print(f"{k:7s} {out[k]['key']:8s} z={out[k]['z']:2d} flip={out[k]['flip']} score={out[k]['score']} cover={out[k]['cover']}")


if __name__ == '__main__':
    main()
