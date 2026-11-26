"""Artifact icons: map each delivered picture to its artifact id, cut the flat grey background, fit each
icon into a square cell and pack all of them into assets/sprites/atlas_artifacts.png (sprite art_<id>).
Usage: python3 tools/artifact_icons.py [folder with the delivered pictures]"""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'artifacts')
OUT = os.path.join(ROOT, 'assets', 'sprites')
MAN = os.path.join(ROOT, 'assets', 'sprites.json')

# artifact id -> start of the delivered file name (see artifact_prompts.txt for the numbering)
FILES = {
    'blade': 'Knightly_power_sword', 'chainblade': 'Battle-scarred_chainsword', 'maul': 'Glowing_runes_thunder_hammer',
    'aegis': 'Battle-scarred_shield_with_red', 'stormshield': 'Steel_energy_shield', 'bastion': 'Gothic_boarding_shield',
    'crown': 'Tarnished_silver_circlet', 'helm': 'Armored_helmet_with_glowing_eyes', 'diadem': 'Ornate_psychic_hood',
    'seal': 'Purity_seal_on_iron_chain', 'voidamulet': 'Obsidian_pendant', 'courage': 'Bronze_medallion_with_lion',
    'plate': 'Battle-scarred_steel_breastplate', 'carapace': 'Chitin_cuirass', 'wardenplate': 'Power_armour_breastplate',
    'banner': 'Tattered_regimental_banner', 'shroud': 'Charcoal_camouflage_hooded_cloak', 'starmantle': 'Mantle_with_starfield',
    'treads': 'Armored_boots_hovering', 'pathboots': 'Scout_boots_and_equipment', 'jetboots': 'Armoured_boots_with_jump',
    'fortune': 'Gold_emerald_skull_signet', 'magus': 'Silver_ring_with_violet', 'signet': 'Bronze_signet_with_red_ruby',
    'codex': 'Tome_with_skull_and_data', 'die': 'Bone_die_on_red_cord', 'medal': 'Iron_military_medal',
    'reliquary': 'Ornate_cathedral_reliquary', 'scope': 'Floating_skull_game_artifact', 'orb': 'Glass_sphere_holding_storm',
    'primarchsword': 'Glowing_golden-hilted_sword', 'inqpistol': 'Ornate_heavy_bolt_pistol', 'ironhalo': 'Gothic_sci-fi_halo',
    'rosary': 'Rosary_with_skull_beads', 'pauldron': 'Armour_shoulder_plate_with_cross', 'standard': 'Battle_standard_with_crimson',
    'sabatons': 'Armored_sabatons_with_prayer', 'highsignet': 'Gold_signet_ring_with_eagle', 'ledger': 'Chained_tax_ledger',
    'censer': 'Skull_censer_emitting', 'bloodvial': 'Crystal_vial_with_ruby',
    'daemonaxe': 'Daemonic_double-bladed_axe', 'eightblade': 'Curved_daemon_sword', 'hornhelm': 'Dark_red_horned_helmet',
    'brasscollar': 'Spiked_brass_collar', 'plaguecarapace': 'Rusted_armour_breastplate', 'flayedcloak': 'Cloak_of_skins_and_skull',
    'warpgreaves': 'Spiked_dark_bronze_greaves', 'eyering': 'Blackened_silver_ring_with_eye', 'throneshard': 'Brass_skull_throne_chunk',
    'forbiddentome': 'Bound_grimoire_with_living', 'championheart': 'Glowing_heart_in_spiked',
    'pulsecarbine': 'Pulse_carbine_game_icon', 'fusionblaster': 'Heavy_fusion_blaster', 'shielddrone': 'Hovering_drone_with_energy',
    'etherealband': 'Ceremonial_headdress_with_blue', 'markerlight': 'Targeting_monocle_with_laser', 'stealthfield': 'Compact_backpack_generator',
    'jetlegs': 'Battlesuit_legs_with_jet', 'dataring': 'White_ceramic_ring_projecting', 'gundrones': 'Two_disc_gun_drones',
    'hologram': 'Holo-projector_showing_planet',
    'warscythe': 'Scythe_crackling_with_emerald', 'gaussflayer': 'Skeletal_energy_rifle', 'phylactery': 'Ankh_pendant_with_emerald',
    'silentcrown': 'Dark_gunmetal_crown_glowing', 'livingcuirass': 'Skeletal_breastplate_glowing', 'dispersion': 'Dark_metal_energy_shield',
    'tesseract': 'Floating_metal_cube_with_emerald', 'scarabs': 'Metallic_scarab_beetles', 'dynastyring': 'Glowing_emerald_ring_on_display',
    'tombtreads': 'Skeletal_armoured_feet_glowing',
    'spiritstone': 'Glowing_spirit_stone_on_chain', 'witchblade': 'Glowing_curved_blade_on_display', 'runearmour': 'Ghost_armor_breastplate',
    'ghosthelm': 'Battle-scarred_white_helmet', 'webwaykey': 'Wraithbone_key_glowing', 'hawkwings': 'Mechanical_wings_with_spirit',
    'bigchoppa': 'Scrap_steel_cleaver', 'kustomshoota': 'Oversized_machine_gun', 'teefsack': 'Leather_sack_holding_tusks',
    'ironjaw': 'Iron_jaw-plate_and_helmet', 'megaplate': 'Scrap_armour_plates', 'redpaint': 'Paint_can_and_brush',
    'boneswords': 'Curved_bone_blades', 'synapse': 'Chitin_crest_with_exposed_brain', 'broodshell': 'Purple_and_bone-white_chitin',
    'sporebelt': 'Spore_sac_belt', 'devourer': 'Chitinous_arm-cannon',
    'auracenser': 'Golden_censer_with_glowing', 'embercrown': 'Crown_with_horns_and_magma', 'gearheart': 'Mechanical_heart_with_gears',
    'wraithlantern': 'Wraithbone_lantern_icon', 'psyfocus': 'Psy-crystals_growing_from_brass', 'blackring': 'Blackstone_ring_with_engraved',
    'orrery': 'Orrery_engine_with_holographic',
    'set_warden': 'Sword_and_breastplate_game_icon', 'set_ruin': 'Daemonic_helm_sword_and_heart',
    'set_dynasty': 'Crown_and_scythe_game_icon', 'set_cadre': 'Blaster_and_shield_drone',
}


