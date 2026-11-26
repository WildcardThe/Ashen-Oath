// Static game data: resources, terrain, factions, units, buildings, spells, relics.

export const RES = ['auramite', 'adamantium', 'ceramite', 'plasteel', 'blackstone', 'wraithbone', 'psycrystal'];
export const RES_INFO = {
  auramite: { name: 'Auramite', color: '#e2b84e', value: 1, rare: false },
  adamantium: { name: 'Adamantium', color: '#c6ccd2', value: 250, rare: false },
  ceramite: { name: 'Ceramite', color: '#b8503a', value: 250, rare: false },
  plasteel: { name: 'Plasteel', color: '#9fb4c8', value: 500, rare: true },
  blackstone: { name: 'Blackstone', color: '#3fd08a', value: 500, rare: true },
  wraithbone: { name: 'Wraithbone', color: '#e8dcc0', value: 500, rare: true },
  psycrystal: { name: 'Psy-reactive Crystals', color: '#6a8cff', value: 500, rare: true },
};

export const MINES = {
  auramite: { name: 'Auramite Mine', yield: 1000 },
  adamantium: { name: 'Adamantium Mine', yield: 2 },
  ceramite: { name: 'Ceramite Mine', yield: 2 },
  plasteel: { name: 'Plasteel Mine', yield: 1 },
  blackstone: { name: 'Blackstone Mine', yield: 1 },
  wraithbone: { name: 'Wraithbone Mine', yield: 1 },
  psycrystal: { name: 'Psy-reactive Crystal Mine', yield: 1 },
};

export const TERRAIN = [
  { name: 'Scrubland', cost: 100, pass: true, base: '#5a4a38' },
  { name: 'Scorched Earth', cost: 150, pass: true, base: '#6a3e2c' },
  { name: 'Toxic Marsh', cost: 175, pass: true, base: '#4a4a2c' },
  { name: 'Bone Fields', cost: 125, pass: true, base: '#8a8884' },
  { name: 'Impassable', cost: Infinity, pass: false, base: '#241e1c' },
  { name: 'Acid Pools', cost: Infinity, pass: false, base: '#3a6a2a' },
  { name: 'Ash Plains', cost: 100, pass: true, base: '#3e3934' },
  { name: 'Dust Flats', cost: 100, pass: true, base: '#9a8e74' },
];
// Painted ground texture per terrain type (assets/terrain/*.webp); acid pools sit on marsh mud.
export const TERRAIN_TEX = ['ground_scrub', 'ground_broken', 'ground_marsh', 'ground_bone', 'ground_rock', 'ground_marsh', 'ground_ash', 'ground_dust'];

export const ROAD_COST = 65;
export const DAY_MP = 1500;
export const HERO_SIGHT = 5;
export const TOWN_SIGHT = 7;
export const HIRE_COST = 2500;
export const MAX_HEROES = 4;
// player banner colours, in the order of the rows on the new game screen
export const PLAYER_COLORS = ['#d23b30', '#3f86e0', '#4fae4a', '#d8a830', '#9a52c8', '#2fb0b0'];
// enemy AI levels: names shown on the new game screen; income, starting wealth and army size of AI lords,
// and how early and how boldly they attack
export const AI_LEVELS = [
  { name: 'Imperial Guard', diff: 'Easy', income: 0.8, start: 0.8, army: 0.8, attackDay: 14, ratio: 1.6 },
  { name: 'Adeptus Astartes', diff: 'Medium', income: 1, start: 1, army: 1, attackDay: 9, ratio: 1.35 },
  { name: 'Primaris', diff: 'Hard', income: 1.25, start: 1.3, army: 1.2, attackDay: 7, ratio: 1.25 },
  { name: 'Chapter Master', diff: 'Expert', income: 1.5, start: 1.6, army: 1.4, attackDay: 5, ratio: 1.15 },
  { name: 'Primarch', diff: 'Impossible', income: 2, start: 2.2, army: 1.7, attackDay: 4, ratio: 1.05 },
];
export const NEUTRAL_COLOR = '#8d8478';

export const ABILITIES = {
  flyer: 'Flies over obstacles and other troops',
  shieldwall: 'Retaliates against every attack',
  doubleStrike: 'Strikes twice in melee',
  noRetal: 'Enemies cannot retaliate',
  lifeDrain: 'Heals itself for half the damage it deals',
  petrify: 'Its gaze may turn the target partly to stone: -3 speed and -3 defence for 2 rounds',
  brawler: 'Shoots and fights in melee without penalty',
};

// Frame animations for the Raptors (shared by both versions for now): idle = first fly frame.
// Bulwark Knights: pixel-art walk and hammer attack; they stand in the attack's first frame.
const KNIGHT_ANIM = { walk: 'anim_knight_walk', attack: 'anim_knight_attack', idle: 'attack', face: 1, scale: 1.45, fps: { walk: 16, attack: 24 } };
const RAPTOR_ANIM = { fly: 'anim_raptor_fly', attack: 'anim_raptor_attack', idle: 'fly', face: 1, scale: 1.5 };

