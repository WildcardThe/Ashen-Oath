"""Hollow tier-3 Raptor stills and tier-5 'Desecrator' sprites: still images (white background) and walk/shoot animation strips.

Animation sheets are 5x5 grids of 256px cells with transparent backgrounds. Each sheet becomes one
horizontal strip of frames sharing a common crop, so feet stay aligned between frames. Metadata
(frame size, foot anchor, body height, muzzle point, fire frame) goes into assets/sprites.json.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'sprites')
MAN = os.path.join(ROOT, 'assets', 'sprites.json')
manifest = json.load(open(MAN))


def white_unit(src, name, height=240):
    a = np.asarray(Image.open(os.path.join(SRC, src)).convert('RGB')).astype(np.float32)
    lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2)
    light = (a.min(axis=2) > 175) | ((lum > 120) & (sat < 22))       # paper white and grey smoke wisps
    lab, _ = ndimage.label(light)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    keep = ndimage.binary_opening(~bg, iterations=1)
    lab2, k2 = ndimage.label(keep)
    if k2 > 1:
        sizes = ndimage.sum(keep, lab2, range(1, k2 + 1))
        keep = np.isin(lab2, [i + 1 for i, v in enumerate(sizes) if v > 0.01 * keep.sum()])
    # enclosed paper-white pockets (between chains, arms and flames) are background too
    white = (a.min(axis=2) > 222) & (sat < 18)
    wl, wn = ndimage.label(white)
    if wn:
        ws = ndimage.sum(white, wl, range(1, wn + 1))
        keep &= ~np.isin(wl, [i + 1 for i, v in enumerate(ws) if v > 40])
    alpha = ndimage.gaussian_filter(keep.astype(np.float32), 0.7) * 255
    im = Image.fromarray(np.dstack([a, alpha]).astype(np.uint8), 'RGBA')
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox())
    im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'))
    manifest[name] = {'kind': 'unit', 'w': im.width, 'h': im.height}


def white_unit_soft(src, name, height=240):
    """Soft matte for art with smoke and fire: solid body plus semi-transparent smoke, un-mixed from white."""
    a = np.asarray(Image.open(os.path.join(SRC, src)).convert('RGB')).astype(np.float32)
    lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2); mn = a.min(axis=2)
    soft = np.clip((255 - mn) * 2.2 / 255, 0, 1)
    core = (lum < 150) | (sat > 70)
    core = ndimage.binary_opening(core, iterations=1)
    lab, n = ndimage.label(core)
    if n > 1:
        sz = ndimage.sum(core, lab, range(1, n + 1))
        core = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v > 200])
    filled = ndimage.binary_fill_holes(core)
    # keep filled pockets only when ringed by flame (white-hot cores); pockets inside chain loops stay open
    holes = filled & ~core
    hl, hn = ndimage.label(holes)
    for i in range(1, hn + 1):
        m = hl == i
        ring = ndimage.binary_dilation(m, iterations=3) & ~m
        if (sat[ring] > 80).mean() < 0.5:
            filled &= ~(m & (mn > 200))
    core = filled
    alpha = np.maximum(ndimage.gaussian_filter(core.astype(np.float32), 0.8), soft)
    alpha[alpha < 0.06] = 0
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip(255 - (255 - a) / safe, 0, 255)
    rgb = np.where(core[..., None], a, rgb)
    im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox())
    im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'))
    manifest[name] = {'kind': 'unit', 'w': im.width, 'h': im.height}


def anim_sheet(src, name, frames, height=200, fire=None, ref=None, hit=None):
    sheet = Image.open(os.path.join(SRC, src)).convert('RGBA')
    c = sheet.width // 5
    cells = [sheet.crop(((i % 5) * c, (i // 5) * c, (i % 5) * c + c, (i // 5) * c + c)) for i in range(frames)]
    alphas = [np.asarray(c.getchannel('A')) > 20 for c in cells]
    union = np.any(alphas, axis=0)
    ys, xs = np.nonzero(union)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # foot anchor: centre of the lowest 12% of the figure, averaged over all frames
    feet = union[int(y1 - (y1 - y0) * 0.12):y1]
    fx = np.nonzero(feet.any(axis=0))[0].mean()
    # body height: median top of each frame (ignores muzzle flash and raised arms)
    tops = [np.nonzero(a.any(axis=1))[0].min() for a in alphas]
    body = y1 - float(np.median(tops))
    k = height / (y1 - y0)
    fw, fh = round((x1 - x0) * k), height
    strip = Image.new('RGBA', (fw * frames, fh))
    for i, c in enumerate(cells):
        strip.paste(c.crop((x0, y0, x1, y1)).resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    strip.save(os.path.join(OUT, name + '.png'))
    ay = 1.0
    if ref is not None:
        # anchor on the standing reference frame: its feet are the ground line, its height the body size
        a0 = alphas[ref]; r_ys, r_xs = np.nonzero(a0)
        fy = r_ys.max() + 1; ft = a0[int(fy - (fy - r_ys.min()) * 0.12):fy]
        fx = np.nonzero(ft.any(axis=0))[0].mean(); body = fy - r_ys.min(); ay = (fy - y0) / (y1 - y0)
    meta = {'kind': 'anim', 'w': strip.width, 'h': fh, 'n': frames, 'fw': fw, 'fh': fh,
            'ax': round(float((fx - x0) / (x1 - x0)), 4), 'ay': round(float(ay), 4), 'body': round(float(body / (y1 - y0)), 4)}
    if hit is not None: meta['hit'] = hit
    meta['src'] = int(y1 - y0)      # strip height in source pixels, to match scales between strips
    if fire is not None:
        # muzzle: right-most opaque point of the gun in the frame before the flash
        a = alphas[fire - 1][y0:y1, x0:x1]
        # ignore stray sparks: measure on the figure itself (largest connected piece)
        lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=2))
        if n > 1: a = a & (lab == (int(np.argmax(ndimage.sum(a, lab, range(1, n + 1)))) + 1))
        cols = np.nonzero(a.any(axis=0))[0]; mx = cols.max()
        my = np.nonzero(a[:, mx - 3:mx + 1].any(axis=1))[0].mean()
        meta.update({'fire': fire, 'mx': round(mx / (x1 - x0), 4), 'my': round(my / (y1 - y0), 4)})
    manifest[name] = meta


white_unit_soft('t3h-base.webp', 'unit_raptor')
white_unit_soft('t3h-up.webp', 'unit_raptor_u')
white_unit('t5h-base.webp', 'unit_desecrator')
white_unit('t5h-up.webp', 'unit_desecrator_u')
anim_sheet('t5h-walk.webp', 'anim_desecrator_walk', 21)
anim_sheet('t5h-shoot.png', 'anim_desecrator_shoot', 25, fire=10)
anim_sheet('t3h-fly.png', 'anim_raptor_fly', 25, ref=0)
anim_sheet('t3h-attack.webp', 'anim_raptor_attack', 25, height=420, ref=0, hit=14)
white_unit_soft('t1h-base.webp', 'unit_zealot')
white_unit_soft('t1h-up.webp', 'unit_zealot_u')
anim_sheet('t1h-run.png', 'anim_zealot_run', 25)
anim_sheet('t1h-attack.webp', 'anim_zealot_attack', 25, height=420, ref=0, hit=7)
anim_sheet('t3c-walk.png', 'anim_knight_walk', 13)
anim_sheet('t3c-attack.webp', 'anim_knight_attack', 22, height=420, ref=0, hit=7)
# Hollow tier 4 gunner (frames cut by tools/t4h_sprites.py). The shoot strip fires on the first frame
# with a painted muzzle flash.
def first_flash(src):
    sh = np.asarray(Image.open(os.path.join(SRC, src)).convert('RGBA')).astype(np.float32); c = sh.shape[1] // 5
    for i in range(25):
        cell = sh[(i // 5) * c:(i // 5 + 1) * c, (i % 5) * c:(i % 5 + 1) * c]
        if ((cell[..., 0] > 230) & (cell[..., 1] > 200) & (cell[..., 3] > 200)).sum() > 25: return i
    return 8
for tag in ('base', 'up'):
    nm = 'gunner' if tag == 'base' else 'gunner_u'
    anim_sheet(f't4h-{tag}-walk.png', f'anim_{nm}_walk', 25, height=220, ref=0)
    anim_sheet(f't4h-{tag}-shoot.png', f'anim_{nm}_shoot', 25, height=220, ref=0, fire=first_flash(f't4h-{tag}-shoot.png'))
    # still picture for portraits and the recruit window: the aiming pose, first shoot frame
    st = Image.open(os.path.join(OUT, f'anim_{nm}_shoot.png')); m = manifest[f'anim_{nm}_shoot']
    fr = st.crop((0, 0, m['fw'], m['fh'])); fr = fr.crop(fr.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox())
    fr = fr.resize((round(fr.width * 240 / fr.height), 240), Image.LANCZOS); fr.save(os.path.join(OUT, f'unit_{nm}.png'))
    manifest[f'unit_{nm}'] = {'kind': 'unit', 'w': fr.width, 'h': fr.height}
# Pyre Desecrators (upgraded tier 5): own walk, shoot and melee sheets, cut by tools/sheet_cut.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet_cut import frames_from_sheet, write_grid
_w = frames_from_sheet(os.path.join(SRC, 't5h-up-walk.jpg'), [(4, 150), (154, 305), (308, 459)])          # side-view rows only
write_grid(_w, os.path.join(SRC, 't5h-up-walk-grid.png'), 260)
write_grid(frames_from_sheet(os.path.join(SRC, 't5h-up-attack.jpg'), [(i * 154, (i + 1) * 154) for i in range(5)]), os.path.join(SRC, 't5h-up-attack-grid.png'), 260)
write_grid(frames_from_sheet(os.path.join(SRC, 't5h-up-shoot.jpg'), [(i * 154, (i + 1) * 154) for i in range(5)]), os.path.join(SRC, 't5h-up-shoot-grid.png'), 260)
anim_sheet('t5h-up-walk-grid.png', 'anim_desecrator_u_walk', len(_w), height=260, ref=0)
anim_sheet('t5h-up-shoot-grid.png', 'anim_desecrator_u_shoot', 25, height=260, ref=0, fire=11)
anim_sheet('t5h-up-attack-grid.png', 'anim_desecrator_u_attack', 25, height=260, ref=0, hit=13)
# Pyre Raptors (upgraded tier 3): own flight and melee sheets
_f = frames_from_sheet(os.path.join(SRC, 't3h-up-fly.jpg'), [(i * 154, (i + 1) * 154) for i in range(5)])[:25]
write_grid(_f, os.path.join(SRC, 't3h-up-fly-grid.png'), 320)
write_grid(frames_from_sheet(os.path.join(SRC, 't3h-up-attack.jpg'), [(i * 154, (i + 1) * 154) for i in range(5)]), os.path.join(SRC, 't3h-up-attack-grid.png'), 320)
anim_sheet('t3h-up-fly-grid.png', 'anim_raptor_u_fly', 25, height=260, ref=0)
anim_sheet('t3h-up-attack-grid.png', 'anim_raptor_u_attack', 25, height=300, ref=0, hit=17)
# Bloodsworn (base tier 1): melee sheet
_a = frames_from_sheet(os.path.join(SRC, 't1h-base-attack.jpg'), [(i * 154, (i + 1) * 154) for i in range(5)])
write_grid(_a, os.path.join(SRC, 't1h-base-attack-grid.png'), 300)
anim_sheet('t1h-base-attack-grid.png', 'anim_zealot_attack_b', len(_a), height=260, ref=0, hit=17)
# Hellfire Reavers (upgraded tier 2): ranged and melee grids in bordered cells on one sheet
from sheet_cut import cut_figure
_sheet = np.asarray(Image.open(os.path.join(SRC, 't2h-up-sheet.jpg')).convert('RGB'))
_rows = [(53, 182), (190, 319), (327, 456), (464, 593), (601, 731)]
def _cells(xs):
    out = []
    for (y0, y1) in _rows:
        for (x0, x1) in xs:
            c = _sheet[y0 + 4:y1 - 3, x0 + 4:x1 - 3]
            out.append(cut_figure(c, 0, c.shape[1], thr=13))
    return out
write_grid(_cells([(19, 142), (150, 274), (282, 405), (413, 536), (545, 668)]), os.path.join(SRC, 't2h-up-shoot-grid.png'), 200)
write_grid(_cells([(707, 831), (839, 962), (970, 1093), (1102, 1225), (1233, 1357)]), os.path.join(SRC, 't2h-up-attack-grid.png'), 200)
anim_sheet('t2h-up-shoot-grid.png', 'anim_reaver_u_shoot', 25, height=220, ref=0, fire=13)
anim_sheet('t2h-up-attack-grid.png', 'anim_reaver_u_attack', 25, height=220, ref=0, hit=11)
# Blood Reavers (base tier 2): the sheet mixes poses, so the animations are built from the frames that
# belong together: standing rifle fire, and the overhead flail smash
from sheet_cut import cut_gradient
_br = np.asarray(Image.open(os.path.join(SRC, 't2h-base-sheet.jpg')).convert('RGB'))
_brows = [(50, 198), (195, 340), (335, 480), (475, 620), (612, 762)]
def _brcell(x0, i):
    r, k = divmod(i, 5); y0, y1 = _brows[r]; xa = x0 + k * 131 - 8
    return cut_gradient(_br[y0:y1, max(0, xa):xa + 147], 10, 137)
_sh = [_brcell(18, i) for i in (0, 0, 5, 5, 11, 11, 10, 10, 10, 15, 15, 15, 15, 0, 0)]
_me = [_brcell(704, i) for i in (0, 0, 1, 1, 2, 2, 3, 6, 7, 7, 7, 9, 9, 0, 0)]
write_grid(_sh, os.path.join(SRC, 't2h-base-shoot-grid.png'), 200)
write_grid(_me, os.path.join(SRC, 't2h-base-attack-grid.png'), 200)
anim_sheet('t2h-base-shoot-grid.png', 'anim_reaver_shoot', 15, height=220, ref=0, fire=6)
anim_sheet('t2h-base-attack-grid.png', 'anim_reaver_attack', 15, height=220, ref=0, hit=8)
# Wandering creatures: still picture, movement sheet and attack sheet each
from sheet_cut import grid_frames
from hollow_cut import cut as _cut
CRE = os.path.join(SRC, 'creatures')
# id: (picture, move sheet, (cols, rows, even), attack sheet, (cols, rows, even), attack pose, hit/fire frame)
CREATURES = {
    'servitor': ('Scrap Servitors', 'Scrap Servitors movement', (7, 3, False), 'Scrap Servitors melee', (5, 4, False), 'attack', 13),
    'scuttler': ('Scuttler Brood', 'Scuttler Brood move', (5, 4, False), 'Scuttler Brood attack', (5, 5, False), 'attack', 7),
    'raider': ('Rustkin Raiders', 'Rustkin Raiders move', (5, 5, False), 'Rustkin Raiders ranged attack', (5, 5, False), 'shoot', 10),
    'stalker': ('Chitin Stalkers', 'Chitin Stalkers move', (5, 5, False), 'Chitin Stalkers attack', (5, 5, False), 'attack', 7),
    'brute': ('Mutant Brute', 'Mutant Brute move', (5, 4, False), 'Mutant Brute attack', ([5, 5, 5, 7], None, False), 'attack', 12),
    'wraith': ('Void Wraiths', 'Void Wraiths move', (5, 4, False), 'Void Wraiths attack', (5, 5, False), 'attack', 12),
    'hulk': ('Spore Hulks', 'Spore Hulks move', (5, 4, False), 'Spore Hulks attack', (5, 5, False), 'attack', 15),
    'mawprince': ('Princes of the Maw', 'Princes of the Maw move', (5, 5, False), 'Princes of the Maw attack', (5, 5, False), 'attack', 13),
    'drake': ('Ash Drakes', 'Ash Drakes move', (5, 5, False), 'Ash Drakes attack', (5, 5, False), 'attack', 13),
    'mawspawn': ('Maw Spawn', 'Maw Spawn move', (5, 5, False), 'Maw Spawn attack', (5, 5, False), 'attack', 12),
    'kite': ('Carrion Kite', 'Carrion Kite fly', (5, 5, False), 'Carrion Kite attack', (5, 5, False), 'attack', 12),
    'basilisk': ('Basilisk', 'Basilisk move', (5, 5, False), 'Basilisk attack', (5, 5, False), 'attack', 9),
}
# elite versions (stronger wandering creatures): same layout, own folder
CRE_E = os.path.join(SRC, 'creatures_elite')
ELITES = {
    'servitor_e': ('Overseer Servitors', 'Overseer Servitors move', (5, 3, False), 'Overseer Servitors attack', (5, 5, False), 'attack', 13),
    'scuttler_e': ('Scuttler Queens', 'Scuttler Queens move', (5, 4, False), 'Scuttler Queens attack', (5, 4, False), 'attack', 8),
    'raider_e': ('Rustkin Warbosses', 'Rustkin Warbosses move', (7, 3, False), 'Rustkin Warbosses attack', (5, 5, False), 'shoot', 12),
    'stalker_e': ('Chitin Reapers', 'Chitin Reapers move', (5, 5, False), 'Chitin Reapers attack', (5, 5, False), 'attack', 8),
    'brute_e': ('Mutant Warlords', 'Mutant Warlords move', (5, 5, False), 'Mutant Warlords attack', (5, 5, False), 'attack', 13),
    'wraith_e': ('Void Revenants', 'Void Revenants move', (5, 5, False), 'Void Revenants attack', (5, 5, False), 'attack', 12),
    'hulk_e': ('Blight Titans', 'Blight Titans move', (5, 5, False), 'Blight Titans attack', (5, 4, False), 'attack', 14),
    'mawprince_e': ('Archons of the Maw', 'Archons of the Maw move', (5, 4, False), 'Archons of the Maw attack', (5, 5, False), 'attack', 12),
    'drake_e': ('Magma Wyrms', 'Magma Wyrms move', (5, 5, False), 'Magma Wyrms attack', (5, 5, False), 'attack', 13),
    'mawspawn_e': ('Maw Fiend', 'Maw Fiend move', (5, 5, False), 'Maw Fiend attack', (5, 5, False), 'attack', 13),
    'kite_e': ('Plague Kite', 'Plague Kite fly', (5, 5, False), 'Plague Kite attack', (5, 5, False), 'attack', 12),
    'basilisk_e': ('Petrifex Basilisk', 'Petrifex Basilisk move', (5, 5, False), 'Petrifex Basilisk attack', (5, 5, False), 'attack', 9),
}
ALL_CRE = {**{k: (CRE, v) for k, v in CREATURES.items()}, **{k: (CRE_E, v) for k, v in ELITES.items()}}
only = [a for a in sys.argv[1:] if not a.startswith('-')]
for cid, (CRE, (pic, mv, mspec, at, aspec, apose, hit)) in ALL_CRE.items():
    if only and cid not in only: continue
    rgba, _ = _cut(np.asarray(Image.open(os.path.join(CRE, pic + '.jpg')).convert('RGB')), island=False)
    im = Image.fromarray(rgba, 'RGBA'); im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
    im = im.resize((round(im.width * 260 / im.height), 260), Image.LANCZOS)
    im.save(os.path.join(OUT, f'unit_{cid}.png'))
    manifest[f'unit_{cid}'] = {'kind': 'unit', 'w': im.width, 'h': im.height}
    for kind, sheet, (cols, rows, even) in (('move', mv, mspec), (apose, at, aspec)):
        fr = grid_frames(os.path.join(CRE, sheet + '.jpg'), cols, rows, even=even, grey_figure=(cid == 'basilisk' and kind == 'attack'))
        if cid == 'servitor':
            for f in fr:   # grey ground disc painted under its feet
                c_ = f[..., :3].astype(int); sat_ = c_.max(2) - c_.min(2); H_ = f.shape[0]
                low = np.zeros(f.shape[:2], bool); low[int(H_ * 0.85):] = True
                f[..., 3] = np.where(low & (sat_ < 14) & (c_.mean(2) > 55), 0, f[..., 3])
        g = os.path.join(CRE, f'_{cid}_{kind}.png')
        write_grid(fr, g, max(max(f.shape[:2]) for f in fr) + 8, align=True)   # in place: no drift between frames
        extra = {'fire': hit} if kind == 'shoot' else {'hit': hit} if kind == 'attack' else {}
        anim_sheet(os.path.join(os.path.basename(CRE), f'_{cid}_{kind}.png'), f'anim_{cid}_{kind}', len(fr), height=240, ref=0, **extra)
    # both sheets are drawn at the same scale: size the attack strip by the movement strip's body,
    # so the creature does not grow or shrink when it switches between them
    mv_, at_ = manifest[f'anim_{cid}_move'], manifest[f'anim_{cid}_{apose}']
    if mspec[:2] == aspec[:2]:   # same grid = drawn at the same scale; different grids are sized independently
        at_['body'] = round(mv_['body'] * mv_['src'] / at_['src'], 4)
json.dump(manifest, open(MAN, 'w'), indent=1)
print({k: v for k, v in manifest.items() if 'desecrator' in k})
