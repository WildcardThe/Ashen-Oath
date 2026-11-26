// Procedural map generation and shared grid helpers.
import { TERRAIN, ARTIFACTS, artifactsByRarity, unitValue, SKILLS, SPELLS } from './data.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const MINE_FOOT = [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]];
export const TOWN_FOOT = [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, -2], [0, -2], [1, -2]];
// Large blocking scenery: tiles covered relative to the anchor, and the sprite's centre in tiles from the anchor's left edge.
export const SCENERY = {
  cave_crystal: { foot: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0]], cx: 0.5 },
  ruin_gate: { foot: [[0, 0], [1, 0]], cx: 1.0 },
  ruin_bridge: { foot: [[0, 0], [1, 0]], cx: 1.0 },
};

export class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p);
    while (i > 0) {
      const j = (i - 1) >> 1; if (P[j] <= P[i]) break;
      [K[i], K[j]] = [K[j], K[i]]; [P[i], P[j]] = [P[j], P[i]]; i = j;
    }
  }
  pop() {
    const K = this.k, P = this.p; const top = K[0]; const lk = K.pop(), lp = P.pop();
    if (K.length) {
      K[0] = lk; P[0] = lp; let i = 0; const n = K.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < n && P[l] < P[m]) m = l;
        if (r < n && P[r] < P[m]) m = r;
        if (m === i) break;
        [K[i], K[m]] = [K[m], K[i]]; [P[i], P[m]] = [P[m], P[i]]; i = m;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------------------
// Template-based generator: zones joined by guarded passages.
const ALL_RARES = ['plasteel', 'psycrystal', 'blackstone', 'wraithbone'];
export const TEMPLATES = {
  duel: {
    name: 'Duel',
    desc: 'Each side has a homeland and a private treasure zone. The rich centre is contested, and heavily guarded passes lead straight to it.',
    zones: [
      { id: 'p0', type: 'start', owner: 0, pos: [0.18, 0.82], w: 1.0, ground: 0 },
      { id: 'p1', type: 'start', owner: 1, pos: [0.82, 0.18], w: 1.0, ground: 0 },
      { id: 't0', type: 'treasure', pos: [0.18, 0.34], w: 0.92, ground: 1, rares: ALL_RARES },
      { id: 't1', type: 'treasure', pos: [0.82, 0.66], w: 0.92, ground: 2, rares: ALL_RARES },
      { id: 'c', type: 'center', pos: [0.5, 0.5], w: 1.05, ground: 3 },
    ],
    links: [['p0', 't0', 1], ['p1', 't1', 1], ['t0', 'c', 2], ['t1', 'c', 2], ['p0', 'c', 3], ['p1', 'c', 3]],
  },
  crossroads: {
    name: 'Crossroads',
    desc: 'Two long routes join the homelands through four treasure zones, with a guarded heart in the middle.',
    zones: [
      { id: 'p0', type: 'start', owner: 0, pos: [0.15, 0.85], w: 1.0, ground: 0 },
      { id: 'p1', type: 'start', owner: 1, pos: [0.85, 0.15], w: 1.0, ground: 0 },
      { id: 'a0', type: 'treasure', pos: [0.14, 0.44], w: 0.85, ground: 1, rares: ['plasteel', 'blackstone'] },
      { id: 'b0', type: 'treasure', pos: [0.54, 0.86], w: 0.85, ground: 2, rares: ['psycrystal', 'wraithbone'] },
      { id: 'a1', type: 'treasure', pos: [0.46, 0.14], w: 0.85, ground: 2, rares: ['psycrystal', 'wraithbone'] },
      { id: 'b1', type: 'treasure', pos: [0.86, 0.56], w: 0.85, ground: 1, rares: ['plasteel', 'blackstone'] },
      { id: 'c', type: 'center', pos: [0.5, 0.5], w: 0.95, ground: 3 },
    ],
    links: [['p0', 'a0', 1], ['p0', 'b0', 1], ['p1', 'a1', 1], ['p1', 'b1', 1], ['a0', 'a1', 2], ['b0', 'b1', 2], ['a0', 'c', 3], ['b1', 'c', 3], ['b0', 'c', 3], ['a1', 'c', 3]],
  },
};
// Ring: 2 to 6 homelands around a guarded centre, a treasure zone between each pair of neighbours.
export function ringTemplate(n) {
  const zones = [], links = [], RARE_PAIRS = [['plasteel', 'blackstone'], ['psycrystal', 'wraithbone'], ['plasteel', 'psycrystal'], ['blackstone', 'wraithbone']];
  const a0 = Math.PI * 3 / 4, R = n <= 3 ? 0.36 : 0.38, RT = n <= 3 ? 0.36 : 0.4;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * 2 * Math.PI / n, b = a + Math.PI / n;
    zones.push({ id: 'p' + i, type: 'start', owner: i, pos: [0.5 + R * Math.cos(a), 0.5 + R * Math.sin(a)], w: 1.0, ground: 0 });
    zones.push({ id: 't' + i, type: 'treasure', pos: [0.5 + RT * Math.cos(b), 0.5 + RT * Math.sin(b)], w: 0.85, ground: [1, 2, 3, 6, 7][i % 5], rares: RARE_PAIRS[i % 4] });
  }
  zones.push({ id: 'c', type: 'center', pos: [0.5, 0.5], w: n <= 3 ? 0.9 : 0.8, ground: 3 });
  for (let i = 0; i < n; i++) {
    links.push(['p' + i, 't' + i, 1], ['p' + ((i + 1) % n), 't' + i, 1], ['t' + i, 'c', n <= 3 ? 2 : 3]);
    if (n <= 3) links.push(['p' + i, 'c', 3]);
  }
  return { name: 'Ring of Fire', desc: 'Every homeland borders two treasure zones shared with its neighbours, and all roads lead to a guarded centre.', zones, links, players: [2, 6] };
}
export function roadSide(tiles, W, H, x, y) {
  let best = null, bd = 1e9;
  for (let dy = -3; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || !tiles[ny * W + nx].road || !dx) continue;
    const d = dx * dx + dy * dy * 1.3 + (dy < 0 ? 6 : 0);
    if (d < bd) { bd = d; best = dx; }
  }
  return best == null ? 0 : Math.sign(best);
}
export const MAP_SIZES = { S: 36, M: 48, L: 60, XL: 72 };
export const SIZE_NAMES = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Huge' };

const MON = [
  [['scuttler', 8, 16], ['raider', 4, 8], ['servitor', 8, 14], ['scuttler', 12, 20], ['mawspawn', 8, 14]],
  [['scuttler', 20, 34], ['raider', 9, 15], ['stalker', 5, 9], ['servitor', 18, 28], ['mawspawn', 18, 30], ['kite', 4, 7]],
  [['stalker', 10, 16], ['raider', 16, 26], ['brute', 6, 10], ['wraith', 8, 12], ['hulk', 1, 3], ['kite', 9, 14], ['basilisk', 2, 4]],
  [['hulk', 3, 6], ['stalker', 18, 28], ['brute', 12, 18], ['wraith', 14, 22], ['drake', 1, 2], ['mawprince', 1, 2], ['kite', 16, 24], ['basilisk', 4, 7]],
];
// Elite creatures: occasionally stand in for their base kin at the two strongest guard levels
// (rich treasure zones and the guarded centre), in smaller numbers.
const ELITE_CHANCE = [0, 0, 0.2, 0.35];