export const UNITS = {
  // ---- The Iron Concord ----
  levy: { name: 'Levy Riflemen', faction: 'concord', tier: 1, hp: 8, atk: 4, def: 3, min: 2, max: 3, spd: 4, shots: 12, ab: [], cost: { auramite: 70 }, growth: 12,
    look: { sprite: 'unit_levy', face: 1, scale: 1.25 }, desc: 'Conscripts from the hive-cities in sealed rebreathers and furs, armed with long-barrelled lumen rifles.' },
  warden: { name: 'Dreadnoughts', faction: 'concord', tier: 2, hp: 34, atk: 8, def: 11, min: 4, max: 7, spd: 4, shots: 0, ab: ['shieldwall'], cost: { auramite: 300 }, growth: 7,
    look: { sprite: 'unit_dread', face: 1, scale: 1.3 }, desc: 'Fallen heroes entombed in walking sarcophagi of plate. Their mass answers every blow.' },
  knight: { name: 'Bulwark Knights', faction: 'concord', tier: 3, hp: 50, atk: 12, def: 12, min: 7, max: 11, spd: 6, shots: 0, ab: [], cost: { auramite: 600 }, growth: 4,
    look: { sprite: 'unit_knight', face: -1, scale: 1.35, anim: KNIGHT_ANIM }, desc: 'Armoured knights of the Concord who carry storm hammers and great shields into the thick of the line.' },
  walker: { name: 'Bastion Walkers', faction: 'concord', tier: 4, hp: 120, atk: 14, def: 14, min: 14, max: 22, spd: 4, shots: 8, ab: [], cost: { auramite: 1500, plasteel: 1 }, growth: 2,
    big: true, look: { kind: 'walker', main: '#4a6788', trim: '#c9a24a', opt: {} }, desc: 'Armoured war-engines piloted by entombed veterans, bearing twin siege cannons.' },
  stormhammer: { name: 'Stormhammer Guard', faction: 'concord', tier: 5, hp: 220, atk: 19, def: 20, min: 30, max: 40, spd: 7, shots: 0, ab: ['shieldwall'], cost: { auramite: 3500, psycrystal: 1 }, growth: 1,
    look: { sprite: 'unit_stormhammer', face: -1, scale: 1.45, anim: { walk: 'anim_knight_walk', face: 1, scale: 1.5, fps: { walk: 16 } } }, desc: 'Veterans sealed in fortress-plate, bearing storm hammers and shields hung with the skulls of fallen foes.' },
  // ---- The Hollow Host ----
  zealot: { name: 'Bloodsworn', faction: 'hollow', tier: 1, hp: 8, atk: 4, def: 2, min: 2, max: 4, spd: 5, shots: 0, ab: [], cost: { auramite: 60 }, growth: 14,
    look: { sprite: 'unit_zealot', face: 1, scale: 1.3, anim: { attack: 'anim_zealot_attack_b', idle: 'attack', face: 1, scale: 1.35, fps: { attack: 24 } } }, desc: 'Oathbreakers in cracked crimson plate and grilled rebreathers, hacking with skull-hung axes and firing stolen sidearms at point-blank range.' },
  turncoat: { name: 'Blood Reavers', faction: 'hollow', tier: 2, hp: 26, atk: 8, def: 6, min: 3, max: 6, spd: 5, shots: 10, ab: ['brawler'], cost: { auramite: 320 }, growth: 7,
    look: { sprite: 'unit_berserker', face: -1, scale: 1.3, anim: { shoot: 'anim_reaver_shoot', attack: 'anim_reaver_attack', idle: 'shoot', face: 1, faces: { attack: -1 }, scale: 1.35, fps: { shoot: 14, attack: 14 } } }, desc: 'Crimson-armoured oathbreakers with spiked mauls and heavy pistols, as deadly up close as at range.' },
  flayer: { name: 'Ash Raptors', faction: 'hollow', tier: 3, hp: 38, atk: 12, def: 7, min: 6, max: 11, spd: 9, shots: 0, ab: ['flyer', 'noRetal'], cost: { auramite: 540 }, growth: 4,
    look: { sprite: 'unit_raptor', face: 1, scale: 1.6, jet: true, anim: RAPTOR_ANIM }, desc: 'Oathbreakers strapped to roaring jump-packs. They crash down on the enemy line with axe and flail before it can answer.' },
  hellforge: { name: 'Havoc Gunners', faction: 'hollow', tier: 4, hp: 120, atk: 15, def: 13, min: 14, max: 22, spd: 5, shots: 16, ab: [], cost: { auramite: 1600, blackstone: 1 }, growth: 2,
    look: { sprite: 'unit_gunner', face: 1, scale: 1.5, anim: { walk: 'anim_gunner_walk', shoot: 'anim_gunner_shoot', idle: 'shoot', face: 1, scale: 1.55, fps: { walk: 22, shoot: 26 } } },
    desc: 'Oathbreakers hauling rotary cannons fed from belts of hell-forged rounds, hung with chains and the skulls of their kills.' },
  desecrator: { name: 'Desecrators', faction: 'hollow', tier: 5, hp: 210, atk: 21, def: 16, min: 26, max: 40, spd: 6, shots: 16, ab: ['brawler'], cost: { auramite: 3700, wraithbone: 1 }, growth: 1,
    look: { sprite: 'unit_desecrator', face: -1, scale: 1.5, anim: { walk: 'anim_desecrator_walk', shoot: 'anim_desecrator_shoot', face: 1 } },
    desc: 'Towering oathbreakers sealed in brass-bound plate, hauling hell-cannons fed by the furnaces on their backs.' },
  // ---- Wandering threats ----
  scuttler: { name: 'Scuttler Brood', faction: 'neutral', tier: 1, hp: 5, atk: 3, def: 2, min: 1, max: 3, spd: 7, shots: 0, ab: [], cost: { auramite: 40 }, growth: 0,
    look: { sprite: 'unit_scuttler', face: 1, scale: 1.0, anim: { move: 'anim_scuttler_move', attack: 'anim_scuttler_attack', idle: 'move', face: 1, scale: 1.0, fps: { move: 18, attack: 22 } } }, desc: 'Chittering swarm-beasts that pour out of collapsed hives.' },
  raider: { name: 'Rustkin Raiders', faction: 'rustbound', tier: 2, hp: 22, atk: 7, def: 4, min: 3, max: 5, spd: 5, shots: 8, ab: [], cost: { auramite: 240 }, growth: 8,
    look: { sprite: 'unit_raider', face: 1, scale: 1.25, anim: { move: 'anim_raider_move', shoot: 'anim_raider_shoot', idle: 'move', face: 1, scale: 1.25, fps: { move: 18, shoot: 22 } } }, desc: 'Scavenger clans who shoot first and loot later.' },
  stalker: { name: 'Chitin Stalkers', faction: 'neutral', tier: 3, hp: 30, atk: 10, def: 6, min: 4, max: 8, spd: 7, shots: 0, ab: [], cost: { auramite: 400 }, growth: 0,
    look: { sprite: 'unit_stalker', face: 1, scale: 1.25, anim: { move: 'anim_stalker_move', attack: 'anim_stalker_attack', idle: 'move', face: 1, scale: 1.25, fps: { move: 18, attack: 22 } } }, desc: 'Bladed hunter-organisms grown for a war that ended long ago.' },
  hulk: { name: 'Spore Hulks', faction: 'neutral', tier: 4, hp: 160, atk: 15, def: 15, min: 16, max: 28, spd: 4, shots: 0, ab: [], cost: { auramite: 1800 }, growth: 0,
    big: true, look: { sprite: 'unit_hulk', face: 1, scale: 1.2, anim: { move: 'anim_hulk_move', attack: 'anim_hulk_attack', idle: 'move', face: 1, scale: 1.2, fps: { move: 18, attack: 22 } } }, desc: 'Lumbering bio-titans that exhale clouds of choking spores.' },
  servitor: { name: 'Scrap Servitors', faction: 'rustbound', tier: 1, hp: 10, atk: 3, def: 5, min: 2, max: 3, spd: 4, shots: 0, ab: [], cost: { auramite: 65 }, growth: 14,
    look: { sprite: 'unit_servitor', face: 1, scale: 1.25, anim: { move: 'anim_servitor_move', attack: 'anim_servitor_attack', idle: 'move', face: 1, scale: 1.25, fps: { move: 18, attack: 22 } } }, desc: 'Lobotomised labour-thralls wired to rusting machinery, still following their last order.' },
  brute: { name: 'Mutant Brutes', faction: 'rustbound', tier: 3, hp: 60, atk: 12, def: 9, min: 8, max: 14, spd: 5, shots: 0, ab: [], cost: { auramite: 620 }, growth: 4,
    look: { sprite: 'unit_brute', face: 1, scale: 1.4, anim: { move: 'anim_brute_move', attack: 'anim_brute_attack', idle: 'move', face: 1, scale: 1.4, fps: { move: 18, attack: 22 } } }, desc: 'Hulking mutants from the radiation belts, swinging girders as clubs.' },
  wraith: { name: 'Void Wraiths', faction: 'rustbound', tier: 4, hp: 120, atk: 14, def: 10, min: 13, max: 21, spd: 8, shots: 0, ab: ['flyer', 'lifeDrain'], cost: { auramite: 1700, psycrystal: 1 }, growth: 2,
    look: { sprite: 'unit_wraith', face: 1, scale: 1.35, anim: { move: 'anim_wraith_move', attack: 'anim_wraith_attack', idle: 'move', face: 1, scale: 1.35, fps: { move: 18, attack: 22 } } }, desc: 'Echoes of the dead that drift through the veil and drink warmth from the living.' },
  mawprince: { name: 'Princes of the Maw', faction: 'rustbound', tier: 5, hp: 230, atk: 22, def: 15, min: 30, max: 42, spd: 11, shots: 0, ab: ['flyer', 'lifeDrain'], cost: { auramite: 4300, wraithbone: 1 }, growth: 1,
    big: true, look: { sprite: 'unit_mawprince', face: 1, scale: 1.45, anim: { move: 'anim_mawprince_move', attack: 'anim_mawprince_attack', idle: 'move', face: 1, scale: 1.45, fps: { move: 18, attack: 22 } } }, desc: 'Fallen champions remade by the Maw, who wander the wastes drinking the life of all they strike.' },
  drake: { name: 'Ash Drakes', faction: 'neutral', tier: 5, hp: 280, atk: 23, def: 19, min: 32, max: 48, spd: 11, shots: 0, ab: ['flyer'], cost: { auramite: 4500 }, growth: 0,
    big: true, look: { sprite: 'unit_drake', face: 1, scale: 1.2, anim: { move: 'anim_drake_move', attack: 'anim_drake_attack', idle: 'move', face: 1, scale: 1.2, fps: { move: 18, attack: 22 } } }, desc: 'Great winged reptiles of the ash wastes, older than the Concord itself.' },
  mawspawn: { name: 'Maw Spawn', faction: 'neutral', tier: 1, hp: 7, atk: 4, def: 2, min: 1, max: 3, spd: 8, shots: 0, ab: ['flyer'], cost: { auramite: 60 }, growth: 0,
    look: { sprite: 'unit_mawspawn', face: 1, scale: 1.1, anim: { move: 'anim_mawspawn_move', attack: 'anim_mawspawn_attack', idle: 'move', face: 1, scale: 1.1, fps: { move: 18, attack: 22 } } }, desc: "Shrieking winged imps spat out wherever the Maw gnaws through the veil." },
  kite: { name: 'Carrion Kites', faction: 'neutral', tier: 3, hp: 32, atk: 9, def: 6, min: 5, max: 8, spd: 9, shots: 0, ab: ['flyer'], cost: { auramite: 450 }, growth: 0,
    look: { sprite: 'unit_kite', face: 1, scale: 1.3, anim: { move: 'anim_kite_move', attack: 'anim_kite_attack', idle: 'move', face: 1, scale: 0.72, fps: { move: 18, attack: 22 } } }, desc: "Rot-feathered scavenger birds with hooked iron beaks, circling every battlefield." },
  basilisk: { name: 'Basilisks', faction: 'neutral', tier: 4, hp: 110, atk: 14, def: 13, min: 12, max: 20, spd: 5, shots: 0, ab: ['petrify'], cost: { auramite: 1400 }, growth: 0,
    big: true, look: { sprite: 'unit_basilisk', face: 1, scale: 1.25, anim: { move: 'anim_basilisk_move', attack: 'anim_basilisk_attack', idle: 'move', face: 1, scale: 1.25, fps: { move: 18, attack: 22 } } }, desc: "Stone-hided lizards whose gaze stiffens flesh to rock before their jaws close." },
};
// ---- New factions: the Scrapjaw Horde and the Deathless Dynasty (basic and upgraded, own sprites) ----
const NEW_UNITS = [
  // id, faction, tier, name, upgraded name, [hp, atk, def, min, max, spd, shots], upgraded stats, cost, upgraded cost, growth, abilities, upgraded abilities, big, scale, desc, upgraded desc
  ['scrapling', 'scrapjaw', 1, 'Scraplings', 'Scrapling Looters', [6, 4, 1, 1, 3, 6, 0], [7, 5, 2, 1, 4, 7, 0], { auramite: 50 }, { auramite: 70 }, 18, [], [], false, 1.0,
    'Scrawny little greenskins in rags and dented helmets, brave only in a crowd and quick to loot the fallen.', 'Scraplings in looted armour scraps and goggles, with jagged cleavers and hubcap shields.'],
  ['blastgob', 'scrapjaw', 2, 'Blastgob Gunners', 'Blastgob Lootas', [18, 7, 3, 2, 6, 4, 10], [22, 8, 4, 3, 7, 4, 14], { auramite: 210 }, { auramite: 280 }, 9, [], [], false, 1.25,
    'Hulking greenskins with clunky scrap machine guns. They rarely hit what they aim at, but they fire a great deal.', 'Gunners who looted bigger guns: multi-barrel scrap cannons fed by hissing power packs.'],
  ['choppa', 'scrapjaw', 3, 'Choppa Brutes', 'Ironjaw Brutes', [55, 14, 6, 8, 14, 5, 0], [66, 15, 10, 9, 16, 5, 0], { auramite: 560 }, { auramite: 780 }, 5, [], ['doubleStrike'], false, 1.4,
    'Massive brutes swinging cleaver-axes of sharpened scrap. All muscle, very little armour.', 'Brutes bolted into thick iron plate with roaring chain-cleavers and hydraulic claws. They strike twice.'],
  ['rokkit', 'scrapjaw', 4, 'Rokkit Wagons', 'Boomkrak Wagons', [95, 15, 8, 12, 22, 7, 8], [115, 17, 10, 14, 25, 8, 12], { auramite: 1500, blackstone: 1 }, { auramite: 1950, blackstone: 2 }, 2, [], [], true, 1.3,
    'Ramshackle war buggies with a rack of crude rockets on the back and a cackling gunner to fire them.', 'Armoured half-tracks with a spiked ram and an eight-rocket launcher, plated with everything that was lying around.'],
  ['junkgod', 'scrapjaw', 5, 'Junkgod Colossi', 'Junkgod Warmongers', [300, 21, 16, 30, 45, 5, 0], [340, 24, 18, 34, 50, 6, 0], { auramite: 4200, plasteel: 1 }, { auramite: 5400, plasteel: 2 }, 1, [], [], true, 1.5,
    "Walking effigies of the horde's war-god, built of scrap and crewed by a mob of greenskins. A wrecking-ball fist does the talking.", 'Even bigger effigies with a furnace belly, a crushing claw and a cannon arm, belching smoke and fire.'],
  ['husk', 'deathless', 1, 'Tomb Husks', 'Gilded Husks', [9, 3, 5, 1, 3, 4, 0], [11, 5, 6, 2, 3, 5, 0], { auramite: 70 }, { auramite: 90 }, 14, [], [], false, 1.2,
    'Gaunt, half-corroded skeletons of living metal. Their minds went in the long sleep; their claws did not.', 'Husks rebuilt with gold trim, a green core burning in their ribs and long razor claws.'],
  ['dwarrior', 'deathless', 2, 'Deathless Warriors', 'Undying Phalanx', [20, 6, 7, 3, 5, 4, 10], [26, 7, 9, 3, 6, 4, 12], { auramite: 260 }, { auramite: 340 }, 8, [], [], false, 1.3,
    'Skeletal soldiers of the Dynasty, marching in perfect step and flaying the enemy with green energy rifles.', 'Heavier warriors in armoured carapaces with crackling heavy rifles. They do not flinch.'],
  ['scarab', 'deathless', 3, 'Scarab Swarms', 'Hexscarab Swarms', [40, 10, 8, 5, 9, 8, 0], [48, 12, 9, 6, 10, 9, 0], { auramite: 480 }, { auramite: 640 }, 6, ['flyer'], ['flyer'], false, 1.2,
    'Dozens of metal beetles flying as one, shaped like a single hungry beast. They eat armour and then what was in it.', 'Gold-shelled scarabs crawling with green glyphs, spiralling in a crackling storm.'],
  ['ark', 'deathless', 4, 'Tomb Arks', 'Eclipse Arks', [120, 15, 14, 14, 22, 6, 6], [145, 17, 16, 16, 26, 7, 8], { auramite: 1800, psycrystal: 1 }, { auramite: 2300, psycrystal: 2 }, 2, ['brawler'], ['brawler'], true, 1.35,
    'Crescent-bladed war-skiffs of living metal gliding silently above the ground, armed with long green beam projectors.', 'Larger arks with a spine of obelisk fins and a cannon whose core burns like a small green sun.'],
  ['shard', 'deathless', 5, 'Star-God Shards', 'Ascended Star-God Shards', [260, 22, 18, 30, 44, 9, 0], [300, 25, 20, 34, 50, 10, 0], { auramite: 4500, wraithbone: 1 }, { auramite: 5800, wraithbone: 2 }, 1, ['flyer'], ['flyer', 'doubleStrike'], true, 1.5,
    'A fragment of a star-god, chained in living metal by the Dynasty and set loose on its enemies.', 'A star-god shard that has broken its chains, crowned with floating obelisks and blazing with white-gold fire. It strikes twice.'],
];
for (const [id, faction, tier, name, uname, st, ust, cost, ucost, growth, ab, uab, big, scale, desc, udesc] of NEW_UNITS) {
  const make = (k, nm, [hp, atk, def, min, max, spd, shots], c, a, d, extra) => {
    const pose = shots ? 'shoot' : 'attack';
    UNITS[k] = { name: nm, faction, tier, hp, atk, def, min, max, spd, shots, ab: a, cost: c, growth, ...(big ? { big: true } : {}),
      look: { sprite: 'unit_' + k, face: 1, scale, anim: { move: `anim_${k}_move`, [pose]: `anim_${k}_${pose}`, idle: 'move', face: 1, scale, fps: { move: 18, [pose]: 22 } } }, desc: d, ...extra };
  };
  make(id, name, st, cost, ab, desc, { upgrade: id + '_u' });
  make(id + '_u', uname, ust, ucost, uab, udesc, { upgraded: true, base: id });
}
// Upgraded versions: stronger, pricier, and recruited once a dwelling is upgraded.
const UPGRADES = {
  levy: 'Veteran Riflemen', warden: 'Ironclad Dreadnoughts', knight: 'Bulwark Paladins', walker: 'Bastion Dreadwalkers', stormhammer: 'Stormhammer Jarls',
  zealot: 'Runescarred', turncoat: 'Hellfire Reavers', flayer: 'Pyre Raptors', hellforge: 'Hellstorm Gunners', desecrator: 'Pyre Desecrators',
};
for (const [id, name] of Object.entries(UPGRADES)) {
  const b = UNITS[id];
  const cost = {};
  for (const [k, v] of Object.entries(b.cost)) cost[k] = k === 'auramite' ? Math.round(v * 1.3 / 10) * 10 : v + (b.tier >= 4 ? 1 : 0);
  UNITS[id + '_u'] = {
    ...b, name, upgraded: true, base: id,
    hp: Math.round(b.hp * 1.2), atk: b.atk + 2, def: b.def + 2, min: Math.round(b.min * 1.15), max: Math.max(b.max + 1, Math.round(b.max * 1.15)),
    spd: b.spd + 1, shots: b.shots ? b.shots + 4 : 0, cost,
    look: b.look.sprite ? { ...b.look } : { ...b.look, main: b.look.main, trim: '#f0d27a', opt: { ...b.look.opt, vet: true } },
    desc: `Upgraded ${b.name}. ${b.desc}`,
  };
  UNITS[id].upgrade = id + '_u';
}
Object.assign(UNITS.warden_u, { look: { sprite: 'unit_dread_u', face: 1, scale: 1.35 }, desc: 'Ancient dreadnoughts in rust-scarred armour, stripped of ornament and rebuilt for war.' });
Object.assign(UNITS.turncoat_u, { look: { sprite: 'unit_berserker_u', face: -1, scale: 1.35, anim: { shoot: 'anim_reaver_u_shoot', attack: 'anim_reaver_u_attack', idle: 'shoot', face: 1, scale: 1.4, fps: { shoot: 24, attack: 24 } } }, desc: 'Reavers whose mauls burn with the Maw\'s fire. They fight just as well up close as at range.' });
Object.assign(UNITS.levy_u, { look: { sprite: 'unit_levy_u', face: 1, scale: 1.3 }, desc: 'Hardened veterans in wolf-pelt hoods, whose long rifles are tuned for the kill at any range.' });
Object.assign(UNITS.knight_u, { look: { sprite: 'unit_knight_u', face: 1, scale: 1.4 }, desc: 'Paladins of the Concord, their shields and pauldrons gilded for every battle won.' });
Object.assign(UNITS.stormhammer_u, {
  hp: 240, atk: 22, def: 24, min: 32, max: 44, spd: 8, ab: ['shieldwall'],
  look: { sprite: 'unit_stormhammer_u', face: -1, scale: 1.5 },
  desc: 'The oldest of the Stormhammer Guard, their plate etched with saga-runes. Their shields answer every blow.',
});
Object.assign(UNITS.desecrator_u, {
  hp: 250, atk: 24, def: 19, min: 30, max: 46, spd: 7, shots: 20,
  look: { sprite: 'unit_desecrator_u', face: 1, scale: 1.55, anim: { walk: 'anim_desecrator_u_walk', shoot: 'anim_desecrator_u_shoot', attack: 'anim_desecrator_u_attack', idle: 'attack', face: 1, scale: 1.6, fps: { walk: 18, shoot: 24, attack: 24 } } },
  desc: 'Desecrators whose cannons were traded for skull-censers of living hellfire. They burn the line from afar and crush what reaches them.',
});
Object.assign(UNITS.zealot_u, {
  look: { sprite: 'unit_zealot_u', face: 1, scale: 1.35, anim: { walk: 'anim_zealot_run', attack: 'anim_zealot_attack', idle: 'attack', face: 1, scale: 1.45, fps: { walk: 26, attack: 24 } } },
  desc: 'Bloodsworn branded with glowing runes of the Maw, swinging axes that burn with its fire.',
});
Object.assign(UNITS.hellforge_u, {
  look: { sprite: 'unit_gunner_u', face: 1, scale: 1.55, anim: { walk: 'anim_gunner_u_walk', shoot: 'anim_gunner_u_shoot', idle: 'shoot', face: 1, scale: 1.6, fps: { walk: 22, shoot: 28 } } },
  desc: 'Havoc Gunners rebuilt with mechanical loader arms and bigger guns. Their cannons never stop turning.',
});
Object.assign(UNITS.flayer_u, { look: { sprite: 'unit_raptor_u', face: 1, scale: 1.65, jet: true, anim: { fly: 'anim_raptor_u_fly', attack: 'anim_raptor_u_attack', idle: 'attack', face: 1, scale: 1.5, fps: { fly: 24, attack: 24 } } }, desc: 'Veteran Raptors with twin-turbine packs and chain-axes, trailing fire and smoke across the battlefield. No foe can answer their strike.' });
// Elite wandering creatures: stronger kin of each creature, guarding the richest treasure.
const ELITES = {
  servitor: ['Overseer Servitors', 'Heavily augmented thralls with twin serrated claws and a furnace on their backs.'],
  scuttler: ['Scuttler Queens', 'Brood-mothers the size of a horse, armoured in amber-veined carapace and spitting acid.'],
  raider: ['Rustkin Warbosses', 'Scarred raider chiefs in bolted scrap plate, firing double-barrelled scrap cannons.'],
  stalker: ['Chitin Reapers', 'Black-shelled hunters with four scythe limbs and a venom-tipped tail.'],
  brute: ['Mutant Warlords', 'Spike-crowned radiation giants swinging rusted anchors.'],
  wraith: ['Void Revenants', 'Crowned spectres wreathed in frost, draining the warmth of all they touch.'],
  hulk: ['Blight Titans', 'Colossal fungal titans whose every blow bursts into choking spores.'],
  mawprince: ['Archons of the Maw', 'Four-winged champions of the hunger, bearing burning greatswords.'],
  drake: ['Magma Wyrms', 'Ancient drakes of obsidian and molten rock that breathe liquid fire.'],
  mawspawn: ['Maw Fiends', 'Horned fiends of the Maw with burning claws and a tail-blade wreathed in fire.'],
  kite: ['Plague Kites', 'Cybernetic carrion-birds dripping virulent bile that eats armour and flesh alike.'],
  basilisk: ['Petrifex Basilisks', 'Crystal-crowned basilisks whose golden gaze turns warriors to statues.'],
};
for (const [id, [name, desc]] of Object.entries(ELITES)) {
  const b = UNITS[id], e = id + '_e', pose = b.shots ? 'shoot' : 'attack';
  UNITS[e] = {
    ...b, name, elite: true, base: id,
    hp: Math.round(b.hp * 1.22), atk: b.atk + 2, def: b.def + 2, min: Math.round(b.min * 1.15), max: Math.max(b.max + 1, Math.round(b.max * 1.18)),
    spd: b.spd + 1, shots: b.shots ? b.shots + 4 : 0,
    cost: Object.fromEntries(Object.entries(b.cost).map(([k, v]) => [k, k === 'auramite' ? Math.round(v * 1.3 / 10) * 10 : v + (b.tier >= 4 ? 1 : 0)])),
    upgraded: !!b.faction && b.faction !== 'neutral', growth: b.growth,
    look: { ...b.look, sprite: 'unit_' + e, anim: { ...b.look.anim, move: `anim_${e}_move`, [pose]: `anim_${e}_${pose}`, scale: b.look.anim.scale * 1.06 }, scale: b.look.scale * 1.06 },
    desc,
  };
  if (b.faction !== 'neutral') b.upgrade = e;     // Rustbound creatures upgrade into their elite kin
}
UNITS.kite_e.look.anim.scale = 1.7;   // its sheet is drawn tighter than the base kite's
for (const k in UNITS) UNITS[k].id = k;

