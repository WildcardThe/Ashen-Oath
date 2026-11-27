// Tactical hex combat engine (pure logic, no DOM).
// Two-hex units, sieges (walls, gate, moat, towers, bombard), morale, luck and school spells.
import { UNITS, SPELLS, HERO_DEFS, unitValue, hstat, skillValue, skillLevel, spellPower, heroMorale, heroLuck, isUndying, STAT_LABEL } from './data.js';

export const COLS = 15, ROWS = 11;
const ROWSETS = { 1: [5], 2: [3, 7], 3: [2, 5, 8], 4: [1, 4, 6, 9], 5: [1, 3, 5, 7, 9], 6: [0, 2, 4, 6, 8, 10], 7: [0, 2, 3, 5, 7, 8, 10] };
export const WALL_COL = 10, GATE_ROW = 5, MOAT_COL = 9;
const SECTION_OF = r => (r <= 2 ? 'top' : r <= 4 ? 'upper' : r <= 7 ? 'lower' : 'bottom');

export const hk = (c, r) => r * COLS + c;
const inb = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const rnd = Math.random;

export function hexNeighbors(c, r) {
  const d = (r & 1) ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]] : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  const out = [];
  for (const [dc, dr] of d) { const c2 = c + dc, r2 = r + dr; if (inb(c2, r2)) out.push([c2, r2]); }
  return out;
}
export function hexDist(c1, r1, c2, r2) {
  const x1 = c1 - (r1 - (r1 & 1)) / 2, z1 = r1, y1 = -x1 - z1;
  const x2 = c2 - (r2 - (r2 & 1)) / 2, z2 = r2, y2 = -x2 - z2;
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

// ---------- geometry of stacks ----------
const tailDir = s => (s.side === 0 ? -1 : 1);
export function cells(s, c = s.c, r = s.r) { return s.big ? [[c, r], [c + tailDir(s), r]] : [[c, r]]; }
function cellsDist(A, B) { let m = Infinity; for (const [a, b] of A) for (const [c, d] of B) m = Math.min(m, hexDist(a, b, c, d)); return m; }
export const stackDist = (a, t) => cellsDist(cells(a), cells(t));

// ---------- creation ----------
export function createBattle(att, def, opts = {}) {
  const b = {
    sides: [{ hero: att.hero || null, owner: att.owner }, { hero: def.hero || null, owner: def.owner }],
    stacks: [], obstacles: new Set(), round: 0, queue: [], waitQ: [], active: -1, q: [],
    cast: [false, false], log: [], over: false, winner: -1, retreated: -1, kills: [0, 0], siege: null,
  };
  if (opts.siege) {
    const lv = opts.siege.level;
    b.siege = {
      level: lv, walls: { top: 2, upper: 2, lower: 2, bottom: 2 }, gate: 2, moat: lv >= 2,
      towers: [...(lv >= 2 ? [{ id: 'keep', hp: 3 }] : []), ...(lv >= 3 ? [{ id: 'north', hp: 2 }, { id: 'south', hp: 2 }] : [])],
      towerDmg: opts.siege.towerDmg || 12,
      faction: opts.siege.faction || 'concord', cannon: opts.siege.cannon || 'concord',   // whose walls, whose siege gun (art)
    };
  }
  [att, def].forEach((side, si) => {
    const units = side.units.slice(0, 7);
    const rows = ROWSETS[units.length] || [];
    const army = units.map(u => UNITS[u.type]);
    const factions = new Set(army.map(u => u.faction));
    const h = side.hero;
    let morale = h ? heroMorale(h) - Math.max(0, factions.size - 1) : 0;
    let luck = h ? heroLuck(h) : 0;
    // the opposing commander's artifacts can sap morale and luck
    const foe = (si === 0 ? def : att).hero;
    if (foe) { morale -= hstat(foe, 'enemyMorale'); luck -= hstat(foe, 'enemyLuck'); }
    morale = Math.max(-3, Math.min(3, morale)); luck = Math.max(-3, Math.min(3, luck));
    if (h && hstat(h, 'noBadMorale')) morale = Math.max(0, morale);
    units.forEach((u, i) => {
      const U = UNITS[u.type];
      const big = !!U.big;
      const c = si === 0 ? (big ? 1 : 0) : (big ? COLS - 2 : COLS - 1);
      b.stacks.push({
        id: b.stacks.length, side: si, type: u.type, u: U, big, count: u.count, start: u.count, top: U.hp,
        c, r: rows[i], shots: U.shots, retaliated: false, defending: false, waited: false, moraleUsed: false,
        frozen: false, buffs: [], src: u.src || null, morale: U.faction === 'neutral' && !h ? 0 : morale, luck,
      });
    });
  });
  const n = 4 + Math.floor(rnd() * 4);
  const maxCol = b.siege ? MOAT_COL - 2 : COLS - 4;
  let tries = 0;
  while (b.obstacles.size < n && tries++ < 300) {
    const c = 2 + Math.floor(rnd() * (maxCol - 1)), r = Math.floor(rnd() * ROWS);
    if (!b.stacks.some(s => cells(s).some(([a, d]) => a === c && d === r))) b.obstacles.add(hk(c, r));
  }
  newRound(b);
  advance(b);
  return b;
}

// ---------- stats ----------
const buffSum = (s, k) => s.buffs.reduce((a, x) => a + (x.stat === k ? x.amount : 0), 0);
const hasBuff = (s, k) => s.buffs.some(x => x.stat === k);
const moraleOf = s => Math.max(-3, Math.min(3, s.morale + buffSum(s, 'morale')));
const luckOf = s => Math.max(-3, Math.min(3, s.luck + buffSum(s, 'luck')));
const heroOf = (b, s) => b.sides[s.side].hero;
function specBonus(h, s) {
  const d = h && HERO_DEFS[h.name];
  if (!d || d.spec.type !== 'unit' || s.type.replace(/_u$/, '') !== d.spec.unit) return 0;
  return 1 + Math.floor(h.level / 4);
}
export function atkOf(b, s) { const h = heroOf(b, s); return s.u.atk + (h ? hstat(h, 'atk') + specBonus(h, s) : 0) + buffSum(s, 'atk'); }
export function defOf(b, s) {
  const h = heroOf(b, s);
  let d = s.u.def + (h ? hstat(h, 'def') + specBonus(h, s) : 0) + buffSum(s, 'def');
  if (s.defending) d += Math.ceil(d * 0.25) + 1;
  return Math.max(0, d);
}
export function spd(b, s) { const h = heroOf(b, s); return Math.max(1, s.u.spd + buffSum(s, 'spd') + (h && specBonus(h, s) ? 1 : 0)); }

// ---------- rounds and turns ----------
function newRound(b) {
  b.round++;
  for (const s of b.stacks) {
    s.retaliated = false; s.waited = false; s.moraleUsed = false; s.frozen = false;
    if (b.round > 1) { s.buffs.forEach(x => x.rounds--); s.buffs = s.buffs.filter(x => x.rounds > 0); }
    const hr = b.round > 1 && s.count > 0 && heroOf(b, s); if (hr) { const rg = hstat(hr, 'regenTroops'); if (rg) heal(s, Math.floor(s.start * s.u.hp * rg)); }
  }
  b.cast = [false, false];
  b.queue = b.stacks.filter(s => s.count > 0).sort((a, c) => spd(b, c) - spd(b, a) || a.side - c.side || a.id - c.id).map(s => s.id);
  b.waitQ = [];
  b.log.push(`Round ${b.round}`);
  if (b.siege) siegeRound(b);
}

function advance(b) {
  if (checkOver(b)) return;
  for (let g = 0; g < 40; g++) {
    let s = null;
    while (b.queue.length && !s) { const t = b.stacks[b.queue.shift()]; if (t.count > 0) s = t; }
    while (!s && b.waitQ.length) { const t = b.stacks[b.waitQ.shift()]; if (t.count > 0) s = t; }
    if (!s) { newRound(b); if (checkOver(b)) return; continue; }
    s.defending = false;
    if (s.buffs.some(x => x.stat === 'blind')) {
      b.q.push({ type: 'wait', id: s.id });
      b.log.push(`${s.u.name} are blinded and cannot act.`);
      continue;
    }
    const mor = moraleOf(s);
    if (mor < 0 && !s.waited && rnd() < -mor / 12) {
      s.frozen = true;
      b.q.push({ type: 'morale', id: s.id, good: false });
      b.log.push(`${s.u.name} falter with low morale and lose their turn.`);
      continue;
    }
    b.active = s.id;
    return;
  }
}

// After a real action: a chance of good morale granting another action, otherwise next stack.
function endAction(b, s) {
  if (!b.over && s.count > 0 && moraleOf(s) > 0 && !s.moraleUsed && rnd() < moraleOf(s) / 24) {
    s.moraleUsed = true;
    b.q.push({ type: 'morale', id: s.id, good: true });
    b.log.push(`${s.u.name} surge forward with high morale!`);
    if (checkOver(b)) return;
    b.active = s.id;
    return;
  }
  advance(b);
}
const drain = (b, ev) => { const out = ev.concat(b.q); b.q = []; return out; };

function checkOver(b) {
  if (b.over) return true;
  const a0 = b.stacks.some(s => s.side === 0 && s.count > 0), a1 = b.stacks.some(s => s.side === 1 && s.count > 0);
  if (!a0 || !a1) { b.over = true; b.winner = a0 ? 0 : 1; b.active = -1; return true; }
  return false;
}

export function turnOrder(b) {
  const seen = new Set(), out = [];
  for (const id of [b.active, ...b.queue, ...b.waitQ]) {
    const s = b.stacks[id];
    if (s && s.count > 0 && !seen.has(id)) { seen.add(id); out.push(s); }
  }
  return out;
}

// ---------- occupancy ----------
export const alive = (b, side) => b.stacks.filter(s => s.count > 0 && s.side === side);
export function stackAt(b, c, r) { return b.stacks.find(s => s.count > 0 && cells(s).some(([a, d]) => a === c && d === r)) || null; }
export function wallAt(b, c, r) {
  if (!b.siege || c !== WALL_COL) return null;
  if (r === GATE_ROW) return b.siege.gate > 0 ? { kind: 'gate' } : null;
  const sec = SECTION_OF(r);
  return b.siege.walls[sec] > 0 ? { kind: 'wall', sec } : null;
}
export const isMoat = (b, c) => !!(b.siege && b.siege.moat && c === MOAT_COL);
function hexOpen(b, c, r, s) {
  if (!inb(c, r) || b.obstacles.has(hk(c, r))) return false;
  const w = wallAt(b, c, r);
  if (w && !(w.kind === 'gate' && s && s.side === 1)) return false;
  const o = stackAt(b, c, r);
  return !o || o === s;
}
export function isFree(b, c, r, ignore) { return hexOpen(b, c, r, ignore); }
export function fits(b, s, c, r) { return cells(s, c, r).every(([a, d]) => hexOpen(b, a, d, s)); }

export function reachable(b, s) {
  const dist = new Map(), prev = new Map(); const sp = spd(b, s);
  dist.set(hk(s.c, s.r), 0);
  if (s.u.ab.includes('flyer')) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const d = hexDist(s.c, s.r, c, r);
      if (d > 0 && d <= sp && fits(b, s, c, r)) dist.set(hk(c, r), d);
    }
    return { dist, prev, flyer: true };
  }
  const q = [[s.c, s.r]];
  while (q.length) {
    const [c, r] = q.shift(); const d = dist.get(hk(c, r));
    if (d >= sp) continue;
    if (d > 0 && s.side === 0 && cells(s, c, r).some(([a]) => isMoat(b, a))) continue;
    for (const [nc, nr] of hexNeighbors(c, r)) {
      const k = hk(nc, nr);
      if (dist.has(k) || !fits(b, s, nc, nr)) continue;
      dist.set(k, d + 1); prev.set(k, hk(c, r)); q.push([nc, nr]);
    }
  }
  return { dist, prev, flyer: false };
}
export function pathFor(reach, s, c, r) {
  if (reach.flyer) return [[s.c, s.r], [c, r]];
  const out = []; let k = hk(c, r);
  while (k !== undefined) { out.push([k % COLS, Math.floor(k / COLS)]); k = reach.prev.get(k); }
  return out.reverse();
}
// Head positions from which `s` can strike `t` (current position included).
export function meleeSpots(b, s, t, reach = reachable(b, s)) {
  const tc = cells(t), out = [];
  const consider = (c, r) => { if (cellsDist(cells(s, c, r), tc) === 1) out.push([c, r]); };
  consider(s.c, s.r);
  for (const k of reach.dist.keys()) { const c = k % COLS, r = Math.floor(k / COLS); if (c !== s.c || r !== s.r) consider(c, r); }
  return out;
}
export function gateSpots(b, s, reach = reachable(b, s)) {
  if (!b.siege || b.siege.gate <= 0 || s.side !== 0) return [];
  const g = [[WALL_COL, GATE_ROW]], out = [];
  const consider = (c, r) => { if (cellsDist(cells(s, c, r), g) === 1) out.push([c, r]); };
  consider(s.c, s.r);
  for (const k of reach.dist.keys()) { const c = k % COLS, r = Math.floor(k / COLS); if (c !== s.c || r !== s.r) consider(c, r); }
  return out;
}

