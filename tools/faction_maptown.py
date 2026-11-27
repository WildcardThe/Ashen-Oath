"""Adventure-map towns of the Scrapjaw Horde and the Deathless Dynasty: cut from flat grey, plus a mask of
the painted blank white banners (tinted in the owner's colour by the game) and a glow layer (fires,
green lights) that the map pulses. Writes assets/sprites/town_<faction>{,_mask,_glow}.png.
Run: python3 tools/faction_maptown.py"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hollow_cut import cut
from rust_town import glow_layer
from commanders import banner_mask
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'sprites'); MAN = os.path.join(ROOT, 'assets', 'sprites.json')
WIDTH = {'scrapjaw': 440, 'deathless': 430, 'concord': 440, 'hollow': 440, 'palefang': 440}
NO_BANNER = {'concord'}   # painted banners only (no blank white one): the game adds its own flag
SRCDIR = {'concord': 'concord_snow', 'hollow': 'hollow_forge'}

man = json.load(open(MAN))
for fac, W in WIDTH.items():
    rgba, _ = cut(np.asarray(Image.open(os.path.join(ROOT, 'assets', 'source', SRCDIR.get(fac, fac), 'map_town.jpg')).convert('RGB')), island=False)
    ys, xs = np.nonzero(rgba[..., 3] > 20)
    crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = W / crop.shape[1]; size = (W, round(crop.shape[0] * k))
    im = Image.fromarray(crop, 'RGBA').resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, f'town_{fac}.png'), optimize=True)
    man[f'town_{fac}'] = {'kind': 'decor', 'w': size[0], 'h': size[1]}
    mk = Image.fromarray(banner_mask(np.asarray(im)), 'L')
    if os.path.exists(os.path.join(OUT, f'town_{fac}_mask.png')) and fac in NO_BANNER: os.remove(os.path.join(OUT, f'town_{fac}_mask.png')); man.pop(f'town_{fac}_mask', None)
    if fac not in NO_BANNER and (np.asarray(mk) > 128).sum() > 30:
        Image.merge('RGBA', (Image.new('L', size, 255),) * 3 + (mk,)).save(os.path.join(OUT, f'town_{fac}_mask.png'), optimize=True)
        man[f'town_{fac}_mask'] = {'kind': 'mask', 'w': size[0], 'h': size[1]}
    gl, nhot = glow_layer(crop)
    if nhot > 40:
        Image.fromarray(gl, 'RGBA').resize(size, Image.LANCZOS).save(os.path.join(OUT, f'town_{fac}_glow.png'), optimize=True)
        man[f'town_{fac}_glow'] = {'kind': 'decor', 'w': size[0], 'h': size[1]}
    print(fac, size, 'mask' if f'town_{fac}_mask' in man else '', 'glow' if nhot > 40 else '')
json.dump(man, open(MAN, 'w'), indent=1)
