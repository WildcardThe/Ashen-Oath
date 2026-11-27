import { generateMap, MINE_FOOT, TOWN_FOOT } from '/home/user/ashen-oath/src/map.js';
import { SITES } from '/home/user/ashen-oath/src/data.js';
import fs from 'fs';
const out = [];
for (const [tpl, size] of [['duel', 'S'], ['duel', 'M'], ['duel', 'L'], ['crossroads', 'M'], ['crossroads', 'L'], ['crossroads', 'XL']]) for (let seed = 1; seed <= 4; seed++) {
  const m = generateMap(seed * 7717, { template: tpl, size, homeGround: [0, 6] });
  const N = m.W, T = m.tiles;
  const objs = [];
  for (const t of m.towns) objs.push({ cat: 'town', visit: [t.x, t.y], foot: TOWN_FOOT.map(([dx, dy]) => [t.x + dx, t.y + dy]) });
  for (const o of m.objects) {
    const cat = o.type === 'site' ? (SITES[o.kind].guarded ? 'bank' : 'site') : o.type === 'relic' ? 'art' : o.type === 'tower' ? 'site' : o.type;
    const foot = (o.type === 'site' || o.type === 'mine') ? MINE_FOOT.map(([dx, dy]) => [o.x + dx, o.y + dy]) : [];
    objs.push({ cat, visit: [o.x, o.y], foot, res: o.res });
  }
  out.push({ map: `${tpl}-${size}-${seed}`, N, land: T.map(t => t.t !== 5), road: T.map(t => !!t.road), obst: T.map(t => t.t === 4 || !!t.blk), terr: T.map(t => t.t), objs });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log(out.length);