export function adjacentEnemy(b, s) { return b.stacks.some(t => t.count > 0 && t.side !== s.side && stackDist(s, t) === 1); }
export function canShoot(b, s) { return s.shots > 0 && !adjacentEnemy(b, s); }
export function totalHp(s) { return s.count > 0 ? (s.count - 1) * s.u.hp + s.top : 0; }

const behindWalls = (b, a, t) => !!(b.siege && t.side === 1 && a.side === 0 && t.c > WALL_COL && a.c <= WALL_COL);
export function dmgMult(b, a, d, ranged) {
  const ha0 = heroOf(b, a), hd0 = heroOf(b, d);
  const A = atkOf(b, a), D = defOf(b, d) * (1 - Math.min(0.8, ha0 ? hstat(ha0, 'pierce') : 0));
  let m = A >= D ? 1 + 0.05 * Math.min(A - D, 60) : Math.max(0.3, 1 - 0.025 * (D - A));
  if (ranged && stackDist(a, d) > 10) m *= 0.5;
  if (ranged && behindWalls(b, a, d)) m *= 0.5;
  if (!ranged && a.u.shots > 0 && !a.u.ab.includes('brawler')) m *= 0.5;
  const ha = heroOf(b, a), hd = heroOf(b, d);
  if (ha) m *= 1 + (ranged ? skillValue(ha, 'archery') + hstat(ha, 'archery') : skillValue(ha, 'offense'));
  if (hd) m *= 1 - skillValue(hd, 'armorer');
  if (hd && ranged) m *= 1 - Math.min(0.5, hstat(hd, 'enemyRanged'));
  if (ranged) m *= Math.max(0.1, 1 + buffSum(a, 'ranged') / 100) * (1 - Math.min(80, buffSum(d, 'rangedWard')) / 100);
  else m *= 1 - Math.min(80, buffSum(d, 'meleeWard')) / 100;
  if (d.u.tier >= 4) m *= 1 + buffSum(a, 'slayer') / 100;
  return m;
}
export function damageRange(b, a, d, ranged) {
  const m = dmgMult(b, a, d, ranged);
  return [Math.max(1, Math.floor(a.u.min * a.count * m)), Math.max(1, Math.floor(a.u.max * a.count * m))];
}
export function killsFor(t, dmg) { const tot = totalHp(t) - dmg; return t.count - (tot <= 0 ? 0 : Math.ceil(tot / t.u.hp)); }

