"""Commander screen: per-slot part masks of the hologram figure in assets/ui/commander.webp, so equipped artifacts tint
their body part in their rarity colour. Each part = a hand-drawn region (1376x768 screen coordinates) x the inside of the
figure, minus its bright frame lines (they stay visible on top of the colour). Output: assets/ui/holo_parts.webp, the
parts stacked vertically (alpha = mask), and holo_parts.json with the crop box and the order."""
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
X0, Y0, W, H = 200, 250, 360, 450
REG = {
    'head': [[(343, 272), (412, 272), (418, 330), (342, 330)]],
    'neck': [[(338, 328), (422, 328), (424, 350), (336, 350)]],
    'armor': [[(281, 348), (298, 314), (342, 306), (420, 306), (470, 318), (503, 345), (503, 405), (470, 418), (452, 432), (452, 520), (306, 520), (306, 432), (298, 418), (281, 405)]],
    'weapon': [[(256, 360), (275, 360), (288, 436), (308, 438), (308, 458), (296, 458), (320, 660), (300, 674), (270, 458), (240, 458), (240, 440), (268, 436)]],
    'ring1': [[(276, 402), (326, 402), (326, 462), (282, 462)]],
    'shield': [[(453, 402), (507, 402), (507, 482), (458, 482)]],
    'misc1': [[(330, 428), (436, 428), (436, 456), (330, 456)]],
    'cloak': [[(468, 478), (512, 468), (514, 642), (490, 652), (476, 560)], [(300, 470), (318, 470), (324, 622), (298, 640)], [(358, 456), (408, 456), (410, 640), (356, 640)]],
    'boots': [[(304, 520), (376, 520), (376, 676), (304, 676)], [(398, 520), (482, 520), (482, 676), (398, 676)]],
}
ORDER = list(REG)
img = np.asarray(Image.open('assets/ui/commander.webp').convert('RGB')).astype(np.float32)[Y0:Y0 + H, X0:X0 + W]
g = img[..., 1]
glowy = ndimage.gaussian_filter(g, 1.5) > 95
inside = ndimage.binary_fill_holes(ndimage.binary_closing(glowy, iterations=4))
inside = ndimage.binary_erosion(inside, iterations=4)
lines = ndimage.binary_dilation(g > 150, iterations=1)
fill = inside & ~lines
out = np.zeros((H * len(ORDER), W), np.uint8)
claimed = np.zeros((H, W), bool)
for k, name in enumerate(ORDER):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for poly in REG[name]: d.polygon([(x - X0, y - Y0) for x, y in poly], fill=255)
    r = np.asarray(m) > 0
    # small parts first in ORDER win overlaps with big ones (armour, cloak) only where they were drawn earlier
    part = r & fill & ~claimed if name in ('armor', 'cloak', 'boots') else r & fill
    if name not in ('armor', 'cloak', 'boots'): claimed |= r
    a = ndimage.gaussian_filter(part.astype(np.float32), 0.7)
    out[k * H:(k + 1) * H] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
Image.fromarray(np.dstack([np.full_like(out, 255)] * 3 + [out]), 'RGBA').save('assets/ui/holo_parts.webp', quality=90)
json.dump({'x': X0, 'y': Y0, 'w': W, 'h': H, 'order': ORDER}, open('assets/ui/holo_parts.json', 'w'))
# preview with sample colours
cols = [(255, 192, 74), (127, 200, 255), (192, 138, 255), (255, 192, 74), (127, 200, 255), (192, 138, 255), (200, 192, 168), (127, 200, 255), (192, 138, 255)]
pv = img.copy()
for k, c in enumerate(cols):
    a = out[k * H:(k + 1) * H, :, None] / 255 * 0.55
    pv = pv * (1 - a) + np.array(c, np.float32) * a
Image.fromarray(np.clip(pv, 0, 255).astype(np.uint8)).resize((W * 2, H * 2)).save('/tmp/claude-0/-home-user-ashen-oath/f78bccdc-629a-5cbd-823e-9f81438fa154/scratchpad/holo_pv.png')
