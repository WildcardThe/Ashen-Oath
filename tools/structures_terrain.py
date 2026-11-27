"""Map structures per homeland ground (batch 12): assets/source/structures2/<kind>_<biome>.jpg on flat grey, cut out,
given a glow layer, and packed into assets/sprites/atlas_st_<n>.webp (+ atlas_st_glow_<n>.webp) as st_<kind>_<biome>.
The map draws the version for the ground under the structure; kinds and grounds without one keep the original picture.
Run: python3 tools/structures_terrain.py"""
import json, os, sys, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from terrain_pack import cut_piece
from faction_town import glow_layer
SRC = 'assets/source/structures2'; OUT = 'assets/sprites'; MAN = 'assets/sprites.json'
man = json.load(open(MAN))
for k in [k for k in man if k.startswith('st_')]: del man[k]
for f in glob.glob(f'{OUT}/atlas_st_*.webp'): os.remove(f)
ims = []
for f in sorted(glob.glob(f'{SRC}/*.jpg')):
    name = 'st_' + os.path.basename(f)[:-4]
    a = np.asarray(Image.open(f).convert('RGB'))[4:-4, 4:-4]
    im = Image.fromarray(cut_piece(a), 'RGBA'); s = 280 / im.width; im = im.resize((280, round(im.height * s)), Image.LANCZOS)
    gl, n = glow_layer(np.asarray(im))
    ims.append((name, im, Image.fromarray(gl, 'RGBA') if n > 40 else None))
# sheets and glow layers share the same pages (keeps the published file count low)
items = [(n, im) for n, im, _ in ims] + [(n + '_glow', gl) for n, _, gl in ims if gl is not None]
items.sort(key=lambda t: -t[1].height)
W = H = 4096; pages = []; x = y = rowh = 0; page = []
for n, im in items:
    if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
    if y + im.height > H: pages.append(page); page = []; x = y = rowh = 0
    page.append((n, im, x, y)); x += im.width + 2; rowh = max(rowh, im.height)
pages.append(page)
for p, page in enumerate(pages):
    h = max(yy + im.height for _, im, _, yy in page)
    sheet = Image.new('RGBA', (W, h))
    for n, im, xx, yy in page:
        sheet.paste(im, (xx, yy))
        man[n] = {'kind': 'glow' if n.endswith('_glow') else 'site', 'w': im.width, 'h': im.height, 'atlas': f'atlas_st_{p}', 'aext': 'webp', 'x': xx, 'y': yy}
    sheet.save(f'{OUT}/atlas_st_{p}.webp', quality=86, method=6)
    print(p, sheet.size, len(page), os.path.getsize(f'{OUT}/atlas_st_{p}.webp') // 1024, 'KB')
json.dump(man, open(MAN, 'w'), indent=1)
