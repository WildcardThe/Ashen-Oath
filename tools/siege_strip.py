"""Complete wall strips (batch 9): per faction one long strip in three states (intact, damaged, destroyed), each a block
of ground running top to bottom with the moat, the wall, a gate in the middle and a tower at each end.
Each picture is matted and keystone-rectified on its own block edges to a rectangle (SW x SH), so the three states
line up part for part; the result (plus what rises above the far edge) is saved as one atlas per faction.
The game cuts it along its length into five parts and gives each part its own state.
Run: python3 tools/siege_strip.py [faction ...]"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siege_art import matte, edges
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'siege_strip'); OUT = os.path.join(ROOT, 'assets', 'siege')
SW, SH, ABOVE = 420, 1400, 160
STATES = ('intact', 'damaged', 'destroyed')


def rectify(path):
    a = np.asarray(Image.open(path).convert('RGB'))
    al, fg, _ = matte(a)
    pl, pr, far, near = edges(fg)
    v = np.arange(-ABOVE, SH); y = far + (v / SH) * (near - far)
    YY = np.repeat(y[:, None], SW, 1)
    XL = np.polyval(pl, YY); XR = np.polyval(pr, YY)
    XX = XL + (np.arange(SW)[None, :] / (SW - 1)) * (XR - XL)
    rgba = np.dstack([a, (al * 255).astype(np.uint8)])
    out = np.stack([map_coordinates(rgba[..., k].astype(np.float32), [YY, XX], order=1, cval=0) for k in range(4)], -1)
    return np.clip(out, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    facs = sys.argv[1:] or ['concord', 'hollow', 'rustbound', 'scrapjaw', 'deathless', 'palefang']
    mp = os.path.join(OUT, 'strip.json'); meta = json.load(open(mp)) if os.path.exists(mp) else {}
    for f in facs:
        ims = [rectify(os.path.join(SRC, f'{f}_{s}.jpg')) for s in STATES]
        sheet = np.concatenate(ims, 1)          # three states side by side, each SW wide and ABOVE + SH tall
        Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, f'strip_{f}.webp'), quality=88, method=6)
        Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, f'_strip_{f}.png'))
        meta[f] = {'w': SW, 'h': SH, 'above': ABOVE}
        print(f, sheet.shape)
    json.dump(meta, open(mp, 'w'))
