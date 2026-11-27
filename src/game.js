// Adventure-layer game state and rules. UI talks to the player through the `io` hooks.
import {
  TERRAIN, UNITS, FACTIONS, BUILDINGS, RES_INFO, MINES, ARTIFACTS, PLAYER_COLORS, DAY_MP, TOWN_SIGHT,
  HIRE_COST, MAX_HEROES, MARKET, AI_LEVELS, ROAD_COST, RES, START_RES, unitValue, hstat, maxMana, maxMp, xpForLevel, buildingCost,
  HERO_DEFS, SKILLS, MAX_SKILLS, SPELLS, SITES, KEY_COLORS, STAT_NAMES, artifactsByRarity, SLOTS, slotsFor, skillLevel, skillValue, heroSight, maxSpellLevel, equipped,
} from './data.js';
import { generateMap, Heap, DIRS8, mulberry32, TOWN_FOOT, MINE_FOOT } from './map.js';
import { createBattle, autoBattle, finishBattle } from './combat.js';
import { aiTurn } from './ai.js';

export const G = { s: null };
export const io = {};
const objIndex = new Map();
const guardSet = new Set();

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- indexing ----------
// Tiles covered by a town, mine or structure graphic point back to the object, so clicking the picture works.
const footIndex = new Map();
export function rebuildIndex() {
  objIndex.clear(); footIndex.clear();
  for (const o of Object.values(G.s.objects)) {
    objIndex.set(o.y * G.s.W + o.x, o.id);
    const foot = o.type === 'town' ? TOWN_FOOT : (o.type === 'mine' || o.type === 'site') ? MINE_FOOT : null;
    if (foot) for (const [dx, dy] of foot) footIndex.set((o.y + dy) * G.s.W + o.x + dx, o.id);
  }
  rebuildGuards();
}
function rebuildGuards() {
  guardSet.clear();
  const s = G.s;
  for (const o of Object.values(s.objects)) if (o.type === 'monster') {
    for (const [dx, dy] of DIRS8) {
      const x = o.x + dx, y = o.y + dy;
      if (x >= 0 && y >= 0 && x < s.W && y < s.H) guardSet.add(y * s.W + x);
    }
  }
}
export const objAt = (x, y) => { const id = objIndex.get(y * G.s.W + x); return id ? G.s.objects[id] : null; };
export const footAt = (x, y) => { const id = footIndex.get(y * G.s.W + x); return id ? G.s.objects[id] : null; };
export const heroAt = (x, y) => Object.values(G.s.heroes).find(h => h.x === x && h.y === y) || null;
export function isGuarded(i) {
  if (!guardSet.has(i)) return false;
  const id = objIndex.get(i);
  return !(id && G.s.objects[id].type === 'monster');
}
export function guardingMonster(x, y) {
  for (const [dx, dy] of DIRS8) { const o = objAt(x + dx, y + dy); if (o && o.type === 'monster') return o; }
  return null;
}
function addObj(o) {
  o.id = G.s.nextId++; G.s.objects[o.id] = o; objIndex.set(o.y * G.s.W + o.x, o.id);
  if (o.type === 'monster') rebuildGuards();
  return o;
}
export function removeObj(o) {
  delete G.s.objects[o.id]; objIndex.delete(o.y * G.s.W + o.x);
  if (o.type === 'monster') rebuildGuards();
}

// lords on the same team never fight; neutral (null) is everyone's enemy
export const teamOf = pid => (pid == null ? null : G.s.players[pid]?.team ?? pid);
export const isEnemy = (a, b) => a !== b && (a == null || b == null || teamOf(a) !== teamOf(b));
export const heroesOf = pid => Object.values(G.s.heroes).filter(h => h.owner === pid);
export const townsOf = pid => Object.values(G.s.objects).filter(o => o.type === 'town' && o.owner === pid);
export const isHuman = pid => pid != null && G.s.players[pid] && G.s.players[pid].human;

function message(text, pid) {
  if (pid == null || isHuman(pid)) io.message?.(text, pid);
}

// ---------- new game ----------
const rnd0 = Math.random;
export const HOME_GROUND = { concord: 0, hollow: 6, rustbound: 7, scrapjaw: 1, deathless: 3, palefang: 2 };
// cfg.players: [{ faction, human, team, commander, bonus }] (row order = colour order); older calls pass a faction
export function newGame(cfg) {
  let { faction, seed = (Math.random() * 1e9) | 0, template = 'duel', size = 'M', aiLevel = 1, monsters = 1, treasure = 1, terrain = 'mixed', startRes = 1, weekEvents = true } = cfg;
  const pick1 = a => a[Math.floor(rnd0() * a.length)], FKEYS = Object.keys(FACTIONS);
  let cfgP = cfg.players;
  if (!cfgP) {   // the rival is one of the other factions
    const others = FKEYS.filter(f => f !== faction);
    cfgP = [{ faction, human: true, team: 0 }, { faction: pick1(others), human: false, team: 1 }];
  }
  cfgP = cfgP.map((q, i) => ({ ...q, faction: FACTIONS[q.faction] ? q.faction : pick1(FKEYS), team: q.team ?? i }));
  // each homeland is the native ground of its faction
  const m = generateMap(seed, { template, size, players: cfgP.length, monsters, treasure, terrain, homeGround: cfgP.map(q => HOME_GROUND[q.faction]) });
  const AL = AI_LEVELS[aiLevel] || AI_LEVELS[1];
  // each lord's commander pool: its own faction's commanders first, then the others (as a tavern offers any)
  const mk = (id, q) => ({
    id, human: !!q.human, faction: q.faction, team: q.team, name: q.human ? q.name || 'You' : FACTIONS[q.faction].name, color: q.color || PLAYER_COLORS[id % PLAYER_COLORS.length],
    res: Object.fromEntries(Object.entries(START_RES).map(([k, v]) => [k, Math.round(v * startRes * (q.human ? 1 : AL.start))])),
    explored: new Array(m.W * m.H).fill(0), pool: [...shuffle(FACTIONS[q.faction].heroes.slice()), ...shuffle(Object.values(FACTIONS).filter(F => F !== FACTIONS[q.faction]).flatMap(F => F.heroes))], retreated: [], alive: true,
  });
  G.s = {
    version: 4, template, seed, W: m.W, H: m.H, tiles: m.tiles, scenery: m.scenery, rivers: m.rivers || [], objects: {}, nextId: 1, heroes: {}, day: 1, current: 0, over: null,
    aiLevel, weekEvents, players: cfgP.map((q, i) => mk(i, q)),
  };
  objIndex.clear(); guardSet.clear();
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  m.towns.forEach((t, i) => {
    const f = t.owner === null ? Object.keys(FACTIONS)[Math.floor(rnd() * Object.keys(FACTIONS).length)] : G.s.players[t.owner].faction;
    const names = FACTIONS[f].townNames;
    const town = addObj({
      type: 'town', x: t.x, y: t.y, owner: t.owner, faction: f, name: names[i % names.length],
      built: { dw1: true, tavern: true, fort: true }, avail: {}, garrison: Array(7).fill(null), builtToday: false, guild: rollGuild(rnd),
    });
    if (t.owner === null) {
      town.built.dw2 = true; town.built.dw3 = true; town.built.fort = true; town.built.mg1 = true;
      const us = FACTIONS[f].units;
      town.garrison[0] = { type: us[0], count: 34 };
      town.garrison[1] = { type: us[1], count: 12 };
      town.garrison[2] = { type: us[2], count: 6 };
      town.garrison[3] = { type: us[1], count: 10 };
    }
    weeklyGrowth(town);
  });
  for (const o of m.objects) addObj({ ...o });
  for (const p of G.s.players) {
    const town = townsOf(p.id)[0], q = cfgP[p.id];
    const h = createHero(p.id, town.x, town.y, { starter: true, pick: q.commander && q.commander !== 'random' ? q.commander : null });
    if (!p.human) for (const st of h.army) if (st) st.count = Math.max(1, Math.round(st.count * AL.army));
    // starting bonus
    const bonus = !q.bonus || q.bonus === 'random' ? pick1(['gold', 'art', 'res']) : q.bonus;
    if (bonus === 'gold') p.res.auramite += 2500;
    if (bonus === 'art') giveArtifact(h, pick1(artifactsByRarity('T')));
    if (bonus === 'res') { p.res.adamantium += 6; p.res.ceramite += 6; for (const r of FACTIONS[p.faction].rares) p.res[r] += 3; }
    p.bonus = bonus;
    reveal(p.id, town.x, town.y, TOWN_SIGHT);
  }
  rebuildIndex();
  G.s.weekEvent = { type: 'plain', title: 'Week of the First Oath', desc: 'The campaign begins.', week: 1, seen: true };
}

export function loadState(state) { G.s = state; rebuildIndex(); }

// Each town's psy-sanctum offers a random selection of spells per level.
const GUILD_SLOTS = [0, 3, 3, 2, 2, 1];
function rollGuild(rnd) {
  const g = {};
  for (let l = 1; l <= 5; l++) {
    const pool = Object.keys(SPELLS).filter(k => SPELLS[k].level === l);
    pool.sort(() => rnd() - 0.5);
    g[l] = pool.slice(0, GUILD_SLOTS[l]);
  }
  return g;
}
export const guildLevel = t => (t.built.mg5 ? 5 : t.built.mg4 ? 4 : t.built.mg3 ? 3 : t.built.mg2 ? 2 : t.built.mg1 ? 1 : 0);
export function guildSpells(t) { const out = []; for (let l = 1; l <= guildLevel(t); l++) out.push(...(t.guild?.[l] || [])); return out; }
function learnFromGuild(h, t) {
  const before = h.spells.length;
  for (const sp of guildSpells(t)) if (SPELLS[sp].level <= maxSpellLevel(h) && !h.spells.includes(sp)) h.spells.push(sp);
  if (guildLevel(t)) h.mana = Math.max(h.mana, maxMana(h));
  return h.spells.length - before;
}

