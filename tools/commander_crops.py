"""Head-focused commander portraits: square avatar (head and shoulders) and a wide strip for list buttons."""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'assets', 'source', 'pack')
OUT = os.path.join(ROOT, 'assets', 'sprites')
# head centre (x, y) and head-and-shoulders box size, in source pixels
HEADS = {1: (552, 175, 470), 2: (585, 170, 460), 3: (247, 215, 260), 4: (300, 160, 280)}
for n, (cx, cy, side) in HEADS.items():
    im = Image.open(os.path.join(PACK, f'Commander {n}.png')).convert('RGBA')
    bg = Image.new('RGBA', im.size, (26, 18, 16, 255)); bg.alpha_composite(im)
    sq = bg.crop((cx - side // 2, cy - int(side * 0.42), cx + side // 2, cy + int(side * 0.58)))
    sq.resize((256, 256), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, f'commander_{n}.png'))
    w = int(side * (0.95 if n <= 2 else 1.25)); h = int(w / 2.6); up = {1: 0.82, 2: 0.82, 3: 0.4, 4: 0.28}[n]
    st = bg.crop((cx - w // 2, cy - int(h * up), cx + w // 2, cy + int(h * (1 - up))))
    st.resize((260, 100), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, f'commander_{n}_strip.png'))
print('ok')
