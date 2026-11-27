"""Pack small loose map sprites (decor, craters, pools, old river strips, commander map masks, town masks and
glows) into one atlas so the published artifact stays under its file limit. Entries gain atlas/x/y; the
loader cuts them back out. Town and avatar pictures loaded by path stay loose. Re-runnable."""
import json, os, re
from PIL import Image
OUT = 'assets/sprites'; MAN = 'assets/sprites.json'; ATLAS = 'atlas_misc'
PAT = re.compile(r'^(tree_mushroom|ruin_bridge|ruin_gate|cave_crystal|skeleton|stones_s|chest_map|goo_\d+|crater_\d+|pond_\d|river_(strip|acid|lava)|cmd_\w+_map_mask|town_\w+_(mask|glow))$')
man = json.load(open(MAN))
names = sorted(k for k in man if PAT.match(k))
ims = []
for n in names:
    p = f'{OUT}/{n}.png'
    if man[n].get('atlas') == ATLAS and os.path.exists(f'{OUT}/{ATLAS}.png'):
        m = man[n]; ims.append((n, Image.open(f'{OUT}/{ATLAS}.png').crop((m['x'], m['y'], m['x'] + m['w'], m['y'] + m['h']))))
    else: ims.append((n, Image.open(p).convert('RGBA')))
ims.sort(key=lambda t: -t[1].height)
W = 2048; x = y = rowh = 0; pos = {}
for n, im in ims:
    if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
    pos[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (W, y + rowh))
for n, im in ims:
    sheet.paste(im, pos[n]); man[n].update({'w': im.width, 'h': im.height, 'atlas': ATLAS, 'x': pos[n][0], 'y': pos[n][1]}); man[n].pop('ext', None)
sheet.save(f'{OUT}/{ATLAS}.png', optimize=True)
print(ATLAS, sheet.size, len(ims), os.path.getsize(f'{OUT}/{ATLAS}.png') // 1024, 'KB')
json.dump(man, open(MAN, 'w'), indent=1)