// ---------- heroes ----------
export function createHero(pid, x, y, opts = {}) {
  const s = G.s, p = s.players[pid];
  // a chosen commander (Recruitment Office), else the next one in line; nobody serves two lords at once
  const serving = new Set(Object.values(s.heroes).map(x => x.name));
  let h = null;
  if (opts.pick) { const i = p.retreated.findIndex(x => x.name === opts.pick); if (i >= 0) h = p.retreated.splice(i, 1)[0]; }
  else if (p.retreated.length) h = p.retreated.shift();
  const us = FACTIONS[p.faction].units;
  if (!h) {
    let name = null;
    if (opts.pick && p.pool.includes(opts.pick)) { name = opts.pick; p.pool.splice(p.pool.indexOf(name), 1); }
    while (!name && p.pool.length) { const n = p.pool.shift(); if (!serving.has(n)) name = n; }
    name = name || `Commander ${s.nextId}`;
    const f = p.faction;
    const def = HERO_DEFS[name] || { cls: 'might', skill: 'offense', spell: 'ember', spec: { type: 'none' } };
    const base = def.cls === 'magic' ? { atk: 0, def: 0, pow: 2, know: 2 } : { atk: 2, def: 2, pow: 1, know: 1 };
    h = {
      id: s.nextId++, name, owner: pid, faction: f, cls: def.cls, ...base, morale: 0, luck: 0, xp: 0, level: 1, mana: 0, mp: 0,
      army: Array(7).fill(null), spells: [def.spell], skills: { [def.skill]: 1 }, equip: {}, backpack: [],
    };
    if (opts.starter) {
      h.army[0] = { type: us[0], count: ri(16, 22) };
      h.army[1] = { type: us[1], count: ri(3, 5) };
      h.army[2] = { type: us[0], count: ri(6, 10) };
    } else {
      h.army[0] = { type: us[0], count: ri(8, 14) };
    }
  } else {
    h.army = Array(7).fill(null);
    h.army[0] = { type: us[0], count: 8 };
  }
  h.x = x; h.y = y; h.owner = pid;
  h.mp = maxMp(h); h.mana = maxMana(h);
  s.heroes[h.id] = h;
  reveal(pid, x, y, heroSight(h));
  return h;
}

export function reveal(pid, x, y, r) {
  const s = G.s, team = s.players[pid].team;
  // allies share what they uncover; players on other sides must discover each other themselves
  const maps = s.players.filter(q => q.id === pid || (team != null && q.team === team)).map(q => q.explored);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.W || ny >= s.H) continue;
    if (dx * dx + dy * dy <= r * r + r) for (const ex of maps) ex[ny * s.W + nx] = 1;
  }
  io.fogChanged?.();
}

// ---------- economy ----------
export const townIncome = t => (t.built.hall3 ? 2000 : t.built.hall2 ? 1000 : 500);
export function dailyIncome(pid) {
  const r = Object.fromEntries(RES.map(k => [k, 0]));
  for (const o of Object.values(G.s.objects)) {
    if (o.owner !== pid) continue;
    if (o.type === 'town') r.auramite += townIncome(o);
    else if (o.type === 'mine' || (o.type === 'site' && o.kind === 'derelict' && o.cleared)) r[o.res] += MINES[o.res].yield;
  }
  for (const h of Object.values(G.s.heroes)) {
    if (h.owner !== pid) continue;
    r.auramite += skillValue(h, 'estates') + hstat(h, 'income');
    const d = HERO_DEFS[h.name]; if (d && d.spec.type === 'income') r.auramite += d.spec.amount;
  }
  // AI lords' income follows the chosen AI level
  const p = G.s.players[pid];
  if (p && !p.human && G.s.aiLevel != null) { const k = AI_LEVELS[G.s.aiLevel].income; for (const key in r) r[key] = Math.round(r[key] * k); }
  return r;
}
export function canAfford(res, cost, n = 1) { return Object.entries(cost).every(([k, v]) => res[k] >= v * n); }
function pay(res, cost, n = 1) { for (const [k, v] of Object.entries(cost)) res[k] -= v * n; }

export const growthMult = t => 1 + (t.built.depot ? 0.5 : 0) + (t.built.citadel ? 0.5 : 0) + (t.built.castle ? 0.5 : 0);
function weeklyGrowth(t) {
  const us = FACTIONS[t.faction].units;
  for (let tier = 1; tier <= 5; tier++) {
    if (!t.built['dw' + tier]) continue;
    const u = us[tier - 1];
    let n = Math.floor(UNITS[u].growth * growthMult(t));
    const ev = G.s.weekEvent;
    if (ev && ev.type === 'unit' && ev.unit === u) n += UNITS[u].tier >= 4 ? 2 : 5;
    if (ev && ev.type === 'famine') n = Math.ceil(n / 2);
    if (t.owner === null) addToArmy(t.garrison, u, n);
    else t.avail[u] = (t.avail[u] || 0) + n;
  }
}

export function buildStatus(t, id, res) {
  if (t.built[id]) return 'built';
  const b = BUILDINGS[id];
  if (b.req.some(r => !t.built[r])) return 'req';
  if (t.builtToday) return 'today';
  if (!canAfford(res, buildingCost(t.faction, id))) return 'cost';
  return 'ok';
}
export function build(t, id) {
  const p = G.s.players[t.owner];
  if (buildStatus(t, id, p.res) !== 'ok') return false;
  pay(p.res, buildingCost(t.faction, id));
  t.built[id] = true; t.builtToday = true;
  const tier = BUILDINGS[id].tier;
  if (tier) { const u = FACTIONS[t.faction].units[tier - 1]; t.avail[u] = (t.avail[u] || 0) + UNITS[u].growth; }
  return true;
}
// The unit a town actually musters from a base unit's pool (upgraded once its dwelling is upgraded).
export function recruitType(t, u) {
  return t.built['dw' + UNITS[u].tier + 'u'] ? UNITS[u].upgrade : u;
}
export function maxRecruit(t, u, res) {
  let n = t.avail[u] || 0;
  for (const [k, v] of Object.entries(UNITS[recruitType(t, u)].cost)) if (v > 0) n = Math.min(n, Math.floor(res[k] / v));
  return Math.max(0, n);
}
export function recruit(t, u, n, army) {
  const p = G.s.players[t.owner], type = recruitType(t, u);
  if (n <= 0 || n > maxRecruit(t, u, p.res)) return false;
  if (!addToArmy(army, type, n)) return false;
  pay(p.res, UNITS[type].cost, n);
  t.avail[u] -= n;
  return true;
}
// Cost to upgrade one unit of `type` in this town, or null if not possible here.
export function upgradeCostEach(t, type) {
  const U = UNITS[type];
  if (!U || !U.upgrade || U.faction !== t.faction || !t.built['dw' + U.tier + 'u']) return null;
  const up = UNITS[U.upgrade].cost, out = {};
  for (const k of new Set([...Object.keys(up), ...Object.keys(U.cost)])) out[k] = Math.max(0, (up[k] || 0) - (U.cost[k] || 0));
  return out;
}
export function upgradeQuote(t, armies) {
  const total = Object.fromEntries(RES.map(k => [k, 0])); let count = 0;
  for (const army of armies) for (const st of army) {
    const c = st && upgradeCostEach(t, st.type); if (!c) continue;
    count += st.count; for (const k in c) total[k] += c[k] * st.count;
  }
  return { total, count };
}
// Upgrades as many stacks as the treasury allows (whole stacks first, then a partial stack).
export function upgradeArmies(t, armies) {
  const p = G.s.players[t.owner]; let done = 0;
  for (const army of armies) for (let i = 0; i < army.length; i++) {
    const st = army[i]; const c = st && upgradeCostEach(t, st.type); if (!c) continue;
    let n = st.count;
    for (const [k, v] of Object.entries(c)) if (v > 0) n = Math.min(n, Math.floor(p.res[k] / v));
    if (n <= 0) continue;
    pay(p.res, c, n);
    const up = UNITS[st.type].upgrade;
    if (n === st.count) army[i] = { type: up, count: n };
    else { st.count -= n; if (!addToArmy(army, up, n)) { st.count += n; for (const [k, v] of Object.entries(c)) p.res[k] += v * n; continue; } }
    done += n;
  }
  return done;
}
export function addToArmy(army, type, count) {
  let i = army.findIndex(s => s && s.type === type);
  if (i < 0) i = army.findIndex(s => !s);
  if (i < 0) return false;
  if (army[i]) army[i].count += count; else army[i] = { type, count };
  return true;
}
export function nextHireName(pid) { return hireOffers(pid)[0] || 'a new commander'; }
// the two commanders the Recruitment Office offers: retreated commanders first, then the pool,
// never one already serving any lord
export function hireOffers(pid) {
  const p = G.s.players[pid], serving = new Set(Object.values(G.s.heroes).map(x => x.name));
  return [...new Set([...p.retreated.map(x => x.name), ...p.pool])].filter(n => !serving.has(n)).slice(0, 2);
}
export function canHire(t) {
  const p = G.s.players[t.owner];
  return t.built.tavern && !heroAt(t.x, t.y) && p.res.auramite >= HIRE_COST && heroesOf(t.owner).length < MAX_HEROES;
}
export function hireHero(t, pick = null) {
  if (!canHire(t)) return null;
  G.s.players[t.owner].res.auramite -= HIRE_COST;
  const h = createHero(t.owner, t.x, t.y, pick ? { pick } : {});
  enterOwnTown(h, t);
  return h;
}
export function trade(pid, res, qty) {
  const p = G.s.players[pid];
  if (qty > 0) { const cost = MARKET.buy(res) * qty; if (p.res.auramite < cost) return false; p.res.auramite -= cost; p.res[res] += qty; }
  else { const n = -qty; if (p.res[res] < n) return false; p.res[res] -= n; p.res.auramite += MARKET.sell(res) * n; }
  return true;
}