export function unitValue(type) {
  const u = UNITS[type];
  let v = Math.sqrt(u.hp * (u.min + u.max) / 2) * (1 + 0.05 * (u.atk + u.def));
  if (u.shots) v *= 1.35;
  if (u.ab.includes('flyer')) v *= 1.15;
  if (u.ab.includes('doubleStrike')) v *= 1.4;
  if (u.ab.includes('lifeDrain')) v *= 1.2;
  if (u.ab.includes('petrify')) v *= 1.1;
  return v * 10;
}

export const FACTIONS = {
  concord: {
    name: 'The Iron Concord', adj: 'Concord',
    units: ['levy', 'warden', 'knight', 'walker', 'stormhammer'],
    rares: ['plasteel', 'psycrystal'],
    dwell: ['Conscript Barracks', 'Reliquary Crypt', 'Bulwark Commandery', 'Walker Bay', 'Stormhammer Keep'],
    dwellU: ['Veterans\' Barracks', 'Ironclad Sanctum', 'Paladin Chapterhouse', 'Dreadwalker Forge', 'Hall of Jarls'],
    heroes: ['Lord-Ascendant Valerian Kord', 'Canoness Seraphine Vale', 'Arch-Magos Teyl Orrin'],
    townNames: ['Fort Ardent', 'Bastion Primaris', 'Iron Vigil'],
    lore: 'A thousand worlds bound by oath to a dying throne. Their gene-forged Wardens still hold the line.',
    style: 'Disciplined and tough. Strong shooters, shield walls and hammer-bearing veterans.',
  },
  hollow: {
    name: 'The Hollow Host', adj: 'Hollow',
    units: ['zealot', 'turncoat', 'flayer', 'hellforge', 'desecrator'],
    rares: ['blackstone', 'wraithbone'],
    dwell: ['Bloodsworn Pits', 'Reaver Barracks', 'Raptor Eyrie', 'Havoc Armoury', 'Desecrator Foundry'],
    dwellU: ['Runescar Pits', 'Hellfire Armory', 'Pyre Eyrie', 'Hellstorm Armoury', 'Pyre Cathedral'],
    heroes: ['Abaddor the Ninefold', 'Ezrakh the Thousandfold', 'Khorvax the Red Wrath'],
    townNames: ['Gutterspire', 'The Weeping Gate', 'Citadel of Ash'],
    lore: 'Wardens who broke their oath and gave their souls to the Maw, the hunger between the stars.',
    style: 'Fast and brutal. Cheap hordes, unanswerable strikes and hell-cannon Desecrators.',
  },
  rustbound: {
    name: 'The Rustbound', adj: 'Rustbound',
    units: ['servitor', 'raider', 'brute', 'wraith', 'mawprince'],
    rares: ['psycrystal', 'wraithbone'],
    dwell: ['Thrall Workshop', 'Raider Camp', 'Mutant Pens', 'Void Shrine', 'Maw Spire'],
    dwellU: ['Overseer Foundry', 'Warboss Stronghold', 'Warlord Pit', 'Revenant Crypt', 'Archon Throne'],
    heroes: ['Overlord Senn-Kahet', 'The Patriarch Below', 'Kalgarax the Devouring Mind', 'Commander Vel\'Aun'],
    townNames: ['Scrapmaw', 'Rustholm', 'Ashpit Hive'],
    lore: 'Scavenger clans, mutants and lobotomised thralls of a dead hive-city, ruled from the shadows by fallen Princes of the Maw.',
    style: 'Hardy and ruthless. Tireless thralls, raider guns, mutant brawlers and life-draining void horrors.',
  },
  scrapjaw: {
    name: 'The Scrapjaw Horde', adj: 'Scrapjaw',
    units: ['scrapling', 'blastgob', 'choppa', 'rokkit', 'junkgod'],
    rares: ['blackstone', 'plasteel'],
    dwell: ['Scrap Huts', 'Gun Shack', 'Brute Pits', 'Rokkit Yard', 'Junkgod Altar'],
    dwellU: ['Looter Huts', 'Big Gun Shack', 'Ironjaw Pits', 'Boomkrak Works', 'Junkgod Temple-Forge'],
    heroes: ['Warboss Grotskar Ironguts', 'Skargul da Brainboila'],
    townNames: ['Krumpholt', 'Gutbash Yard', 'Da Big Heap'],
    lore: 'Green-skinned brutes who grow from spores in the battlefield mud. The biggest one is in charge, and everything they own was looted and bolted together.',
    style: 'Loud, cheap and hard to stop. Huge mobs, wild gunfire, rocket wagons and a scrap-god walker.',
  },
  deathless: {
    name: 'The Deathless Dynasty', adj: 'Deathless',
    units: ['husk', 'dwarrior', 'scarab', 'ark', 'shard'],
    rares: ['psycrystal', 'wraithbone'],
    dwell: ['Waking Crypts', 'Phalanx Halls', 'Scarab Hives', 'Ark Cradle', 'Star-God Prison'],
    dwellU: ['Gilded Crypts', 'Undying Halls', 'Hex Hives', 'Eclipse Cradle', 'Ascension Prism'],
    heroes: ['Phaeron Ahzrel the Unending', 'Cryptek Orumesh'],
    townNames: ['Necrokhet', 'The Silent Throne', 'Tomb of Ahzrel'],
    lore: 'An empire older than the stars traded its flesh for living metal and slept for sixty million years. Now the tomb-worlds are opening.',
    style: 'Slow, relentless and hard to kill. Armoured warriors, green beam weapons, scarab swarms and a chained star-god.',
  },
};