function rollBase(s) {
  const u = s.u, n = Math.min(s.count, 10); let t = 0;
  const roll = buffSum(s, 'roll');
  if (roll > 0) return u.max * s.count;
  if (roll < 0) return u.min * s.count;
  for (let i = 0; i < n; i++) t += u.min + Math.floor(rnd() * (u.max - u.min + 1));
  return t * s.count / n;
}
function applyDamage(b, t, dmg) {
  const before = t.count, tot = totalHp(t) - dmg;
  if (tot <= 0) { t.count = 0; t.top = 0; } else { t.count = Math.ceil(tot / t.u.hp); t.top = tot - (t.count - 1) * t.u.hp; }
  const killed = before - t.count;
  b.kills[t.side] += killed * t.u.hp;
  return killed;
}
function heal(s, amt) {
  const max = s.start * s.u.hp, cur = totalHp(s), tot = Math.min(max, cur + amt);
  if (tot <= 0) return 0;
  s.count = Math.ceil(tot / s.u.hp); s.top = tot - (s.count - 1) * s.u.hp;
  return tot - cur;
}
function strike(b, a, t, ranged, ev) {
  let dmg = rollBase(a) * dmgMult(b, a, t, ranged), luck = null;
  const lk = luckOf(a);
  if (lk > 0 && rnd() < lk / 24) { dmg *= 2; luck = 'good'; }
  else if (lk < 0 && rnd() < -lk / 12) { dmg *= 0.5; luck = 'bad'; }
  dmg = Math.max(1, Math.floor(dmg));
  const killed = applyDamage(b, t, dmg);
  if (a.u.ab.includes('lifeDrain') && a.count > 0) heal(a, Math.floor(dmg * 0.5));
  const ha = heroOf(b, a); if (ha && a.count > 0) { const ls = hstat(ha, 'lifesteal'); if (ls) heal(a, Math.floor(dmg * ls)); }
  t.buffs = t.buffs.filter(x => x.stat !== 'blind');
  const th = !ranged && buffSum(t, 'thorns');
  if (th > 0 && a.count > 0) { const back = Math.max(1, Math.floor(dmg * th / 100)); const k2 = applyDamage(b, a, back); b.q.push({ type: 'strike', id: -1, target: a.id, dmg: back, killed: k2, spell: 'pyreaegis', countAfter: a.count }); }
  // basilisk gaze: a chance to stiffen the target to stone for two rounds
  if (a.u.ab.includes('petrify') && !ranged && t.count > 0 && !t.buffs.some(x => x.src === 'petrify') && rnd() < (a.u.elite ? 0.35 : 0.25)) {
    t.buffs.push({ stat: 'spd', amount: -3, rounds: 2, src: 'petrify' }, { stat: 'def', amount: -3, rounds: 2, src: 'petrify' });
    b.log.push(`${t.u.name} turn${t.count > 1 ? '' : 's'} partly to stone!`);
  }
  ev.push({ type: 'strike', id: a.id, target: t.id, dmg, killed, ranged, luck, countAfter: t.count, selfCount: a.count });
  b.log.push(`${luck === 'good' ? 'Lucky strike! ' : luck === 'bad' ? 'Bad luck: ' : ''}${a.u.name} ${ranged ? 'shoot' : 'strike'} ${t.u.name} for ${dmg}${killed ? `, ${killed} fall` : ''}.`);
}