export function armyStrength(army, hero) {
  let v = 0;
  for (const st of army) if (st) v += st.count * unitValue(st.type);
  if (hero) v *= 1 + 0.05 * (hstat(hero, 'atk') + hstat(hero, 'def'));
  return v;
}

// ---------- movement ----------
export const passable = T => TERRAIN[T.t].pass && !T.blk;
// Rough-terrain reduction from Pathfinding or boots (0..1).
export const roughCut = h => (h ? Math.max(skillValue(h, 'pathfinding'), hstat(h, 'rough')) : 0);
// Map rites that open ground for the day: acid pools (Walk the Toxic Shallows), and obstacles and
// pools alike (Jump-Pack Ascension). Footprints of towns and structures stay closed.
const flying = h => h && h.flyDay === G.s.day, wading = h => h && h.walkDay === G.s.day;
export function passableFor(h, T) {
  if (passable(T)) return true;
  if (T.blk) return false;
  return (T.t === 5 && (wading(h) || flying(h))) || (T.t === 4 && flying(h));
}
export function stepCost(fromI, toI, h = null) {
  const s = G.s, tf = s.tiles[fromI], tt = s.tiles[toI];
  const diag = (fromI % s.W) !== (toI % s.W) && Math.floor(fromI / s.W) !== Math.floor(toI / s.W);
  let base = tf.road && tt.road ? ROAD_COST : TERRAIN[tt.t].pass ? TERRAIN[tt.t].cost : 125;
  if (flying(h)) base = Math.min(base, 100);
  if (base > 100) base = 100 + (base - 100) * (1 - roughCut(h));
  return Math.round(base * (diag ? 1.414 : 1));
}

export function computePaths(hero, explored = null) {
  const s = G.s, N = s.W * s.H;
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const start = hero.y * s.W + hero.x;
  dist[start] = 0;
  const hp = new Heap(); hp.push(start, 0);
  const heroIdx = new Map();
  for (const h of Object.values(s.heroes)) heroIdx.set(h.y * s.W + h.x, h);
  while (hp.size) {
    const u = hp.pop();
    if (done[u]) continue; done[u] = 1;
    if (u !== start && (objIndex.has(u) || heroIdx.has(u))) continue;
    const guardedU = u !== start && isGuarded(u);
    const ux = u % s.W, uy = (u / s.W) | 0;
    for (const [dx, dy] of DIRS8) {
      const x = ux + dx, y = uy + dy;
      if (x < 0 || y < 0 || x >= s.W || y >= s.H) continue;
      const v = y * s.W + x;
      if (!passableFor(hero, s.tiles[v])) continue;
      if (explored && !explored[v]) continue;
      const ov = objIndex.get(v);
      if (guardedU && !(ov && s.objects[ov].type === 'monster')) continue;
      const nd = dist[u] + stepCost(u, v, hero);
      if (nd < dist[v]) { dist[v] = nd; prev[v] = u; hp.push(v, nd); }
    }
  }
  return { dist, prev, start };
}

export function pathTo(paths, x, y) {
  const s = G.s;
  let i = y * s.W + x;
  if (!isFinite(paths.dist[i]) || i === paths.start) return null;
  const out = [];
  while (i !== paths.start && i !== -1) { out.push({ x: i % s.W, y: (i / s.W) | 0, total: paths.dist[i] }); i = paths.prev[i]; }
  out.reverse();
  let prevD = 0;
  for (const st of out) { st.step = st.total - prevD; prevD = st.total; }
  return out;
}

export async function moveHero(h, path) {
  const s = G.s;
  for (const st of path) {
    if (s.over || !s.heroes[h.id]) return 'gone';
    const i = st.y * s.W + st.x, from = h.y * s.W + h.x;
    if (Math.max(Math.abs(st.x - h.x), Math.abs(st.y - h.y)) !== 1) return 'blocked';
    const c = stepCost(from, i, h);
    if (h.mp < c) return 'nomp';
    const o = objAt(st.x, st.y), other = heroAt(st.x, st.y);
    if (o || other) { h.mp -= c; await interact(h, st.x, st.y); return 'interact'; }
    if (st.x !== h.x) h.facing = st.x > h.x ? 1 : -1;
    h.x = st.x; h.y = st.y; h.mp -= c; h.safe = false;
    reveal(h.owner, h.x, h.y, heroSight(h));
    await io.step?.(h);
    if (isGuarded(i)) {
      const m = guardingMonster(h.x, h.y);
      if (m) { await interact(h, m.x, m.y); return 'interact'; }
    }
  }
  return 'done';
}

function enterOwnTown(h, t) {
  h.x = t.x; h.y = t.y;
  const n = learnFromGuild(h, t);
  if (n && isHuman(h.owner)) message(`${h.name} learns ${n} new spell${n > 1 ? 's' : ''} at the Mage Guild.`, h.owner);
}
export function visitTown(h, t) { enterOwnTown(h, t); }

// ---------- artifacts ----------
export function giveArtifact(h, id) {
  const L = ARTIFACTS[id].learnSpell;
  if (L) { const opts = Object.keys(SPELLS).filter(k => SPELLS[k].level === L && !h.spells.includes(k)); if (opts.length) { const sp = opts[Math.floor(Math.random() * opts.length)]; h.spells.push(sp); message(`${h.name} reads the ${ARTIFACTS[id].name} and learns ${SPELLS[sp].name}.`, h.owner); } }
  for (const slot of slotsFor(ARTIFACTS[id].slot)) if (!h.equip[slot]) { h.equip[slot] = id; return slot; }
  h.backpack.push(id); return null;
}
export function equipFromBackpack(h, idx, slot) {
  const id = h.backpack[idx]; if (!id || !slotsFor(ARTIFACTS[id].slot).includes(slot)) return false;
  h.backpack.splice(idx, 1);
  if (h.equip[slot]) h.backpack.push(h.equip[slot]);
  h.equip[slot] = id;
  h.mp = Math.min(h.mp, maxMp(h)); h.mana = Math.min(h.mana, maxMana(h));
  return true;
}
export function unequip(h, slot) {
  if (!h.equip[slot]) return false;
  h.backpack.push(h.equip[slot]); h.equip[slot] = null;
  h.mp = Math.min(h.mp, maxMp(h)); h.mana = Math.min(h.mana, maxMana(h));
  return true;
}
function lootArtifacts(winner, loser) {
  const all = [...equipped(loser), ...loser.backpack];
  loser.equip = {}; loser.backpack = [];
  for (const id of all) giveArtifact(winner, id);
  return all.length;
}

// ---------- adventure spells ----------
export function canCastAdventure(h, sp) {
  return h.spells.includes(sp) && SPELLS[sp].kind === 'adventure' && h.mana >= Math.max(1, SPELLS[sp].cost - hstat(h, 'spellCost')) && !h.castToday;
}
export function castAdventure(h, sp) {
  if (!canCastAdventure(h, sp)) return { ok: false, msg: 'Not enough mana, or a spell was already cast today.' };
  if (sp === 'farsight') {
    reveal(h.owner, h.x, h.y, 12 + 2 * skillLevel(h, 'air'));
  } else if (sp === 'viewearth' || sp === 'viewair') {
    const want = sp === 'viewearth' ? (o => o.type === 'mine' || o.type === 'pile' || (o.type === 'site' && o.kind === 'derelict')) : (o => o.type === 'town' || o.type === 'relic');
    for (const o of Object.values(G.s.objects)) if (want(o)) reveal(h.owner, o.x, o.y, 1 + skillLevel(h, SPELLS[sp].school));
    if (sp === 'viewair') for (const e of Object.values(G.s.heroes)) reveal(h.owner, e.x, e.y, 1 + skillLevel(h, 'air'));
  } else if (sp === 'waterwalk') {
    h.walkDay = G.s.day;
  } else if (sp === 'jumppack') {
    h.flyDay = G.s.day;
  } else if (sp === 'portal') {
    if (h.mp < 300) return { ok: false, msg: 'Town Portal needs at least 300 movement points left.' };
    const towns = townsOf(h.owner).filter(t => !heroAt(t.x, t.y) || heroAt(t.x, t.y) === h);
    if (!towns.length) return { ok: false, msg: 'You have no free town to return to.' };
    towns.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    const t = towns[0];
    h.mp -= 300; enterOwnTown(h, t); reveal(h.owner, t.x, t.y, TOWN_SIGHT);
  }
  h.mana -= Math.max(1, SPELLS[sp].cost - hstat(h, 'spellCost')); h.castToday = true;
  return { ok: true };
}