// Commander roster: class steers stat growth; specialty and starting skill make each one distinct.
export const HERO_DEFS = {
  'Castellan Varro Hesk': { cls: 'might', spec: { type: 'unit', unit: 'warden' }, skill: 'leadership', spell: 'stoneskin' },
  'Lord-Warden Ismene Dray': { cls: 'might', spec: { type: 'skill', skill: 'armorer' }, skill: 'armorer', spell: 'stoneskin' },
  'Chaplain Oskar Venn': { cls: 'magic', spec: { type: 'spell', spell: 'mend' }, skill: 'water', spell: 'mend' },
  'Marshal Teodor Kael': { cls: 'might', spec: { type: 'unit', unit: 'walker' }, skill: 'offense', spell: 'haste' },
  'Sister-Captain Anwe Roth': { cls: 'might', spec: { type: 'unit', unit: 'levy' }, skill: 'archery', spell: 'mend' },
  'Inquisitor Halden Crane': { cls: 'magic', spec: { type: 'income', amount: 350 }, skill: 'wisdom', spell: 'ember' },
  'Vexhal the Unsworn': { cls: 'might', spec: { type: 'unit', unit: 'zealot' }, skill: 'offense', spell: 'haste' },
  'Morgrith Ashtongue': { cls: 'magic', spec: { type: 'spell', spell: 'ember' }, skill: 'fire', spell: 'ember' },
  'Lady Sythe of the Maw': { cls: 'might', spec: { type: 'unit', unit: 'flayer' }, skill: 'logistics', spell: 'haste' },
  'Korvane Gutterlord': { cls: 'might', spec: { type: 'income', amount: 350 }, skill: 'estates', spell: 'ember' },
  'The Pale Ascendant': { cls: 'magic', spec: { type: 'skill', skill: 'intelligence' }, skill: 'wisdom', spell: 'slow' },
  'Draeg Nine-Scars': { cls: 'might', spec: { type: 'unit', unit: 'hellforge' }, skill: 'pathfinding', spell: 'ember' },
  'Scrapking Malvo': { cls: 'might', spec: { type: 'income', amount: 350 }, skill: 'estates', spell: 'stoneskin' },
  'Mother Rust': { cls: 'might', spec: { type: 'unit', unit: 'servitor' }, skill: 'armorer', spell: 'stoneskin' },
  'Grimbolt the Welder': { cls: 'might', spec: { type: 'unit', unit: 'brute' }, skill: 'offense', spell: 'haste' },
  'Sable the Void-Touched': { cls: 'magic', spec: { type: 'unit', unit: 'wraith' }, skill: 'wisdom', spell: 'slow' },
  'Warboss Kreg': { cls: 'might', spec: { type: 'unit', unit: 'raider' }, skill: 'archery', spell: 'haste' },
  'The Hollow Prince': { cls: 'magic', spec: { type: 'skill', skill: 'intelligence' }, skill: 'wisdom', spell: 'ember' },
  // painted commanders: avatar, map vehicle and battlefield figure (assets/ui/avatars, cmd_<look>_* sprites)
  'Lord-Ascendant Valerian Kord': { cls: 'might', look: 'valerian', spec: { type: 'unit', unit: 'knight' }, skill: 'leadership', spell: 'fury',
    bio: 'The last of the gene-forged sons sent to lead the Concord\'s crusades, Valerian stands half again as tall as any warrior beside him. He has not lost a field in three hundred years, and he carries the scars of every one he nearly lost. Soldiers who march under his banner swear they do not feel fear, only the weight of his gaze.' },
  'Canoness Seraphine Vale': { cls: 'magic', look: 'seraphine', spec: { type: 'spell', spell: 'mend' }, skill: 'water', spell: 'mend',
    bio: 'Seraphine died on the walls of Fort Calder and rose again three days later, wreathed in pale fire. The Concord calls her a living saint; she calls herself a sword that has not yet been put away. Where she flies, the faithful fight on through wounds that should have killed them.' },
  'Arch-Magos Teyl Orrin': { cls: 'magic', look: 'orrin', spec: { type: 'unit', unit: 'walker' }, skill: 'armorer', spell: 'stoneskin',
    bio: 'More machine than man for two centuries, Orrin keeps the Concord\'s war engines alive with prayer, oil and terrible secrets. He speaks in binary hymns and remembers every bolt of every walker he has ever rebuilt. His enemies say his walkers never fall; his engineers know he simply refuses to let them.' },
  'Abaddor the Ninefold': { cls: 'might', look: 'abaddor', spec: { type: 'unit', unit: 'zealot' }, skill: 'offense', spell: 'fury',
    bio: 'Abaddor broke nine oaths to nine masters, and each betrayal made him stronger. Now he leads the Hollow\'s hosts from the front in black armour fused to his flesh, a talon of daemon-steel on one hand. His warriors follow him not from loyalty, which he despises, but because no one has ever outlived his ambition.' },
  'Ezrakh the Thousandfold': { cls: 'magic', look: 'ezrakh', spec: { type: 'spell', spell: 'fireburst' }, skill: 'wisdom', spell: 'ember',
    bio: 'Ezrakh was a librarian once, guardian of forbidden books. He read every one of them. What is left of him now is a voice inside blue and gold armour, a mind that sees a thousand futures and chooses the cruellest. His rites change shape as they are cast, and so, some say, does he.' },
  'Khorvax the Red Wrath': { cls: 'might', look: 'khorvax', spec: { type: 'unit', unit: 'turncoat' }, skill: 'offense', spell: 'frenzy',
    bio: 'Khorvax does not plan battles. He finds them. Mounted on a beast of brass and daemon-flesh that has never been tamed, he charges at the head of every assault, and his axe has taken more skulls than the Hollow can count. His only prayer is a roar, and his only rite is blood.' },
  'Overlord Senn-Kahet': { cls: 'magic', look: 'sennkahet', spec: { type: 'unit', unit: 'wraith' }, skill: 'intelligence', spell: 'slow',
    bio: 'Senn-Kahet ruled a dynasty of stars sixty million years ago, slept in a tomb beneath the Rust Wastes, and woke to find the galaxy overrun by what he calls vermin. He leads the Rustbound for now, because their scrap-machines amuse him and their dead do not trouble him. Nothing he commands ever stays dead for long.' },
  'The Patriarch Below': { cls: 'magic', look: 'patriarch', spec: { type: 'unit', unit: 'servitor' }, skill: 'leadership', spell: 'withering',
    bio: 'In the deep mines of the Rust Wastes, the workers began to pray to something in the dark. Their children were born with too many arms and their grandchildren with violet skin and black eyes. The Patriarch is the first of them, swollen and ancient, and his brood now marches openly under his gaze.' },
  'Kalgarax the Devouring Mind': { cls: 'might', look: 'kalgarax', spec: { type: 'unit', unit: 'brute' }, skill: 'offense', spell: 'haste',
    bio: 'Kalgarax is not a commander so much as the hunger of a swarm given a body. It arrived with the spore-rains that fell on the Rust Wastes and has been feeding ever since. Every creature in its army moves as one; every world it leaves behind is stripped to bare rock.' },
  'Commander Vel\'Aun': { cls: 'might', look: 'velaun', spec: { type: 'unit', unit: 'raider' }, skill: 'archery', spell: 'precision',
    bio: 'Vel\'Aun came to the Rust Wastes as an envoy from a young star-empire and stayed as a mercenary general. The scrap-kings pay her in salvage; she pays them back in victories won at long range, with precision they had never imagined. She believes every war ends in an agreement. She simply prefers to dictate it.' },
  'Warboss Grotskar Ironguts': { cls: 'might', look: 'grotskar', spec: { type: 'unit', unit: 'choppa' }, skill: 'offense', spell: 'fury',
    bio: 'Grotskar started as the smallest of his mob and ate his way to the top. He is now so big that his mob built him a war-truck just to carry him to the fighting. He has one rule of strategy: find the biggest enemy and hit it until it stops moving.' },
  'Skargul da Brainboila': { cls: 'magic', look: 'skargul', spec: { type: 'spell', spell: 'chainstorm' }, skill: 'air', spell: 'arc',
    bio: "The horde's shamans soak up the war-fury of every brute around them until it pours out as green lightning. Skargul soaks up more than most, and his head sometimes smokes. The brutes keep a careful distance and cheer very loudly." },
  'Phaeron Ahzrel the Unending': { cls: 'might', look: 'ahzrel', spec: { type: 'unit', unit: 'dwarrior' }, skill: 'armorer', spell: 'stoneskin',
    bio: 'Ahzrel ruled forty worlds before the long sleep and has woken to find that nobody remembers his name. He intends to fix that. He speaks of the living the way a gardener speaks of weeds, and he has never once retreated, because he has never needed to.' },
  'Cryptek Orumesh': { cls: 'magic', look: 'orumesh', spec: { type: 'spell', spell: 'haste' }, skill: 'wisdom', spell: 'haste',
    bio: "Orumesh was the Dynasty's master of time, and some say it was his engines that let the tomb-worlds sleep through sixty million years. He remembers every second of it. He bends the hours of a battle the way others bend steel, and finds the living's hurry rather sad." },
};
export function specText(name) {
  const d = HERO_DEFS[name]; if (!d) return '';
  const sp = d.spec;
  if (sp.type === 'unit') return `${UNITS[sp.unit].name}: +1 Attack, +1 Defence and +1 Speed per 4 levels.`;
  if (sp.type === 'skill') return `${SKILLS[sp.skill].name}: skill effect grows 5% per level.`;
  if (sp.type === 'spell') return `${SPELLS[sp.spell].name}: casts with +1 Power per 3 levels.`;
  if (sp.type === 'income') return `+${sp.amount} auramite every day.`;
  return '';
}

// ---- Secondary skills (Basic / Advanced / Expert) ----
export const SKILL_LEVELS = ['Basic', 'Advanced', 'Expert'];
export const SKILLS = {
  offense: { name: 'Offence', v: [0.1, 0.2, 0.3], desc: v => `Melee damage +${v * 100}%.` },
  archery: { name: 'Archery', v: [0.1, 0.25, 0.5], desc: v => `Ranged damage +${v * 100}%.` },
  armorer: { name: 'Armourer', v: [0.05, 0.1, 0.15], desc: v => `Damage taken -${v * 100}%.` },
  leadership: { name: 'Leadership', v: [1, 2, 3], desc: v => `Troop morale +${v}.` },
  luck: { name: 'Fortune', v: [1, 2, 3], desc: v => `Troop luck +${v}.` },
  logistics: { name: 'Logistics', v: [0.1, 0.2, 0.3], desc: v => `Map movement +${v * 100}%.` },
  pathfinding: { name: 'Pathfinding', v: [0.25, 0.5, 0.75], desc: v => `Rough terrain slows ${v * 100}% less.` },
  scouting: { name: 'Scouting', v: [1, 2, 3], desc: v => `Sight radius +${v}.` },
  wisdom: { name: 'Wisdom', v: [3, 4, 5], desc: v => `Can learn spells up to level ${v}.` },
  intelligence: { name: 'Intelligence', v: [0.25, 0.5, 1], desc: v => `Maximum mana +${v * 100}%.` },
  mysticism: { name: 'Mysticism', v: [2, 3, 4], desc: v => `Restores ${v} extra mana a day.` },
  estates: { name: 'Estates', v: [125, 250, 500], desc: v => `+${v} auramite a day.` },
  ballistics: { name: 'Ballistics', v: [1, 2, 3], desc: v => `Siege bombard fires ${v + 1} times a round${v > 1 ? ' and hits harder' : ''}.` },
  fire: { name: 'Pyromancy', v: [1, 2, 3], desc: v => `Fire spells ${25 * v}% stronger and last ${v} round${v > 1 ? 's' : ''} longer.`, school: 'fire' },
  earth: { name: 'Geomancy', v: [1, 2, 3], desc: v => `Earth spells ${25 * v}% stronger and last ${v} round${v > 1 ? 's' : ''} longer.`, school: 'earth' },
  water: { name: 'Hydromancy', v: [1, 2, 3], desc: v => `Water spells ${25 * v}% stronger and last ${v} round${v > 1 ? 's' : ''} longer.`, school: 'water' },
  air: { name: 'Aeromancy', v: [1, 2, 3], desc: v => `Air spells ${25 * v}% stronger and last ${v} round${v > 1 ? 's' : ''} longer.`, school: 'air' },
};
export const MAX_SKILLS = 8;
export const skillLevel = (h, id) => (h.skills && h.skills[id]) || 0;
export function skillValue(h, id) {
  const l = skillLevel(h, id); if (!l) return 0;
  let v = SKILLS[id].v[l - 1];
  const d = HERO_DEFS[h.name];
  if (d && d.spec.type === 'skill' && d.spec.skill === id) v *= 1 + 0.05 * h.level;
  return v;
}

