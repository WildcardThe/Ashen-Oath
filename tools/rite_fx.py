"""Rite animation sheets: each delivered 5x5 sheet (pure black background, drawn with additive
blending in battle) is cut into 25 cells, the cell borders trimmed, and repacked as a 5x5 grid of
CELL px cells in assets/fx/<id>.webp. Usage: python3 tools/rite_fx.py [folder with the delivered sheets]"""
import os, shutil, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'rite_fx'); OUT = os.path.join(ROOT, 'assets', 'fx')
FILES = {   # prompt number in rite_animation_prompts.txt -> chosen sheet
    'firebolt': 'Warp-fire_bolt_animation_sprite_#U2026_b9600d31', 'firehit': 'Fire_bolt_striking_target_animation_a515ba28',
    'explosion': 'Fiery_explosion_animation_sprite#U2026_58379fd7', 'pillar': 'Fire_pillar_erupting_from_ground_572a8f43',
    'meteor': 'Burning_meteor_falling_diagonally_f35f5c50', 'rage': 'Red_energy_aura_animation_sprite#U2026_30fca194',
    'fireshield': 'Flame_shield_animation_sprite_sheet_f2308379', 'curse': 'Glowing_eye_opening_and_burning_efe04238',
    'sumfire': 'Fiery_summoning_circle_animation#U2026_2922e1fc', 'stone': 'Stone_plates_spiralling_upward',
    'gravity': 'Dark_purple_gravity_vortex', 'deathring': 'Green_shock_ring_spreading', 'necrotic': 'Necrotic_energy_animation',
    'nullfield': 'Hexagonal_force_field_animation', 'debris': 'Starship_wreckage_crashing', 'collapse': 'Sphere_crushing_with_violet',
    'barrier': 'Green_energy_barrier_rising', 'sumearth': 'Stone_giant_assembling', 'heal': 'Healing_light_falling',
    'icespear': 'Ice_spear_flying', 'iceimpact': 'Ice_impact_animation', 'icespikes': 'Ice_spikes_bursting',
    'halo': 'Golden_halo_animation', 'water': 'Water_spiral_animation', 'mirror': 'Silvery_water_mirror',
    'lightning': 'Blue-white_lightning_strikes', 'beam': 'Energy_beam_firing', 'wind': 'Swirling_blue_wind',
    'bubble': 'Energy_bubble_deflecting', 'tornado': 'Tornado_forming_from_glowing',
}
CELL, TRIM = 192, 0.035
if __name__ == '__main__':
    if len(sys.argv) > 1:
        fs = os.listdir(sys.argv[1])
        for fid, pre in FILES.items():
            hits = [f for f in fs if f.startswith(pre)]
            if len(hits) != 1: raise SystemExit(f'{fid}: {len(hits)} match {pre!r}')
            shutil.copy(os.path.join(sys.argv[1], hits[0]), os.path.join(SRC, fid + '.jpg'))
    for fid in FILES:
        im = Image.open(os.path.join(SRC, fid + '.jpg')).convert('RGB'); W, H = im.size; cw, ch = W / 5, H / 5
        out = Image.new('RGB', (CELL * 5, CELL * 5))
        for k in range(25):
            c, r = k % 5, k // 5
            box = (round(c * cw + cw * TRIM), round(r * ch + ch * TRIM), round((c + 1) * cw - cw * TRIM), round((r + 1) * ch - ch * TRIM))
            cell = im.crop(box).resize((CELL, CELL), Image.LANCZOS)
            # crush the jpeg's near-black noise so it adds nothing under additive blending
            cell = cell.point(lambda v: 0 if v < 14 else round((v - 14) * 255 / 241))
            out.paste(cell, (c * CELL, r * CELL))
        out.save(os.path.join(OUT, fid + '.webp'), quality=82)
    print(len(FILES), 'sheets', sum(os.path.getsize(os.path.join(OUT, f + '.webp')) for f in FILES) // 1024, 'KB')
