"""Pack a painted town's building and glow pictures into one atlas (assets/town/<faction>/atlas.webp) to keep
the number of published files down. meta.json gets "atlas": 1 and per building "r" (and "gr" for its glow):
[x, y, w, h] in the atlas. The base picture and animated sheets stay separate files.
Run: python3 tools/pack_town.py <faction> [...]"""
import json, os, sys, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def pack(fac):
    d = os.path.join(ROOT, 'assets', 'town', fac); meta = json.load(open(os.path.join(d, 'meta.json')))
    items = []
    for k, m in meta.items():
        if k == 'base': continue
        items.append((k, 'r', os.path.join(d, k + '.webp')))
        if m.get('glow'): items.append((k, 'gr', os.path.join(d, k + '_glow.webp')))
    ims = [(k, f, Image.open(p).convert('RGBA'), p) for k, f, p in items if os.path.exists(p)]
    ims.sort(key=lambda t: -t[2].height)
    W = 4096; x = y = rowh = 0; pos = []
    for k, f, im, p in ims:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos.append((k, f, im, p, x, y)); x += im.width + 2; rowh = max(rowh, im.height)
    H = y + rowh
    if H > 16383: raise SystemExit(f'{fac}: atlas too tall ({H})')
    at = Image.new('RGBA', (W, H))
    for k, f, im, p, x, y in pos:
        at.paste(im, (x, y)); meta[k][f] = [x, y, im.width, im.height]
    at.save(os.path.join(d, 'atlas.webp'), quality=90, method=4)
    meta['atlas'] = 1
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), indent=1)
    print(fac, at.size, len(pos), 'pictures', round(os.path.getsize(os.path.join(d, 'atlas.webp')) / 1e6, 1), 'MB')

for f in sys.argv[1:]: pack(f)
