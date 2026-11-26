"""Pack the obstacle, mountain and pool pieces into four atlases (keeps the published artifact under its
file limit). Manifest entries keep their names and gain atlas/x/y; the loader cuts them back out.
Run after tools/terrain_pack.py, tools/rough_edges.py and tools/clean_grey.py."""
import json, os, re
from PIL import Image
OUT = 'assets/sprites'; MAN = 'assets/sprites.json'
GROUPS = {'atlas_obst_w': r'^(ow|owb|pool|poolb)_\d+$', 'atlas_obst_v': r'^ov_\d+$', 'atlas_mtn_w': r'^(mw|mwb)_\d+$', 'atlas_mtn_v': r'^(mv|mvb)_\d+$'}
man = json.load(open(MAN))
for atlas, pat in GROUPS.items():
    names = sorted(k for k in man if re.match(pat, k) and (os.path.exists(f'{OUT}/{k}.png') or man[k].get('atlas') == atlas))
    ims = []
    for n in names:
        p = f'{OUT}/{n}.png'
        if os.path.exists(p): ims.append((n, Image.open(p).convert('RGBA')))
        else:   # already packed earlier: cut it back out of the old atlas
            m = man[n]; ims.append((n, Image.open(f'{OUT}/{atlas}.png').crop((m['x'], m['y'], m['x'] + m['w'], m['y'] + m['h']))))
    ims.sort(key=lambda t: -t[1].height)
    W = 2048; x = y = rowh = 0; pos = {}
    for n, im in ims:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    sheet = Image.new('RGBA', (W, y + rowh))
    for n, im in ims:
        sheet.paste(im, pos[n]); man[n].update({'w': im.width, 'h': im.height, 'atlas': atlas, 'x': pos[n][0], 'y': pos[n][1]})
    sheet.save(f'{OUT}/{atlas}.png', optimize=True)
    for n, _ in ims:
        if os.path.exists(f'{OUT}/{n}.png'): os.remove(f'{OUT}/{n}.png')
    print(atlas, sheet.size, len(ims), os.path.getsize(f'{OUT}/{atlas}.png') // 1024, 'KB')
json.dump(man, open(MAN, 'w'), indent=1)
