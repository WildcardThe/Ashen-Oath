"""Menu screens: the two backgrounds and the recruitment scene are re-encoded; the emblems, badges,
crests and setup icons are cut from their black backgrounds (flood fill from the border, soft edge)
and packed into assets/ui/menu_icons.webp (256 px cells, order in menu_icons.json); the logo emblem
is cut to assets/ui/logo.webp. Usage: python3 tools/menu_art.py [folder with the delivered pictures]"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'menu'); UI = os.path.join(ROOT, 'assets', 'ui')
FILES = {
    'menu_bg': 'Strategy_game_main_menu_screen', 'setup_bg': 'Gothic_sci-fi_game_setup_screen', 'recruit_scene': 'Scribe_writing_in_military_hall',
    'logo': 'Broken_crown_pierced_by_sword',
    'm_new': 'Crossed_swords_over_cracked_planet', 'm_load': 'Holographic_star_map', 'm_options': 'Cogwheel_with_skull', 'm_credits': 'Parchment_scrolls', 'm_quit': 'Skull_resting_on_broken_helmet',
    'rank0': 'Eagle_badge_on_dark_shield', 'rank1': 'Armoured_super-soldier_winged', 'rank2': 'Armoured_helmet_military_badge', 'rank3': 'Skull_badge_with_crossed_swords', 'rank4': 'Golden_demigod_badge',
    'f_concord': '-', 'f_hollow': '-', 'f_rustbound': 'Heraldic_crest_with_mechanical', 'f_scrapjaw': '-', 'f_deathless': '-', 'f_palefang': '-',
    'human': 'Armoured_hand_clenching_fist', 'ai': 'Brass_servo-skull', 'ally': 'Armoured_gauntlets_shaking_hands', 'enemy': 'Two_crossed_swords_with_skull',
    'random': 'Two_bone_dice', 'b_gold': 'Crystals_and_coins', 'b_art': 'Open_reliquary_chest', 'b_res': 'Crate_of_mixed_materials', 'reroll': 'Brass_dial_with_glowing',
}
WIDE = {'menu_bg', 'setup_bg', 'recruit_scene'}

def cut(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    mx = a.max(2); bgl = np.median(np.concatenate([mx[:6].ravel(), mx[-6:].ravel(), mx[:, :6].ravel(), mx[:, -6:].ravel()]))
    dark = mx < bgl + 14
    lab, _ = ndimage.label(dark); edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    dist = ndimage.distance_transform_edt(~bg)
    al = np.clip(dist / 2.5, 0, 1) * np.clip((mx - bgl) / 30 + 0.35, 0, 1)
    al = np.where(bg, 0, np.maximum(al, (~bg) & (dist > 3)))
    ys, xs = np.nonzero(al > 0.1)
    out = np.dstack([a, al * 255]).astype(np.uint8)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(out, 'RGBA')

if __name__ == '__main__':
    if len(sys.argv) > 1:
        fs = os.listdir(sys.argv[1])
        for k, pre in FILES.items():
            hits = [f for f in fs if f.startswith(pre)]
            if len(hits) != 1: raise SystemExit(f'{k}: {len(hits)} match {pre!r}')
            shutil.copy(os.path.join(sys.argv[1], hits[0]), os.path.join(SRC, k + '.jpg'))
    for k in WIDE:
        im = Image.open(os.path.join(SRC, k + '.jpg')).convert('RGB')
        if k == 'setup_bg':   # the first rank frame is painted lit: repaint it like the others (the game lights the chosen one)
            im.paste(im.crop((962, 520, 1036, 598)), (884, 520))
        im.save(os.path.join(UI, k + '.webp'), quality=88)
    lg = cut(os.path.join(SRC, 'logo.jpg')); lg.thumbnail((900, 500)); lg.save(os.path.join(UI, 'logo.webp'), quality=90)
    ids = [k for k in FILES if k not in WIDE and k != 'logo']
    C, COLS = 256, 8; rows = (len(ids) + COLS - 1) // COLS
    sheet = Image.new('RGBA', (C * COLS, C * rows))
    for i, k in enumerate(ids):
        im = cut(os.path.join(SRC, k + '.jpg')); s = (C - 8) / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        sheet.paste(im, ((i % COLS) * C + (C - im.width) // 2, (i // COLS) * C + (C - im.height) // 2))
    sheet.save(os.path.join(UI, 'menu_icons.webp'), quality=88)
    json.dump({'cols': COLS, 'rows': rows, 'ids': ids}, open(os.path.join(UI, 'menu_icons.json'), 'w'))
    print(len(ids), 'icons')