// ---------- siege ----------
function siegeRound(b) {
  const S = b.siege;
  const attackers = alive(b, 0), defenders = alive(b, 1);
  if (!attackers.length || !defenders.length) return;
  const hero = b.sides[0].hero;
  const bal = hero ? skillLevel(hero, 'ballistics') : 0;
  for (let i = 0; i < 1 + bal; i++) {
    const targets = [];
    for (const k in S.walls) if (S.walls[k] > 0) targets.push({ kind: 'wall', sec: k });
    if (S.gate > 0) targets.push({ kind: 'gate' }, { kind: 'gate' });
    for (const t of S.towers) if (t.hp > 0) targets.push({ kind: 'tower', id: t.id });
    if (!targets.length) break;
    const t = targets[Math.floor(rnd() * targets.length)];
    const hit = rnd() < 0.55 + 0.15 * bal;
    let destroyed = false;
    if (hit) {
      const dmg = bal >= 2 && rnd() < 0.3 ? 2 : 1;
      if (t.kind === 'wall') { S.walls[t.sec] = Math.max(0, S.walls[t.sec] - dmg); destroyed = S.walls[t.sec] === 0; }
      if (t.kind === 'gate') { S.gate = Math.max(0, S.gate - dmg); destroyed = S.gate === 0; }
      if (t.kind === 'tower') { const tw = S.towers.find(x => x.id === t.id); tw.hp = Math.max(0, tw.hp - dmg); destroyed = tw.hp === 0; }
    }
    b.q.push({ type: 'catapult', target: t, hit, destroyed });
    b.log.push(`The siege bombard ${hit ? `hits the ${t.kind === 'wall' ? 'wall' : t.kind === 'gate' ? 'gate' : 'tower'}${destroyed ? ' and brings it down' : ''}` : 'misses'}.`);
  }
  for (const tw of S.towers) {
    if (tw.hp <= 0) continue;
    const foes = alive(b, 0); if (!foes.length) break;
    const t = foes.reduce((best, s) => (!best || s.count * unitValue(s.type) > best.count * unitValue(best.type) ? s : best), null);
    const dmg = Math.round(S.towerDmg * (tw.id === 'keep' ? 1.5 : 1) * (0.85 + rnd() * 0.3));
    const killed = applyDamage(b, t, dmg);
    b.q.push({ type: 'tower', tower: tw.id, target: t.id, dmg, killed, countAfter: t.count });
    b.log.push(`A tower fires on ${t.u.name} for ${dmg}${killed ? `, ${killed} fall` : ''}.`);
  }
}

