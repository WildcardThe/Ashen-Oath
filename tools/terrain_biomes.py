"""Faction terrain sets (batch 5): one ground texture and eight painted objects per homeland.
Sources: assets/source/terrain2/<faction>_<part>.jpg, each a single object on flat grey.
- textures -> assets/terrain/ground_*.webp (seamless), one per passable terrain type
- mountain, trees, tree, rocks, log, lake -> assets/sprites/tz_<biome>_<part>.png with their size in tiles;
  the mountain also gets composed ridge variants (main peak with shaded shoulders) so ranges stack densely
- river -> assets/sprites/river_<biome>.png, a seamless cross-section strip (flow runs vertically)
Run: python3 tools/terrain_biomes.py"""
import json, os, sys
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from terrain_pack import cut_piece, seamless, SRC, OUT, MAN

BIOMES = {'snow': 'concord', 'scrap': 'scrapjaw', 'shale': 'palefang', 'glass': 'deathless', 'ash': 'hollow', 'rust': 'rustbound'}
# ground texture per terrain type file (see TERRAIN_TEX in src/data.js)
TEXTURES = {'ground_scrub': 'concord_tex', 'ground_broken': 'scrapjaw_tex', 'ground_marsh': 'palefang_tex',
            'ground_bone': 'deathless_tex2', 'ground_ash': 'hollow_tex', 'ground_dust': 'rustbound_tex'}
# intended width on the map in tiles; pieces are stored at 150 px per tile
TILES = {'mountain': 2.4, 'trees': 1.5, 'tree': 1.1, 'rocks': 1.35, 'log': 1.4, 'lake': 2.2}
PPT = 150
# river flow direction in the source: degrees to rotate so the water runs left to right
RIVER_ROT = {'concord': -43, 'hollow': 90, 'rustbound': 0, 'scrapjaw': 0, 'deathless': 0, 'palefang': 0}

manifest = json.load(open(MAN))


def load_piece(fac, part):
    a = np.asarray(Image.open(os.path.join(SRC, f'{fac}_{part}.jpg')).convert('RGB'))[4:-4, 4:-4]
    med = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)]), 0)
    # the cutter fills enclosed holes; clear flat grey trapped between branches, trunks and arches
    gap = ndimage.binary_opening(np.sqrt(((a.astype(np.float32) - med) ** 2).sum(2)) < 9, iterations=2)
    lab, n = ndimage.label(gap)
    if n:
        sz = ndimage.sum(gap, lab, range(1, n + 1)); gap = np.isin(lab, [i + 1 for i, z in enumerate(sz) if z > 150])
    # mountains keep their painted smoke (grey, close to the background): only trees and wrecks get gaps cleared
    return Image.fromarray(cut_piece(a, ndimage.binary_dilation(gap, iterations=1) if part in ('trees', 'tree', 'log', 'rocks') else None), 'RGBA')


def save(im, name, tiles):
    w = int(round(tiles * PPT)); im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'))
    manifest[name] = {'kind': 'decor', 'w': im.width, 'h': im.height, 'tiles': round(tiles, 2)}


def shade(im, k):
    r, g, b, a = im.split(); rgb = ImageEnhance.Brightness(Image.merge('RGB', (r, g, b))).enhance(k)
    return Image.merge('RGBA', (*rgb.split(), a))


def ridge(m, parts):
    """compose a wider range piece: [(scale, dx as a share of the main width, dy share, mirrored, shade)], drawn back to front"""
    W, H = m.size; boxes = []
    for s, dx, dy, mir, k in parts:
        w, h = int(W * s), int(H * s); x = int(W * dx) - w // 2; y = H - h + int(H * dy)
        boxes.append((x, y, w, h, mir, k))
    x0 = min(b[0] for b in boxes); x1 = max(b[0] + b[2] for b in boxes); y0 = min(b[1] for b in boxes); y1 = max(b[1] + b[3] for b in boxes)
    c = Image.new('RGBA', (x1 - x0, y1 - y0))
    for x, y, w, h, mir, k in boxes:
        p = m.resize((w, h), Image.LANCZOS)
        if mir: p = p.transpose(Image.FLIP_LEFT_RIGHT)
        if k != 1: p = shade(p, k)
        c.alpha_composite(p, (x - x0, y - y0))
    return c