export const BUILDINGS = {
  dw1: { tier: 1, cost: { auramite: 0 }, req: [] },
  dw2: { tier: 2, cost: { auramite: 1000, adamantium: 5 }, req: [] },
  dw3: { tier: 3, cost: { auramite: 2000, adamantium: 5, ceramite: 5 }, req: ['dw2'] },
  dw4: { tier: 4, cost: { auramite: 4000, adamantium: 10, ceramite: 5 }, rare: [0, 5], req: ['dw3'] },
  dw5: { tier: 5, cost: { auramite: 8000, ceramite: 10 }, rare: [1, 10], req: ['dw4', 'mg1'] },
  dw1u: { tier: 1, up: true, cost: { auramite: 600, adamantium: 5 }, req: ['dw1'] },
  dw2u: { tier: 2, up: true, cost: { auramite: 1500, adamantium: 5, ceramite: 5 }, req: ['dw2'] },
  dw3u: { tier: 3, up: true, cost: { auramite: 3000, ceramite: 5 }, rare: [0, 3], req: ['dw3'] },
  dw4u: { tier: 4, up: true, cost: { auramite: 5000, adamantium: 5 }, rare: [0, 5], req: ['dw4'] },
  dw5u: { tier: 5, up: true, cost: { auramite: 10000, adamantium: 5 }, rare: [1, 10], req: ['dw5', 'hall2'] },
  hall2: { name: 'City Hall', cost: { auramite: 2500 }, req: [], desc: 'Raises daily income to 1000 auramite.' },
  hall3: { name: 'Capitol', cost: { auramite: 5000, adamantium: 5, ceramite: 5 }, req: ['hall2', 'dw3'], desc: 'Raises daily income to 2000 auramite.' },
  tavern: { name: 'Recruitment Office', cost: { auramite: 500, adamantium: 5 }, req: [], desc: 'Hire new commanders.' },
  market: { name: 'Trade Exchange', cost: { auramite: 1000, ceramite: 5 }, req: [], desc: 'Trade materials for auramite and back.' },
  mg1: { name: 'Mage Guild level 1', guild: 1, cost: { auramite: 2000, adamantium: 5, ceramite: 5 }, req: [], desc: 'Teaches level 1 spells to visiting commanders.' },
  mg2: { name: 'Mage Guild level 2', guild: 2, cost: { auramite: 1000, adamantium: 5, ceramite: 5 }, rare: [1, 4], req: ['mg1'], desc: 'Teaches level 2 spells.' },
  mg3: { name: 'Mage Guild level 3', guild: 3, cost: { auramite: 1000, adamantium: 5, ceramite: 5 }, rare: [0, 6], req: ['mg2'], desc: 'Teaches level 3 spells.' },
  mg4: { name: 'Mage Guild level 4', guild: 4, cost: { auramite: 1000, adamantium: 5, ceramite: 5 }, rare: [1, 8], req: ['mg3'], desc: 'Teaches level 4 spells.' },
  mg5: { name: 'Mage Guild level 5', guild: 5, cost: { auramite: 2000, adamantium: 5 }, rare: [0, 10], req: ['mg4', 'hall2'], desc: 'Teaches level 5 spells.' },
  fort: { name: 'Fort', cost: { auramite: 5000, adamantium: 10, ceramite: 10 }, req: [], desc: 'Walls and a gate defend the town in a siege.' },
  citadel: { name: 'Citadel', cost: { auramite: 2500, ceramite: 5 }, req: ['fort'], desc: 'Adds a moat and a central gun tower. Troop growth +50%.' },
  castle: { name: 'Castle', cost: { auramite: 5000, adamantium: 10, ceramite: 10 }, req: ['citadel'], desc: 'Adds two flanking towers. Troop growth +50% more.' },
  depot: { name: 'Supply Depot', cost: { auramite: 1500, ceramite: 5 }, req: ['dw2'], desc: '+50% weekly troop growth.' },
};
export function buildingCost(faction, id) {
  const b = BUILDINGS[id];
  if (!b.rare) return b.cost;
  return { ...b.cost, [FACTIONS[faction].rares[b.rare[0]]]: b.rare[1] };
}
export const BUILD_ORDER = ['hall2', 'hall3', 'fort', 'citadel', 'castle', 'tavern', 'market', 'depot', 'mg1', 'mg2', 'mg3', 'mg4', 'mg5', 'dw1', 'dw1u', 'dw2', 'dw2u', 'dw3', 'dw3u', 'dw4', 'dw4u', 'dw5', 'dw5u'];
export function buildingName(faction, id) {
  const b = BUILDINGS[id];
  if (!b.tier) return b.name;
  return (b.up ? FACTIONS[faction].dwellU : FACTIONS[faction].dwell)[b.tier - 1];
}
export function buildingDesc(faction, id) {
  const b = BUILDINGS[id];
  if (!b.tier) return b.desc;
  const u = UNITS[FACTIONS[faction].units[b.tier - 1]];
  if (b.up) return `Recruits arrive as ${UNITS[u.upgrade].name}. Existing ${u.name} can be upgraded here.`;
  return `Musters ${u.growth} ${u.name} each week.`;
}

export const SCHOOLS = { fire: 'Fire', earth: 'Earth', water: 'Water', air: 'Air' };
export const SPELL_COST = [0, 5, 8, 12, 16, 24];
// kind: dmg (single), area (target + neighbours, hits everyone), mass_dmg (all enemies), heal, mass_heal, buff, mass_buff, debuff, adventure
export const SPELLS = {
  ember: { name: 'Ember Bolt', school: 'fire', level: 1, kind: 'dmg', target: 'enemy', base: 10, per: 10 },
  stoneskin: { name: 'Stoneskin', school: 'earth', level: 1, kind: 'buff', target: 'ally', stat: 'def', amount: 3 },
  mend: { name: 'Mending Litany', school: 'water', level: 1, kind: 'heal', target: 'ally', base: 20, per: 15 },
  haste: { name: 'Warp Haste', school: 'air', level: 1, kind: 'buff', target: 'ally', stat: 'spd', amount: 3 },
  fury: { name: 'Battle Fury', school: 'fire', level: 2, kind: 'buff', target: 'ally', stat: 'atk', amount: 4 },
  slow: { name: 'Gravity Well', school: 'earth', level: 2, kind: 'debuff', target: 'enemy', stat: 'spd', amount: -3 },
  frost: { name: 'Frost Lance', school: 'water', level: 2, kind: 'dmg', target: 'enemy', base: 15, per: 12 },
  arc: { name: 'Lightning Arc', school: 'air', level: 2, kind: 'dmg', target: 'enemy', base: 20, per: 15 },
  farsight: { name: 'Far Sight', school: 'air', level: 2, kind: 'adventure', desc: 'Reveals the land in a wide radius around the commander.' },
  fireburst: { name: 'Fireburst', school: 'fire', level: 3, kind: 'area', target: 'any', base: 15, per: 12 },
  voidward: { name: 'Void Ward', school: 'earth', level: 3, kind: 'mass_buff', target: 'none', stat: 'def', amount: 3 },
  tide: { name: 'Cleansing Tide', school: 'water', level: 3, kind: 'mass_heal', target: 'none', base: 10, per: 8 },
  tailwind: { name: 'Tailwind', school: 'air', level: 3, kind: 'mass_buff', target: 'none', stat: 'spd', amount: 2 },
  lance: { name: 'Orbital Lance', school: 'air', level: 4, kind: 'dmg', target: 'enemy', base: 40, per: 20 },
  inferno: { name: 'Inferno', school: 'fire', level: 4, kind: 'area', target: 'any', base: 25, per: 15 },
  portal: { name: 'Town Portal', school: 'earth', level: 4, kind: 'adventure', desc: 'Returns the commander to the nearest town you hold.' },
  cataclysm: { name: 'Cataclysm', school: 'fire', level: 5, kind: 'mass_dmg', target: 'none', base: 25, per: 15 },
  resurrect: { name: 'Resurrection', school: 'earth', level: 5, kind: 'heal', target: 'ally', base: 40, per: 25 },
  // ---- pyre rites (fire) ----
  curse: { name: 'Hex of the Burning Eye', school: 'fire', level: 1, kind: 'debuff', target: 'enemy', stat: 'roll', amount: -1, step: 0, label: 'Cursed' },
  wardwater: { name: 'Promethium Ward', school: 'fire', level: 1, kind: 'buff', target: 'ally', stat: 'ward_water', amount: 50, step: 10, label: 'Water ward %' },
  blind: { name: 'Searing Blindness', school: 'fire', level: 2, kind: 'debuff', target: 'enemy', stat: 'blind', amount: -1, step: 0, maxRounds: 2, label: 'Blinded' },
  misfortune: { name: 'Curse of Ill Omen', school: 'fire', level: 3, kind: 'debuff', target: 'enemy', stat: 'luck', amount: -2, step: -1, label: 'Luck' },
  exterminatus: { name: 'Exterminatus', school: 'fire', level: 4, kind: 'all_dmg', target: 'none', base: 30, per: 22 },
  frenzy: { name: 'Frenzy of the Blood-God', school: 'fire', level: 4, kind: 'buff', target: 'ally', stats: [['atk', 6], ['def', -6]] },
  slayer: { name: 'Mark of the Beast-Slayer', school: 'fire', level: 4, kind: 'buff', target: 'ally', stat: 'slayer', amount: 50, step: 15, label: 'Vs tier 4-5 %' },
  pyreaegis: { name: 'Pyre Aegis', school: 'fire', level: 4, kind: 'buff', target: 'ally', stat: 'thorns', amount: 25, step: 10, label: 'Burns attackers %' },
  sumfire: { name: 'Call of the Ash Drakes', school: 'fire', level: 5, kind: 'summon', target: 'none', unit: 'drake', base: 300, per: 130 },
  // ---- bastion rites (earth) ----
  bulwark: { name: 'Ceramite Bulwark', school: 'earth', level: 1, kind: 'buff', target: 'ally', stat: 'meleeWard', amount: 20, step: 10, label: 'Melee ward %' },
  viewearth: { name: 'Auspex of the Deep', school: 'earth', level: 1, kind: 'adventure', desc: 'Reveals every mine and resource heap on the map.' },
  deathknell: { name: 'Death Knell', school: 'earth', level: 2, kind: 'all_dmg', target: 'none', living: true, base: 8, per: 7 },
  wardair: { name: 'Anti-Psyker Ward', school: 'earth', level: 2, kind: 'buff', target: 'ally', stat: 'ward_air', amount: 50, step: 10, label: 'Air ward %' },
  raise: { name: 'Raise the Fallen', school: 'earth', level: 3, kind: 'raise', target: 'ally', base: 30, per: 22 },
  nullfield: { name: 'Null Field', school: 'earth', level: 3, kind: 'buff', target: 'ally', stat: 'nullmagic', amount: 1, step: 0, label: 'Immune to enemy rites' },
  tremor: { name: 'Siege Tremor', school: 'earth', level: 3, kind: 'tremor', target: 'none' },
  barricade: { name: 'Force Barricade', school: 'earth', level: 3, kind: 'obstacle', target: 'any' },
  debris: { name: 'Orbital Debris Storm', school: 'earth', level: 4, kind: 'area', target: 'any', base: 25, per: 18 },
  despair: { name: 'Litany of Despair', school: 'earth', level: 4, kind: 'mass_debuff', target: 'none', stat: 'morale', amount: -1, step: -1, label: 'Morale' },
  collapse: { name: 'Graviton Collapse', school: 'earth', level: 5, kind: 'dmg', target: 'enemy', base: 75, per: 30 },
  sumearth: { name: 'Awaken the Spore Hulks', school: 'earth', level: 5, kind: 'summon', target: 'none', unit: 'hulk', base: 300, per: 130 },
  // ---- litany rites (water) ----
  bless: { name: 'Benediction of the Saint', school: 'water', level: 1, kind: 'buff', target: 'ally', stat: 'roll', amount: 1, step: 0, label: 'Blessed' },
  dispel: { name: 'Purging Water', school: 'water', level: 1, kind: 'dispel', target: 'any_stack' },
  wardfire: { name: 'Coolant Ward', school: 'water', level: 1, kind: 'buff', target: 'ally', stat: 'ward_fire', amount: 50, step: 10, label: 'Fire ward %' },
  withering: { name: 'Rite of Withering', school: 'water', level: 2, kind: 'debuff', target: 'enemy', stat: 'atk', amount: -3 },
  clearfield: { name: 'Clear the Field', school: 'water', level: 2, kind: 'clear', target: 'any' },
  mindwipe: { name: 'Mind-Wipe', school: 'water', level: 3, kind: 'debuff', target: 'enemy', stat: 'ranged', amount: -50, step: 0, label: 'Ranged damage %' },
  hoarfrost: { name: 'Ring of Hoarfrost', school: 'water', level: 3, kind: 'ring', target: 'any', base: 15, per: 12 },
  hymn: { name: 'Hymn of Zeal', school: 'water', level: 3, kind: 'mass_buff', target: 'none', stat: 'morale', amount: 1, step: 1, label: 'Morale' },
  clone: { name: 'Mirror of the Sea of Souls', school: 'water', level: 4, kind: 'clone', target: 'ally' },
  prayer: { name: 'Great Prayer of the Throne', school: 'water', level: 4, kind: 'mass_buff', target: 'none', stats: [['atk', 2], ['def', 2], ['spd', 2]] },
  waterwalk: { name: 'Walk the Toxic Shallows', school: 'water', level: 4, kind: 'adventure', desc: 'For the rest of the day the army can cross acid pools.' },
  sumwater: { name: 'Call the Void Wraiths', school: 'water', level: 5, kind: 'summon', target: 'none', unit: 'wraith', base: 300, per: 130 },
  // ---- storm rites (air) ----
  viewair: { name: 'Vox-Intercept', school: 'air', level: 1, kind: 'adventure', desc: 'Reveals every commander, town and artifact on the map.' },
  fate: { name: 'Fate-Reading', school: 'air', level: 2, kind: 'buff', target: 'ally', stat: 'luck', amount: 1, step: 1, label: 'Luck' },
  precision: { name: 'Targeting Litany', school: 'air', level: 2, kind: 'buff', target: 'ally', stat: 'ranged', amount: 25, step: 10, label: 'Ranged damage %' },
  refractor: { name: 'Refractor Field', school: 'air', level: 3, kind: 'buff', target: 'ally', stat: 'rangedWard', amount: 25, step: 10, label: 'Ranged ward %' },
  banish: { name: 'Banishment', school: 'air', level: 3, kind: 'tag_dmg', target: 'none', base: 25, per: 18 },
  chainstorm: { name: 'Chain of the Storm', school: 'air', level: 4, kind: 'chain', target: 'enemy', base: 30, per: 20 },
  reflex: { name: 'Vengeful Reflex', school: 'air', level: 4, kind: 'mass_buff', target: 'none', stat: 'retal', amount: 1, step: 0, label: 'Retaliates every attack' },
  mirror: { name: 'Warp Mirror', school: 'air', level: 5, kind: 'buff', target: 'ally', stat: 'mirror', amount: 40, step: 10, label: 'Reflects rites %' },
  jumppack: { name: 'Jump-Pack Ascension', school: 'air', level: 5, kind: 'adventure', desc: 'For the rest of the day the army flies over mountains, woods and pools.' },
  sumair: { name: 'Call the Plague Kites', school: 'air', level: 5, kind: 'summon', target: 'none', unit: 'kite_e', base: 300, per: 130 },
};
// stacks the Death Knell spares and Banishment strikes: the undying, daemons and machine-spirits
export const isUndying = u => u.ab.includes('lifeDrain') || u.faction === 'deathless' || /^(mawspawn|wraith|mawprince)/.test(u.id || '');
export const STAT_LABEL = { atk: 'Attack', def: 'Defence', spd: 'Speed', morale: 'Morale', luck: 'Luck' };
for (const k in SPELLS) { SPELLS[k].id = k; SPELLS[k].cost = SPELL_COST[SPELLS[k].level]; }
// Effective casting power for a hero and spell: power stat plus specialty bonus; school skill scales the result.
export function spellPower(h, sp) {
  let p = hstat(h, 'pow');
  const d = HERO_DEFS[h.name];
  if (d && d.spec.type === 'spell' && d.spec.spell === sp) p += Math.floor(h.level / 3) + 1;
  return p;
}
export const schoolLevel = (h, sp) => skillLevel(h, SPELLS[sp].school);
export function spellDesc(h, sp) {
  const S = SPELLS[sp], p = h ? spellPower(h, sp) : 1, sl = h ? schoolLevel(h, sp) : 0, m = 1 + 0.25 * sl;
  const amt = Math.round(((S.base || 0) + (S.per || 0) * p) * m), rounds = Math.min(S.maxRounds || 99, 1 + p + sl);
  const fx = (st, a) => `${a > 0 ? '+' : ''}${a} ${STAT_LABEL[st] || ''}`;
  const val = () => S.amount + (S.step ?? 1) * sl;
  switch (S.kind) {
    case 'dmg': return `Deals ${amt} damage to one enemy stack.`;
    case 'area': return `Deals ${amt} damage to the target hex and all six around it, friend or foe.`;
    case 'ring': return `Deals ${amt} damage to the six hexes around the target, not the centre.`;
    case 'mass_dmg': return `Deals ${amt} damage to every enemy stack.`;
    case 'all_dmg': return S.living ? `Deals ${amt} damage to every stack on the field, except the undying and daemons.` : `Deals ${amt} damage to every stack on the field, friend and foe.`;
    case 'tag_dmg': return `Deals ${amt} damage to every undying and daemonic enemy stack.`;
    case 'chain': return `Deals ${amt} damage to an enemy stack, then jumps to three more, each strike half as strong.`;
    case 'heal': return `Restores ${amt} health to an allied stack, raising fallen troops.`;
    case 'raise': return `Raises ${amt} health of fallen troops in an undying or Rustbound stack.`;
    case 'mass_heal': return `Restores ${amt} health to every allied stack and lifts curses.`;
    case 'summon': return `Calls ${UNITS[S.unit].name} (about ${Math.max(1, Math.round(amt / UNITS[S.unit].hp))}) to fight until the battle ends.`;
    case 'clone': return `Creates a fleeting copy of an allied stack (${40 + 10 * sl}% of its size) for the battle.`;
    case 'dispel': return 'Removes every rite effect from one stack.';
    case 'obstacle': return 'Raises an impassable force barrier on the target hex and one beside it.';
    case 'clear': return 'Washes away the obstacle on the target hex.';
    case 'tremor': return 'Shakes down two wall sections and damages the gate (attacker in a siege only).';
    case 'buff': case 'debuff': case 'mass_buff': case 'mass_debuff': {
      const who = S.kind === 'buff' ? 'Allied stack' : S.kind === 'debuff' ? 'Enemy stack' : S.kind === 'mass_buff' ? 'All allies' : 'All enemies';
      if (S.stats) return `${who}: ${S.stats.map(([st, a]) => fx(st, a + (a > 0 ? sl : -sl))).join(', ')} for ${rounds} rounds.`;
      if (STAT_LABEL[S.stat]) return `${who} ${fx(S.stat, val())} for ${rounds} rounds.`;
      const v = val();
      const txt = { roll: S.amount > 0 ? 'always deals its highest damage' : 'only deals its lowest damage', blind: 'cannot act until struck', nullmagic: 'is untouched by enemy rites', retal: 'retaliate against every attack',
        ward_fire: `takes ${v}% less fire damage`, ward_water: `takes ${v}% less water damage`, ward_air: `takes ${v}% less air damage`, meleeWard: `takes ${v}% less melee damage`,
        rangedWard: `takes ${v}% less ranged damage`, ranged: `${v > 0 ? 'deals' : 'loses'} ${Math.abs(v)}% ${v > 0 ? 'more' : 'of its'} ranged damage`, slayer: `deals ${v}% more damage to tier 4-5 creatures`,
        thorns: `burns melee attackers for ${v}% of the damage they deal`, mirror: `has a ${v}% chance to bounce enemy rites back` }[S.stat];
      return `${who} ${txt} for ${rounds} rounds.`;
    }
    default: return S.desc;
  }
}