// ---------- actions (each returns an event list, or null if invalid) ----------
function moveTo(b, s, c, r, ev) {
  if (c === s.c && r === s.r) return true;
  const reach = reachable(b, s);
  if (!reach.dist.has(hk(c, r))) return false;
  ev.push({ type: 'move', id: s.id, path: pathFor(reach, s, c, r) });
  s.c = c; s.r = r;
  return true;
}
export function actMove(b, s, c, r) {
  if (b.over || b.active !== s.id || (c === s.c && r === s.r)) return null;
  const ev = [];
  if (!moveTo(b, s, c, r, ev)) return null;
  endAction(b, s);
  return drain(b, ev);
}
export function actMelee(b, s, t, c, r) {
  if (b.over || b.active !== s.id || !t || t.count <= 0 || t.side === s.side) return null;
  if (cellsDist(cells(s, c, r), cells(t)) !== 1) return null;
  const ev = [];
  if (!(c === s.c && r === s.r) && !fits(b, s, c, r)) return null;
  if (!moveTo(b, s, c, r, ev)) return null;
  strike(b, s, t, false, ev);
  if (t.count > 0 && s.count > 0 && !s.u.ab.includes('noRetal') && (!t.retaliated || t.u.ab.includes('shieldwall') || hasBuff(t, 'retal'))) {
    t.retaliated = true; strike(b, t, s, false, ev); ev[ev.length - 1].retal = true;
  }
  if (s.u.ab.includes('doubleStrike') && s.count > 0 && t.count > 0) strike(b, s, t, false, ev);
  if (checkOver(b)) return drain(b, ev);
  endAction(b, s);
  return drain(b, ev);
}
export function actShoot(b, s, t) {
  if (b.over || b.active !== s.id || !t || t.count <= 0 || t.side === s.side || !canShoot(b, s)) return null;
  s.shots--;
  const ev = [];
  strike(b, s, t, true, ev);
  if (checkOver(b)) return drain(b, ev);
  endAction(b, s);
  return drain(b, ev);
}
export function actBatter(b, s, c = s.c, r = s.r) {
  if (b.over || b.active !== s.id || !b.siege || b.siege.gate <= 0 || s.side !== 0) return null;
  if (cellsDist(cells(s, c, r), [[WALL_COL, GATE_ROW]]) !== 1) return null;
  const ev = [];
  if (!moveTo(b, s, c, r, ev)) return null;
  b.siege.gate = Math.max(0, b.siege.gate - (s.u.tier >= 3 || s.count >= 20 ? 1 : 0.5));
  const destroyed = b.siege.gate <= 0;
  ev.push({ type: 'batter', id: s.id, destroyed });
  b.log.push(`${s.u.name} batter the gate${destroyed ? ' and smash it open!' : '.'}`);
  endAction(b, s);
  return drain(b, ev);
}
export function actDefend(b, s) {
  if (b.over || b.active !== s.id) return null;
  s.defending = true;
  b.log.push(`${s.u.name} brace for the enemy.`);
  advance(b);
  return drain(b, [{ type: 'defend', id: s.id }]);
}
export function actWait(b, s) {
  if (b.over || b.active !== s.id || s.waited) return null;
  s.waited = true; b.waitQ.push(s.id);
  advance(b);
  return drain(b, [{ type: 'wait', id: s.id }]);
}
export function actRetreat(b, side) { b.over = true; b.winner = 1 - side; b.retreated = side; b.active = -1; }

