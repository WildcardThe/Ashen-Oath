// Adventure-map AI: builds, recruits, and sends commanders after the best nearby prize.
import { AI_LEVELS, FACTIONS, RES_INFO, SITES, MAX_HEROES, unitValue, HIRE_COST, siteSpent, maxMana, maxSpellLevel, MAX_SKILLS, UNITS } from './data.js';
import {
  G, isEnemy, computePaths, pathTo, moveHero, townsOf, heroesOf, armyStrength, objAt, heroAt,
  buildStatus, build, maxRecruit, recruit, hireHero, mergeGarrison, upgradeArmies,
} from './game.js';

const BUILD_PRIORITY = ['dw2', 'hall2', 'mg1', 'dw3', 'fort', 'dw1u', 'depot', 'dw2u', 'citadel', 'dw4', 'mg2', 'dw3u', 'hall3', 'castle', 'dw5', 'dw4u', 'mg3', 'dw5u', 'market', 'mg4', 'mg5'];

export async function aiTurn(pid) {
  const s = G.s, p = s.players[pid];
  const nh = heroesOf(pid).length;
  if ((nh === 0 && p.res.auramite >= HIRE_COST) || (nh < 3 && s.day >= 3 && p.res.auramite >= HIRE_COST + 1500)) {
    const t = townsOf(pid).find(t => t.built.tavern && !heroAt(t.x, t.y));
    if (t) hireHero(t);
  }
  for (const t of townsOf(pid)) aiTown(t);
  for (const h of heroesOf(pid)) {
    await aiHero(h);
    if (s.over) return;
  }
  for (const t of townsOf(pid)) {
    const h = heroAt(t.x, t.y);
    if (h && h.owner === pid) mergeGarrison(t, h);
  }
}

function aiTown(t) {
  const p = G.s.players[t.owner];
  for (const id of BUILD_PRIORITY) {
    if (buildStatus(t, id, p.res) === 'ok') { build(t, id); break; }
  }
  const h = heroAt(t.x, t.y);
  const army = h && h.owner === t.owner ? h.army : t.garrison;
  const us = FACTIONS[t.faction].units;
  for (let i = us.length - 1; i >= 0; i--) {
    const n = maxRecruit(t, us[i], p.res);
    if (n > 0) recruit(t, us[i], n, army);
  }
  if (h && h.owner === t.owner) { mergeGarrison(t, h); upgradeArmies(t, [h.army]); }
  else upgradeArmies(t, [t.garrison]);
}

async function aiHero(h) {
  const s = G.s;
  for (let iter = 0; iter < 25; iter++) {
    if (!s.heroes[h.id] || s.over) return;
    const paths = computePaths(h);
    const target = pickTarget(h, paths);
    if (!target) return;
    const path = pathTo(paths, target.x, target.y);
    if (!path || !path.length || path[0].step > h.mp) return;
    const before = h.mp;
    const tgt = objAt(target.x, target.y);
    await moveHero(h, path);
    if (!s.heroes[h.id]) return;
    // remember structures already tried, so a commander never shuttles back to one that gave nothing
    if (tgt && tgt.type === 'site') (h.aiSeen = h.aiSeen || {})[tgt.id] = s.day;
    const here = objAt(h.x, h.y);
    if (here && here.type === 'town' && here.owner === h.owner) mergeGarrison(here, h);
    if (h.mp === before) return;
  }
}

