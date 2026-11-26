// Painted rite animations: 5x5 sheets (assets/fx/<id>.webp, black background drawn with additive
// blending). Each rite lists what plays when it is invoked:
//   proj  - a sheet that flies from the caster's edge of the field to the target (looping frames)
//   fall  - a sheet that falls onto each target from above (meteors)
//   hit   - an impact on every stack the rite damages
//   on    - a one-shot on the target stack(s) of a blessing or curse
//   at    - a one-shot on the target hex (area rites, barricades)
//   aura  - a sheet looping faintly over the stack while the rite's effect lasts
//   summon- a one-shot where a summoned or cloned stack appears
const img = {};
export function sheet(id) {
  if (!img[id]) { const im = new Image(); im.src = `assets/fx/${id}.webp`; img[id] = im; }
  return img[id].complete && img[id].naturalWidth ? img[id] : null;
}
export const RITE_FX = {
  ember: { proj: 'firebolt', hit: 'firehit' }, fury: { on: 'rage', aura: 'rage' }, frenzy: { on: 'rage', aura: 'rage' }, slayer: { on: 'rage', aura: 'rage' },
  curse: { on: 'curse' }, misfortune: { on: 'curse' }, blind: { on: 'curse' },
  wardwater: { on: 'fireshield', aura: 'fireshield' }, pyreaegis: { on: 'fireshield', aura: 'fireshield' },
  fireburst: { at: 'explosion' }, inferno: { at: 'pillar', hit: 'explosion' }, exterminatus: { fall: 'meteor', hit: 'pillar' },
  cataclysm: { fall: 'meteor', hit: 'explosion' }, sumfire: { summon: 'sumfire' },
  stoneskin: { on: 'stone' }, bulwark: { on: 'stone' }, voidward: { on: 'stone' }, slow: { on: 'gravity', aura: 'gravity' },
  deathknell: { hit: 'deathring' }, despair: { on: 'deathring' }, raise: { on: 'necrotic' }, resurrect: { on: 'heal' },
  nullfield: { on: 'nullfield', aura: 'nullfield' }, wardair: { on: 'nullfield', aura: 'nullfield' },
  tremor: { gate: 'debris' }, barricade: { at: 'barrier' }, debris: { at: 'debris' }, collapse: { hit: 'collapse' }, sumearth: { summon: 'sumearth' },
  mend: { on: 'heal' }, tide: { on: 'heal' }, bless: { on: 'halo' }, hymn: { on: 'halo' }, prayer: { on: 'halo' }, fate: { on: 'halo' },
  dispel: { on: 'water' }, wardfire: { on: 'water' }, withering: { on: 'water' }, mindwipe: { on: 'water' }, clearfield: { at: 'water' },
  frost: { proj: 'icespear', hit: 'iceimpact' }, hoarfrost: { at: 'icespikes', hit: 'iceimpact' }, clone: { summon: 'mirror' }, sumwater: { summon: 'mirror' },
  haste: { on: 'wind', aura: 'wind' }, tailwind: { on: 'wind', aura: 'wind' }, precision: { on: 'wind', aura: 'wind' },
  arc: { hit: 'lightning' }, banish: { hit: 'lightning' }, chainstorm: { hit: 'lightning' }, lance: { hit: 'beam' },
  refractor: { on: 'bubble', aura: 'bubble' }, mirror: { on: 'bubble', aura: 'bubble' }, reflex: { on: 'bubble', aura: 'bubble' },
  sumair: { summon: 'tornado' },
};
// size (in hex radii) and anchor: 'feet' sheets stand on the ground, 'mid' sheets centre on the body
export const FX_LOOK = {
  firebolt: [1.8, 'mid'], icespear: [2, 'mid'], meteor: [2.4, 'mid'], firehit: [2.8, 'mid'], explosion: [4.6, 'mid'], pillar: [3.6, 'feet'],
  rage: [2.8, 'feet'], fireshield: [2.9, 'mid'], curse: [2.4, 'top'], sumfire: [4.2, 'feet'], stone: [2.8, 'feet'], gravity: [2.8, 'ground'],
  deathring: [3.6, 'ground'], necrotic: [2.8, 'feet'], nullfield: [2.9, 'mid'], debris: [4.2, 'feet'], collapse: [3.2, 'mid'], barrier: [2.6, 'feet'],
  sumearth: [4.2, 'feet'], heal: [2.8, 'feet'], iceimpact: [2.8, 'mid'], icespikes: [4.6, 'ground'], halo: [2.8, 'feet'], water: [2.8, 'feet'],
  mirror: [3.4, 'feet'], lightning: [3.4, 'feet'], beam: [3.6, 'feet'], wind: [2.8, 'feet'], bubble: [2.9, 'mid'], tornado: [4.2, 'feet'],
};
for (const id in FX_LOOK) sheet(id);   // start loading

// Draw one frame of a sheet at a pixel point; anchor decides which part of the cell sits on the point.
export function drawFx(g, id, x, y, r, frame, alpha = 1, angle = 0, sizeMul = 1) {
  const im = sheet(id); if (!im) return;
  const [sz, anchor] = FX_LOOK[id] || [3, 'mid'];
  const s = sz * r * sizeMul, cw = im.naturalWidth / 5, f = Math.max(0, Math.min(24, frame | 0));
  const oy = anchor === 'feet' ? -s * 0.86 : anchor === 'top' ? -s * 1.05 : -s / 2;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha;
  g.translate(x, y); if (angle) g.rotate(angle);
  g.drawImage(im, (f % 5) * cw, Math.floor(f / 5) * cw, cw, cw, -s / 2, angle ? -s / 2 : oy, s, s);
  g.restore();
}
