"""Rite icons: copy each delivered picture under its rite id, then pack them into one atlas
(assets/ui/rite_icons.webp, 128 px cells, black background kept: the Rites window shows them with
'screen' blending so the black falls away). The order is written to assets/ui/rite_icons.json.
Usage: python3 tools/rite_icons.py [folder with the delivered pictures]"""
import json, os, shutil, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'rites')
FILES = {
    # fire
    'ember': 'Fire_bolt_game_icon', 'fury': 'Armoured_gauntlet_gripping_chain', 'curse': 'Staring_eye_symbol_glowing',
    'wardwater': 'Water_droplet_hitting_heater_shield', 'blind': 'Helmet_visor_burned_by_fire', 'firewall': 'Flames_in_three_hexagonal',
    'fireburst': 'Explosion_icon_with_skull', 'mines': 'Mine_exploding_on_cracked', 'misfortune': 'Broken_bone_spell_icon',
    'inferno': 'Fire_pillar_game_spell_icon', 'exterminatus': 'Planet_cracking_apart', 'berserk': 'Screaming_horned_skull',
    'pyreaegis': 'Flaming_shield_game_icon', 'frenzy': 'Crossed_axes_and_broken_shield', 'slayer': 'Spear_through_monster_skull',
    'cataclysm': 'Three_meteors_falling', 'sacrifice': 'Armoured_figure_rising_in_flames', 'sumfire': 'Fire_daemon_rising',
    # earth
    'stoneskin': 'Armoured_shoulder_pauldron', 'bulwark': 'Sword_breaking_against_tower', 'slow': 'Phosphor-green_gravity_vortex',
    'viewearth': 'Auspex_scanner_screen', 'deathknell': 'Cathedral_bell_skull', 'quicksand': 'Armoured_hand_reaching_from_ash',
    'wardair': 'Shield_with_lightning_bolt_symbol', 'voidward': 'Force_field_shield_game_icon', 'raise': 'Skeletal_hand_bursting',
    'nullfield': 'Hexagonal_null-field_emitter', 'tremor': 'Fortress_wall_cracking', 'barricade': 'Glowing_hexagonal_energy_panels',
    'portal': 'Gothic_arched_gateway_vortex', 'debris': 'Rocks_plunging_into_crater', 'despair': 'Stone_angel_spell_icon',
    'resurrect': 'Armoured_warrior_rising_from_tomb', 'collapse': 'Sphere_pulling_inward', 'sumearth': 'Rock_humanoid_rising',
    # water
    'mend': 'Prayer_book_healing', 'bless': 'Armoured_hand_blessing', 'dispel': 'Censer_pouring_water',
    'wardfire': 'Shield_blocking_flame_icon', 'lander': 'Armoured_landing_craft', 'frost': 'Ice_crystal_flying',
    'withering': 'Rusting_sword_spell_icon', 'clearfield': 'Broken_boulder_swept', 'scuttle': 'Landing_craft_sinking',
    'tide': 'Wave_with_shields', 'mindwipe': 'Wave_erasing_circuit', 'hoarfrost': 'Ice_spikes_spell_icon',
    'hymn': 'Organ_pipe_sound_waves', 'warpjump': 'Hexagons_connecting_with_dissolv', 'clone': 'Armoured_warrior_silhouette_mirr',
    'prayer': 'Kneeling_figures_before_golden', 'waterwalk': 'Armoured_boot_on_liquid', 'sumwater': 'Water_figure_rising',
    # air
    'haste': 'Armoured_boot_running', 'viewair': 'Vox_antenna_mast', 'arc': 'Lightning_striking_helmet',
    'farsight': 'Open_eye_telescope_lens', 'veil': 'Hooded_cloak_game_spell', 'fate': 'Tarot_cards_showing_star',
    'precision': 'Bullet_piercing_skull_scope', 'tailwind': 'Wind_streams_carrying_banner', 'refractor': 'Bullet_deflected_by_energy',
    'banish': 'Winged_skull_split_by_light', 'domination': 'Hand_controlling_marching', 'lance': 'Satellite_beam_striking',
    'chainstorm': 'Lightning_bolt_sparking', 'reflex': 'Crossed_blades_with_return', 'webway': 'Archway_of_light',
    'jumppack': 'Jump-pack_wings', 'mirror': 'Lightning_hitting_gothic_hand', 'sumair': 'Tornado_summons',
    # school tabs
    'tab_all': 'Winged_skull_above_open_book_ab3c4f7e', 'tab_fire': 'Flame_rising_from_brazier_bowl_bfa52d49',
    'tab_earth': 'Fortress_tower_mountain_spell_icon', 'tab_water': 'Water_droplet_spell_icon', 'tab_air': 'Lightning_bolt_wind_spell_icon',
}

if __name__ == '__main__':
    if len(sys.argv) > 1:
        files = [os.path.join(r, f) for r, _, fs in os.walk(sys.argv[1]) for f in fs]
        for rid, pre in FILES.items():
            hits = [f for f in files if os.path.basename(f).startswith(pre)]
            if len(hits) != 1: raise SystemExit(f'{rid}: {len(hits)} files match {pre!r}')
            shutil.copy(hits[0], os.path.join(SRC, rid + '.jpg'))
    CELL, COLS = 128, 10
    ids = list(FILES); rows = (len(ids) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS * CELL, rows * CELL))
    for k, rid in enumerate(ids):
        im = Image.open(os.path.join(SRC, rid + '.jpg')).convert('RGB')
        # trim the plain black margin so the symbol fills its cell, keep it square
        bb = im.point(lambda v: 255 if v > 28 else 0).convert('L').getbbox() or (0, 0, im.width, im.height)
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2; side = max(bb[2] - bb[0], bb[3] - bb[1]) * 1.08
        im = im.crop((round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))).resize((CELL, CELL), Image.LANCZOS)
        sheet.paste(im, ((k % COLS) * CELL, (k // COLS) * CELL))
    sheet.save(os.path.join(ROOT, 'assets', 'ui', 'rite_icons.webp'), quality=88)
    json.dump({'cell': CELL, 'cols': COLS, 'rows': rows, 'ids': ids}, open(os.path.join(ROOT, 'assets', 'ui', 'rite_icons.json'), 'w'))
    print(len(ids), 'icons', os.path.getsize(os.path.join(ROOT, 'assets', 'ui', 'rite_icons.webp')) // 1024, 'KB')