export async function interact(h, x, y) {
  const s = G.s, p = s.players[h.owner], human = p.human;
  const other = heroAt(x, y), o = objAt(x, y);
  const isTown = o && o.type === 'town';
  if (other && other !== h && !isTown) {
    if (other.owner !== h.owner && !isEnemy(other.owner, h.owner)) { message(`${other.name} is an allied commander.`, h.owner); return; }
    if (other.owner !== h.owner && other.safe) { message(`${other.name} shelters in a Sanctuary Basilica and cannot be attacked.`, h.owner); return; }
    if (other.owner !== h.owner) await fightHero(h, other);
    else if (human) await io.exchange?.(h, other);
    return;
  }
  if (!o) return;
  switch (o.type) {
    case 'pile':
      p.res[o.res] += o.amount; removeObj(o);
      message(`${h.name} collects ${o.amount} ${RES_INFO[o.res].name}.`, h.owner);
      break;
    case 'chest': {
      let choice = 'auramite';
      if (human) choice = await io.chest(h);
      else choice = p.res.auramite < 6000 ? 'auramite' : 'xp';
      removeObj(o);
      if (choice === 'auramite') { p.res.auramite += 1000; message('You take 1000 auramite from the supply cache.', h.owner); }
      else await gainXp(h, 750);
      break;
    }
    case 'relic': {
      removeObj(o);
      const slot = giveArtifact(h, o.relic);
      if (human) await io.artifactFound?.(h, o.relic, slot);
      break;
    }
    case 'mine':
      if (o.owner !== h.owner && !isEnemy(o.owner, h.owner)) { message('This mine belongs to an ally.', h.owner); break; }
      if (o.owner !== h.owner) {
        const prev = o.owner; o.owner = h.owner;
        message(`${MINES[o.res].name} claimed. +${MINES[o.res].yield} ${RES_INFO[o.res].name} per day.`, h.owner);
        if (isHuman(prev)) message(`The enemy has seized one of your ${MINES[o.res].name}s.`, prev);
      }
      break;
    case 'site':
      await visitSite(h, o);
      break;
    case 'tower':
      o.visited = o.visited || []; if (!o.visited.includes(h.owner)) o.visited.push(h.owner);
      reveal(h.owner, o.x, o.y, 12);
      message('From the watchtower your scouts survey the wastes.', h.owner);
      break;
    case 'monster': {
      if (human) { const ok = await io.confirmMonster(h, o); if (!ok) return; G.quickNext = ok === 'quick'; }
      await fightMonster(h, o);
      break;
    }
    case 'town':
      if (o.owner === h.owner) {
        if (other && other !== h) { if (human) await io.exchange?.(h, other); return; }
        enterOwnTown(h, o);
        if (human) await io.openTown?.(o);
      } else if (!isEnemy(o.owner, h.owner)) {
        message(`${o.name} is held by an ally.`, h.owner);
      } else {
        await fightTown(h, o);
      }
      break;
  }
}

// ---------- adventure-map structures ----------
function freeTileNear(x, y) {
  const s = G.s;
  const order = [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, 2], [-2, 1], [2, 1], [-1, 2], [1, 2], [0, -1], [-2, 0], [2, 0]];
  for (const [dx, dy] of order) {
    const nx = x + dx, ny = y + dy;
    if (nx < 1 || ny < 1 || nx >= s.W - 1 || ny >= s.H - 1) continue;
    const i = ny * s.W + nx;
    if (passable(s.tiles[i]) && !objAt(nx, ny) && !heroAt(nx, ny) && !isGuarded(i)) return { x: nx, y: ny };
  }
  return null;
}
const pick = a => a[Math.floor(Math.random() * a.length)];

const RARES = ['plasteel', 'blackstone', 'wraithbone', 'psycrystal'];
const ARTI_PRICE = { T: 2000, m: 5000, M: 10000, R: 20000 };
const fmt = n => n.toLocaleString('en-US');
const resText = bag => Object.entries(bag).filter(([, v]) => v).map(([k, v]) => `${fmt(v)} ${RES_INFO[k].name}`).join(', ');
function giveRes(p, bag) { for (const [k, v] of Object.entries(bag)) p.res[k] += v; }
function randomRes(roll = Math.random()) {
  if (roll < 0.35) return ['auramite', 1500];
  if (roll < 0.7) { const r = pick(['adamantium', 'ceramite']); return [r, 6]; }
  return [pick(RARES), 3];
}
function learnSpell(h, levels) {
  const cap = maxSpellLevel(h);
  const opts = Object.keys(SPELLS).filter(k => !h.spells.includes(k) && levels.includes(SPELLS[k].level) && SPELLS[k].level <= cap);
  if (!opts.length) return null;
  const sp = pick(opts); h.spells.push(sp); return sp;
}
function learnSkill(h, k) {
  if (h.skills[k]) return false;
  if (Object.keys(h.skills).length >= MAX_SKILLS) return false;
  h.skills[k] = 1; return true;
}
const freshSkills = h => Object.keys(h.skills).length < MAX_SKILLS ? Object.keys(SKILLS).filter(k => !h.skills[k]) : [];
// Temporary blessings last until the commander's next battle.
function bless(h, morale = 0, luck = 0) { h.tmp = h.tmp || {}; h.tmp.morale = Math.max(h.tmp.morale || 0, morale); h.tmp.luck = Math.max(h.tmp.luck || 0, luck); }
function unexplore(pid, x, y, r) {
  const s = G.s;
  for (const q of s.players) {
    if (q.id === pid) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.W || ny >= s.H || dx * dx + dy * dy > r * r + r) continue;
      if (Object.values(s.heroes).some(e => e.owner === q.id && Math.hypot(e.x - nx, e.y - ny) <= heroSight(e))) continue;
      if (townsOf(q.id).some(t => Math.hypot(t.x - nx, t.y - ny) <= TOWN_SIGHT)) continue;
      q.explored[ny * s.W + nx] = 0;
    }
  }
  io.fogChanged?.();
}
// The spoils of each guarded treasury (o.loot is rolled on the map so it can be shown in advance).
function bankLoot(o) {
  switch (o.kind) {
    case 'brutes': return { res: { adamantium: 10, ceramite: 10, [pick(RARES)]: 4 } };
    case 'forgevault': return { res: { auramite: 2500, adamantium: 8 } };
    case 'rookery': return { res: { auramite: 2000 }, recruit: { unit: 'kite', count: 4 + Math.floor(Math.random() * 4) } };
    case 'mawpit': return { res: { auramite: 1000, [pick(RARES)]: 2 } };
    case 'basilisks': { const [a, b] = shuffle(RARES.slice()); return { res: { [a]: 5, [b]: 5 } }; }
    case 'serpent': { const [a, b] = shuffle(RARES.slice()); return { res: { auramite: 3000, [a]: 4, [b]: 4 } }; }
    case 'hive': return { res: { auramite: 1200, [pick(['adamantium', 'ceramite'])]: 5 } };
    case 'wyrm': return { res: { auramite: 10000 }, arts: ['R', 'M', 'm'] };
    case 'crypt': return { res: { auramite: 2500 }, arts: ['m'] };
    case 'frigate': return { res: { auramite: 2000, plasteel: 4 }, arts: [Math.random() < 0.5 ? 'm' : 'T'] };
    case 'cathedral': return { res: { auramite: 5000 }, arts: ['M'] };
    case 'citadel': return { res: { auramite: 2500 }, arts: [Math.random() < 0.5 ? 'M' : 'm'] };
    case 'reactor': { const [a, b] = shuffle(RARES.slice()); return { res: { auramite: 1000, [a]: 4, [b]: 4 } }; }
    case 'foundry': return { res: { auramite: 1500, adamantium: 8, ceramite: 8 } };
    case 'reliquary': {
      const r = Math.random();
      if (r < 0.3) return { res: { auramite: 6000 } };
      if (r < 0.55) return { arts: ['M'] };
      if (r < 0.8) return { xp: 5000 };
      return { res: Object.fromEntries(RARES.map(k => [k, 5])) };
    }
    case 'blastdoor': return { res: { auramite: 3000, [pick(RARES)]: 3 }, arts: [Math.random() < 0.5 ? 'M' : 'm'] };
  }
  return { res: { auramite: 1000 } };
}
// one-time structures (drop pods, abandoned camps, the wandering scribe, opened reliquaries) disappear
// once used, and the ground under their picture becomes walkable again
function vanish(o) {
  const s = G.s;
  for (const [dx, dy] of MINE_FOOT) { const x = o.x + dx, y = o.y + dy; if (x >= 0 && y >= 0 && x < s.W && y < s.H) s.tiles[y * s.W + x].blk = false; }
  removeObj(o); rebuildIndex();
  io.fogChanged?.();
}
async function payLoot(h, o, loot, title) {
  const p = G.s.players[h.owner], human = p.human, parts = [];
  if (loot.res) { giveRes(p, loot.res); parts.push(resText(loot.res)); }
  for (const r of loot.arts || []) { const id = pick(artifactsByRarity(r)); giveArtifact(h, id); parts.push(`the ${ARTIFACTS[id].name}`); }
  if (loot.recruit) {
    const { unit, count } = loot.recruit;
    if (addToArmy(h.army, unit, count)) parts.push(`${count} ${UNITS[unit].name} join your army`);
  }
  if (human) await io.notice?.(title, `Spoils: ${parts.join('; ') || 'nothing of worth'}${loot.xp ? `${parts.length ? '; ' : ''}${fmt(loot.xp)} experience` : ''}.`);
  if (loot.xp) await gainXp(h, loot.xp);
}