// ---- Artifacts ----
export const SLOTS = ['head', 'neck', 'armor', 'cloak', 'weapon', 'shield', 'boots', 'ring1', 'ring2', 'misc1', 'misc2', 'misc3'];
export const SLOT_NAMES = { head: 'Head', neck: 'Neck', armor: 'Armour', cloak: 'Cloak', weapon: 'Weapon', shield: 'Shield', boots: 'Boots', ring1: 'Ring', ring2: 'Ring', misc1: 'Trinket', misc2: 'Trinket', misc3: 'Trinket' };
export const slotsFor = type => (type === 'ring' ? ['ring1', 'ring2'] : type === 'misc' ? ['misc1', 'misc2', 'misc3'] : [type]);
export const RARITY = { T: { name: 'Treasure', color: '#c8c0a8' }, m: { name: 'Minor', color: '#7fc8ff' }, M: { name: 'Major', color: '#c08aff' }, R: { name: 'Relic', color: '#ffc04a' } };
export const ARTIFACTS = {
  blade: { name: 'Blade of the First Oath', slot: 'weapon', r: 'T', atk: 2 },
  chainblade: { name: 'Ripper Chainblade', slot: 'weapon', r: 'm', atk: 4 },
  maul: { name: 'Thunder Maul of Hesk', slot: 'weapon', r: 'M', atk: 6, morale: 1 },
  aegis: { name: 'Ceramite Aegis', slot: 'shield', r: 'T', def: 2 },
  stormshield: { name: 'Storm Shield', slot: 'shield', r: 'm', def: 4 },
  bastion: { name: 'Bastion Wall', slot: 'shield', r: 'M', def: 6, morale: 1 },
  crown: { name: 'Psy-Crown of Veyl', slot: 'head', r: 'T', pow: 2 },
  helm: { name: 'Helm of Command', slot: 'head', r: 'm', def: 1, morale: 1 },
  diadem: { name: 'Diadem of the Seer', slot: 'head', r: 'M', pow: 3, know: 2 },
  seal: { name: 'Seal of Unbroken Faith', slot: 'neck', r: 'T', pow: 1, know: 1 },
  voidamulet: { name: 'Amulet of the Void', slot: 'neck', r: 'm', know: 3 },
  courage: { name: 'Talisman of Courage', slot: 'neck', r: 'm', morale: 1, luck: 1 },
  plate: { name: 'Plate of the Martyr', slot: 'armor', r: 'T', def: 3 },
  carapace: { name: 'Carapace of the Maw', slot: 'armor', r: 'm', def: 3, atk: 2 },
  wardenplate: { name: 'Armour of the First Warden', slot: 'armor', r: 'R', atk: 3, def: 3, pow: 3, know: 3 },
  banner: { name: 'Banner of the Last Stand', slot: 'cloak', r: 'T', atk: 1, def: 1 },
  shroud: { name: 'Shroud of Shadows', slot: 'cloak', r: 'm', luck: 1, def: 1 },
  starmantle: { name: 'Mantle of Dead Stars', slot: 'cloak', r: 'M', pow: 2, spellDmg: 0.2 },
  treads: { name: 'Grav-Treads', slot: 'boots', r: 'T', move: 300 },
  pathboots: { name: "Pathfinder's Boots", slot: 'boots', r: 'm', move: 200, rough: 0.5 },
  jetboots: { name: 'Jump-Thruster Boots', slot: 'boots', r: 'M', move: 600 },
  fortune: { name: 'Ring of Fortune', slot: 'ring', r: 'T', luck: 1 },
  magus: { name: 'Ring of the Magus', slot: 'ring', r: 'm', know: 1, regen: 2 },
  signet: { name: 'Signet of Command', slot: 'ring', r: 'm', morale: 1, atk: 1 },
  codex: { name: 'Codex of Lost Ages', slot: 'misc', r: 'T', know: 2 },
  die: { name: 'Lucky Bone Die', slot: 'misc', r: 'T', luck: 1 },
  medal: { name: 'Medal of Valour', slot: 'misc', r: 'm', morale: 1 },
  reliquary: { name: 'Golden Reliquary', slot: 'misc', r: 'M', income: 500 },
  scope: { name: 'Servo-Skull Scope', slot: 'misc', r: 'm', sight: 2, archery: 0.1 },
  orb: { name: 'Spellbinder Orb', slot: 'misc', r: 'M', spellDmg: 0.25, mana: 20 },
  // ---- loyalist crusade relics ----
  primarchsword: { name: 'Sword of the Sainted Primarch', slot: 'weapon', r: 'R', atk: 8, morale: 2, set: 'warden' },
  inqpistol: { name: 'Bolt Pistol of the Inquisition', slot: 'weapon', r: 'M', atk: 4, archery: 0.2 },
  ironhalo: { name: 'Iron Halo', slot: 'head', r: 'M', def: 4, morale: 1, set: 'warden' },
  rosary: { name: 'Rosary of the Martyred Saint', slot: 'neck', r: 'm', pow: 2, morale: 1 },
  pauldron: { name: 'Pauldron of Honour', slot: 'armor', r: 'M', def: 6 },
  standard: { name: 'Standard of the Unbowed Legion', slot: 'cloak', r: 'M', atk: 2, def: 2, morale: 1, set: 'warden' },
  sabatons: { name: 'Sabatons of the Long March', slot: 'boots', r: 'm', move: 300, def: 1 },
  highsignet: { name: 'Signet of the High Lords', slot: 'ring', r: 'M', atk: 1, def: 1, pow: 1, know: 1 },
  ledger: { name: 'Tithe Ledger', slot: 'misc', r: 'm', income: 250 },
  censer: { name: 'Censer of Purifying Flame', slot: 'misc', r: 'm', morale: 1, enemyMorale: 1 },
  bloodvial: { name: "Vial of the Primarch's Blood", slot: 'misc', r: 'R', raise: 0.25 },
  // ---- traitor relics of the ruinous powers ----
  daemonaxe: { name: 'Daemon-Bound Axe', slot: 'weapon', r: 'M', atk: 7, morale: -1 },
  eightblade: { name: 'Blade of the Eightfold Star', slot: 'weapon', r: 'R', atk: 6, pow: 3, enemyLuck: 1, set: 'ruin' },
  hornhelm: { name: 'Helm of the Many-Horned', slot: 'head', r: 'm', atk: 3, set: 'ruin' },
  brasscollar: { name: 'Collar of Brass and Fury', slot: 'neck', r: 'M', def: 3, noBadMorale: 1 },
  plaguecarapace: { name: 'Plague-Rotted Carapace', slot: 'armor', r: 'M', def: 5, enemyMorale: 1 },
  flayedcloak: { name: 'Cloak of Flayed Skins', slot: 'cloak', r: 'm', atk: 2, enemyMorale: 1, set: 'ruin' },
  warpgreaves: { name: 'Greaves of the Warp-Stride', slot: 'boots', r: 'M', move: 400, rough: 0.5 },
  eyering: { name: 'Ring of the Eyeless Seer', slot: 'ring', r: 'm', pow: 2, luck: -1 },
  throneshard: { name: 'Skull Throne Shard', slot: 'misc', r: 'M', atk: 3, lifesteal: 0.05 },
  forbiddentome: { name: 'Tome of Forbidden Names', slot: 'misc', r: 'M', know: 4, learnSpell: 4 },
  championheart: { name: 'Heart of the Fallen Champion', slot: 'misc', r: 'R', atk: 4, pow: 4, set: 'ruin' },
  // ---- star-caste xenos relics ----
  pulsecarbine: { name: 'Pulse Carbine of the Fire Caste', slot: 'weapon', r: 'm', atk: 3, archery: 0.15 },
  fusionblaster: { name: 'Fusion Blaster of the Hunter', slot: 'weapon', r: 'M', atk: 6, pierce: 0.3, set: 'cadre' },
  shielddrone: { name: 'Shield Drone', slot: 'shield', r: 'M', def: 6, set: 'cadre' },
  etherealband: { name: 'Ethereal Headband of Unity', slot: 'head', r: 'M', morale: 2, know: 2 },
  markerlight: { name: 'Markerlight Monocle', slot: 'head', r: 'm', sight: 2, archery: 0.1, set: 'cadre' },
  stealthfield: { name: 'Stealth-Field Generator', slot: 'cloak', r: 'M', luck: 2, def: 1 },
  jetlegs: { name: 'Battlesuit Jet Boosters', slot: 'boots', r: 'M', move: 500, set: 'cadre' },
  dataring: { name: "Commander's Data-Ring", slot: 'ring', r: 'm', atk: 1, def: 1 },
  gundrones: { name: 'Gun Drone Pair', slot: 'misc', r: 'M', archery: 0.2, atk: 1 },
  hologram: { name: 'Greater Good Hologram', slot: 'misc', r: 'R', morale: 2, luck: 1 },
  // ---- deathless dynasty relics ----
  warscythe: { name: 'Warscythe of the Overlord', slot: 'weapon', r: 'R', atk: 9, pierce: 0.3, set: 'dynasty' },
  gaussflayer: { name: 'Gauss Flayer', slot: 'weapon', r: 'm', atk: 3, archery: 0.1 },
  phylactery: { name: 'Phylactery of Reanimation', slot: 'neck', r: 'M', raise: 0.2, set: 'dynasty' },
  silentcrown: { name: 'Crown of the Silent King', slot: 'head', r: 'R', pow: 4, know: 4, morale: 1, set: 'dynasty' },
  livingcuirass: { name: 'Living-Metal Cuirass', slot: 'armor', r: 'M', def: 5, regenTroops: 0.1, set: 'dynasty' },
  dispersion: { name: 'Dispersion Shield', slot: 'shield', r: 'M', def: 5, enemyRanged: 0.15 },
  tesseract: { name: 'Tesseract Labyrinth', slot: 'misc', r: 'R', pow: 3, know: 3, enemyMorale: 1 },
  scarabs: { name: 'Canoptek Scarab Swarm', slot: 'misc', r: 'm', def: 1, sight: 1 },
  dynastyring: { name: 'Ring of the Eternal Dynasty', slot: 'ring', r: 'M', know: 2, manaWeekly: 1 },
  tombtreads: { name: 'Treads of the Tomb-Stalker', slot: 'boots', r: 'm', move: 300, rough: 0.5 },
  // ---- seer-kin relics ----
  spiritstone: { name: 'Spirit-Stone of the Fallen Seer', slot: 'neck', r: 'M', pow: 3, know: 2 },
  witchblade: { name: 'Witchblade', slot: 'weapon', r: 'M', atk: 5, pow: 2 },
  runearmour: { name: 'Rune Armour of the Farseer', slot: 'armor', r: 'M', def: 4, luck: 2 },
  ghosthelm: { name: 'Ghosthelm', slot: 'head', r: 'm', know: 2, spellCost: 1 },
  webwaykey: { name: 'Webway Key', slot: 'misc', r: 'R', move: 600, sight: 2 },
  hawkwings: { name: 'Wings of the Swooping Hawk', slot: 'cloak', r: 'M', move: 400, rough: 0.5 },
  // ---- greenskin warband loot ----
  bigchoppa: { name: 'Big Choppa', slot: 'weapon', r: 'm', atk: 4 },
  kustomshoota: { name: 'Kustom Shoota', slot: 'weapon', r: 'M', atk: 3, archery: 0.3 },
  teefsack: { name: 'Sack of Teef', slot: 'misc', r: 'T', income: 150 },
  ironjaw: { name: 'Warboss Iron Gob', slot: 'head', r: 'M', atk: 3, morale: 2 },
  megaplate: { name: 'Mega-Armour Plate', slot: 'armor', r: 'M', def: 7, move: -200 },
  redpaint: { name: 'Red Wunz Paint Pot', slot: 'misc', r: 'm', move: 100, morale: 1 },
  // ---- hive-swarm trophies ----
  boneswords: { name: 'Bonesword Pair', slot: 'weapon', r: 'M', atk: 6, lifesteal: 0.1 },
  synapse: { name: 'Synapse Node', slot: 'head', r: 'M', pow: 3, noBadMorale: 1 },
  broodshell: { name: 'Chitin Shell of the Brood-Mother', slot: 'armor', r: 'm', def: 4 },
  sporebelt: { name: 'Spore Sac Bandolier', slot: 'misc', r: 'm', enemyRanged: 0.1 },
  devourer: { name: 'Devourer Symbiote', slot: 'weapon', r: 'm', atk: 2, archery: 0.15 },
  // ---- our own world ----
  auracenser: { name: 'Auramite Censer of the Concord', slot: 'misc', r: 'm', morale: 1, income: 100 },
  embercrown: { name: 'Hollow Crown of Embers', slot: 'head', r: 'M', atk: 3, pow: 2 },
  gearheart: { name: 'Rustbound Gear-Heart', slot: 'misc', r: 'M', def: 3, atk: 1 },
  wraithlantern: { name: 'Wraithbone Lantern', slot: 'misc', r: 'm', sight: 2, luck: 1 },
  psyfocus: { name: 'Psy-Crystal Focus', slot: 'misc', r: 'M', pow: 3, spellDmg: 0.15 },
  blackring: { name: 'Blackstone Bastion Ring', slot: 'ring', r: 'm', def: 2 },
  orrery: { name: "Plasteel Cartographer's Engine", slot: 'misc', r: 'M', revealWeekly: 1, sight: 1 },
};
// Combination sets: wearing every piece adds the set bonus (on top of each piece's own effect).
export const SETS = {
  warden: { name: 'Panoply of the First Warden', icon: 'set_warden', pieces: ['wardenplate', 'ironhalo', 'primarchsword', 'standard'], bonus: { atk: 5, def: 5, pow: 5, know: 5, morale: 2 } },
  ruin: { name: 'Regalia of the Eightfold Ruin', icon: 'set_ruin', pieces: ['eightblade', 'hornhelm', 'flayedcloak', 'championheart'], bonus: { atk: 6, pow: 4, enemyMorale: 2, enemyLuck: 1 } },
  dynasty: { name: 'Dynasty of the Silent King', icon: 'set_dynasty', pieces: ['silentcrown', 'warscythe', 'livingcuirass', 'phylactery'], bonus: { raise: 0.3, def: 3 } },
  cadre: { name: 'Hunter Cadre', icon: 'set_cadre', pieces: ['fusionblaster', 'shielddrone', 'markerlight', 'jetlegs'], bonus: { archery: 0.3, atk: 2 } },
};
ARTIFACTS.wardenplate.set = 'warden';
for (const k in ARTIFACTS) ARTIFACTS[k].id = k;
export const RELICS = ARTIFACTS;
const EFFECT_TEXT = { atk: 'Attack', def: 'Defence', pow: 'Power', know: 'Knowledge', morale: 'Morale', luck: 'Luck', move: 'movement', sight: 'sight', mana: 'max mana', regen: 'mana a day', income: 'auramite a day' };
const pct = v => `${Math.round(v * 100)}%`;
function effectParts(a) {
  const parts = [];
  for (const k in EFFECT_TEXT) if (a[k]) parts.push(`${a[k] > 0 ? '+' : ''}${k === 'move' ? a[k] / 100 : a[k]} ${EFFECT_TEXT[k]}`);
  if (a.spellDmg) parts.push(`spells +${pct(a.spellDmg)}`);
  if (a.archery) parts.push(`ranged damage +${pct(a.archery)}`);
  if (a.rough) parts.push(`rough terrain ${pct(a.rough)} easier`);
  if (a.enemyMorale) parts.push(`enemy morale -${a.enemyMorale}`);
  if (a.enemyLuck) parts.push(`enemy luck -${a.enemyLuck}`);
  if (a.pierce) parts.push(`attacks ignore ${pct(a.pierce)} of enemy defence`);
  if (a.lifesteal) parts.push(`troops heal ${pct(a.lifesteal)} of damage dealt`);
  if (a.regenTroops) parts.push(`troops regenerate ${pct(a.regenTroops)} each round`);
  if (a.noBadMorale) parts.push('troops never suffer bad morale');
  if (a.enemyRanged) parts.push(`enemy ranged damage -${pct(a.enemyRanged)}`);
  if (a.raise) parts.push(`${pct(a.raise)} of fallen troops return after a won battle`);
  if (a.spellCost) parts.push(`spells cost ${a.spellCost} less mana`);
  if (a.manaWeekly) parts.push('mana refills every week');
  if (a.revealWeekly) parts.push('reveals the whole map every week');
  if (a.learnSpell) parts.push(`teaches a level ${a.learnSpell} spell when found`);
  return parts;
}
export function artifactDesc(id) {
  const a = ARTIFACTS[id], parts = effectParts(a);
  if (a.set) { const S = SETS[a.set]; parts.push(`part of the ${S.name} (${S.pieces.length} pieces; all together: ${effectParts(S.bonus).join(', ')})`); }
  return parts.join(', ');
}
// set bonuses active on a commander
export const activeSets = h => Object.entries(SETS).filter(([, S]) => S.pieces.every(p => equipped(h).includes(p))).map(([k]) => k);
export const artifactsByRarity = r => Object.keys(ARTIFACTS).filter(k => ARTIFACTS[k].r === r);