def river(fac, out):
    p = load_piece(fac, 'river')
    if RIVER_ROT[fac]: p = p.rotate(RIVER_ROT[fac], resample=Image.BICUBIC, expand=True)
    a = np.asarray(p).astype(np.float32); al = a[..., 3] > 200
    rows = np.nonzero(al.mean(1) > 0.5)[0]; band = al[rows.min():rows.max() + 1]
    cols = np.nonzero(band.mean(0) > 0.92)[0]
    x0, x1 = cols.min() + 10, cols.max() - 10
    seg = a[:, x0:x1]
    ys = np.nonzero((seg[..., 3] > 20).mean(1) > 0.5)[0]; seg = seg[ys.min():ys.max() + 1]
    L = seg.shape[1]; o = L // 4
    t = np.linspace(0, 1, o)[None, :, None]
    body = seg[:, :L - o].copy(); body[:, :o] = seg[:, L - o:] * (1 - t) + seg[:, :o] * t
    strip = Image.fromarray(np.clip(np.transpose(body, (1, 0, 2)), 0, 255).astype(np.uint8), 'RGBA')
    w = 180; strip = strip.resize((w, round(strip.height * w / strip.width)), Image.LANCZOS)
    strip.save(os.path.join(OUT, out + '.png'))
    manifest[out] = {'kind': 'decor', 'w': strip.width, 'h': strip.height}


if __name__ == '__main__':
    only = sys.argv[1:]
    for k in [k for k in manifest if (k.startswith('tz_') and (not only or k.split('_')[1] in only)) or (k.startswith('river_') and k[6:] in BIOMES and (not only or k[6:] in only))]: del manifest[k]
    if not only:
        for out, src in TEXTURES.items(): seamless(os.path.join(SRC, src + '.jpg'), out)
    for bio, fac in BIOMES.items():
        if only and bio not in only: continue
        for part, tiles in TILES.items():
            p = load_piece(fac, part)
            if bio == 'ash' and part == 'mountain':
                # the painted smoke column reads as grey ghosts on the map: cut it off at the first row of rock
                # (the game draws animated smoke over the crater instead)
                a = np.asarray(p).astype(np.float32); on = a[..., 3] > 200; sat = a[..., :3].max(2) - a[..., :3].min(2)
                hot = (sat > 60) & on   # the crater glow: the first rows with fire mark the top of the cone
                y0 = int(np.nonzero(hot.sum(1) > 6)[0][0]); p = p.crop((0, max(0, y0 - 6), p.width, p.height))
                al = np.asarray(p).copy(); fade = np.clip(np.arange(al.shape[0]) / 12, 0, 1)[:, None]; al[..., 3] = (al[..., 3] * fade).astype(np.uint8); p = Image.fromarray(al, 'RGBA')
                print('ash smoke cut at', y0)
            save(p, f'tz_{bio}_{part}', tiles)
            if part == 'mountain':
                # ridge variants: shoulders left and right, a twin range, a low foothill pair
                save(ridge(p, [(0.72, 0.18, 0.04, True, 0.82), (0.66, 0.86, 0.06, False, 0.8), (1.0, 0.5, 0, False, 1)]), f'tz_{bio}_mtn1', 3.2)
                save(ridge(p, [(0.8, 0.25, 0.02, False, 0.85), (0.92, 0.78, 0.05, True, 1)]), f'tz_{bio}_mtn2', 3.0)
                save(ridge(p, [(0.62, 0.3, 0, True, 0.9), (0.55, 0.74, 0.04, False, 1)]), f'tz_{bio}_mtn3', 2.2)
                save(p.transpose(Image.FLIP_LEFT_RIGHT).resize((p.width, int(p.height * 0.8)), Image.LANCZOS), f'tz_{bio}_mtn4', 2.2)
        river(fac, f'river_{bio}')
        print(bio, 'done')
    json.dump(manifest, open(MAN, 'w'), indent=1)