async function visitSite(h, o) {
  await visitSite0(h, o);
  if (G.s.objects[o.id] && ((SITES[o.kind].once && o.cleared) || (o.kind === 'reliquary' && o.cleared))) vanish(o);
}
async function visitSite0(h, o) {
  const s = G.s, p = s.players[h.owner], human = p.human, S = SITES[o.kind];
  const notice = (title, text) => (human ? io.notice?.(title, text) : null);
  const say = text => message(text, h.owner);
  const choose = async (text, buttons, ai) => (human && io.choose ? await io.choose(S.name, text, buttons) : ai);
  const week = Math.floor((s.day - 1) / 7);
  o.visited = o.visited || [];
  if (S.perHero && o.visited.includes(h.id)) { say(`${h.name} has already visited this ${S.name}.`); return; }
  if (S.weekly && o.week === week) { say(`The ${S.name} has nothing more to give this week.`); return; }
  if (S.heroWeekly && (o.vw || {})[h.id] === week) { say(`${h.name} has already been here this week.`); return; }
  if (S.once && o.cleared) { say(`The ${S.name} is empty.`); return; }
  const markHero = () => { o.visited.push(h.id); };
  const markWeek = () => { o.week = week; };
  const markHeroWeek = () => { o.vw = o.vw || {}; o.vw[h.id] = week; };
  // guarded structures: beat the guards first
  if (S.guarded && !o.cleared) {
    if (human) { const ok = await io.confirmMonster(h, { unit: o.guard.unit, count: o.guard.count, site: o.kind }); if (!ok) return; G.quickNext = ok === 'quick'; }
    const r = await fightGuards(h, o.guard);
    if (!s.heroes[h.id] || !r.won) return;
    o.cleared = true;
    if (o.kind === 'derelict') { o.owner = h.owner; await notice(`${S.name} taken`, `The complex is yours: +${MINES[o.res].yield} ${RES_INFO[o.res].name} per day.`); return; }
    if (o.kind === 'pyramid') {
      const sp = learnSpell(h, [5]) || learnSpell(h, [4]);
      if (sp) await notice(`${S.name} opened`, `Carved into the inner tomb: ${SPELLS[sp].name} (level ${SPELLS[sp].level}).`);
      else { await notice(`${S.name} opened`, `${h.name} cannot grasp the spells inscribed within, but gains 3,000 experience studying them.`); await gainXp(h, 3000); }
      return;
    }
    await payLoot(h, o, bankLoot(o), `${S.name} taken`);
    return;
  }
  switch (o.kind) {
    // ---- income and pickups ----
    case 'turbine': { markWeek(); const [res, n] = randomRes(); p.res[res] += n; say(`The processor yields ${n} ${RES_INFO[res].name}.`); return; }
    case 'geotap': markWeek(); p.res.auramite += 750; say('The geothermal tap yields 750 auramite.'); return;
    case 'glasshouse': {
      markWeek();
      if (Math.random() < 0.5) { p.res.auramite += 500; say('The glasshouse harvest sells for 500 auramite.'); }
      else { const r = pick(RARES); p.res[r] += 2; say(`The glasshouse yields 2 ${RES_INFO[r].name}.`); }
      return;
    }
    case 'droppod': {
      const gold = o.amount || 1500, xp = Math.round(gold * 0.6);
      const c = await choose(`The pod holds ${fmt(gold)} auramite worth of supplies, or data worth ${fmt(xp)} experience.`, [{ label: `${fmt(xp)} experience`, value: 'xp' }, { label: `${fmt(gold)} auramite`, value: 'gold', primary: true }], p.res.auramite < 6000 ? 'gold' : 'xp');
      o.cleared = true;
      if (c === 'xp') await gainXp(h, xp); else { p.res.auramite += gold; say(`${fmt(gold)} auramite recovered from the drop pod.`); }
      return;
    }
    case 'bivouac': {
      o.cleared = true;
      const r = o.res || pick(['adamantium', 'ceramite', ...RARES]), n = RES_INFO[r].rare ? 3 : 5, gold = 400 + 100 * Math.floor(Math.random() * 3);
      p.res.auramite += gold; p.res[r] += n;
      await notice(S.name, `Left behind in the camp: ${fmt(gold)} auramite and ${n} ${RES_INFO[r].name}.`);
      return;
    }
    case 'derelict': {   // cleared already: claim it like a mine
      if (o.owner !== h.owner) { const prev = o.owner; o.owner = h.owner; say(`${S.name} claimed: +${MINES[o.res].yield} ${RES_INFO[o.res].name} per day.`); if (isHuman(prev)) message(`The enemy has seized your ${S.name}.`, prev); }
      return;
    }
    // ---- army ----
    case 'armoury': {
      const stacks = h.army.map((st, i) => ({ st, i })).filter(({ st }) => st && UNITS[st.type].upgrade);
      const costOf = st => { const a = UNITS[st.type].cost, b = UNITS[UNITS[st.type].upgrade].cost, c = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) c[k] = Math.max(0, (b[k] || 0) - (a[k] || 0)) * st.count; return c; };
      const total = {}; for (const { st } of stacks) for (const [k, v] of Object.entries(costOf(st))) total[k] = (total[k] || 0) + v;
      if (!stacks.length) { await notice(S.name, 'None of your troops can be upgraded here.'); return; }
      if (!canAfford(p.res, total)) { await notice(S.name, `Upgrading your army costs ${resText(total)}. You cannot afford it.`); return; }
      const ok = await choose(`Upgrade ${stacks.length} stack${stacks.length > 1 ? 's' : ''} for ${resText(total)}?`, [{ label: 'Not now', value: false }, { label: 'Upgrade', value: true, primary: true }], true);
      if (!ok) return;
      pay(p.res, total);
      for (const { st, i } of stacks) h.army[i] = { type: UNITS[st.type].upgrade, count: st.count };
      say(`${S.name}: your troops are refitted and upgraded.`);
      return;
    }
    case 'broker': {
      const stacks = h.army.map((st, i) => ({ st, i })).filter(({ st }) => st);
      if (stacks.length < 2) { await notice(S.name, 'The broker will not buy your last troops.'); return; }
      if (!human) return;
      const priceOf = st => Math.round(st.count * (UNITS[st.type].cost.auramite || 100) * 0.5);
      const pickI = await io.choose(S.name, 'Which stack will you sell? The broker pays half their muster price.', [{ label: 'Sell nothing', value: -1 }, ...stacks.map(({ st, i }) => ({ label: `${st.count} ${UNITS[st.type].name}: ${fmt(priceOf(st))}`, value: i }))]);
      if (pickI == null || pickI < 0) return;
      const st = h.army[pickI]; p.res.auramite += priceOf(st); h.army[pickI] = null;
      say(`Sold ${st.count} ${UNITS[st.type].name} for ${fmt(priceOf(st))} auramite.`);
      return;
    }
    case 'engineforge': {
      if (o.week !== week) { o.week = week; o.stock = 2; }
      const U = UNITS.walker, cost = U.cost;
      if (!o.stock) { await notice(S.name, 'No war engines are ready this week.'); return; }
      const can = Math.min(o.stock, ...Object.entries(cost).map(([k, v]) => Math.floor(p.res[k] / v)));
      if (can <= 0) { await notice(S.name, `A Dreadwalker costs ${resText(cost)}. You cannot afford one.`); return; }
      const n = await choose(`${o.stock} Bastion Dreadwalker${o.stock > 1 ? 's' : ''} ready, ${resText(cost)} each.`, [{ label: 'Leave', value: 0 }, ...Array.from({ length: can }, (_, k) => ({ label: `Buy ${k + 1}`, value: k + 1, primary: k + 1 === can }))], can);
      if (!n) return;
      if (!addToArmy(h.army, 'walker', n)) { await notice(S.name, 'Your army has no room for them.'); return; }
      pay(p.res, cost, n); o.stock -= n; say(`${n} Bastion Dreadwalker${n > 1 ? 's' : ''} join your army.`);
      return;
    }
    // ---- commander growth ----
    case 'provinggrounds': case 'watchtower': case 'choir': case 'archive': {
      const k = { provinggrounds: 'atk', watchtower: 'def', choir: 'pow', archive: 'know' }[o.kind];
      markHero(); h[k]++; if (k === 'know') h.mana += 10;
      await notice(S.name, `${h.name} gains +1 ${STAT_NAMES[k]}.`);
      return;
    }
    case 'arena': {
      let stat = h.cls === 'magic' ? 'def' : 'atk';
      if (human && io.choose) stat = await io.choose(S.name, `${h.name} may fight once in the pit.`, [{ label: '+2 Attack', value: 'atk', primary: true }, { label: '+2 Defence', value: 'def' }]) || 'atk';
      h[stat] += 2; markHero();
      say(`${h.name} gains +2 ${STAT_NAMES[stat]} in the Gladiator Pit.`);
      return;
    }
    case 'warcollege': case 'sanctum': {
      const [a, b] = o.kind === 'warcollege' ? ['atk', 'def'] : ['pow', 'know'];
      if (p.res.auramite < 1000) { await notice(S.name, 'Tuition is 1,000 auramite. You cannot afford it.'); return; }
      const k = await choose(`Pay 1,000 auramite to train ${h.name}?`, [{ label: 'Leave', value: null }, { label: `+1 ${STAT_NAMES[a]}`, value: a, primary: true }, { label: `+1 ${STAT_NAMES[b]}`, value: b }], h.cls === 'magic' ? b : a);
      if (!k) return;
      p.res.auramite -= 1000; h[k]++; if (k === 'know') h.mana += 10; markHero();
      say(`${h.name} gains +1 ${STAT_NAMES[k]}.`);
      return;
    }
    case 'librarium': {
      if (h.level < 10) { await notice(S.name, `The librarians turn ${h.name} away. Return at level 10.`); return; }
      markHero(); for (const k of ['atk', 'def', 'pow', 'know']) h[k] += 2; h.mana += 20;
      await notice(S.name, `${h.name} studies the lost texts: +2 to every primary stat.`);
      return;
    }
    case 'monolith': markHero(); await notice(S.name, `${h.name} reads the monolith's data-streams: +1,000 experience.`); await gainXp(h, 1000); return;
    case 'engine': { markHero(); const need = xpForLevel(h.level + 1) - h.xp; await notice(S.name, `The engine's cogitators teach ${h.name} a lifetime of lessons.`); await gainXp(h, need); return; }
    case 'hermit': {
      const k = o.skill && SKILLS[o.skill] ? o.skill : (o.skill = pick(Object.keys(SKILLS)));
      if (h.skills[k]) { await notice(S.name, `The hermit teaches ${SKILLS[k].name}, which ${h.name} already knows.`); return; }
      if (!learnSkill(h, k)) { await notice(S.name, `${h.name} has no room to learn ${SKILLS[k].name}.`); return; }
      markHero(); await notice(S.name, `The hermit teaches ${h.name} Basic ${SKILLS[k].name}.`);
      return;
    }
    case 'academy': {
      const fresh = freshSkills(h);
      if (!o.offer) o.offer = shuffle(Object.keys(SKILLS)).slice(0, 4);
      const offer = o.offer.filter(k => fresh.includes(k));
      if (!offer.length) { await notice(S.name, `The academy has nothing new to teach ${h.name}.`); return; }
      if (p.res.auramite < 2000) { await notice(S.name, 'Each course costs 2,000 auramite. You cannot afford one.'); return; }
      const k = await choose('Each course costs 2,000 auramite.', [{ label: 'Leave', value: null }, ...offer.map((k2, i) => ({ label: SKILLS[k2].name, value: k2, primary: i === 0 }))], offer[0]);
      if (!k) return;
      p.res.auramite -= 2000; learnSkill(h, k); say(`${h.name} learns Basic ${SKILLS[k].name}.`);
      return;
    }
    case 'scribe': {
      o.cleared = true;
      const r = Math.random(); let text;
      const fresh = freshSkills(h);
      if (r < 0.34 && fresh.length) { const k = pick(fresh); learnSkill(h, k); text = `Basic ${SKILLS[k].name}`; }
      else if (r < 0.67 && learnSpell(h, [1, 2, 3])) text = `the spell ${SPELLS[h.spells[h.spells.length - 1]].name}`;
      else { const k = pick(['atk', 'def', 'pow', 'know']); h[k] += 2; text = `+2 ${STAT_NAMES[k]}`; }
      await notice(S.name, `The tech-scribe shares what he knows and moves on. ${h.name} gains ${text}.`);
      return;
    }
    // ---- magic ----
    case 'litany': case 'canticle': case 'revelation': {
      const lvl = { litany: 1, canticle: 2, revelation: 3 }[o.kind];
      if (!o.spell || !SPELLS[o.spell]) { const pool = Object.keys(SPELLS).filter(k => SPELLS[k].level === lvl); o.spell = pick(pool); }
      const sp = SPELLS[o.spell];
      if (h.spells.includes(o.spell)) { say(`${h.name} already knows ${sp.name}.`); return; }
      const lore = { litany: 'Tech-adepts chanting over a cracked data-altar', canticle: 'Hooded scribes guarding a choir of humming servo-skulls', revelation: 'A blind oracle bound in cables to a whispering monolith' }[o.kind];
      if (maxSpellLevel(h) < lvl) {
        if (human && io.riteShrine) await io.riteShrine(h, o.spell, S.name, `${lore} offer${o.kind === 'revelation' ? 's' : ''} to teach the rite of ${sp.name}, but ${h.name} needs greater Wisdom to grasp it.`, false);
        else await notice(S.name, `The shrine holds ${sp.name}, but ${h.name} needs greater Wisdom to learn it.`);
        return;
      }
      h.spells.push(o.spell);
      if (human && io.riteShrine) await io.riteShrine(h, o.spell, S.name, `${lore} welcome${o.kind === 'revelation' ? 's' : ''} ${h.name}. In exchange for a vow of protection, ${h.name} is taught the rite of ${sp.name}.`, true);
      else await notice(S.name, `${h.name} learns ${sp.name} (level ${lvl}).`);
      return;
    }
    case 'voidfont': {
      o.vd = o.vd || {};
      if (o.vd[h.id] === s.day) { say('The font has already filled you today.'); return; }
      if (h.mana >= maxMana(h)) { say(`${h.name}'s mana is already full.`); return; }
      o.vd[h.id] = s.day; h.mana = maxMana(h); say(`${h.name}'s mana is restored.`);
      return;
    }
    case 'riftspring': markWeek(); h.mana = Math.max(h.mana, maxMana(h) * 2); say(`The rift spring floods ${h.name} with power: mana doubled.`); return;
    // ---- movement, morale and luck ----
    case 'motorpool': markHeroWeek(); h.mp += 500; say(`${h.name}'s vehicles are refuelled: +5 movement today.`); return;
    case 'reclamator': markHeroWeek(); bless(h, 1); h.mp += 300; say(`${h.name}'s troops drink clean water: +1 morale for the next battle, +3 movement.`); return;
    case 'rally': markHeroWeek(); bless(h, 1, 1); h.mp += 300; say(`${h.name}'s troops rally to the standard: +1 morale and +1 luck for the next battle.`); return;
    case 'chapel': { markHeroWeek(); const m = (s.day - 1) % 7 === 6 ? 2 : 1; bless(h, m); say(`Prayers at the chapel: +${m} morale for the next battle.`); return; }
    case 'medicae': markHeroWeek(); bless(h, 1); h.mp += 300; say(`The medicae tend ${h.name}'s wounded: +1 morale for the next battle, +3 movement.`); return;
    case 'votive': {
      markHeroWeek(); const l = pick([-1, 1, 1, 2, 2, 3]);
      if (l < 0) { h.tmp = h.tmp || {}; h.tmp.luck = Math.min(h.tmp.luck || 0, l); say('The votive candles gutter out: -1 luck for the next battle.'); }
      else { bless(h, 0, l); say(`The votive shrine blesses ${h.name}: +${l} luck for the next battle.`); }
      return;
    }
    case 'pool': markHeroWeek(); bless(h, 0, 2); h.mp = 0; say(`${h.name} rests by the still pool: +2 luck for the next battle.`); return;
    // ---- sight and travel ----
    case 'auspex': reveal(h.owner, o.x, o.y, 15); say('The auspex array sweeps the wastes.'); return;
    case 'shroud': markWeek(); unexplore(h.owner, o.x, o.y, 10); say('The shroud generator hums: the land around it vanishes from enemy maps.'); return;
    case 'obelisk': {
      const relics = Object.values(s.objects).filter(q => q.type === 'relic').sort((a, b) => 'TmMR'.indexOf(ARTIFACTS[b.relic].r) - 'TmMR'.indexOf(ARTIFACTS[a.relic].r));
      const t = relics.find(q => !p.explored[q.y * s.W + q.x]) || relics[0];
      if (!t) { say('The obelisk\'s carvings point to relics already taken.'); return; }
      reveal(h.owner, t.x, t.y, 3);
      await notice(S.name, `The carvings show where the ${ARTIFACTS[t.relic].name} lies. The place is marked on your map.`);
      io.centerOn?.(t.x, t.y);
      return;
    }
    case 'watcheye': {
      const far = Object.values(s.objects).filter(q => q !== o && q.type === 'site' && (q.kind === 'watcheye' || SITES[q.kind].guarded) && !p.explored[q.y * s.W + q.x]);
      for (const q of shuffle(far).slice(0, 3)) reveal(h.owner, q.x, q.y, 5);
      say(far.length ? 'Through the watch eye you glimpse distant places.' : 'The watch eye shows nothing you have not seen.');
      return;
    }
    case 'riftgate': {
      const twin = Object.values(s.objects).find(q => q !== o && q.type === 'site' && q.kind === 'riftgate' && q.pair === o.pair);
      const spot = twin && freeTileNear(twin.x, twin.y);
      if (!spot) { say('The gate flickers but the far side is blocked.'); return; }
      h.x = spot.x; h.y = spot.y; reveal(h.owner, h.x, h.y, heroSight(h));
      say(`${h.name} steps through the Teleportarium Gate.`);
      await io.step?.(h);
      return;
    }
    case 'keystation': {
      p.keys = p.keys || [];
      if (p.keys.includes(o.color)) { say(`You already hold the ${o.color} key-codex.`); return; }
      p.keys.push(o.color); await notice(S.name, `You receive the ${o.color} key-codex. It opens every ${o.color} Sealed Blast Door.`);
      return;
    }
    case 'blastdoor': {
      if (o.cleared) { say('The vault behind the door is empty.'); return; }
      if (!(p.keys || []).includes(o.color)) { await notice(S.name, `The door is sealed. It needs the ${o.color} key-codex from a Key Codex Station.`); return; }
      o.cleared = true; await payLoot(h, o, bankLoot(o), 'The blast door grinds open');
      return;
    }
    // ---- people and trade ----
    case 'confessor': {
      if (o.cleared) { say('The confessor has nothing more to ask.'); return; }
      const q = o.quest || (o.quest = { type: 'res', res: pick(RARES), n: 8 + Math.floor(Math.random() * 6) });
      const rw = o.reward || (o.reward = { arts: ['M'] });
      const rwText = rw.arts ? 'a major artifact' : rw.xp ? `${fmt(rw.xp)} experience` : resText(rw.res || {});
      const want = q.type === 'res' ? `bring ${q.n} ${RES_INFO[q.res].name}` : `return when a commander has reached level ${q.n}`;
      const done = q.type === 'res' ? p.res[q.res] >= q.n : h.level >= q.n;
      if (!done) { await notice(S.name, `"Prove your devotion: ${want}." Reward: ${rwText}.`); return; }
      const ok = await choose(`"You can ${want.replace('return when a commander has reached', 'show me')}. Will you?" Reward: ${rwText}.`, [{ label: 'Not yet', value: false }, { label: 'Complete the task', value: true, primary: true }], true);
      if (!ok) return;
      if (q.type === 'res') p.res[q.res] -= q.n;
      o.cleared = true; await payLoot(h, o, rw, S.name);
      return;
    }
    case 'penal': {
      if (o.freed) { say('The cells of the stockade stand empty.'); return; }
      if (heroesOf(h.owner).length >= MAX_HEROES) { say('You already command four commanders. Return when there is room.'); return; }
      const spot = freeTileNear(o.x, o.y);
      if (!spot) { say('There is no room outside the stockade gates.'); return; }
      o.freed = true;
      const nh = createHero(h.owner, spot.x, spot.y, {});
      nh.mp = 0;
      await notice(S.name, `${h.name} breaks open the cells. ${nh.name} is freed and joins your cause.`);
      await gainXp(nh, 3200);
      return;
    }
    case 'trader': {
      if (!human) return;
      const have = RES.filter(r => p.res[r] > 0);
      const give = await io.choose(S.name, 'What will you trade away?', [{ label: 'Nothing', value: null }, ...have.map(r => ({ label: `${RES_INFO[r].name} (${fmt(p.res[r])})`, value: r }))]);
      if (!give) return;
      const get = await io.choose(S.name, `Trade ${RES_INFO[give].name} for what?`, [{ label: 'Nothing', value: null }, ...RES.filter(r => r !== give).map(r => ({ label: `${RES_INFO[r].name} (${traderRate(give, r)} each)`, value: r }))]);
      if (!get) return;
      const rate = traderRate(give, get), max = Math.floor(p.res[give] / rate);
      if (max <= 0) { await notice(S.name, `You need ${rate} ${RES_INFO[give].name} for each ${RES_INFO[get].name}.`); return; }
      const qs = [...new Set([1, 5, 10, Math.floor(max / 2), max].filter(n => n >= 1 && n <= max))];
      const n = await io.choose(S.name, `${rate} ${RES_INFO[give].name} buys 1 ${RES_INFO[get].name}.`, [{ label: 'Cancel', value: 0 }, ...qs.map(n2 => ({ label: `Buy ${fmt(n2)}`, value: n2 }))]);
      if (!n) return;
      p.res[give] -= rate * n; p.res[get] += n; say(`Traded ${fmt(rate * n)} ${RES_INFO[give].name} for ${fmt(n)} ${RES_INFO[get].name}.`);
      return;
    }
    case 'smuggler': {
      if (!o.stock) o.stock = [pick(artifactsByRarity('T')), pick(artifactsByRarity('m')), pick(artifactsByRarity(Math.random() < 0.7 ? 'm' : 'M'))];
      if (!o.stock.length) { await notice(S.name, 'The smugglers have sold everything.'); return; }
      const price = id => ARTI_PRICE[ARTIFACTS[id].r];
      let id;
      if (human) id = await io.choose(S.name, 'Contraband for sale, no questions asked.', [{ label: 'Leave', value: null }, ...o.stock.map(a => ({ label: `${ARTIFACTS[a].name}: ${fmt(price(a))}`, value: a }))]);
      else id = o.stock.find(a => p.res.auramite >= price(a) + 4000);
      if (!id) return;
      if (p.res.auramite < price(id)) { await notice(S.name, 'You cannot afford it.'); return; }
      p.res.auramite -= price(id); o.stock.splice(o.stock.indexOf(id), 1);
      const slot = giveArtifact(h, id); if (human) await io.artifactFound?.(h, id, slot);
      return;
    }
    case 'sanctuary': h.safe = true; say(`${h.name} rests in the basilica. No enemy may attack them until they move on.`); return;
    // ---- older saves ----
    case 'observatory': {
      markHero(); h.mana = Math.max(h.mana, maxMana(h));
      const sp = learnSpell(h, [1, 2, 3, 4]);
      await notice(S.name, sp ? `The astropaths reveal a new spell: ${SPELLS[sp].name}. Mana is fully restored.` : 'Mana is fully restored.');
      return;
    }
    case 'shrine': {
      markHero(); const fresh = freshSkills(h); let learned = null;
      if (fresh.length) { learned = pick(fresh); h.skills[learned] = 1; }
      await notice(S.name, `${h.name} gains 1,500 experience${learned ? ` and learns Basic ${SKILLS[learned].name}` : ''}.`);
      await gainXp(h, 1500);
      return;
    }
    default:
      if (S.guarded && o.cleared) say(`The ${S.name} has already been plundered.`);
  }
}
const traderRate = (give, get) => {
  const v = k => (k === 'auramite' ? 1 / 250 : RES_INFO[k].rare ? 2 : 1);
  return Math.max(1, Math.ceil(2.5 * v(get) / v(give)));
};

