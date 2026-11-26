"""Pack the structure and mine pictures (and their glow layers) into two atlas images, so the
published artifact stays under its file-count limit. Manifest entries keep their names and gain
atlas/x/y; the loader cuts each sprite back out. Run after tools/structures.py."""
import json, os, re
from PIL import Image
OUT = 'assets/sprites'; MAN = 'assets/sprites.json'
man = json.load(open(MAN))
names = sorted(k for k in man if re.match(r'^(site|mine)_', k) and not k.endswith('_glow') and os.path.exists(f'{OUT}/{k}.png'))
for atlas, suffix in (('atlas_sites', ''), ('atlas_sites_glow', '_glow')):
    items = [(n + suffix, Image.open(f'{OUT}/{n + suffix}.png')) for n in names if os.path.exists(f'{OUT}/{n + suffix}.png')]
    W = 3072; x = y = rowh = 0; pos = {}
    for n, im in items:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    sheet = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for n, im in items:
        sheet.paste(im, pos[n]); man[n] = {'kind': 'glow' if suffix else 'site', 'w': im.width, 'h': im.height, 'atlas': atlas, 'x': pos[n][0], 'y': pos[n][1]}
    sheet.save(f'{OUT}/{atlas}.png', optimize=True)
    print(atlas, sheet.size, len(items), os.path.getsize(f'{OUT}/{atlas}.png') // 1024, 'KB')
json.dump(man, open(MAN, 'w'), indent=1)
