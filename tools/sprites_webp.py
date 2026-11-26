"""Store animation strips and unit pictures as WebP (about 5x smaller than PNG): the game loads every
manifest sprite at start-up. Entries get "ext": "webp"; strips wider than WebP's 16383 px stay PNG.
Run after any tool that rewrites sprites: python3 tools/sprites_webp.py"""
import json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites'); MAN = os.path.join(ROOT, 'assets', 'sprites.json')
M = json.load(open(MAN)); n = 0; before = after = 0
for k, m in M.items():
    if k.startswith('town_'):   # also shown by direct .png path (town thumbnails)
        m.pop('ext', None); continue
    if m.get('atlas') or m.get('kind') not in ('anim', 'unit') or m.get('w', 0) > 16383: continue
    png, webp = os.path.join(SPR, k + '.png'), os.path.join(SPR, k + '.webp')
    if not os.path.exists(png): continue
    if not (m.get('ext') == 'webp' and os.path.exists(webp) and os.path.getmtime(webp) >= os.path.getmtime(png)):
        Image.open(png).save(webp, quality=88, method=4); n += 1
    m['ext'] = 'webp'; before += os.path.getsize(png); after += os.path.getsize(webp)
json.dump(M, open(MAN, 'w'), indent=1)
print(f'{n} converted; {before / 1e6:.0f} MB png -> {after / 1e6:.0f} MB webp')