async function fightGuards(h, guard) {
  const u = UNITS[guard.unit];
  const n = Math.max(1, Math.min(guard.count, 5, u.tier >= 4 ? guard.count : Math.ceil(guard.count / 7)));
  const arr = []; let left = guard.count;
  for (let i = 0; i < n; i++) { const c = Math.round(left / (n - i)); arr.push({ type: guard.unit, count: c }); left -= c; }
  const r = await runBattle({ hero: h, owner: h.owner, units: armyUnits(h.army) }, { hero: null, owner: null, units: arr.map((st, i) => ({ ...st, src: { arr, idx: i } })) });
  guard.count = arr.reduce((a, x) => a + (x ? x.count : 0), 0);
  await afterBattle(h, r, 0);
  checkElimination();
  return { won: r.winner === 0 };
}

// ---------- battles ----------
function armyUnits(army) {
  const out = [];
  army.forEach((st, i) => { if (st) out.push({ type: st.type, count: st.count, src: { arr: army, idx: i } }); });
  return out;
}

async function runBattle(att, def, opts = {}) {
  const hs = isHuman(att.owner) ? 0 : isHuman(def.owner) ? 1 : -1;
  const hsAll = [att.owner, def.owner].map((o, i) => (isHuman(o) ? i : -1)).filter(i => i >= 0);   // hot-seat: both sides human
  const b = createBattle(att, def, opts);
  // the ground of the battlefield: the defender's tile (town or monster), else where the attacker stands
  const at = opts.at || att.hero; if (at) { const T = G.s.tiles[at.y * G.s.W + at.x]; b.terrain = T ? T.t : 0; }
  const before = [att, def].map(sd => sd.hero ? sd.hero.army.map(st => st && { ...st }) : null);
  if (hs >= 0 && G.quickNext) { G.quickNext = false; autoBattle(b); await io.quickResult?.(b, hs); }
  else if (hs >= 0) await io.battle(b, hsAll.length > 1 ? hsAll : hs); else autoBattle(b);
  const r = finishBattle(b);
  // artifacts that bring back part of the fallen troops of the winning commander
  const ws = r.winner, wh = ws != null && [att, def][ws] && [att, def][ws].hero;
  if (wh && r.retreated !== ws) {
    const k = hstat(wh, 'raise');
    if (k > 0) {
      let back = 0;
      before[ws].forEach((st, i) => { if (!st) return; const now = wh.army[i] && wh.army[i].type === st.type ? wh.army[i].count : 0; const n = Math.floor((st.count - now) * Math.min(0.9, k)); if (n > 0 && addToArmy(wh.army, st.type, n)) back += n; });
      if (back) message(`${back} fallen troops rise again to follow ${wh.name}.`, wh.owner);
    }
  }
  return r;
}

