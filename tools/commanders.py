"""New commanders: avatar, map movement sheet (with a mask of the blank banner, tinted in the player's
colour by the game) and battlefield idle / rite sheets. Frames are cut from the 5-column sheets,
aligned on the feet and written as horizontal strips (assets/sprites/cmd_<id>_<part>.png).
Usage: python3 tools/commanders.py [folder with the delivered pictures]"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet_cut import grid_frames, align_frames
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'commanders'); OUT = os.path.join(ROOT, 'assets', 'sprites')
MAN = os.path.join(ROOT, 'assets', 'sprites.json')
# id -> part -> (start of the delivered file name, rows in the 5-column sheet)
PICKS = {
    'valerian': {'avatar': ('Demigod_warrior_wearing_golden', 0), 'map': ('Assault_tank_moving_sprite', 4), 'mapstill': ('Gilded_assault_tank_facing_right', 0),
                 'battle': ('Demigod_warrior_holding_flaming', 0), 'idle': ('Warrior_commander_standing_with_#U2026_93a4', 5), 'cast': ('Warrior_casting_spell_sprite_sheet_d3753', 5)},
    'seraphine': {'avatar': ('Warrior_commander_portrait_d5211', 0), 'map': ('Winged_warrior_gliding_with_sword_a2d26', 5), 'mapstill': ('Winged_warrior_flying_with_sword_dec30', 0),
                  'battle': ('Warrior_saint_hovering_with_sword_6da2', 0), 'idle': ('Warrior_saint_hovering_idle_spri', 5), 'cast': ('Warrior_casting_animation_sprite#U2026_c3c2', 5)},
    'orrin': {'avatar': ('Cybernetic_tech-priest_commander#U2026_1a24', 0), 'map': ('Mechanical_throne_moving_sprite_', 5), 'mapstill': ('Commander_riding_mechanical_thro', 0),
              'battle': ('Cybernetic_tech-priest_leaning_o', 0), 'idle': ('Cybernetic_tech-priest_idle_anim', 4), 'cast': ('Cybernetic_tech-priest_casting_a', 5)},
    'abaddor': {'avatar': ('Warlord_in_power_armor_raising', 0), 'map': ('Armored_troop_carrier_moving_sprite_c751', 5), 'mapstill': ('Armoured_troop_carrier_facing_right', 0),
                'battle': ('Armored_warlord_holding_sword', 0), 'idle': ('Warlord_in_power_armour_standing_110e', 5), 'cast': ('Warlord_casting_warp-lightning_a#U2026_edb7', 5)},
    'ezrakh': {'avatar': ('Warp-sorcerer_wearing_horned_helm', 0), 'map': ('Sorcerer_gliding_on_fiery_disc', 5), 'mapstill': ('Warp-sorcerer_hovering_on_disc', 0),
               'battle': ('Warp-sorcerer_holding_staff', 0), 'idle': ('Warp-sorcerer_idle_cycle_sprite', 4), 'cast': ('Warp-sorcerer_casting_magic_anim', 5)},
    'khorvax': {'avatar': ('Berserker_warlord_in_power_armour', 0), 'map': ('Berserker_warlord_charging_on_beast', 5), 'mapstill': ('Warlord_riding_daemonic_beast', 0),
                'battle': ('Berserker_warlord_riding_daemoni', 0), 'idle': ('Berserker_warlord_on_bull_beast', 5), 'cast': ('Rider_casting_animation_sprite', 5)},
    'sennkahet': {'avatar': ('Machine_king_portrait', 0), 'map': ('Machine_king_hovering_on_barge', 5), 'mapstill': ('Machine-king_standing_on_hover', 0),
                  'battle': ('Skeletal_machine_king_holding', 0), 'idle': ('Skeletal_machine-king_idling', 5), 'cast': ('Machine_king_casting_spell', 5)},
    'patriarch': {'avatar': ('Alien_brood-father_wearing_robe', 0), 'map': ('Mining_crawler_truck_movement', 5), 'mapstill': ('Mining_truck_carrying_alien', 0),
                  'battle': ('Alien_brood-father_standing_in_robe', 0), 'idle': ('Alien_creature_breathing_idle', 5), 'cast': ('Alien_casting_psychic_spell', 5)},
    'kalgarax': {'avatar': ('Alien_tyrant_head_portrait', 0), 'map': ('Alien_tyrant_walking_sprite_sheet', 4), 'mapstill': ('Alien_tyrant_walking_6027', 0),
                 'battle': ('Alien_tyrant_wearing_bone_armor', 0), 'idle': ('Alien_tyrant_breathing_idle', 5), 'cast': ('Alien_tyrant_casting_psychic', 5)},
    'velaun': {'avatar': ('Alien_woman_wearing_battlesuit', 0), 'map': ('Grav-tank_moving_in_cycle', 5), 'mapstill': ('Grav-tank_hovering_with_drones', 0),
               'battle': ('Battlesuit_commander_with_hoveri', 0), 'idle': ('Battlesuit_commander_scanning_field', 5), 'cast': ('Battlesuit_casting_animation', 5)},
    # Scrapjaw Horde and Deathless Dynasty (files copied from assets/source/<faction>/c1_*, c2_*)
    'grotskar': {'avatar': ('-', 0), 'map': ('-', 5), 'mapstill': ('-', 0), 'battle': ('-', 0), 'idle': ('-', 5), 'cast': ('-', 5)},
    'skargul': {'avatar': ('-', 0), 'map': ('-', 4), 'mapstill': ('-', 0), 'battle': ('-', 0), 'idle': ('-', 4), 'cast': ('-', (7, 4))},
    'ahzrel': {'avatar': ('-', 0), 'map': ('-', 5), 'mapstill': ('-', 0), 'battle': ('-', 0), 'idle': ('-', 4), 'cast': ('-', 5)},
    'orumesh': {'avatar': ('-', 0), 'map': ('-', 3), 'mapstill': ('-', 0), 'battle': ('-', 0), 'idle': ('-', 3), 'cast': ('-', 5)},
}
FIXED_CELLS = {('ahzrel', 'idle')}
NO_MASK = {'velaun'}   # white hull: the painted pennant is too small to separate, the game adds its own
ROWS = {cid: {p: r for p, (_, r) in parts.items()} for cid, parts in PICKS.items()}

def import_from(folder):
    fs = [os.path.join(r, f) for r, _, x in os.walk(folder) for f in x]
    for cid, parts in PICKS.items():
        if not any(os.path.basename(f).startswith(parts['avatar'][0]) for f in fs): continue   # not in this delivery
        for part, (pre, _) in parts.items():
            hits = [f for f in fs if os.path.basename(f).startswith(pre)]
            if len(hits) != 1: raise SystemExit(f'{cid}/{part}: {len(hits)} match {pre!r}')
            shutil.copy(hits[0], os.path.join(SRC, f'{cid}_{part}.jpg'))

def banner_mask(f):
    """the plain white banner or pennant: bright, colourless, flat patches in the upper part of the figure"""
    a = f[..., :3].astype(np.float32); al = f[..., 3] / 255
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    cand = (lum > 160) & (sat < 26) & (al > 0.5)
    ys = np.nonzero(al > 0.3)[0]
    if not len(ys): return np.zeros(al.shape, np.uint8)
    top, bot = ys.min(), ys.max()
    # cloth is smooth; feathers, ivory armour and chrome are full of fine detail
    mu = ndimage.uniform_filter(lum, 5); sd = np.sqrt(np.maximum(ndimage.uniform_filter(lum ** 2, 5) - mu ** 2, 0))
    lab, n = ndimage.label(ndimage.binary_closing(cand, iterations=1))
    keep = np.zeros(al.shape, bool)
    for k in range(1, n + 1):
        m = lab == k; area = m.sum(); cy = np.nonzero(m)[0].mean()
        if area > 25 and cy < top + (bot - top) * 0.6 and sd[m].mean() < 45: keep |= m
    soft = ndimage.gaussian_filter(keep.astype(np.float32), 0.7) * al
    # how white each banner pixel is decides how strongly it takes the player's colour
    return np.clip(soft * np.clip((lum - 90) / 140, 0, 1) * 255, 0, 255).astype(np.uint8)

def strip(frames, name, height, man, mask=False):
    al = align_frames(frames)
    L = max(cx for _, cx, _ in al); R = max(f.shape[1] - cx for f, cx, _ in al); T = max(y1 for _, _, y1 in al)
    W, H = int(np.ceil(L + R)) + 4, int(T) + 4
    k = height / H; fw, fh = max(1, round(W * k)), height
    out = Image.new('RGBA', (fw * len(al), fh)); mout = Image.new('L', (fw * len(al), fh)) if mask else None
    bodies = []
    for i, (f, cx, y1) in enumerate(al):
        c = np.zeros((H, W, 4), np.uint8); ox, oy = int(round(L - cx)) + 2, int(T - y1) + 2
        h, w = min(f.shape[0], H - oy), min(f.shape[1], W - ox); c[oy:oy + h, ox:ox + w] = f[:h, :w]
        out.paste(Image.fromarray(c, 'RGBA').resize((fw, fh), Image.LANCZOS), (i * fw, 0))
        if mask: mout.paste(Image.fromarray(banner_mask(c), 'L').resize((fw, fh), Image.LANCZOS), (i * fw, 0))
        ys = np.nonzero(c[..., 3] > 60)[0]; bodies.append((ys.max() - ys.min()) * k if len(ys) else fh)
    out.save(os.path.join(OUT, name + '.png'), optimize=True)
    man[name] = {'kind': 'anim', 'w': fw * len(al), 'h': fh, 'n': len(al), 'fw': fw, 'fh': fh, 'ax': round(L / W, 4), 'ay': 1, 'body': round(float(np.median(bodies)) / fh, 4), 'body0': round(bodies[0] / fh, 4)}
    if mask:
        rgba = Image.merge('RGBA', (Image.new('L', mout.size, 255),) * 3 + (mout,))
        rgba.save(os.path.join(OUT, name + '_mask.png'), optimize=True)
        man[name + '_mask'] = {'kind': 'mask', 'w': fw * len(al), 'h': fh}
        man[name]['banner'] = bool((np.asarray(mout) > 128).sum() > 40 * len(al))

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] != '-': import_from(sys.argv[1])
    man = json.load(open(MAN))
    only = sys.argv[2:] if len(sys.argv) > 2 else None
    for cid in PICKS:
        if only and cid not in only: continue
        im = Image.open(os.path.join(SRC, f'{cid}_avatar.jpg')).convert('RGB'); s = min(im.size)
        im.crop(((im.width - s) // 2, 0, (im.width + s) // 2, s)).resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, 'assets', 'ui', 'avatars', cid + '.webp'), quality=88)
        for part, h, mask in (('map', 150, True), ('idle', 300, False), ('cast', 300, False)):
            rc = ROWS[cid][part]; cols, rows = rc if isinstance(rc, tuple) else (5, rc)
            if (cid, part) in FIXED_CELLS:   # thin staffs survive only the equal-cell cutter
                from faction_units import fixed_grid_frames
                fr = fixed_grid_frames(os.path.join(SRC, f'{cid}_{part}.jpg'), cols, rows, noshadow=True)
            else: fr = grid_frames(os.path.join(SRC, f'{cid}_{part}.jpg'), cols, rows, even=True)
            strip(fr, f'cmd_{cid}_{part}', h, man, mask and cid not in NO_MASK)
        print(cid, {p: man[f'cmd_{cid}_{p}']['n'] for p in ('map', 'idle', 'cast')})
    json.dump(man, open(MAN, 'w'), indent=1)