def import_from(folder):
    files = [os.path.join(r, f) for r, _, fs in os.walk(folder) for f in fs if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    for aid, pre in FILES.items():
        hits = [f for f in files if os.path.basename(f).startswith(pre)]
        if len(hits) != 1: raise SystemExit(f'{aid}: {len(hits)} files match {pre!r}')
        shutil.copy(hits[0], os.path.join(SRC, aid + '.jpg'))


def cut(path):
    # same flat-grey cut as the map structures, tuned for single centred icons
    from scipy import ndimage
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    sat = a.max(2) - a.min(2)
    border = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    med = np.median(border, 0)
    # backgrounds that darken toward the bottom: also compare with each row's own edge colour
    rowbg = np.median(np.concatenate([a[:, :10], a[:, -10:]], 1), 1)[:, None, :]
    near = (np.minimum(np.sqrt(((a - med) ** 2).sum(2)), np.sqrt(((a - rowbg) ** 2).sum(2))) < 18) & (sat < 16)
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgm = ndimage.binary_erosion(np.isin(lab, edge[edge > 0]), iterations=2)
    num = ndimage.gaussian_filter(np.where(bgm[..., None], a, 0), (24, 24, 0))
    den = ndimage.gaussian_filter(bgm.astype(np.float32), 24)[..., None]
    bg = np.where(den > 1e-3, num / np.maximum(den, 1e-3), med)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    fg = ndimage.binary_opening((d > 20) | ((sat > 28) & (d > 10)), iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=5))
    sz = ndimage.sum(fg, lab, range(1, n + 1)); big = sz.max()
    fg &= np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > big * 0.03])
    fg = ndimage.binary_fill_holes(ndimage.binary_closing(fg, iterations=2))
    pocket = ndimage.binary_opening(fg & (d < 12) & (sat < 12), iterations=2)
    pl, pn = ndimage.label(pocket)
    if pn:
        ps = ndimage.sum(pocket, pl, range(1, pn + 1)); fg &= ~np.isin(pl, [i + 1 for i, v in enumerate(ps) if v > 300])
    # glow, smoke and energy fields: soft alpha around the object
    ring = ndimage.binary_dilation(fg, iterations=24)
    soft = np.where(ring & ~fg, np.clip((d - 8) / 55, 0, 0.9), 0)
    al = np.maximum(ndimage.gaussian_filter(fg.astype(np.float32), 0.9) * fg, soft)
    al = np.where(al < 0.06, 0, al)
    rgb = np.where((al > 0.95)[..., None], a, np.clip(bg + (a - bg) / np.maximum(al, 0.3)[..., None], 0, 255))
    rgba = np.dstack([rgb, al * 255]).astype(np.uint8)
    ys, xs = np.nonzero(al > 0.08)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


if __name__ == '__main__':
    if len(sys.argv) > 1: import_from(sys.argv[1])
    man = json.load(open(MAN))
    CELL, PAD, COLS = 192, 6, 10
    ids = list(FILES)
    rows = (len(ids) + COLS - 1) // COLS
    sheet = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    for k, aid in enumerate(ids):
        im = Image.fromarray(cut(os.path.join(SRC, aid + '.jpg')), 'RGBA')
        s = (CELL - 2 * PAD) / max(im.size); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        x0, y0 = (k % COLS) * CELL, (k // COLS) * CELL
        sheet.paste(im, (x0 + (CELL - im.width) // 2, y0 + (CELL - im.height) // 2))
        man['art_' + aid] = {'kind': 'artifact', 'w': CELL, 'h': CELL, 'atlas': 'atlas_artifacts', 'x': x0, 'y': y0}
    sheet.save(os.path.join(OUT, 'atlas_artifacts.png'), optimize=True)
    json.dump(man, open(MAN, 'w'), indent=1)
    print(len(ids), 'icons,', os.path.getsize(os.path.join(OUT, 'atlas_artifacts.png')) // 1024, 'KB')