async function afterBattle(h, r, side) {
  if (!G.s.heroes[h.id]) return;
  h.tmp = null;
  if (r.winner === side) { if (r.xp[side] > 0) await gainXp(h, r.xp[side]); }
  else if (r.retreated === side) retreatHero(h);
  else killHero(h);
}

async function fightMonster(h, o) {
  const u = UNITS[o.unit];
  const n = Math.max(1, Math.min(o.count, 5, u.tier >= 4 ? o.count : Math.ceil(o.count / 7)));
  const arr = []; let left = o.count;
  for (let i = 0; i < n; i++) { const c = Math.round(left / (n - i)); arr.push({ type: o.unit, count: c }); left -= c; }
  const def = { hero: null, owner: null, units: arr.map((st, i) => ({ ...st, src: { arr, idx: i } })) };
  const r = await runBattle({ hero: h, owner: h.owner, units: armyUnits(h.army) }, def, { at: o });
  o.count = arr.reduce((a, x) => a + (x ? x.count : 0), 0);
  if (r.winner === 0 || o.count <= 0) removeObj(o);
  await afterBattle(h, r, 0);
  checkElimination();
}

async function fightHero(a, d) {
  const r = await runBattle({ hero: a, owner: a.owner, units: armyUnits(a.army) }, { hero: d, owner: d.owner, units: armyUnits(d.army) });
  let looted = 0;
  if (r.winner === 0 && r.retreated !== 1) looted = lootArtifacts(a, d);
  if (r.winner === 1 && r.retreated !== 0) looted = lootArtifacts(d, a);
  if (looted) message(`${looted} artifact${looted > 1 ? 's' : ''} taken from the fallen commander.`, r.winner === 0 ? a.owner : d.owner);
  await afterBattle(a, r, 0);
  await afterBattle(d, r, 1);
  checkElimination();
}

async function fightTown(h, t) {
  const vh = heroAt(t.x, t.y);
  const defUnits = vh ? armyUnits(vh.army) : [];
  for (let i = 0; i < 7 && defUnits.length < 7; i++) {
    const st = t.garrison[i];
    if (st) defUnits.push({ type: st.type, count: st.count, src: { arr: t.garrison, idx: i } });
  }
  if (defUnits.length === 0) { captureTown(h, t); return; }
  const siege = t.built.fort ? { level: t.built.castle ? 3 : t.built.citadel ? 2 : 1, towerDmg: 10 + 4 * Object.keys(t.built).filter(k => /^dw\d$/.test(k)).length, faction: t.faction, cannon: (G.s.players[h.owner] || {}).faction } : null;
  const r = await runBattle({ hero: h, owner: h.owner, units: armyUnits(h.army) }, { hero: vh, owner: t.owner, units: defUnits }, { siege, at: t });
  if (vh && r.winner === 0 && r.retreated !== 1) lootArtifacts(h, vh);
  if (vh) await afterBattle(vh, r, 1);
  await afterBattle(h, r, 0);
  if (r.winner === 0 && G.s.heroes[h.id] && t.garrison.every(x => !x) && !heroAt(t.x, t.y)) captureTown(h, t);
  checkElimination();
}