// Adventure-map structures. art: sprite name after 'site_' (default: the kind). Rules:
// perHero: each commander once · weekly: once a week for anyone · heroWeekly: each commander once a week ·
// once: a single use, then spent · guarded: defenders must be beaten first (guard + reward rolled on the map).
export const SITES = {
  // ---- income and pickups ----
  turbine: { name: 'Atmospheric Processor', art: 'atmospheric_processor', weekly: true, desc: 'Yields a random resource once a week to whoever visits.' },
  geotap: { name: 'Geothermal Tap', art: 'geothermal_tap', weekly: true, desc: 'Yields 750 auramite once a week to whoever visits.' },
  glasshouse: { name: 'Hydroponic Glasshouse', art: 'hydroponic_glasshouse', weekly: true, desc: 'Yields 500 auramite or 2 of a rare material once a week.' },
  droppod: { name: 'Supply Drop Pod', art: 'supply_drop_pod', once: true, desc: 'A crashed supply pod: take its resources or study its data for experience.' },
  bivouac: { name: 'Abandoned Bivouac', art: 'abandoned_bivouac', once: true, desc: 'A deserted camp. Its stores hold auramite and materials.' },
  derelict: { name: 'Derelict Mining Complex', art: 'derelict_mining_complex', guarded: true, desc: 'Guarded. Once cleared it works as a mine for whoever claims it.' },
  // ---- army ----
  armoury: { name: 'Armoury Bastion', art: 'armoury_bastion', desc: 'Upgrade your troops here, away from any town, for the usual price.' },
  broker: { name: 'Mercenary Broker', art: 'mercenary_broker', desc: 'Sell one of your troop stacks for auramite.' },
  engineforge: { name: 'War Engine Forge', art: 'war_engine_forge', desc: 'Buy Bastion Dreadwalkers, rebuilt for any lord who pays. Two are ready each week.' },
  // ---- commander growth ----
  provinggrounds: { name: 'Weapons Proving Ground', art: 'weapons_proving_ground', perHero: true, desc: '+1 Attack to each commander who visits.' },
  watchtower: { name: 'Bastion Watchtower', art: 'bastion_watchtower', perHero: true, desc: '+1 Defence to each commander who visits.' },
  choir: { name: 'Psychic Choir Spire', art: 'psychic_choir_spire', perHero: true, desc: '+1 Power to each commander who visits.' },
  archive: { name: 'Archive of Revelation', art: 'archive_of_revelation', perHero: true, desc: '+1 Knowledge to each commander who visits.' },
  arena: { name: 'Gladiator Pit', art: 'gladiator_pit', perHero: true, desc: 'Each commander may fight here once: +2 Attack or +2 Defence.' },
  warcollege: { name: 'War College', art: 'war_college', perHero: true, desc: 'Pay 1,000 auramite for +1 Attack or +1 Defence (once per commander).' },
  sanctum: { name: 'Scholastic Sanctum', art: 'scholastic_sanctum', perHero: true, desc: 'Pay 1,000 auramite for +1 Power or +1 Knowledge (once per commander).' },
  librarium: { name: 'Grand Librarium', art: 'grand_librarium', perHero: true, desc: '+2 to every primary stat. Only commanders of level 10 or higher are let in.' },
  monolith: { name: 'Data-Monolith', art: 'data_monolith', perHero: true, desc: 'Each commander gains 1,000 experience, once.' },
  engine: { name: 'Ancient Thinking Engine', art: 'ancient_thinking_engine', perHero: true, desc: 'Each commander gains one level, once.' },
  hermit: { name: "Hermit's Hab", art: 'hermit_s_hab', perHero: true, desc: 'A recluse teaches one secondary skill to each commander.' },
  academy: { name: 'Scholam Academy', art: 'scholar_academy', desc: 'Buy secondary skills for 2,000 auramite each.' },
  scribe: { name: 'Wandering Tech-Scribe', art: 'wandering_tech_scribe', once: true, desc: 'Teaches the first commander to find him a stat, a skill or a spell.' },
  // ---- magic ----
  litany: { name: 'Shrine of the Litany', art: 'shrine_of_the_litany', desc: 'Teaches a level 1 spell.' },
  canticle: { name: 'Shrine of the Canticle', art: 'shrine_of_the_canticle', desc: 'Teaches a level 2 spell.' },
  revelation: { name: 'Shrine of Revelation', art: 'shrine_of_revelation', desc: 'Teaches a level 3 spell to commanders wise enough to learn it.' },
  pyramid: { name: 'Alien Tomb Pyramid', art: 'alien_tomb_pyramid', guarded: true, desc: 'Guarded. Within lies a forbidden spell of great power.' },
  voidfont: { name: 'Void Font', art: 'void_font', desc: 'Restores a commander\'s mana to full, once a day.' },
  riftspring: { name: 'Rift Spring', art: 'rift_spring', weekly: true, desc: 'Doubles the visiting commander\'s mana, once a week.' },
  // ---- movement, morale and luck (the next battle) ----
  motorpool: { name: 'Motor Pool', art: 'motor_pool', heroWeekly: true, desc: '+5 movement today, once a week per commander.' },
  reclamator: { name: 'Water Reclamator', art: 'water_reclamator', heroWeekly: true, desc: '+1 morale for the next battle and +3 movement.' },
  rally: { name: 'Rally Standard', art: 'rally_standard', heroWeekly: true, desc: '+1 morale and +1 luck for the next battle, and +3 movement.' },
  chapel: { name: 'Chapel of the Martyr', art: 'chapel_of_the_martyr', heroWeekly: true, desc: '+1 morale for the next battle (+2 on the seventh day).' },
  medicae: { name: 'Medicae Fountain', art: 'medicae_fountain', heroWeekly: true, desc: '+1 morale for the next battle and +3 movement.' },
  votive: { name: 'Votive Shrine', art: 'votive_shrine', heroWeekly: true, desc: 'A random luck blessing (-1 to +3) for the next battle.' },
  pool: { name: 'Contemplation Pool', art: 'contemplation_pool', heroWeekly: true, desc: '+2 luck for the next battle, but the commander rests for the day.' },
  // ---- sight and travel ----
  auspex: { name: 'Auspex Array', art: 'auspex_array', desc: 'Reveals the land for a long way around it.' },
  shroud: { name: 'Shroud Generator', art: 'shroud_generator', weekly: true, desc: 'Hides the surrounding land from every rival lord.' },
  obelisk: { name: 'Relic Obelisk', art: 'relic_obelisk', desc: 'Its carvings show where a buried relic lies.' },
  watcheye: { name: 'Watch Eye', art: 'watch_eye', desc: 'Shows the lands around distant structures.' },
  riftgate: { name: 'Teleportarium Gate', art: 'teleportarium_gate', desc: 'Step through to arrive beside its linked twin gate.' },
  keystation: { name: 'Key Codex Station', art: 'key_codex_station', desc: 'Grants a coloured key-codex that opens Sealed Blast Doors of the same colour.' },
  blastdoor: { name: 'Sealed Blast Door', art: 'sealed_blast_door', desc: 'A vault door. A commander carrying the matching key-codex can open it and claim the cache behind it.' },
  // ---- people and trade ----
  confessor: { name: "Confessor's Outpost", art: 'confessor_s_outpost', desc: 'A confessor sets a task and rewards whoever completes it.' },
  penal: { name: 'Penal Stockade', art: 'penal_stockade', desc: 'A captive commander waits to be freed and join your cause.' },
  trader: { name: 'Free Trader Post', art: 'free_trader_post', desc: 'Trade resources at fair rates, no Trade Exchange needed.' },
  smuggler: { name: "Smuggler's Den", art: 'smuggler_s_den', desc: 'Buy artifacts the smugglers have on offer.' },
  sanctuary: { name: 'Sanctuary Basilica', art: 'sanctuary_basilica', desc: 'A commander who rests here cannot be attacked until they move on.' },
  // ---- guarded treasuries ----
  brutes: { name: 'Brute Stockpile', art: 'brute_stockpile', guarded: true, desc: 'Guarded by mutant brutes. Holds a stockpile of resources.' },
  forgevault: { name: 'Forge Vault', art: 'forge_vault', guarded: true, desc: 'Guarded by servitors. Holds auramite and adamantium.' },
  rookery: { name: 'Kite Rookery', art: 'kite_rookery', guarded: true, desc: 'Guarded by Carrion Kites. Survivors may join you, with auramite.' },
  mawpit: { name: 'Maw Spawn Pit', art: 'maw_spawn_pit', guarded: true, desc: 'Guarded by Maw Spawn. Holds auramite and a rare material.' },
  basilisks: { name: 'Basilisk Stores', art: 'basilisk_stores', guarded: true, desc: 'Guarded by basilisks. Holds rare materials.' },
  serpent: { name: 'Serpent Vault', art: 'serpent_vault', guarded: true, desc: 'Guarded by chitin hunters. Holds auramite and rare materials.' },
  hive: { name: 'Swarm Hive', art: 'swarm_hive', guarded: true, desc: 'Guarded by a scuttler swarm. Holds a little treasure.' },
  wyrm: { name: 'Wyrm Sanctum', art: 'wyrm_sanctum', guarded: true, desc: 'Guarded by drakes. The richest hoard on the map: auramite and several artifacts.' },
  crypt: { name: 'Ossuary Crypt', art: 'ossuary_crypt', guarded: true, desc: 'Guarded by void spectres. Holds auramite and an artifact.' },
  frigate: { name: 'Crashed Frigate', art: 'crashed_frigate', guarded: true, desc: 'Guarded by raiders. Holds auramite, plasteel and an artifact.' },
  reliquary: { name: 'Sealed Reliquary', art: 'sealed_reliquary', guarded: true, desc: 'Something stirs inside. It may hold a great reward, or only a fight.' },
  cathedral: { name: 'Fallen Cathedral Treasury', art: 'fallen_cathedral_treasury', guarded: true, desc: 'Guarded by the Maw\'s champions. Holds auramite and a major artifact.' },
  // ---- older saves ----
  observatory: { name: 'Psionic Observatory', art: 'shrine_of_revelation', desc: 'Teaches each visiting commander one new spell and restores their mana.', perHero: true },
  citadel: { name: 'Creature Citadel', art: 'fallen_cathedral_treasury', desc: 'Guarded. Defeat the defenders for an artifact and auramite.', guarded: true },
  reactor: { name: 'Reactor Complex', art: 'basilisk_stores', desc: 'Guarded. Defeat the defenders for rare materials.', guarded: true },
  foundry: { name: 'War Foundry', art: 'forge_vault', desc: 'Guarded. Defeat the defenders for building materials.', guarded: true },
  shrine: { name: 'Experience Shrine', art: 'data_monolith', desc: 'Each commander gains 1,500 experience and learns a new skill, once.', perHero: true },
};
export const KEY_COLORS = { red: '#c8402e', blue: '#3f72c8', green: '#4fae4a', gold: '#d8b040' };
// Is a structure used up for this commander right now? (drawn dimmed, skipped by the AI)
export function siteSpent(o, h, day) {
  const S = SITES[o.kind], week = Math.floor((day - 1) / 7);
  if (S.guarded) return !!o.cleared && o.kind !== 'derelict';
  if (S.once || o.kind === 'penal') return !!(o.cleared || o.freed);
  if (S.weekly) return o.week === week;
  if (S.perHero) return !!h && o.visited.includes(h.id);
  if (S.heroWeekly) return !!h && (o.vw || {})[h.id] === week;
  if (o.kind === 'blastdoor' || o.kind === 'confessor') return !!o.cleared;
  return false;
}


