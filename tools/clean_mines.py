"""Remove the grass baseplate from map building sprites so they sit on any ground.

Usage:  python3 tools/clean_mines.py
Reads the untouched originals in assets/sprites_olive and writes assets/sprites.
Grass colours are sampled from each sprite's outer edge; matching pixels connected to the edge are made
transparent, so green details inside a building (crystals, glows) survive. A soft feather blends the cut.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'sprites_olive')
OUT = os.path.join(ROOT, 'assets', 'sprites')
NAMES = ['mine_adamantium', 'mine_ceramite', 'mine_plasteel', 'mine_blackstone', 'mine_auramite', 'mine_wraithbone',
         'mine_psycrystal', 'cave_crystal', 'ruin_gate', 'ruin_bridge',
         'rock_a', 'rock_c', 'rock_d', 'rock_e', 'rock_f', 'rock_g', 'crystal_blue', 'crystal_blue_s', 'crystal_purple', 'spires_black',
         'tree_dead', 'tree_teal', 'tree_mushroom', 'tree_orange', 'tree_pine', 'tree_purple', 'bush_green', 'bush_purple', 'bush_teal',
         'skeleton', 'stones_s']
SMALL = lambda n: not n.startswith(('mine_', 'cave_', 'ruin_'))
TREES = lambda n: n.startswith('tree_')
rng = np.random.default_rng(3)

for n in NAMES:
    a = np.asarray(Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    h, w = al.shape
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2); mx = rgb.max(axis=2); mn = rgb.min(axis=2); sat = (mx - mn) / np.maximum(mx, 1)
    # olive grass and dark soil specks: green-leaning, not bright
    greenish = (b < g * 0.78) & (g >= r * 0.85) & (lum < 125)
    soil = (lum < 100) & (b < g * 0.88) & (r < g * 1.32) & (sat < 0.75)
    glowing = (sat > 0.55) & (lum > 90)                        # crystals and lit windows
    cand = (greenish | soil) & ~glowing
    # only cut near the outside: grass plates sit at the rim, building details sit deeper in
    depth = ndimage.distance_transform_edt(al >= 200)
    # small obstacles: their grass rim is thin; trees keep their (green) foliage, so only the outer rim is cut
    cand &= depth < (12 if n == 'mine_blackstone' else 16 if TREES(n) else 9 if SMALL(n) else 26)
    cand |= al < 200                                           # existing soft edge counts as background
    cand = ndimage.binary_opening(cand, iterations=1)
    # keep only background connected to the sprite border
    lab, _ = ndimage.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    bg = ndimage.binary_dilation(bg, iterations=1) & (cand | (al < 200))   # grow slightly into grass, never into the building
    keep = ~bg
    keep = ndimage.binary_fill_holes(keep)
    lab2, k2 = ndimage.label(keep)                             # drop small stray islands
    if k2 > 1:
        sizes = ndimage.sum(keep, lab2, range(1, k2 + 1))
        keep = np.isin(lab2, [i + 1 for i, v in enumerate(sizes) if v >= 0.02 * keep.sum()])
    soft = ndimage.gaussian_filter(keep.astype(np.float32), 1.2)
    new_al = np.minimum(al, soft * 255)
    # tint leftover greenish fringe pixels towards neutral so no green halo remains
    rgb2 = rgb.copy()
    # leftover olive grass inside the building (between crystals, in courtyards) takes the ground's purple-grey
    olive = greenish & ~glowing & (soft > 0.05) & (depth < (10 if TREES(n) else 1e9))
    tint = np.array([1.02, 0.9, 1.08])
    rgb2[olive] = rgb[olive] * 0.25 + (lum[olive][:, None] * tint) * 0.75
    out = np.dstack([np.clip(rgb2, 0, 255), new_al]).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    im.save(os.path.join(OUT, n + '.png'))
    print(n, 'kept', round(float(keep.mean()) * 100), '%')