function captureTown(h, t) {
  const prev = t.owner;
  t.owner = h.owner; h.x = t.x; h.y = t.y;
  reveal(h.owner, t.x, t.y, TOWN_SIGHT);
  if (isHuman(h.owner)) message(`${t.name} has fallen to your forces.`, h.owner);
  if (isHuman(prev)) message(`${t.name} has fallen to the enemy!`, prev);
  checkElimination();
}

function killHero(h) {
  delete G.s.heroes[h.id];
  if (isHuman(h.owner)) message(`${h.name} has fallen in battle.`, h.owner);
}
function retreatHero(h) {
  delete G.s.heroes[h.id];
  h.army = Array(7).fill(null);
  G.s.players[h.owner].retreated.push(h);
  if (isHuman(h.owner)) message(`${h.name} retreats and can be hired again at a Recruitment Office.`, h.owner);
}

export async function gainXp(h, xp) {
  h.xp += Math.round(xp);
  while (h.xp >= xpForLevel(h.level + 1)) {
    h.level++;
    const w = h.cls === 'magic' ? { atk: 1, def: 1, pow: 3, know: 3 } : { atk: 3, def: 3, pow: 1, know: 1 };
    let roll = Math.random() * 8, stat = 'atk';
    for (const k in w) { roll -= w[k]; if (roll <= 0) { stat = k; break; } }
    h[stat]++; if (stat === 'know') h.mana += 10;
    const opts = skillChoices(h);
    let pick = opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
    if (opts.length && isHuman(h.owner) && io.levelUp) pick = await io.levelUp(h, stat, opts);
    if (pick) h.skills[pick] = (h.skills[pick] || 0) + 1;
  }
}

// Level-up offers: one upgrade of a known skill and one new skill, when available.
export function skillChoices(h) {
  const known = Object.keys(h.skills).filter(k => h.skills[k] < 3);
  const fresh = Object.keys(h.skills).length < MAX_SKILLS ? Object.keys(SKILLS).filter(k => !h.skills[k]) : [];
  const out = [];
  if (known.length) out.push(shuffle(known)[0]);
  if (fresh.length) out.push(shuffle(fresh)[0]);
  if (out.length < 2 && known.length > 1) out.push(shuffle(known.filter(k => !out.includes(k)))[0]);
  return out.filter(Boolean);
}

export function checkElimination() {
  const s = G.s;
  for (const p of s.players) {
    const alive = townsOf(p.id).length > 0 || heroesOf(p.id).length > 0;
    if (!alive && p.alive) { p.alive = false; io.message?.(p.human ? `${p.name} has been defeated.` : `${p.name} has been destroyed.`); }
  }
  if (s.over) return;
  // the game ends when one side is left; with several humans (hot-seat) a defeated player simply drops out
  const humans = s.players.filter(p => p.human), livingHumans = humans.filter(p => p.alive);
  const living = s.players.filter(p => p.alive), teams = new Set(living.map(p => teamOf(p.id)));
  if (humans.length && !livingHumans.length) s.over = 'defeat';
  else if (teams.size <= 1) { s.over = livingHumans.length ? 'victory' : 'ended'; s.winners = living.map(p => p.name); }
  if (s.over) io.gameOver?.(s.over);
}

// ---------- week events (each new week has a theme, as in the classic games) ----------
const PLAIN_WEEKS = ['Week of the Ash Moth', 'Week of Embers', 'Week of the Long Night', 'Week of Iron Rain', 'Week of the Silent Bells'];
export function rollWeekEvent() {
  const s = G.s, r = s.weekEvents === false ? 0.99 : Math.random();
  const units = [...new Set(s.players.flatMap(p => FACTIONS[p.faction].units))];
  if (r < 0.45) { const u = units[Math.floor(Math.random() * units.length)]; s.weekEvent = { type: 'unit', unit: u, title: `Week of the ${UNITS[u].name}`, desc: `${UNITS[u].name} muster in greater numbers this week (+${UNITS[u].tier >= 4 ? 2 : 5} growth).` }; }
  else if (r < 0.6) { s.weekEvent = { type: 'plenty', title: 'Week of Plenty', desc: 'Supply convoys arrive: every lord receives 3 of each rare material.' }; for (const p of s.players) if (p.alive) for (const k of ['plasteel', 'blackstone', 'wraithbone', 'psycrystal']) p.res[k] += 3; }
  else if (r < 0.7) { s.weekEvent = { type: 'tithe', title: 'Week of the Tithe', desc: 'Every lord receives 2,500 auramite from the sector tithes.' }; for (const p of s.players) if (p.alive) p.res.auramite += 2500; }
  else if (r < 0.77) { s.weekEvent = { type: 'famine', title: 'Week of Famine', desc: 'Blight strikes the hive-farms: troop growth is halved this week.' }; }
  else if (r < 0.85) { s.weekEvent = { type: 'swarm', title: 'Week of the Swarm', desc: 'Wild creatures breed fast: every wandering group grows by a quarter.' }; for (const o of Object.values(s.objects)) if (o.type === 'monster') o.count = Math.ceil(o.count * 1.25); }
  else s.weekEvent = { type: 'plain', title: PLAIN_WEEKS[Math.floor(Math.random() * PLAIN_WEEKS.length)], desc: 'Fresh troops are ready to muster.' };
  s.weekEvent.week = Math.floor((s.day - 1) / 7) + 1; s.weekEvent.seen = false;
}

// ---------- kingdom ----------
export function dismissHero(h) {
  if (heroesOf(h.owner).length <= 1) return false;
  delete G.s.heroes[h.id];
  return true;
}
export function barter(pid, give, get, qty) {
  // rate improves with every Trade Exchange you own
  const p = G.s.players[pid], markets = townsOf(pid).filter(t => t.built.market).length;
  if (!markets || give === get) return false;
  const v = k => (RES_INFO[k].rare ? 2 : 1) * (k === 'auramite' ? 1 / 250 : 1);
  const rate = Math.max(1.5, 4 - 0.5 * (markets - 1)) * v(get) / v(give);   // units of `give` per unit of `get`
  const cost = Math.ceil(rate * qty);
  if (p.res[give] < cost) return false;
  p.res[give] -= cost; p.res[get] += qty;
  return cost;
}
export function barterRate(pid, give, get) {
  const markets = townsOf(pid).filter(t => t.built.market).length;
  if (!markets || give === get) return null;
  const v = k => (RES_INFO[k].rare ? 2 : 1) * (k === 'auramite' ? 1 / 250 : 1);
  return Math.ceil(Math.max(1.5, 4 - 0.5 * (markets - 1)) * v(get) / v(give));
}
export function recruitAll(t, army) {
  const p = G.s.players[t.owner]; let n = 0;
  for (const u of [...FACTIONS[t.faction].units].reverse()) { const k = maxRecruit(t, u, p.res); if (k > 0 && recruit(t, u, k, army)) n += k; }
  return n;
}

// ---------- turns ----------
function newDay() {
  const s = G.s;
  s.day++;
  const week = (s.day - 1) % 7 === 0;
  for (const p of s.players) {
    if (!p.alive) continue;
    const inc = dailyIncome(p.id);
    for (const k in inc) p.res[k] += inc[k];
  }
  for (const h of Object.values(s.heroes)) {
    // a flight or wade that ended on a mountain or pool sets the army down on firm ground nearby
    if (!passable(s.tiles[h.y * s.W + h.x]) && !objAt(h.x, h.y)) { const t = freeTileNear(h.x, h.y); if (t) { h.x = t.x; h.y = t.y; } }
    h.mp = maxMp(h); h.castToday = false;
    h.mana = Math.min(maxMana(h), h.mana + 2 + skillValue(h, 'mysticism') + hstat(h, 'regen'));
    const t = objAt(h.x, h.y);
    if (t && t.type === 'town' && t.owner === h.owner && guildLevel(t)) h.mana = Math.max(h.mana, maxMana(h));
  }
  if (week) rollWeekEvent();
  if (week) for (const h of Object.values(s.heroes)) {
    if (hstat(h, 'manaWeekly')) h.mana = Math.max(h.mana, maxMana(h));
    if (hstat(h, 'revealWeekly')) reveal(h.owner, s.W >> 1, s.H >> 1, s.W);
  }
  for (const o of Object.values(s.objects)) {
    if (o.type === 'town') { o.builtToday = false; if (week) weeklyGrowth(o); }
    if (week && o.type === 'monster') o.count = Math.ceil(o.count * 1.08);
  }
  if (week) io.message?.(`Week ${Math.floor((s.day - 1) / 7) + 1} begins: ${s.weekEvent.title}.`);
}

export async function endTurn() {
  const s = G.s;
  if (s.over) return;
  for (;;) {
    s.current = (s.current + 1) % s.players.length;
    if (s.current === 0) newDay();
    const p = s.players[s.current];
    if (!p.alive) continue;
    if (p.human) { s.viewer = p.id; break; }
    io.aiStart?.(p);
    await aiTurn(p.id);
    io.aiEnd?.(p);
    if (s.over || !s.players.some(q => q.human)) return;
  }
  io.turnStart?.();
}

export function mergeGarrison(t, h) {
  for (let i = 0; i < 7; i++) {
    const st = t.garrison[i];
    if (st && addToArmy(h.army, st.type, st.count)) t.garrison[i] = null;
  }
}
