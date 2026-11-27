"""Mines per terrain (batch 11): 7 mines x 6 homelands from assets/source/mines2/<res>_<biome>.jpg (flat grey).
Each is cut out, given a glow layer for its lamps and crystals, and packed into assets/sprites/atlas_mines.webp and
atlas_mines_glow.webp as mine_<res>_<biome> (+ _glow). The map draws the version for the ground the mine stands on.
Run: python3 tools/mines_terrain.py"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from terrain_pack import cut_piece
from faction_town import glow_layer
SRC = 'assets/source/mines2'; OUT = 'assets/sprites'; MAN = 'assets/sprites.json'
RES = ['auramite', 'adamantium', 'ceramite', 'plasteel', 'blackstone', 'wraithbone', 'psycrystal']
BIO = ['snow', 'ash', 'rust', 'scrap', 'glass', 'shale']
man = json.load(open(MAN))
ims = []
for r in RES:
    for b in BIO:
        a = np.asarray(Image.open(f'{SRC}/{r}_{b}.jpg').convert('RGB'))[4:-4, 4:-4]
        p = cut_piece(a)
        im = Image.fromarray(p, 'RGBA'); s = 300 / im.width; im = im.resize((300, round(im.height * s)), Image.LANCZOS)
        gl, n = glow_layer(np.asarray(im))
        ims.append((f'mine_{r}_{b}', im, Image.fromarray(gl, 'RGBA') if n > 40 else None))
ims.sort(key=lambda t: -t[1].height)
W = 2048; x = y = rowh = 0; pos = {}
for n, im, _ in ims:
    if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
    pos[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (W, y + rowh)); glow = Image.new('RGBA', (W, y + rowh))
for n, im, gl in ims:
    sheet.paste(im, pos[n]); man[n] = {'kind': 'site', 'w': im.width, 'h': im.height, 'atlas': 'atlas_mines', 'aext': 'webp', 'x': pos[n][0], 'y': pos[n][1]}
    if gl is not None:
        glow.paste(gl, pos[n]); man[n + '_glow'] = {'kind': 'glow', 'w': im.width, 'h': im.height, 'atlas': 'atlas_mines_glow', 'aext': 'webp', 'x': pos[n][0], 'y': pos[n][1]}
    else: man.pop(n + '_glow', None)
sheet.save(f'{OUT}/atlas_mines.webp', quality=88, method=6); glow.save(f'{OUT}/atlas_mines_glow.webp', quality=85, method=6)
json.dump(man, open(MAN, 'w'), indent=1)
print(sheet.size, sum(1 for *_, g in ims if g is not None), 'with glow', os.path.getsize(f'{OUT}/atlas_mines.webp') // 1024, 'KB')