export function generateMap(seed, opts = {}) {
  const np = Math.max(2, Math.min(6, opts.players || 2));
  const tpl = opts.template === 'ring' || np > 2 ? ringTemplate(np) : TEMPLATES[opts.template] || TEMPLATES.duel;
  const W = MAP_SIZES[opts.size] || MAP_SIZES.M, H = W;
  const rnd = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const noise = scale => {
    const gw = Math.ceil(W / scale) + 2, gh = Math.ceil(H / scale) + 2;
    const g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i++) g[i] = rnd();
    return (x, y) => {
      const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
  };
  const Nz = noise(W / 6), Nz2 = noise(W / 5), Ng = noise(5), Ng2 = noise(7);

  // ---- zones ----
  const zones = tpl.zones.map((z, i) => ({
    ...z, ground: z.type === 'start' && opts.homeGround && opts.homeGround[z.owner] != null ? opts.homeGround[z.owner]
      : z.type !== 'start' && opts.terrain === 'volcanic' ? [1, 6][i % 2] : z.type !== 'start' && opts.terrain === 'wasteland' ? [0, 2, 3, 7][i % 4] : z.ground,
    i, cx: Math.round(z.pos[0] * (W - 1) + (rnd() - 0.5) * W * 0.05), cy: Math.round(z.pos[1] * (H - 1) + (rnd() - 0.5) * H * 0.05), tiles: [],
  }));
  for (const z of zones) { z.cx = Math.max(5, Math.min(W - 6, z.cx)); z.cy = Math.max(5, Math.min(H - 6, z.cy)); }
  const zid = id => zones.find(z => z.id === id).i;
  const tiles = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ox = (Nz(x, y) - 0.5) * W * 0.22, oy = (Nz2(x, y) - 0.5) * W * 0.22;
    let best = 0, bd = Infinity;
    for (const z of zones) { const d = Math.hypot(x + ox - z.cx, y + oy - z.cy) / z.w; if (d < bd) { bd = d; best = z.i; } }
    const z = zones[best];
    // one ground type per zone: the terrain only changes where the zones meet, behind their walls
    const t = z.ground;
    tiles[idx(x, y)] = { t: inb(x, y) ? t : 4, g: z.ground, road: false, blk: false, b: rnd() < 0.7 ? 0 : 1, z: best, v: Math.floor(rnd() * 1e9) };
    if (inb(x, y)) z.tiles.push(idx(x, y));
  }
  const pass = i => TERRAIN[tiles[i].t].pass && !tiles[i].blk;
  const setImp = (i, b, t = 4) => { const T = tiles[i]; if (!inb(i % W, (i / W) | 0)) return; T.t = t; T.b = b; };

  // ---- zone walls: tiles touching another zone become impassable ----
  const wallBiome = new Map();
  // zone walls are mountain ranges or crags; small pieces stay occasional
  const biomeFor = (a, b) => { const k = Math.min(a, b) * 100 + Math.max(a, b); if (!wallBiome.has(k)) wallBiome.set(k, pick([0, 0, 0, 3])); return wallBiome.get(k); };
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = idx(x, y), z = tiles[i].z;
    for (const [dx, dy] of DIRS8) {
      const o = tiles[idx(x + dx, y + dy)].z;
      if (o !== z) { setImp(i, biomeFor(z, o)); break; }
    }
  }

  // ---- guarded passages ----
  const gates = [];
  const carve = (x, y, r, zs) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
      const T = tiles[idx(nx, ny)]; if (!zs.includes(T.z)) continue;
      if (!TERRAIN[T.t].pass) T.t = zones[T.z].ground;
    }
  };
  for (const [a, b, value] of tpl.links) {
    const A = zones[zid(a)], B = zones[zid(b)];
    const mx = (A.cx + B.cx) / 2, my = (A.cy + B.cy) / 2;
    let best = null, bd = Infinity;
    for (const i of A.tiles) {
      const x = i % W, y = (i / W) | 0;
      if (x < 3 || y < 3 || x > W - 4 || y > H - 4) continue;
      let touches = false;
      for (const [dx, dy] of DIRS4) if (tiles[idx(x + dx, y + dy)].z === B.i) { touches = true; break; }
      if (!touches) continue;
      const d = Math.hypot(x - mx, y - my) + rnd() * 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (best) {
      carve(best.x, best.y, 1, [A.i, B.i]);
      for (const [dx, dy] of DIRS4) { const nx = best.x + dx, ny = best.y + dy; if (tiles[idx(nx, ny)].z === B.i) carve(nx, ny, 1, [A.i, B.i]); }
      gates.push({ x: best.x, y: best.y, a: A.i, b: B.i, value });
    } else {
      // Zones not touching: cut a corridor along the straight line between them.
      const steps = Math.ceil(Math.hypot(B.cx - A.cx, B.cy - A.cy));
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(A.cx + (B.cx - A.cx) * k / steps), y = Math.round(A.cy + (B.cy - A.cy) * k / steps);
        if (inb(x, y)) { const T = tiles[idx(x, y)]; if (!TERRAIN[T.t].pass) T.t = zones[T.z].ground; }
      }
      gates.push({ x: Math.round(mx), y: Math.round(my), a: A.i, b: B.i, value });
    }
  }
  const nearGate = (x, y, r) => gates.some(g => Math.max(Math.abs(g.x - x), Math.abs(g.y - y)) <= r);

  // ---- towns ----
  const towns = [];
  for (const z of zones) {
    if (z.type === 'start') towns.push({ x: z.cx, y: z.cy, owner: z.owner, zone: z.i });
    if (z.type === 'center') towns.push({ x: z.cx, y: z.cy, owner: null, zone: z.i });
  }
  towns.sort((a, b) => (a.owner ?? 9) - (b.owner ?? 9));
  const clear = (cx, cy, rad) => {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const x = cx + dx, y = cy + dy;
      if (inb(x, y) && dx * dx + dy * dy <= rad * rad + 1) { const T = tiles[idx(x, y)]; if (!TERRAIN[T.t].pass) T.t = zones[T.z].ground; }
    }
  };
  for (const t of towns) clear(t.x, t.y, 3);

  // a small obstacle piece (biome 1 or 2, or an acid pool) within r tiles
  const smallNear = (x, y, r, t = null) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!inb(x + dx, y + dy)) continue; const T = tiles[idx(x + dx, y + dy)];
      if (t != null ? T.t === t : (T.t === 4 && (T.b === 1 || T.b === 2)) || T.t === 5) return true;
    }
    return false;
  };
  // ---- interior obstacles spread through each zone ----
  const CELL = 4;
  for (let cy = 0; cy < H; cy += CELL) for (let cx = 0; cx < W; cx += CELL) {
    const sx = cx + ri(1, CELL - 2), sy = cy + ri(1, CELL - 2);
    if (!inb(sx, sy)) continue;
    const zi = tiles[idx(sx, sy)].z, z = zones[zi];
    if (Math.hypot(sx - z.cx, sy - z.cy) < (z.type === 'treasure' ? 3 : 5) || nearGate(sx, sy, 3)) continue;
    if (rnd() < (z.type === 'start' ? 0.15 : 0.05)) continue;
    // each clump stands on its own with a walkable ring around it, instead of fusing with the zone walls
    // or a neighbouring clump (hand-made maps break open ground into many separate obstacle groups)
    const mine_ = new Set();
    const ok = (x, y) => inb(x, y) && tiles[idx(x, y)].z === zi && !nearGate(x, y, 2) && Math.hypot(x - z.cx, y - z.cy) >= 3
      && DIRS8.every(([dx, dy]) => { const X = x + dx, Y = y + dy; return inb(X, Y) && (mine_.has(idx(X, Y)) || TERRAIN[tiles[idx(X, Y)].t].pass); });
    const setImpOwn = (i, b, t) => { setImp(i, b, t); mine_.add(i); };
    if (rnd() < 0.4) {
      const b = rnd() < 0.6 ? 0 : 3, len = ri(4, 9);
      let a = rnd() * Math.PI, x = sx, y = sy;
      for (let k = 0; k < len; k++) {
        const X = Math.round(x), Y = Math.round(y);
        if (ok(X, Y)) setImpOwn(idx(X, Y), b);
        a += (rnd() - 0.5) * 0.7; x += Math.cos(a); y += Math.sin(a);
      }
    } else {
      // small pieces (scrap, wrecks, ruins, pools: biomes 1 and 2) stand alone and well apart;
      // anything bigger than one tile is a little range of peaks or crags
      const r = rnd(), poolK = r > 0.88 && !smallNear(sx, sy, 4, 5), single = r < 0.45;
      let b = single ? (rnd() < 0.8 ? 1 : 2) : rnd() < 0.55 ? 0 : 3;
      if (single && smallNear(sx, sy, 3)) b = 3;
      const size = poolK ? ri(3, 5) : single ? 1 : ri(3, 9), cellsL = [[sx, sy]];
      for (let k = 0; k < 60 && cellsL.length < size; k++) {
        const [px, py] = cellsL[Math.floor(rnd() * cellsL.length)]; const [dx, dy] = DIRS4[Math.floor(rnd() * 4)];
        if (!cellsL.some(([qx, qy]) => qx === px + dx && qy === py + dy)) cellsL.push([px + dx, py + dy]);
      }
      for (const [x, y] of cellsL) if (ok(x, y)) setImpOwn(idx(x, y), b, poolK ? 5 : 4);
    }
  }
  for (const t of towns) clear(t.x, t.y, 3);

  // ---- make every walkable pocket reachable without opening new routes between zones ----
  for (let iter = 0; iter < 120; iter++) {
    const seen = new Uint8Array(W * H); const s0 = idx(towns[0].x, towns[0].y); const st = [s0]; seen[s0] = 1;
    while (st.length) {
      const i = st.pop(); const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
        const j = idx(nx, ny); if (seen[j] || !pass(j)) continue; seen[j] = 1; st.push(j);
      }
    }
    let start = -1;
    for (let i = 0; i < W * H; i++) if (pass(i) && !seen[i]) { start = i; break; }
    if (start < 0) break;
    const zs = tiles[start].z;
    const dist = new Float64Array(W * H).fill(1e9), prev = new Int32Array(W * H).fill(-1);
    const hp = new Heap(); dist[start] = 0; hp.push(start, 0); let goal = -1;
    while (hp.size) {
      const u = hp.pop(); if (seen[u]) { goal = u; break; }
      const ux = u % W, uy = (u / W) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = ux + dx, ny = uy + dy; if (!inb(nx, ny)) continue;
        const v = idx(nx, ny); const c = pass(v) ? 0.01 : tiles[v].z === zs ? 1 : 60;
        if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; hp.push(v, dist[v]); }
      }
    }
    if (goal < 0 || dist[goal] > 40) { tiles[start].t = 4; continue; }
    for (let i = goal; i !== -1; i = prev[i]) if (!pass(i)) tiles[i].t = zones[tiles[i].z].ground;
  }

  // ---- roads: each town and zone centre to its gates ----
  // town pictures cover the tiles behind and beside their gate: roads never run under them, so a road
  // always arrives at a town from the front, straight into its gate
  const underTown = new Uint8Array(W * H);
  for (const t of towns) for (const [dx, dy] of TOWN_FOOT) if (inb(t.x + dx, t.y + dy)) underTown[idx(t.x + dx, t.y + dy)] = 1;
  const road = (ax, ay, bx, by) => {
    const N = W * H, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const s = idx(ax, ay), goal = idx(bx, by); dist[s] = 0; const h = new Heap(); h.push(s, 0);
    while (h.size) {
      const u = h.pop(); if (u === goal) break;
      const ux = u % W, uy = (u / W) | 0;
      for (const [dx, dy] of DIRS4) {
        const x = ux + dx, y = uy + dy; if (!inb(x, y)) continue;
        const v = idx(x, y); if ((!pass(v) || underTown[v]) && v !== goal) continue;
        const T = tiles[v]; const c = (T.road ? 0.4 : ({ 0: 1, 1: 1.6, 2: 2.2, 3: 1.2, 6: 1, 7: 1.1 }[T.t] ?? 9)) * (0.85 + 0.3 * ((T.v % 1000) / 1000));
        if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; h.push(v, dist[v]); }
      }
    }
    if (!isFinite(dist[goal])) return;
    for (let i = goal; i !== -1; i = prev[i]) tiles[i].road = true;
  };
  // zones with a town: a road from the town to each of its passages. Zones without one: the passages
  // are joined to each other (a minimum spanning chain), not to the zone centre, so roads stay lean
  // and lead somewhere, as on hand-made maps where roads link towns and the main passes
  for (const z of zones) {
    const gs = gates.filter(g => g.a === z.i || g.b === z.i);
    if (!gs.length) continue;
    if (towns.some(t => t.zone === z.i)) { for (const g of gs) road(z.cx, z.cy, g.x, g.y); continue; }
    const inTree = [gs[0]], rest = gs.slice(1);
    while (rest.length) {
      let bi = 0, bj = 0, bd = Infinity;
      rest.forEach((g, i) => inTree.forEach((h, j) => { const d = Math.hypot(g.x - h.x, g.y - h.y); if (d < bd) { bd = d; bi = i; bj = j; } }));
      const g = rest.splice(bi, 1)[0]; road(inTree[bj].x, inTree[bj].y, g.x, g.y); inTree.push(g);
    }
  }
  // every town gate joins the road network (a town zone's roads already start there; this covers the rest)
  for (const t of towns) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < W * H; i++) if (tiles[i].road && !underTown[i]) { const d = Math.hypot(i % W - t.x, ((i / W) | 0) - t.y); if (d > 1.5 && d < bd) { bd = d; best = i; } }
    if (best >= 0) road(t.x, t.y, best % W, (best / W) | 0);
    tiles[idx(t.x, t.y)].road = true;
  }

  // ---- rivers: decorative and continuous, from the map edge to a pool inside a zone ----
  const rivers = [];
  {
    const nR = W <= 36 ? 2 : W <= 48 ? 4 : 6;
    const avoid = new Uint8Array(W * H);
    for (const t of towns) for (let dy = -4; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) { const x = t.x + dx, y = t.y + dy; if (inb(x, y)) avoid[idx(x, y)] = 1; }
    const Nr = noise(4);
    for (let k = 0; k < nR; k++) {
      let end = -1;
      for (let tries = 0; tries < 200 && end < 0; tries++) {
        const z = pick(zones.filter(z => z.type !== 'start'));
        const i = z.tiles[Math.floor(rnd() * z.tiles.length)];
        if (pass(i) && !tiles[i].road && !avoid[i] && !tiles[i].river && !nearGate(i % W, (i / W) | 0, 2)) end = i;
      }
      if (end < 0) continue;
      const ex = end % W, ey = (end / W) | 0;
      // start on the border side nearest to the end point
      const sides = [[ex, 0], [ex, H - 1], [0, ey], [W - 1, ey]].sort((a, b) => Math.hypot(a[0] - ex, a[1] - ey) - Math.hypot(b[0] - ex, b[1] - ey));
      const [sx0, sy0] = sides[Math.floor(rnd() * 2)];
      const sx = Math.max(0, Math.min(W - 1, sx0 + (sx0 === 0 || sx0 === W - 1 ? 0 : ri(-6, 6))));
      const sy = Math.max(0, Math.min(H - 1, sy0 + (sy0 === 0 || sy0 === H - 1 ? 0 : ri(-6, 6))));
      const N = W * H, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
      const s0 = idx(sx, sy); dist[s0] = 0; const hp = new Heap(); hp.push(s0, 0);
      while (hp.size) {
        const u = hp.pop(); if (u === end) break;
        const ux = u % W, uy = (u / W) | 0;
        for (const [dx, dy] of DIRS8) {
          const x = ux + dx, y = uy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const v = idx(x, y), T = tiles[v];
          let c = (dx && dy ? 1.42 : 1) * (1 + Nr(x, y) * 2.5);
          if (avoid[v]) c += 80; if (T.river) c += 25; if (T.road) c += 6; if (T.t === 4) c += 1.5;
          if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; hp.push(v, dist[v]); }
        }
      }
      if (!isFinite(dist[end])) continue;
      const pts = [];
      for (let i = end; i !== -1; i = prev[i]) pts.push([i % W, (i / W) | 0]);
      pts.reverse();
      for (const [x, y] of pts) tiles[idx(x, y)].river = true;
      rivers.push({ pts, pond: [ex, ey] });
    }
  }

  // ---- objects ----
  const objects = [], scenery = [];
  const taken = new Uint8Array(W * H), blocked = new Uint8Array(W * H);
  for (const t of towns) {
    for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (inb(t.x + dx, t.y + dy)) taken[idx(t.x + dx, t.y + dy)] = 1;
    for (const [dx, dy] of TOWN_FOOT) tiles[idx(t.x + dx, t.y + dy)].blk = true;
    blocked[idx(t.x, t.y)] = 1;
  }
  const playerTowns = towns.filter(t => t.owner !== null);
  const sites = towns.map(t => idx(t.x, t.y));   // entrances that must always stay reachable
  const dP = (x, y) => Math.min(...playerTowns.map(t => Math.hypot(x - t.x, y - t.y)));
  function connectedOK(ti) {
    if (ti != null) blocked[ti] = 1;
    const seen = new Uint8Array(W * H); const s0 = idx(towns[0].x, towns[0].y); const st = [s0]; seen[s0] = 1; let count = 0;
    while (st.length) {
      const i = st.pop(); count++;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
        const j = idx(nx, ny); if (seen[j] || !pass(j)) continue;
        seen[j] = 1; if (!blocked[j]) st.push(j);
      }
    }
    let expected = 0; for (let i = 0; i < W * H; i++) if (pass(i) && !blocked[i]) expected++;
    const ok = count - 1 === expected && (ti == null || seen[ti] === 1) && sites.every(i => seen[i] === 1);
    if (!ok && ti != null) blocked[ti] = 0;
    return ok;
  }
  const free = (x, y, allowRoad) => { if (!inb(x, y)) return false; const i = idx(x, y); return pass(i) && !taken[i] && !tiles[i].river && (allowRoad || !tiles[i].road); };
  function tryAt(o, x, y, opt) {
    if (!free(x, y, opt.allowRoad)) return false;
    if (opt.zone != null && tiles[idx(x, y)].z !== opt.zone) return false;
    if (opt.minTownDist && dP(x, y) < opt.minTownDist) return false;
    if (!opt.allowGate && nearGate(x, y, 1)) return false;
    const i = idx(x, y);
    const foot = (opt.foot || []).map(([dx, dy]) => [x + dx, y + dy]);
    if (foot.some(([fx, fy]) => !free(fx, fy, false) || (opt.zone != null && tiles[idx(fx, fy)].z !== opt.zone))) return false;
    for (const [fx, fy] of foot) tiles[idx(fx, fy)].blk = true;
    if (opt.solid) tiles[i].blk = true;
    if ((opt.blocking || opt.solid || foot.length) && !connectedOK(opt.solid ? null : i)) {
      for (const [fx, fy] of foot) tiles[idx(fx, fy)].blk = false;
      if (opt.solid) tiles[i].blk = false;
      return false;
    }
    taken[i] = 1;
    for (const [fx, fy] of foot) { taken[idx(fx, fy)] = 1; if (inb(fx, fy - 1)) taken[idx(fx, fy - 1)] = 1; }
    o.x = x; o.y = y; (opt.list || objects).push(o);
    if (opt.blocking) sites.push(i);
    return true;
  }
  function place(o, cx, cy, rmin, rmax, opt = {}) {
    for (let k = 0; k < 400; k++) {
      const a = rnd() * Math.PI * 2, r = rmin + rnd() * (rmax - rmin);
      if (tryAt(o, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), opt)) return o;
    }
    return null;
  }
  // how much of the band behind (above) and beside a structure is already impassable
  const backScore = (x, y) => {
    let n = 0;
    for (let dx = -2; dx <= 2; dx++) if (!inb(x + dx, y - 2) || !pass(idx(x + dx, y - 2))) n++;
    for (const dx of [-2, 2]) if (!inb(x + dx, y - 1) || !pass(idx(x + dx, y - 1))) n++;
    return n;
  };
  function inZone(o, zi, opt = {}) {
    const list = zones[zi].tiles;
    for (let k = 0; k < 500; k++) {
      const i = list[Math.floor(rnd() * list.length)], x = i % W, y = (i / W) | 0;
      // structures with a footprint prefer spots backed by rock or ruins, as on hand-made maps;
      // the demand relaxes as attempts run out
      if (opt.foot && k < 300 && backScore(x, y) < (k < 100 ? 4 : k < 200 ? 3 : 2)) continue;
      if (tryAt(o, x, y, { ...opt, zone: zi })) return o;
    }
    return null;
  }
  const monster = (o, lvl, mult = 1) => {
    const L = Math.min(3, lvl); const [u, a, b] = pick(MON[L]);
    const elite = rnd() < ELITE_CHANCE[L];
    o.unit = elite ? u + '_e' : u; o.count = Math.max(1, Math.round(ri(a, b) * mult * (opts.monsters || 1) * (elite ? 0.75 : 1))); return o;
  };
  // Wandering monsters always guard something: a treasure, mine or structure, else a narrow road.
  const W8 = { mine: 4, site: 4, relic: 4, tower: 2, chest: 2, pile: 1 };
  const nearMonster = (x, y, r) => objects.some(m => m.type === 'monster' && Math.max(Math.abs(m.x - x), Math.abs(m.y - y)) <= r);
  function guardSomething(zi, lvl, minTownDist = 5) {
    const cands = objects.filter(o => W8[o.type] && !(o.type === 'site' && o.guard) && tiles[idx(o.x, o.y)].z === zi
      && dP(o.x, o.y) >= minTownDist && !nearMonster(o.x, o.y, 2));
    let total = cands.reduce((a, o) => a + W8[o.type], 0);
    while (cands.length) {
      let r = rnd() * total, t = cands[0];
      for (const o of cands) { r -= W8[o.type]; if (r <= 0) { t = o; break; } }
      const ty = t.type === 'mine' || t.type === 'site' ? t.y + 1 : t.y;
      const G = { minTownDist: 4.5, zone: zi, allowGate: true };
      const m = place({ type: 'monster' }, t.x, ty, 1, 1.6, G) || place({ type: 'monster' }, t.x, ty, 1, 1.6, { ...G, allowRoad: true });
      if (m) return monster(m, lvl);
      cands.splice(cands.indexOf(t), 1); total -= W8[t.type];
    }
    // nothing left worth guarding: no guard (creatures always stand by a mine, treasure, structure,
    // portal or passage, never alone on an empty road)
    return null;
  }
  // guards stand beside what they guard, off the road where they can (on hand-made maps almost no
  // monster stands on a road tile: they flank it and their reach covers it)
  const guardNear = (x, y, lvl, zi) => {
    const G = { minTownDist: 4.5, zone: zi, allowGate: true };
    const o = place({ type: 'monster' }, x, y, 1, 1.6, G) || place({ type: 'monster' }, x, y, 1, 1.6, { ...G, allowRoad: true });
    if (o) monster(o, lvl);
  };
  const maybeGuard = (o, p, lvl, zi, dy = 0) => { if (o && rnd() < p) guardNear(o.x, o.y + dy, lvl, zi); };
  const RES_RARE = new Set(ALL_RARES);
  const pileOf = () => {
    const r = rnd();
    const res = r < 0.3 ? 'auramite' : r < 0.48 ? 'adamantium' : r < 0.66 ? 'ceramite' : pick(ALL_RARES);
    return { type: 'pile', res, amount: res === 'auramite' ? ri(5, 10) * 100 : RES_RARE.has(res) ? ri(2, 4) : ri(3, 6) };
  };
  // resource piles lie in little heaps of two or three, as on hand-made maps
  const pileGroup = (p, zi) => { if (!p) return; const n = rnd() < 0.55 ? 1 : rnd() < 0.5 ? 2 : 0; for (let k = 0; k < n; k++) place(pileOf(), p.x, p.y, 1, 1.5, { zone: zi }); };
  const mine = res => ({ type: 'mine', res, owner: null });
  const M = { blocking: true, foot: MINE_FOOT };
  const sceneryFoot = nm => SCENERY[nm].foot.filter(([dx, dy]) => dx || dy);
  const used = new Set();
  const artifactOf = r => { const pool = artifactsByRarity(r).filter(k => !used.has(k)); const id = pool.length ? pick(pool) : pick(artifactsByRarity(r)); used.add(id); return { type: 'relic', relic: id }; };

  // pickups per zone follow the land each zone gets (more zones share the same map), and the treasure option
  const F = (W * H) / (48 * 48) * Math.min(1, 7 / zones.length), TR = opts.treasure || 1, nF = n => Math.max(1, Math.round(n * F * TR));
  // guards on every passage
  for (const g of gates) {
    const o = { type: 'monster' };
    // a passage guard stands next to the road through the gap; its reach still closes the gap
    const beside = DIRS8.map(([dx, dy]) => [g.x + dx, g.y + dy]).filter(([x, y]) => inb(x, y) && !tiles[idx(x, y)].road);
    let ok = false;
    for (const [x, y] of beside.sort(() => rnd() - 0.5)) if (tryAt(o, x, y, { allowGate: true })) { ok = true; break; }
    if (ok || tryAt(o, g.x, g.y, { allowRoad: true, allowGate: true }) || place(o, g.x, g.y, 1, 2, { allowRoad: true, allowGate: true })) monster(o, g.value, g.value === 3 ? 1.3 : 1);
  }
  // mines first, so structures never crowd them out of a zone
  for (const z of zones) {
    const zi = z.i;
    if (z.type === 'start') {
      place(mine('adamantium'), z.cx, z.cy, 4, 7, { ...M, zone: zi });
      place(mine('ceramite'), z.cx, z.cy, 4, 7, { ...M, zone: zi });
      const gm = place(mine('auramite'), z.cx, z.cy, 9, 14, { ...M, zone: zi }) || place(mine('auramite'), z.cx, z.cy, 6, 11, { ...M, zone: zi });
      if (gm) guardNear(gm.x, gm.y + 1, 0, zi);
      const rm = place(mine(pick(ALL_RARES)), z.cx, z.cy, 10, 15, { ...M, zone: zi, minTownDist: 8 });
      if (rm) guardNear(rm.x, rm.y + 1, 1, zi);
    } else if (z.type === 'treasure') {
      for (const res of z.rares || []) { const m = inZone(mine(res), zi, { ...M, minTownDist: 6 }); if (m) guardNear(m.x, m.y + 1, 1, zi); }
      inZone(mine(rnd() < 0.5 ? 'adamantium' : 'ceramite'), zi, { ...M, minTownDist: 6 });
    } else {
      for (const res of [pick(ALL_RARES), pick(ALL_RARES), 'auramite']) { const m = inZone(mine(res), zi, { ...M, minTownDist: 5 }); if (m) guardNear(m.x, m.y + 1, 2, zi); }
    }
  }
  // ---- adventure-map structures ----
  const site = (kind, extra = {}) => ({ type: 'site', kind, visited: [], ...extra });
  const guardOf = (lvl, mult) => { const g = monster({}, lvl, mult); return { unit: g.unit, count: g.count }; };
  // a set creature guarding a treasury, sized to the usual strength of guards at that level
  const avgStr = L => MON[L].reduce((a, [u, lo, hi]) => a + unitValue(u) * (lo + hi) / 2, 0) / MON[L].length;
  const guardFor = (units, lvl, mult = 1) => {
    const L = Math.min(3, lvl), elite = units[1] && rnd() < 0.15 + 0.2 * L, unit = elite ? units[1] : units[0];
    return { unit, count: Math.max(1, Math.round(avgStr(L) * mult * (opts.monsters || 1) * (0.85 + rnd() * 0.3) / unitValue(unit))) };
  };
  const BANK = {
    brutes: ['brute', 'brute_e'], forgevault: ['servitor', 'servitor_e'], rookery: ['kite', 'kite_e'], mawpit: ['mawspawn', 'mawspawn_e'],
    basilisks: ['basilisk', 'basilisk_e'], serpent: ['stalker', 'stalker_e'], hive: ['scuttler', 'scuttler_e'], wyrm: ['drake', 'drake_e'],
    crypt: ['wraith', 'wraith_e'], frigate: ['raider', 'raider_e'], cathedral: ['mawprince', 'mawprince_e'], pyramid: ['basilisk_e', 'drake'],
  };
  const bank = (kind, lvl, mult = 1, extra = {}) => site(kind, { guard: BANK[kind] ? guardFor(BANK[kind], lvl, mult) : guardOf(lvl, mult), ...extra });
  const S = { ...M, minTownDist: 5 };
  const ofType = t => zones.filter(z => z.type === t);
  const spellOf = lvl => pick(Object.keys(SPELLS).filter(k => SPELLS[k].level === lvl));
  // what each kind of zone may hold; every structure is rolled with its own settings
  const make = (kind, lvl) => {
    switch (kind) {
      case 'litany': return site(kind, { spell: spellOf(1) });
      case 'canticle': return site(kind, { spell: spellOf(2) });
      case 'revelation': return site(kind, { spell: spellOf(3) });
      case 'hermit': return site(kind, { skill: pick(Object.keys(SKILLS)) });
      case 'droppod': return site(kind, { amount: pick([1000, 1500, 2000]) });
      case 'bivouac': return site(kind, { res: pick(['adamantium', 'ceramite', ...ALL_RARES]) });
      case 'derelict': return site(kind, { guard: guardOf(lvl, 1.2), res: pick([...ALL_RARES, 'adamantium', 'ceramite']) });
      case 'confessor': {
        const quest = rnd() < 0.6 ? { type: 'res', res: pick(ALL_RARES), n: 6 + Math.floor(rnd() * 6) } : { type: 'level', n: 6 + Math.floor(rnd() * 4) };
        const reward = rnd() < 0.5 ? { arts: [rnd() < 0.3 ? 'M' : 'm'] } : rnd() < 0.5 ? { xp: 4000 } : { res: { auramite: 6000 } };
        return site(kind, { quest, reward });
      }
      case 'reliquary': return site(kind, { guard: guardOf(lvl, 1.3) });
      default: return BANK[kind] ? bank(kind, lvl, kind === 'wyrm' ? 1.7 : kind === 'cathedral' ? 1.4 : 1) : site(kind);
    }
  };
  const putAll = (kinds, zi, lvl) => { for (const k of kinds) { const o = inZone(make(k, lvl), zi, S); if (o && o.guard == null && /^(droppod|bivouac|scribe|smuggler)$/.test(k)) maybeGuard(o, 0.4, lvl, zi, 1); } };
  const take = (pool, n) => { const a = pool.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
  const STAT4 = ['provinggrounds', 'watchtower', 'choir', 'archive'];
  const BOOST = ['motorpool', 'reclamator', 'rally', 'chapel', 'medicae', 'votive', 'pool'];
  const KEYS = ['red', 'blue', 'green', 'gold'];
  ofType('start').forEach((z, k) => {
    putAll(['turbine', pick(['droppod', 'bivouac']), pick(STAT4), pick(BOOST), pick(['mawpit', 'hive', 'forgevault']), 'litany'], z.i, 0);
    if (F > 1.2) putAll([pick(['geotap', 'glasshouse']), pick(['droppod', 'bivouac'])], z.i, 0);
    inZone(site('keystation', { color: KEYS[k % 4] }), z.i, { ...M, minTownDist: 4 });
  });
  const tz = ofType('treasure'), cz = ofType('center');
  tz.forEach((z, k) => {
    putAll([
      ...take(STAT4, 2), pick(['canticle', 'litany']), pick(['voidfont', 'riftspring']), pick(['glasshouse', 'geotap']), 'arena',
      pick(['monolith', 'hermit', 'warcollege', 'sanctum']), pick(['brutes', 'rookery', 'basilisks', 'serpent', 'crypt', 'frigate']),
      ...take(BOOST, 2), pick(['obelisk', 'watcheye']), pick(['trader', 'smuggler', 'armoury', 'broker']), pick(['scribe', 'confessor', 'droppod']), 'derelict',
    ], z.i, 1 + (k % 2));
    if (F > 1.2) putAll([pick(STAT4), pick(['auspex', 'shroud', 'bivouac']), ...(F > 2 ? [pick(['brutes', 'serpent', 'crypt'])] : [])], z.i, 2);
  });
  // a blast door for each key, out in the treasure zones
  ofType('start').forEach((_, k) => { const z = tz.length ? tz[(k * 2 + 1) % tz.length] : cz[0]; if (z) inZone(site('blastdoor', { color: KEYS[k % 4] }), z.i, S); });
  for (const z of cz) {
    putAll(['cathedral', 'wyrm', pick(['pyramid', 'reliquary']), 'penal', 'revelation', pick(['librarium', 'engine']), 'sanctuary', pick(['engineforge', 'academy']), pick(['shroud', 'auspex', 'watcheye'])], z.i, 3);
    if (F > 1.2) putAll([pick(['librarium', 'engine']), pick(['pyramid', 'basilisks']), pick(BOOST)], z.i, 3);
  }
  // linked Teleportarium pairs: one between opposite treasure zones, one from the centre to a treasure zone
  const pairs = [];
  if (tz.length >= 2) pairs.push([tz[0], tz[tz.length - 1]]);
  if (cz[0] && tz.length >= 2) pairs.push([cz[0], tz[1 + Math.floor(rnd() * (tz.length - 2 || 1))] || tz[1]]);
  let gid = 1;
  for (const [za, zb] of pairs) {
    const a = inZone(site('riftgate', { pair: gid }), za.i, S), b = a && inZone(site('riftgate', { pair: gid }), zb.i, S);
    if (a && !b) objects.splice(objects.indexOf(a), 1);
    // portals are blocked by a guard on at least one side, like passages
    if (a && b) { const lv = z => (z.type === 'center' ? 3 : z.type === 'treasure' ? 2 : 1); guardNear(a.x, a.y + 1, lv(za), za.i); if (rnd() < 0.5) guardNear(b.x, b.y + 1, lv(zb), zb.i); }
    gid++;
  }
  for (const z of zones) {
    const zi = z.i;
    if (z.type === 'start') {
      for (let k = 0; k < nF(3); k++) pileGroup(inZone(pileOf(), zi, { minTownDist: 4 }), zi);
      for (let k = 0; k < nF(3); k++) inZone({ type: 'chest' }, zi, { minTownDist: 4 });
      maybeGuard(inZone(artifactOf('T'), zi, { minTownDist: 6 }), 0.6, 0, zi);
      for (let k = 0; k < nF(1.5); k++) guardSomething(zi, 0, 6);
    } else if (z.type === 'treasure') {
      for (let k = 0; k < nF(5); k++) pileGroup(inZone(pileOf(), zi), zi);
      for (let k = 0; k < nF(5); k++) inZone({ type: 'chest' }, zi);
      for (const r of ['T', 'm']) maybeGuard(inZone(artifactOf(r), zi, { minTownDist: 6 }), r === 'm' ? 0.8 : 0.5, r === 'm' ? 2 : 1, zi);
      inZone({ type: 'tower' }, zi, { blocking: true });
      for (let k = 0; k < nF(2.5); k++) guardSomething(zi, 1 + (rnd() < 0.4 ? 1 : 0), 6);
      for (let k = 0; k < nF(1.5); k++) { const nm = pick(['ruin_gate', 'ruin_bridge', 'cave_crystal']); inZone({ sprite: nm }, zi, { foot: sceneryFoot(nm), solid: true, list: scenery, minTownDist: 6 }); }
    } else {
      for (let k = 0; k < nF(6); k++) pileGroup(inZone(pileOf(), zi), zi);
      for (let k = 0; k < nF(4); k++) inZone({ type: 'chest' }, zi);
      const a1 = inZone(artifactOf('M'), zi); if (a1) guardNear(a1.x, a1.y, 3, zi);
      const a2 = inZone(artifactOf(rnd() < 0.5 ? 'R' : 'M'), zi); if (a2) guardNear(a2.x, a2.y, 3, zi);
      for (let k = 0; k < nF(3); k++) guardSomething(zi, 2 + (rnd() < 0.4 ? 1 : 0), 4);
      for (let k = 0; k < nF(1.5); k++) { const nm = pick(['cave_crystal', 'ruin_gate']); inZone({ sprite: nm }, zi, { foot: sceneryFoot(nm), solid: true, list: scenery }); }
    }
  }
  // ---- thick woods in big empty stretches, with treasure tucked into their edges ----
  // Open ground with nothing on it for several tiles in every direction (the wide empty patches around
  // towns and in zone middles) is planted with dense forest, as hand-made maps fill such ground with
  // woods. Every forest keeps the map fully walkable, and nooks along its edge hold a chest, resources
  // or an artifact, sometimes guarded.
  {
    const keepF = new Uint8Array(W * H);
    const mk = (x, y) => { if (inb(x, y)) keepF[idx(x, y)] = 1; };
    for (const o of objects) {
      mk(o.x, o.y);
      if (o.type === 'site' || o.type === 'mine') for (let dx = -1; dx <= 1; dx++) { mk(o.x + dx, o.y + 1); mk(o.x + dx, o.y + 2); }
      else for (const [dx, dy] of DIRS8) mk(o.x + dx, o.y + dy);
    }
    for (const t of towns) for (let dy = 0; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) mk(t.x + dx, t.y + dy);   // the town's front stays open
    for (const g of gates) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mk(g.x + dx, g.y + dy);
    const isObj = new Set(objects.map(o => idx(o.x, o.y)));
    const plantable = i => pass(i) && !keepF[i] && !tiles[i].road && !tiles[i].river && !isObj.has(i);
    // Chebyshev distance from each tile to the nearest tile that cannot be planted
    const openness = () => {
      const d = new Int16Array(W * H).fill(-1), q = [];
      for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (!plantable(i) || x === 0 || y === 0 || x === W - 1 || y === H - 1) { d[i] = 0; q.push(i); } }
      for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of DIRS8) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const j = idx(X, Y); if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } }
      return d;
    };
    const treeBiome = 4;
    for (let forests = 0; forests < 40; forests++) {
      const d = openness();
      let seed = -1, best = 1;
      for (let i = 0; i < W * H; i++) if (d[i] > best || (d[i] === best && seed >= 0 && rnd() < 0.05)) { if (d[i] >= 2) { best = d[i]; seed = i; } }
      if (seed < 0) break;
      const target = Math.min(26, 5 + best * best * 3) * (0.7 + rnd() * 0.5);
      const patch = [seed], inP = new Set([seed]);
      const setTree = i => { const T = tiles[i]; T.t = 4; T.b = treeBiome; };
      setTree(seed);
      if (!connectedOK(null)) { tiles[seed].t = tiles[seed].g ?? zones[tiles[seed].z].ground; keepF[seed] = 1; continue; }
      for (let k = 0; k < 160 && patch.length < target; k++) {
        const base = patch[Math.floor(rnd() * patch.length)], bx = base % W, by = (base / W) | 0, [dx, dy] = DIRS8[Math.floor(rnd() * 8)];
        const X = bx + dx, Y = by + dy; if (!inb(X, Y)) continue; const j = idx(X, Y);
        if (inP.has(j) || d[j] < 1) continue;             // never onto kept tiles; connectivity keeps paths around
        const old = tiles[j].t; setTree(j);
        if (!connectedOK(null)) { tiles[j].t = old; tiles[j].b = 0; continue; }
        patch.push(j); inP.add(j);
      }
      for (const i of patch) keepF[i] = 1;
      // nooks: open tiles hugging the forest get a treasure
      const nooks = [];
      for (const i of patch) { const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of DIRS4) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const j = idx(X, Y);
          if (!pass(j) || taken[j] || tiles[j].road || inP.has(j)) continue;
          const n = DIRS8.filter(([a, b]) => inP.has(idx(X + a, Y + b))).length; if (n >= 3) nooks.push([X, Y, n]); } }
      nooks.sort((a, b) => b[2] - a[2]);
      const zi = tiles[seed].z, lvl = zones[zi].type === 'start' ? 0 : zones[zi].type === 'center' ? 3 : 1;
      let put = 0;
      for (const [X, Y] of nooks) {
        if (put >= (patch.length > 14 ? 2 : 1)) break;
        const r = rnd(), o = r < 0.4 ? { type: 'chest' } : r < 0.75 ? pileOf() : artifactOf(lvl >= 3 ? 'M' : lvl ? 'm' : 'T');
        if (!tryAt(o, X, Y, { zone: zi, allowGate: true })) continue;
        put++;
        if (o.type === 'relic') maybeGuard(o, 0.6, lvl, zi); else if (o.type === 'pile') pileGroup(o, zi);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(X + dx, Y + dy)) keepF[idx(X + dx, Y + dy)] = 1;
      }
    }
  }
  // ---- groves: smaller stands of trees in medium gaps the big forests did not reach ----
  {
    const isObj = new Set(objects.map(o => idx(o.x, o.y)));
    const near = new Uint8Array(W * H);
    const mk = (x, y) => { if (inb(x, y)) near[idx(x, y)] = 1; };
    for (const o of objects) {
      mk(o.x, o.y);
      if (o.type === 'site' || o.type === 'mine') for (let dx = -1; dx <= 1; dx++) { mk(o.x + dx, o.y + 1); mk(o.x + dx, o.y + 2); }
      else for (const [dx, dy] of DIRS8) mk(o.x + dx, o.y + dy);
    }
    for (const t of towns) for (let dy = 0; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mk(t.x + dx, t.y + dy);
    for (const g of gates) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mk(g.x + dx, g.y + dy);
    const ok = (x, y) => inb(x, y) && pass(idx(x, y)) && !near[idx(x, y)] && !isObj.has(idx(x, y)) && !tiles[idx(x, y)].road && !tiles[idx(x, y)].river
      && DIRS4.every(([dx, dy]) => !inb(x + dx, y + dy) || !tiles[idx(x + dx, y + dy)].road);
    const want = Math.round(W * H / 110);
    const openAt = (x0, y0) => { let n = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (ok(x0 + dx, y0 + dy)) n++; return n; };
    const failed = new Uint8Array(W * H);
    for (let n = 0; n < want; ) {
      // the emptiest spot left on the map
      let bi = -1, bo = 15;
      for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (failed[i] || !ok(x, y)) continue; const o = openAt(x, y); if (o > bo || (o === bo && rnd() < 0.3)) { bo = o; bi = i; } }
      if (bi < 0) break;
      const x0 = bi % W, y0 = (bi / W) | 0;
      const cells = [[x0, y0]], size = Math.min(9, 3 + Math.floor((bo - 15) / 4) + ri(0, 2));
      for (let k = 0; k < 50 && cells.length < size; k++) {
        const [px, py] = cells[Math.floor(rnd() * cells.length)], [dx, dy] = DIRS8[Math.floor(rnd() * 8)];
        if (ok(px + dx, py + dy) && !cells.some(([a, b]) => a === px + dx && b === py + dy)) cells.push([px + dx, py + dy]);
      }
      const old = cells.map(([x, y]) => tiles[idx(x, y)].t);
      for (const [x, y] of cells) { tiles[idx(x, y)].t = 4; tiles[idx(x, y)].b = 4; }
      if (!connectedOK(null)) { cells.forEach(([x, y], k) => { tiles[idx(x, y)].t = old[k]; tiles[idx(x, y)].b = 0; }); failed[bi] = 1; continue; }
      for (const [x, y] of cells) for (const [dx, dy] of DIRS8) mk(x + dx, y + dy);
      n++;
    }
  }
  // ---- dressing: small obstacle clumps, as hand-made maps have ----
  // Studied maps cover about half their land with obstacles and break open ground with many small clumps
  // (median 5 tiles), and most structures sit with rock, trees or ruins behind them. Big zone walls are
  // already in place, so this adds the small clumps: first behind structures, then scattered.
  {
    const keep = new Uint8Array(W * H);          // tiles that must stay open: entrances, their fronts, roads
    const mark = (x, y, r = 0) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy)) keep[idx(x + dx, y + dy)] = 1; };
    for (const o of objects) {
      mark(o.x, o.y, 1);
      if (o.type === 'site' || o.type === 'mine') for (let dx = -1; dx <= 1; dx++) mark(o.x + dx, o.y + 1), mark(o.x + dx, o.y + 2);
    }
    for (const t of towns) mark(t.x, t.y + 1, 3);
    for (const g of gates) mark(g.x, g.y, 2);
    for (let i = 0; i < W * H; i++) if (tiles[i].road || tiles[i].river) keep[i] = 1;
    const canBlock = (x, y) => inb(x, y) && !keep[idx(x, y)] && pass(idx(x, y));
    // turn a set of tiles into one obstacle clump, keeping every place on the map reachable
    const clump = (cells, b) => {
      cells = cells.filter(([x, y]) => canBlock(x, y));
      if (!cells.length) return 0;
      const old = cells.map(([x, y]) => { const T = tiles[idx(x, y)]; return [T.t, T.b]; });
      for (const [x, y] of cells) { const T = tiles[idx(x, y)]; T.t = 4; T.b = b; }
      if (!connectedOK(null)) { cells.forEach(([x, y], k) => { const T = tiles[idx(x, y)]; T.t = old[k][0]; T.b = old[k][1]; }); return 0; }
      for (const [x, y] of cells) keep[idx(x, y)] = 0;
      return cells.length;
    };
    const grow = (x, y, n) => {
      const cells = [[x, y]];
      for (let k = 0; k < 30 && cells.length < n; k++) {
        const [px, py] = cells[Math.floor(rnd() * cells.length)], [dx, dy] = DIRS8[Math.floor(rnd() * 8)];
        if (!cells.some(([qx, qy]) => qx === px + dx && qy === py + dy)) cells.push([px + dx, py + dy]);
      }
      return cells;
    };
    // single pieces may be scrap, wrecks or ruins when no other small piece is close; clumps are crags or peaks
    const biomeFor = cells => (cells.length === 1 && !smallNear(cells[0][0], cells[0][1], 3) && rnd() < 0.7 ? 1 : rnd() < 0.5 ? 3 : 0);
    // behind structures: fill the band above and beside the footprint when it is open
    for (const o of objects) {
      if ((o.type !== 'site' && o.type !== 'mine') || rnd() < 0.25) continue;
      const band = [];
      for (let dx = -2; dx <= 2; dx++) band.push([o.x + dx, o.y - 2]);
      band.push([o.x - 2, o.y - 1], [o.x + 2, o.y - 1]);
      const open = band.filter(([x, y]) => canBlock(x, y));
      if (open.length >= 2) { const cs = open.sort(() => rnd() - 0.5).slice(0, ri(2, Math.min(5, open.length))); clump(cs, biomeFor(cs)); }
    }
    // scattered free-standing clumps through open ground: studied maps have about 21 separate obstacle
    // groups per 1000 tiles; the zone walls give a few, these give the rest
    const want = Math.round(W * H * 0.015);
    const alone = cells => cells.every(([x, y]) => DIRS8.every(([dx, dy]) => { const X = x + dx, Y = y + dy;
      return !inb(X, Y) || cells.some(([a, b]) => a === X && b === Y) || TERRAIN[tiles[idx(X, Y)].t].pass; }));
    for (let n = 0, tries = 0; n < want && tries < want * 15; tries++) {
      const z = zones[Math.floor(rnd() * zones.length)], i = z.tiles[Math.floor(rnd() * z.tiles.length)], x = i % W, y = (i / W) | 0;
      if (!canBlock(x, y) || dP(x, y) < 3.5) continue;
      const cells = grow(x, y, ri(1, 4)).filter(([a, b]) => canBlock(a, b));
      if (!cells.length || !alone(cells)) continue;
      if (clump(cells, biomeFor(cells))) n++;
    }
  }
  // structures and mines face the nearest road: pictures show the entrance on the lower left,
  // so one with its road to the right is drawn mirrored
  for (const o of objects) if (o.type === 'site' || o.type === 'mine') o.flip = roadSide(tiles, W, H, o.x, o.y) > 0;
  // scenery footprints
  for (const sc of scenery) for (const [dx, dy] of SCENERY[sc.sprite].foot) { const x = sc.x + dx, y = sc.y + dy; if (inb(x, y)) { tiles[idx(x, y)].blk = true; } }

  return { W, H, tiles, towns, objects, scenery, rivers, zones: zones.map(z => ({ id: z.id, type: z.type, cx: z.cx, cy: z.cy })), gates };
}
