"""Obstacle pieces cut from the generated sheets sometimes end in a straight line where the sheet cell
clipped them (flat bottoms on peaks, flat tops on pools). This breaks every such edge into an irregular,
rocky outline: each clipped column (or row) is eaten back by a noisy depth with a short soft rim.
Re-running leaves already-rough pieces alone (it only touches edges that are still straight)."""
import json, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
MAN = 'assets/sprites.json'; OUT = 'assets/sprites'
man = json.load(open(MAN))
rng = np.random.default_rng(7)

def noise1d(n, scale):
    out = np.zeros(n)
    for octave, amp in ((scale, 1.0), (scale / 2.5, 0.5), (scale / 6, 0.25)):
        k = max(2, int(n / max(octave, 1)) + 2)
        pts = rng.uniform(-1, 1, k)
        out += amp * np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)
    return out / 1.75

def run(v):
    best = cur = 0
    for x in v:
        cur = cur + 1 if x else 0; best = max(best, cur)
    return best

def roughen(a):
    al = a[..., 3].astype(np.float32); H, W = al.shape; changed = []
    for side in ('bottom', 'top', 'left', 'right'):
        edge = {'bottom': al[-1], 'top': al[0], 'left': al[:, 0], 'right': al[:, -1]}[side]
        L = len(edge)
        if run(edge > 128) / L < 0.08: continue
        cross = H if side in ('bottom', 'top') else W
        base = max(4, cross * 0.07)
        depth = np.clip(base * (1.0 + 0.9 * noise1d(L, L / 7)), 2, cross * 0.22)
        depth = ndimage.uniform_filter1d(depth, 3)
        on = ndimage.binary_dilation(edge > 40, iterations=6)   # only where the piece actually reaches the edge
        for i in range(L):
            if not on[i]: continue
            d = depth[i]
            # soft rim: from fully kept at d+3 px inside the edge to cut at d px
            for t in range(4):
                keep = t / 3.0                                  # t=0 at the cut line, t=3 three px inside
                off = int(d) + t
                if side == 'bottom': y, x = H - 1 - off, i
                elif side == 'top': y, x = off, i
                elif side == 'left': y, x = i, off
                else: y, x = i, W - 1 - off
                if 0 <= y < H and 0 <= x < W: al[y, x] *= keep
            # everything beyond the depth is gone
            if side == 'bottom': al[H - int(d):, i] = 0
            elif side == 'top': al[:int(d), i] = 0
            elif side == 'left': al[i, :int(d)] = 0
            else: al[i, W - int(d):] = 0
        changed.append(side)
    a = a.copy(); a[..., 3] = np.clip(al, 0, 255).astype(np.uint8)
    return a, changed

names = sys.argv[1:] or [k for k in man if re.match(r'^(ow|owb|ov|mw|mwb|mv|mvb|pool|poolb)_\d+$', k)]
for k in names:
    p = f'{OUT}/{k}.png'; a = np.asarray(Image.open(p).convert('RGBA'))
    b, ch = roughen(a)
    if ch:
        im = Image.fromarray(b, 'RGBA'); bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        im = im.crop(bb); im.save(p); man[k]['w'], man[k]['h'] = im.size
        print(k, ch)
json.dump(man, open(MAN, 'w'), indent=1)