// ---------- spells ----------
const combatSpell = sp => SPELLS[sp] && SPELLS[sp].kind !== 'adventure';
export const spellCost = (h, sp) => Math.max(1, SPELLS[sp].cost - (h ? hstat(h, 'spellCost') : 0));
export function castable(h, sp) { return h && h.spells.includes(sp) && combatSpell(sp) && h.mana >= spellCost(h, sp); }
export function canCast(b, side) {
  const h = b.sides[side].hero;
  return !!h && !b.over && !b.cast[side] && h.spells.some(sp => castable(h, sp));
}
export function spellNeedsTarget(sp) { return SPELLS[sp].target !== 'none'; }
export function validSpellTarget(b, side, sp, t, hex) {
  const S = SPELLS[sp];
  if (S.kind === 'tremor') return !!b.siege && side === 0;
  if (S.target === 'none') return true;
  if (S.kind === 'obstacle') return !!hex && hexOpen(b, hex.c, hex.r, null);
  if (S.kind === 'clear') return !!hex && b.obstacles.has(hk(hex.c, hex.r));
  if (S.target === 'any') return !!hex;
  if (!t || t.count <= 0) return false;
  if (S.target === 'any_stack') return true;
  if (t.side !== side && hasBuff(t, 'nullmagic')) return false;
  if (S.kind === 'raise') return t.side === side && t.count < t.start && (isUndying(t.u) || t.u.faction === 'rustbound' || t.u.faction === 'deathless');
  return S.target === 'enemy' ? t.side !== side : t.side === side;
}
function spellAmount(h, sp) {
  const S = SPELLS[sp], p = spellPower(h, sp), sl = skillLevel(h, S.school);
  const extra = 1 + 0.25 * sl + (S.kind.includes('dmg') || S.kind === 'area' ? hstat(h, 'spellDmg') : 0);
  return { amt: Math.round((S.base || 0) + (S.per || 0) * p) * extra, rounds: 1 + p + sl, sl };
}
export function areaHexes(c, r) { return [[c, r], ...hexNeighbors(c, r)]; }
function areaTargets(b, c, r) {
  const set = new Set();
  for (const [a, d] of areaHexes(c, r)) { const s = stackAt(b, a, d); if (s) set.add(s); }
  return [...set];
}
// a free hex for a stack arriving mid-battle, as close as possible to its own edge
function freeSpot(b, st) {
  for (let k = 0; k < COLS; k++) {
    const c = st.side === 0 ? k + (st.big ? 1 : 0) : COLS - 1 - k - (st.big ? 1 : 0);
    const rows = [...Array(ROWS).keys()].sort((a, d) => Math.abs(a - ROWS / 2) - Math.abs(d - ROWS / 2));
    for (const r of rows) if (fits(b, st, c, r)) return [c, r];
  }
  return null;
}
function addStack(b, side, type, count, like) {
  const U = UNITS[type], st = {
    id: b.stacks.length, side, type, u: U, big: !!U.big, count, start: count, top: U.hp, c: 0, r: 0, shots: U.shots,
    retaliated: false, defending: false, waited: false, moraleUsed: false, frozen: false, buffs: [], src: null, summoned: true,
    morale: like ? like.morale : 0, luck: like ? like.luck : 0,
  };
  const at = freeSpot(b, st); if (!at) return null;
  [st.c, st.r] = at; b.stacks.push(st);
  return st;
}
export function actCast(b, side, sp, t, hex) {
  const h = b.sides[side].hero; const S = SPELLS[sp];
  if (!h || b.over || b.cast[side] || !castable(h, sp) || !validSpellTarget(b, side, sp, t, hex)) return null;
  h.mana -= spellCost(h, sp); b.cast[side] = true;
  const { amt, rounds: r0, sl } = spellAmount(h, sp), rounds = Math.min(S.maxRounds || 99, r0);
  const ev = [{ type: 'spell', spell: sp, side, target: t ? t.id : -1, at: hex || (t ? { c: t.c, r: t.r } : null) }];
  // enemy rites: null fields shield a stack, wards soften the school's damage
  const hurt = (list, mult = 1) => {
    for (const s of list) {
      if (s.count <= 0 || (s.side !== side && hasBuff(s, 'nullmagic'))) continue;
      const ward = buffSum(s, 'ward_' + S.school);
      const dmg = Math.max(1, Math.round(amt * mult * (1 - Math.min(90, ward) / 100)));
      const killed = applyDamage(b, s, dmg);
      ev.push({ type: 'strike', id: -1, target: s.id, dmg, killed, spell: sp, countAfter: s.count });
    }
  };
  const addBuff = (s, stat, amount) => s.buffs.push({ stat, amount, rounds, label: S.label || STAT_LABEL[stat] || stat, sp });
  const val = () => S.amount + (S.step ?? 1) * sl;
  const applyBuff = (s, neg) => {
    if (S.stats) for (const [st, a] of S.stats) addBuff(s, st, a + (a > 0 ? sl : -sl));
    else addBuff(s, S.stat, neg && (S.step ?? 1) > 0 ? S.amount - sl : val());
  };
  // a warp mirror on the target may throw a damaging rite back at the caster's own troops
  let tt = t;
  if (t && t.side !== side && (S.kind === 'dmg' || S.kind === 'chain') && rnd() * 100 < buffSum(t, 'mirror')) {
    const own = alive(b, side); if (own.length) { tt = own[Math.floor(rnd() * own.length)]; b.log.push(`The Warp Mirror throws ${S.name} back!`); }
  }
  switch (S.kind) {
    case 'dmg': hurt([tt]); break;
    case 'area': hurt(areaTargets(b, hex.c, hex.r)); break;
    case 'ring': { const centre = stackAt(b, hex.c, hex.r); hurt(areaTargets(b, hex.c, hex.r).filter(x => x !== centre)); break; }
    case 'mass_dmg': hurt(alive(b, 1 - side)); break;
    case 'all_dmg': hurt(b.stacks.filter(x => x.count > 0 && !(S.living && isUndying(x.u)))); break;
    case 'tag_dmg': hurt(alive(b, 1 - side).filter(x => isUndying(x.u))); break;
    case 'chain': {
      const hit = [tt]; let m = 1; hurt([tt], 1);
      for (let k = 0; k < 3; k++) {
        const last = hit[hit.length - 1], next = alive(b, 1 - side).filter(x => !hit.includes(x)).sort((a, c) => stackDist(last, a) - stackDist(last, c))[0];
        if (!next) break; m /= 2; hit.push(next); hurt([next], m);
      }
      break;
    }
    case 'heal': heal(t, Math.round(amt)); ev.push({ type: 'heal', target: t.id, countAfter: t.count }); break;
    case 'raise': heal(t, Math.round(amt)); ev.push({ type: 'heal', target: t.id, countAfter: t.count }); break;
    case 'mass_heal':
      for (const s of alive(b, side)) { heal(s, Math.round(amt)); s.buffs = s.buffs.filter(x => x.amount > 0); ev.push({ type: 'heal', target: s.id, countAfter: s.count }); }
      break;
    case 'buff': applyBuff(t); break;
    case 'mass_buff': for (const s of alive(b, side)) applyBuff(s); break;
    case 'debuff': applyBuff(t, true); break;
    case 'mass_debuff': for (const s of alive(b, 1 - side)) if (!hasBuff(s, 'nullmagic')) applyBuff(s, true); break;
    case 'dispel': t.buffs = []; break;
    case 'summon': {
      const like = alive(b, side)[0], n = Math.max(1, Math.round(amt / UNITS[S.unit].hp));
      const st = addStack(b, side, S.unit, n, like);
      if (st) ev.push({ type: 'summon', id: st.id }); else b.log.push('There is no room on the field for the summoned host.');
      break;
    }
    case 'clone': {
      const st = addStack(b, side, t.type, Math.max(1, Math.round(t.count * (0.4 + 0.1 * sl))), t);
      if (st) ev.push({ type: 'summon', id: st.id });
      break;
    }
    case 'obstacle': {
      b.obstacles.add(hk(hex.c, hex.r));
      const nb = hexNeighbors(hex.c, hex.r).find(([c, r]) => hexOpen(b, c, r, null)); if (nb) b.obstacles.add(hk(nb[0], nb[1]));
      b.bgDirty = true; break;
    }
    case 'clear': b.obstacles.delete(hk(hex.c, hex.r)); b.bgDirty = true; break;
    case 'tremor': {
      const W = b.siege; const secs = Object.keys(W.walls).filter(k => W.walls[k] > 0).sort(() => rnd() - 0.5).slice(0, 2);
      for (const k of secs) W.walls[k] = Math.max(0, W.walls[k] - 1);
      W.gate = Math.max(0, W.gate - 1); b.bgDirty = true; break;
    }
  }
  b.log.push(`${h.name} invokes ${S.name}${t ? ` on ${t.u.name}` : ''}.`);
  checkOver(b);
  return ev;
}