function pickTarget(h, paths) {
  const s = G.s, W = s.W;
  const my = armyStrength(h.army, h);
  let best = null, bs = 0;
  const consider = (x, y, val) => {
    const d = paths.dist[y * W + x];
    if (!isFinite(d) || val <= 0) return;
    const sc = val / (d + 300);
    if (sc > bs) { bs = sc; best = { x, y }; }
  };
  for (const o of Object.values(s.objects)) {
    switch (o.type) {
      case 'pile': consider(o.x, o.y, o.amount * RES_INFO[o.res].value * 0.6 + 200); break;
      case 'chest': consider(o.x, o.y, 900); break;
      case 'relic': consider(o.x, o.y, 1600); break;
      case 'mine': if (o.owner !== h.owner && isEnemy(o.owner, h.owner)) consider(o.x, o.y, RES_INFO[o.res].rare ? 2600 : 2000); break;
      case 'site': {
        const S = SITES[o.kind], p = s.players[h.owner];
        if (o.kind === 'riftgate' || o.kind === 'broker' || o.kind === 'trader' || o.kind === 'sanctuary' || o.kind === 'confessor') break;
        if (siteSpent(o, h, s.day)) {
          if (o.kind === 'derelict' && o.owner !== h.owner) consider(o.x, o.y, 2200);
          break;
        }
        if (o.kind === 'derelict' && o.cleared) { if (o.owner !== h.owner) consider(o.x, o.y, 2200); break; }
        if (o.kind === 'penal') { if (heroesOf(h.owner).length < MAX_HEROES) consider(o.x, o.y, 3000); break; }
        if (o.kind === 'blastdoor') { if ((p.keys || []).includes(o.color)) consider(o.x, o.y, 3000); break; }
        if (o.kind === 'keystation') { if (!(p.keys || []).includes(o.color)) consider(o.x, o.y, 1200); break; }
        if (S.guarded) {
          const gs = o.guard.count * unitValue(o.guard.unit);
          if (my > gs * 1.6) consider(o.x, o.y, 2200 + gs * 0.3);
          break;
        }
        if (!S.guarded && h.aiSeen && s.day - (h.aiSeen[o.id] ?? -99) < 7) break;
        const lvl = { litany: 1, canticle: 2, revelation: 3 }[o.kind];
        if (lvl && (h.spells.includes(o.spell) || maxSpellLevel(h) < lvl)) break;
        if (o.kind === 'hermit' && (h.skills[o.skill] || Object.keys(h.skills).length >= MAX_SKILLS)) break;
        if (o.kind === 'academy' && Object.keys(h.skills).length >= MAX_SKILLS) break;
        if (o.kind === 'smuggler' && o.stock && !o.stock.length) break;
        if (o.kind === 'armoury' && !h.army.some(st => st && UNITS[st.type].upgrade)) break;
        if (o.kind === 'voidfont' && h.mana >= maxMana(h) * 0.8) break;
        if (o.kind === 'librarium' && h.level < 10) break;
        if (/^(warcollege|sanctum|academy|engineforge|smuggler|armoury)$/.test(o.kind) && p.res.auramite < 6000) break;
        const VAL = { arena: 1800, librarium: 3000, engine: 2400, monolith: 1600, provinggrounds: 1400, watchtower: 1400, choir: 1200, archive: 1200,
          turbine: 700, geotap: 600, glasshouse: 600, droppod: 1000, bivouac: 800, scribe: 1400, litany: 900, canticle: 1100, revelation: 1300 };
        consider(o.x, o.y, VAL[o.kind] || 600);
        break;
      }
      case 'monster': {
        const ms = o.count * unitValue(o.unit);
        if (my > ms * 1.6) consider(o.x, o.y, 400 + ms * 0.3);
        break;
      }
      case 'town': {
        const vh = heroAt(o.x, o.y);
        const AL = AI_LEVELS[s.aiLevel ?? 1] || AI_LEVELS[1];
        if (o.owner !== h.owner && !isEnemy(o.owner, h.owner)) break;
        if (o.owner !== h.owner) {
          const ds = armyStrength(o.garrison, null) + (vh ? armyStrength(vh.army, vh) : 0);
          if (s.day >= AL.attackDay && my > ds * AL.ratio) consider(o.x, o.y, 8000);
        } else if (!vh) {
          const gs = armyStrength(o.garrison, null);
          if (gs > 0) consider(o.x, o.y, 500 + gs * 0.8);
        }
        break;
      }
    }
  }
  for (const e of Object.values(s.heroes)) {
    if (e.owner === h.owner || e.safe || !isEnemy(e.owner, h.owner)) continue;
    const t = objAt(e.x, e.y);
    if (t && t.type === 'town') continue;
    const es = armyStrength(e.army, e);
    if (my > es * 1.4) consider(e.x, e.y, 3000 + es * 0.5);
  }
  return best;
}
