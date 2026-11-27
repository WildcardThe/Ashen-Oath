"""Pack the faction terrain pieces (tz_*) and biome river strips into WebP atlases, keeping the published
artifact under its file limit. Manifest entries keep their names and gain atlas/x/y/aext; the loader cuts
them back out. Run after tools/terrain_biomes.py (re-running it re-packs from the loose PNGs it writes)."""
import json, os, re
from PIL import Image
OUT = 'assets/sprites'; MAN = 'assets/sprites.json'
BIO = ('snow', 'scrap', 'shale', 'glass', 'ash', 'rust')
GROUPS = {f'atlas_tz_{i}': [b for b in BIO[i * 3:(i + 1) * 3]] for i in range(2)}
man = json.load(open(MAN))
for atlas, bios in GROUPS.items():
    pat = re.compile(r'^(tz_(%s)_.*|river_(%s))$' % ('|'.join(bios), '|'.join(bios)))
    names = sorted(k for k in man if pat.match(k))
    ims = []
    for n in names:
        p = f'{OUT}/{n}.png'
        if os.path.exists(p): ims.append((n, Image.open(p).convert('RGBA')))
        else:
            m = man[n]; ims.append((n, Image.open(f'{OUT}/{atlas}.webp').convert('RGBA').crop((m['x'], m['y'], m['x'] + m['w'], m['y'] + m['h']))))
    ims.sort(key=lambda t: -t[1].height)
    W = 2048; x = y = rowh = 0; pos = {}
    for n, im in ims:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    sheet = Image.new('RGBA', (W, y + rowh))
    for n, im in ims:
        sheet.paste(im, pos[n]); man[n].update({'w': im.width, 'h': im.height, 'atlas': atlas, 'aext': 'webp', 'x': pos[n][0], 'y': pos[n][1]})
    sheet.save(f'{OUT}/{atlas}.webp', quality=92, method=6)
    print(atlas, sheet.size, len(ims), os.path.getsize(f'{OUT}/{atlas}.webp') // 1024, 'KB')
json.dump(man, open(MAN, 'w'), indent=1)