export const MARKET = { sell: r => (RES_INFO[r].rare ? 250 : 125), buy: r => (RES_INFO[r].rare ? 1000 : 500) };
export const START_RES = { auramite: 10000, adamantium: 15, ceramite: 15, plasteel: 3, blackstone: 3, wraithbone: 3, psycrystal: 3 };

export const STAT_NAMES = { atk: 'Attack', def: 'Defence', pow: 'Power', know: 'Knowledge' };

export const equipped = h => (h.equip ? Object.values(h.equip).filter(Boolean) : []);
// Total of a stat from the hero and equipped artifacts (primary stats, morale, luck and artifact effects).
export function hstat(h, k) {
  let v = h[k] || 0;
  for (const id of equipped(h)) v += ARTIFACTS[id][k] || 0;
  for (const st of activeSets(h)) v += SETS[st].bonus[k] || 0;
  return v;
}
export const maxMana = h => Math.round((hstat(h, 'know') * 10) * (1 + skillValue(h, 'intelligence'))) + equipped(h).reduce((a, id) => a + (ARTIFACTS[id].mana || 0), 0);
export const maxMp = h => Math.round((DAY_MP + hstat(h, 'move')) * (1 + skillValue(h, 'logistics')));
export const heroSight = h => 5 + skillValue(h, 'scouting') + hstat(h, 'sight');
export const maxSpellLevel = h => Math.max(2, skillValue(h, 'wisdom'));
// Hero morale and luck before army effects, clamped later to -3..+3.
export const heroMorale = h => hstat(h, 'morale') + skillValue(h, 'leadership') + (h.tmp?.morale || 0);
export const heroLuck = h => hstat(h, 'luck') + skillValue(h, 'luck') + (h.tmp?.luck || 0);

export function xpForLevel(l) {
  let x = 0;
  for (let i = 2; i <= l; i++) x += 1000 + Math.max(0, i - 3) * 200;
  return x;
}

export function qtyWord(n) {
  if (n < 5) return 'A handful of';
  if (n < 10) return 'Several';
  if (n < 20) return 'A pack of';
  if (n < 50) return 'Many';
  if (n < 100) return 'A horde of';
  if (n < 250) return 'A throng of';
  return 'A vast swarm of';
}