export function finishBattle(b) {
  for (const s of b.stacks) {
    if (!s.src) continue;
    const keep = s.count > 0 && b.retreated !== s.side;
    s.src.arr[s.src.idx] = keep ? { type: s.type, count: s.count } : null;
  }
  return { winner: b.winner, retreated: b.retreated, xp: [b.kills[1], b.kills[0]] };
}

// ---------------- Combat AI ----------------
function killScore(b, a, t, ranged) {
  const [lo, hi] = damageRange(b, a, t, ranged); const avg = (lo + hi) / 2;
  let sc = Math.min(t.count, avg / t.u.hp) * unitValue(t.type);
  if (avg >= totalHp(t)) sc *= 1.3;
  if (t.u.shots > 0 && t.shots > 0) sc *= 1.2;
  return sc;
}
function approachField(b, s, sources) {
  const f = new Map(); const q = [];
  for (const [c, r] of sources) { if (!fits(b, s, c, r)) continue; const k = hk(c, r); if (!f.has(k)) { f.set(k, 0); q.push([c, r]); } }
  if (s.u.ab.includes('flyer')) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!fits(b, s, c, r)) continue;
      let m = Infinity; for (const [a, d] of sources) m = Math.min(m, hexDist(c, r, a, d));
      f.set(hk(c, r), m);
    }
    return f;
  }
  while (q.length) {
    const [c, r] = q.shift(); const d = f.get(hk(c, r));
    for (const [nc, nr] of hexNeighbors(c, r)) {
      const k = hk(nc, nr); if (f.has(k) || !fits(b, s, nc, nr)) continue;
      f.set(k, d + 1); q.push([nc, nr]);
    }
  }
  return f;
}
const ringAround = list => { const out = []; for (const t of list) for (const [c, r] of cells(t)) for (const n of hexNeighbors(c, r)) out.push(n); return out; };

export function aiDecide(b, s) {
  const enemies = b.stacks.filter(e => e.count > 0 && e.side !== s.side);
  if (!enemies.length) return { type: 'defend' };
  if (canShoot(b, s)) {
    let best = null, bs = -1;
    for (const e of enemies) { const sc = killScore(b, s, e, true); if (sc > bs) { bs = sc; best = e; } }
    return { type: 'shoot', target: best };
  }
  // Defenders in a siege hold behind their walls unless an attacker is close.
  if (b.siege && s.side === 1 && b.siege.gate > 0 && Object.values(b.siege.walls).some(v => v > 0)) {
    const near = enemies.some(e => e.c > WALL_COL || stackDist(s, e) <= spd(b, s) + 1);
    if (!near) return { type: 'defend' };
  }
  const reach = reachable(b, s);
  let best = null, bs = -Infinity;
  for (const e of enemies) for (const [c, r] of meleeSpots(b, s, e, reach)) {
    const here = c === s.c && r === s.r;
    const sc = killScore(b, s, e, false) - (here ? 0 : reach.dist.get(hk(c, r))) * 0.01;
    if (sc > bs) { bs = sc; best = { target: e, c, r }; }
  }
  if (best) return { type: 'melee', ...best };
  let field = approachField(b, s, ringAround(enemies));
  const here = hk(s.c, s.r);
  if (!field.has(here) && b.siege && s.side === 0 && b.siege.gate > 0) {
    const gs = gateSpots(b, s, reach);
    if (gs.length) return { type: 'batter', c: gs[0][0], r: gs[0][1] };
    field = approachField(b, s, hexNeighbors(WALL_COL, GATE_ROW));
  }
  let bk = null, bd = field.get(here) ?? Infinity;
  for (const [k] of reach.dist) { const f = field.get(k); if (f !== undefined && f < bd) { bd = f; bk = k; } }
  if (bk !== null) return { type: 'move', c: bk % COLS, r: Math.floor(bk / COLS) };
  return { type: 'defend' };
}

export function aiAct(b, s) {
  const d = aiDecide(b, s); let ev = null;
  if (d.type === 'shoot') ev = actShoot(b, s, d.target);
  else if (d.type === 'melee') ev = actMelee(b, s, d.target, d.c, d.r);
  else if (d.type === 'move') ev = actMove(b, s, d.c, d.r);
  else if (d.type === 'batter') ev = actBatter(b, s, d.c, d.r);
  if (!ev) ev = actDefend(b, s) || [];
  return ev;
}

export function aiSpell(b, side) {
  const h = b.sides[side].hero;
  if (!h || b.cast[side] || b.over) return null;
  const enemies = alive(b, 1 - side), allies = alive(b, side);
  const val = s => s.count * unitValue(s.type);
  let best = null, bs = 60;
  for (const sp of h.spells) {
    if (!castable(h, sp)) continue;
    const S = SPELLS[sp]; const { amt } = spellAmount(h, sp);
    const kv = s => Math.min(s.count, amt / s.u.hp) * unitValue(s.type);
    if (S.kind === 'dmg') for (const e of enemies) { const sc = kv(e); if (sc > bs) { bs = sc; best = { spell: sp, target: e }; } }
    if (S.kind === 'mass_dmg') { const sc = enemies.reduce((a, e) => a + kv(e), 0); if (sc > bs) { bs = sc; best = { spell: sp }; } }
    if (S.kind === 'area') for (const e of enemies) {
      const hit = areaTargets(b, e.c, e.r); const sc = hit.reduce((a, x) => a + (x.side === side ? -1.5 : 1) * kv(x), 0);
      if (sc > bs) { bs = sc; best = { spell: sp, hex: { c: e.c, r: e.r } }; }
    }
    if (S.kind === 'all_dmg') { const sc = b.stacks.filter(x => x.count > 0 && !(S.living && isUndying(x.u))).reduce((a, x) => a + (x.side === side ? -1.3 : 1) * kv(x), 0); if (sc > bs) { bs = sc; best = { spell: sp }; } }
    if (S.kind === 'tag_dmg') { const sc = enemies.filter(x => isUndying(x.u)).reduce((a, x) => a + kv(x), 0); if (sc > bs) { bs = sc; best = { spell: sp }; } }
    if (S.kind === 'chain') for (const e of enemies) { const sc = kv(e) * 1.6; if (sc > bs) { bs = sc; best = { spell: sp, target: e }; } }
    if (S.kind === 'summon' && b.round <= 3) { const sc = amt / UNITS[S.unit].hp * unitValue(S.unit) * 0.8; if (sc > bs) { bs = sc; best = { spell: sp }; } }
    if (S.kind === 'heal') for (const a of allies) { const lost = (a.start - a.count) * a.u.hp; const sc = Math.min(lost, amt) / a.u.hp * unitValue(a.type) * 0.9; if (sc > bs) { bs = sc; best = { spell: sp, target: a }; } }
  }
  if (best) return best;
  const strongest = allies.reduce((a, c) => (!a || val(c) > val(a) ? c : a), null);
  for (const sp of h.spells) {
    if (!castable(h, sp)) continue;
    const S = SPELLS[sp];
    if (S.kind === 'buff' && strongest && !strongest.buffs.some(x => x.sp === sp) && validSpellTarget(b, side, sp, strongest)) return { spell: sp, target: strongest };
    if (S.kind === 'mass_buff' && allies.length >= 3 && !allies[0].buffs.some(x => x.sp === sp)) return { spell: sp };
    if (S.kind === 'mass_debuff' && enemies.length >= 3 && !enemies[0].buffs.some(x => x.sp === sp)) return { spell: sp };
    if (S.kind === 'debuff') { const e = enemies.reduce((a, c) => (!a || val(c) > val(a) ? c : a), null); if (e && !e.buffs.some(x => x.sp === sp) && validSpellTarget(b, side, sp, e)) return { spell: sp, target: e }; }
  }
  return null;
}
export function aiCast(b, side) {
  const sp = aiSpell(b, side); if (!sp) return null;
  return actCast(b, side, sp.spell, sp.target || null, sp.hex || null);
}

export function autoBattle(b) {
  let n = 0;
  while (!b.over && n++ < 3000) {
    const s = b.stacks[b.active]; if (!s) break;
    aiCast(b, s.side);
    if (b.over) break;
    if (b.stacks[b.active] !== s) continue;
    aiAct(b, s);
    b.q = [];
  }
  if (!b.over) { b.over = true; b.winner = 1; }
}
