// Town panorama: each built structure is drawn in place on a painted backdrop and becomes a clickable region.
import { mulberry32 } from './map.js';

export const SCENE_W = 1000, SCENE_H = 420;

const PAL = {
  concord: { stone: '#7c7a7e', stoneLt: '#9a989c', stoneDk: '#4c4a50', roof: '#9a4a2a', roofDk: '#6a2e1a', trim: '#c9a24a', glow: '#ffcf70', banner: '#2f5fae', wood: '#5a3a22', sky: ['#3a2a3a', '#a04a2a', '#e09050'] },
  hollow: { stone: '#4e3634', stoneLt: '#6a4a46', stoneDk: '#2a1c1b', roof: '#2a1818', roofDk: '#160c0c', trim: '#d04030', glow: '#ff5a2a', banner: '#8a1a1a', wood: '#3a2218', sky: ['#1a0e14', '#5a1a1a', '#b03a1a'] },
};

// Building footprints in scene coordinates: x centre, ground y, and draw order (back to front).
export const LAYOUT = {
  hall: { x: 500, y: 300, z: 1 },
  guild: { x: 150, y: 318, z: 2 },
  market: { x: 700, y: 352, z: 3 },
  tavern: { x: 318, y: 352, z: 3 },
  depot: { x: 880, y: 340, z: 2 },
  dw1: { x: 85, y: 405, z: 5 },
  dw2: { x: 245, y: 412, z: 6 },
  dw3: { x: 420, y: 404, z: 5 },
  dw4: { x: 600, y: 414, z: 6 },
  dw5: { x: 800, y: 408, z: 5 },
};
export const SCENE_NAMES = { hall: 'Town Hall', guild: 'Mage Guild', market: 'Trade Exchange', tavern: 'Recruitment Office', depot: 'Supply Depot', fort: 'Fortifications' };

function poly(g, pts, fill, stroke = 'rgba(14,10,8,0.85)') { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); } }
function rect(g, x, y, w, h, fill, stroke = 'rgba(14,10,8,0.85)') { g.fillStyle = fill; g.fillRect(x, y, w, h); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); } }
function shadedWall(g, x, y, w, h, P) {
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, P.stoneLt); gr.addColorStop(0.6, P.stone); gr.addColorStop(1, P.stoneDk);
  rect(g, x, y, w, h, gr);
  g.strokeStyle = 'rgba(20,16,14,0.25)'; g.lineWidth = 1;
  for (let yy = y + 8; yy < y + h; yy += 8) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
}
function windows(g, x, y, w, h, cols, rows, P, lit = 0.7) {
  const cw = w / cols, rh = h / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const wx = x + i * cw + cw * 0.3, wy = y + j * rh + rh * 0.2, ww = cw * 0.4, wh = rh * 0.55;
    g.fillStyle = (i * 7 + j * 3) % 10 / 10 < lit ? P.glow : '#1a1412';
    g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx, wy + ww / 2); g.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); g.lineTo(wx + ww, wy + wh); g.closePath(); g.fill();
  }
}
function gable(g, x, y, w, h, P) { poly(g, [[x - 4, y], [x + w / 2, y - h], [x + w + 4, y]], P.roof); poly(g, [[x + w / 2, y - h], [x + w + 4, y], [x + w / 2 + 6, y]], P.roofDk, null); }
function spire(g, cx, y, w, h, P) { poly(g, [[cx - w / 2, y], [cx, y - h], [cx + w / 2, y]], P.roof); poly(g, [[cx, y - h], [cx + w / 2, y], [cx + w * 0.15, y]], P.roofDk, null); g.fillStyle = P.trim; g.fillRect(cx - 1, y - h - 8, 2, 8); }
function spikes(g, x, y, w, n, h, P) { for (let i = 0; i < n; i++) { const sx = x + (i + 0.5) * w / n; poly(g, [[sx - 4, y], [sx, y - h * (0.6 + ((i * 37) % 10) / 25)], [sx + 4, y]], P.stoneDk); } }
function banner(g, x, y, h, P, t = 0) { g.fillStyle = '#2a2420'; g.fillRect(x, y - h, 2, h); const wv = Math.sin(t * 0.004 + x) * 3; poly(g, [[x + 2, y - h], [x + 22, y - h + 4 + wv], [x + 2, y - h + 14]], P.banner, null); }
function door(g, cx, y, w, h) { g.fillStyle = '#1a1210'; g.beginPath(); g.moveTo(cx - w / 2, y); g.lineTo(cx - w / 2, y - h + w / 2); g.arc(cx, y - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, y); g.fill(); }
function gild(g, x, y, w, P) { g.fillStyle = P.trim; g.fillRect(x, y, w, 3); }

// ---- individual structures; each returns its bounding box ----
const DRAW = {
  hall(g, L, P, t, town) {
    const lv = town.built.hall3 ? 3 : town.built.hall2 ? 2 : 1, { x, y } = L;
    if (lv === 3) {
      shadedWall(g, x - 120, y - 120, 240, 120, P); windows(g, x - 110, y - 112, 220, 70, 8, 2, P);
      g.fillStyle = P.roof; g.beginPath(); g.arc(x, y - 120, 70, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(14,10,8,.85)'; g.stroke();
      g.fillStyle = P.trim; g.beginPath(); g.arc(x, y - 120, 70, Math.PI * 1.05, Math.PI * 1.25); g.lineTo(x, y - 120); g.fill();
      spire(g, x, y - 188, 22, 60, P); [-140, 140].forEach(o => { shadedWall(g, x + o - 18, y - 170, 36, 170, P); spire(g, x + o, y - 170, 46, 70, P); });
      door(g, x, y, 34, 56); gild(g, x - 120, y - 124, 240, P);
      return { x: x - 160, y: y - 260, w: 320, h: 260 };
    }
    const w = lv === 2 ? 170 : 130, h = lv === 2 ? 120 : 90;
    shadedWall(g, x - w / 2, y - h, w, h, P); windows(g, x - w / 2 + 8, y - h + 10, w - 16, h * 0.55, lv === 2 ? 6 : 4, 1, P);
    gable(g, x - w / 2, y - h, w, h * 0.7, P);
    shadedWall(g, x - 22, y - h - 80, 44, 80, P); spire(g, x, y - h - 80, 56, lv === 2 ? 110 : 70, P);
    windows(g, x - 16, y - h - 70, 32, 40, 1, 1, P, 1);
    if (town.faction === 'hollow') spikes(g, x - w / 2, y - h, w, 7, 26, P);
    door(g, x, y, 28, 46);
    if (lv === 2) { banner(g, x - w / 2 + 6, y - h, 40, P, t); banner(g, x + w / 2 - 8, y - h, 40, P, t); }
    return { x: x - w / 2 - 6, y: y - h - 80 - (lv === 2 ? 110 : 70), w: w + 12, h: h + 80 + (lv === 2 ? 110 : 70) };
  },
  guild(g, L, P, t, town, lvl) {
    const { x, y } = L; let top = y;
    for (let i = 0; i < lvl; i++) {
      const w = 64 - i * 7, h = 40;
      shadedWall(g, x - w / 2, top - h, w, h, P); windows(g, x - w / 2 + 4, top - h + 6, w - 8, 22, 2, 1, P, 0.9);
      gild(g, x - w / 2, top - h, w, P); top -= h;
    }
    poly(g, [[x - 18, top], [x, top - 34], [x + 18, top]], P.roof);
    const pulse = 0.6 + 0.4 * Math.sin(t * 0.004);
    const gr = g.createRadialGradient(x, top - 46, 0, x, top - 46, 30); gr.addColorStop(0, `rgba(160,190,255,${0.9 * pulse})`); gr.addColorStop(1, 'rgba(120,140,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, top - 46, 30, 0, Math.PI * 2); g.fill();
    poly(g, [[x, top - 64], [x + 9, top - 46], [x, top - 32], [x - 9, top - 46]], '#8aa8ff');
    door(g, x, y, 22, 32);
    return { x: x - 40, y: top - 70, w: 80, h: y - top + 70 };
  },
  tavern(g, L, P, t) {
    const { x, y } = L;
    shadedWall(g, x - 60, y - 60, 120, 60, P); gable(g, x - 60, y - 60, 120, 44, P); windows(g, x - 54, y - 54, 108, 36, 4, 1, P, 0.9);
    rect(g, x - 20, y - 104, 12, 30, P.stoneDk); door(g, x + 20, y, 20, 34);
    g.fillStyle = P.wood; g.fillRect(x - 72, y - 52, 12, 3); rect(g, x - 80, y - 49, 22, 16, P.trim);
    return { x: x - 82, y: y - 110, w: 150, h: 110 };
  },
  market(g, L, P, t) {
    const { x, y } = L;
    shadedWall(g, x - 50, y - 70, 100, 70, P); gable(g, x - 50, y - 70, 100, 40, P); windows(g, x - 44, y - 62, 88, 30, 3, 1, P);
    const cols = ['#a83a2a', '#c8a040', '#3a6a9a'];
    for (let i = 0; i < 3; i++) { const sx = x - 120 + i * 48 + (i > 1 ? 150 : 0); rect(g, sx, y - 28, 40, 28, P.wood); poly(g, [[sx - 4, y - 28], [sx + 20, y - 44], [sx + 44, y - 28]], cols[i]); }
    g.strokeStyle = '#2a2420'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 60, y); g.lineTo(x + 60, y - 110); g.lineTo(x + 110, y - 100); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(x + 105, y - 101); g.lineTo(x + 105, y - 60); g.stroke(); rect(g, x + 98, y - 62, 14, 10, '#6a5a3a');
    return { x: x - 124, y: y - 112, w: 240, h: 112 };
  },
  depot(g, L, P) {
    const { x, y } = L;
    for (let i = 0; i < 3; i++) { const sx = x - 70 + i * 46; rect(g, sx, y - 80, 36, 80, P.stoneLt); g.fillStyle = P.roof; g.beginPath(); g.ellipse(sx + 18, y - 80, 18, 7, 0, 0, Math.PI * 2); g.fill(); gild(g, sx, y - 60, 36, P); }
    rect(g, x - 80, y - 30, 160, 30, P.stone);
    return { x: x - 82, y: y - 92, w: 164, h: 92 };
  },
  dw(g, L, P, t, town, tier, up) {
    const { x, y } = L, hollow = town.faction === 'hollow';
    const W = [96, 120, 120, 150, 120][tier - 1], H = [56, 70, 80, 70, 110][tier - 1];
    shadedWall(g, x - W / 2, y - H, W, H, P);
    if (tier === 4) { // hangar for war engines
      g.fillStyle = P.roof; g.beginPath(); g.moveTo(x - W / 2 - 4, y - H); g.quadraticCurveTo(x, y - H - 60, x + W / 2 + 4, y - H); g.fill(); g.strokeStyle = 'rgba(14,10,8,.85)'; g.stroke();
      rect(g, x - 34, y - 56, 68, 56, '#1a1412'); for (let i = 0; i < 6; i++) { g.fillStyle = '#3a3430'; g.fillRect(x - 34, y - 56 + i * 9, 68, 3); }
    } else if (tier === 5) {
      [-W / 2 + 14, W / 2 - 14].forEach(o => { shadedWall(g, x + o - 16, y - H - 50, 32, H + 50, P); spire(g, x + o, y - H - 50, 42, 60, P); });
      windows(g, x - W / 2 + 34, y - H + 12, W - 68, 50, 3, 2, P, 0.9); door(g, x, y, 30, 50);
      if (hollow) spikes(g, x - W / 2, y - H, W, 8, 34, P);
    } else {
      gable(g, x - W / 2, y - H, W, tier === 3 ? 60 : 44, P);
      windows(g, x - W / 2 + 8, y - H + 10, W - 16, H * 0.5, tier + 2, 1, P);
      door(g, x, y, 22, 34);
      if (tier === 3) { shadedWall(g, x + W / 2 - 26, y - H - 50, 26, H + 50, P); spire(g, x + W / 2 - 13, y - H - 50, 34, 44, P); }
      if (hollow) spikes(g, x - W / 2, y - H, W, 6, 22, P);
    }
    if (up) { gild(g, x - W / 2, y - H, W, P); gild(g, x - W / 2, y - 6, W, P); banner(g, x - W / 2 + 4, y - H, 36, P, t); banner(g, x + W / 2 - 6, y - H, 36, P, t); }
    const extra = tier === 5 ? 110 : tier === 4 ? 60 : tier === 3 ? 100 : 50;
    return { x: x - W / 2 - 8, y: y - H - extra, w: W + 16, h: H + extra };
  },
};

function backdrop(g, town, P, rnd) {
  const sky = g.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, P.sky[0]); sky.addColorStop(0.65, P.sky[1]); sky.addColorStop(1, P.sky[2]);
  g.fillStyle = sky; g.fillRect(0, 0, SCENE_W, SCENE_H);
  // distant hive spires
  g.fillStyle = 'rgba(30,20,24,0.55)';
  for (let i = 0; i < 18; i++) { const x = rnd() * SCENE_W, w = 20 + rnd() * 40, h = 60 + rnd() * 140; g.fillRect(x, 250 - h, w, h); poly(g, [[x, 250 - h], [x + w / 2, 250 - h - 30 - rnd() * 40], [x + w, 250 - h]], 'rgba(30,20,24,0.55)', null); }
  g.fillStyle = 'rgba(20,14,16,0.7)';
  g.beginPath(); g.moveTo(0, 260); for (let x = 0; x <= SCENE_W; x += 40) g.lineTo(x, 240 - rnd() * 40); g.lineTo(SCENE_W, 260); g.fill();
  // ash clouds
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,30,30,0.25)'; g.beginPath(); g.ellipse(rnd() * SCENE_W, 40 + rnd() * 90, 90 + rnd() * 80, 14 + rnd() * 10, 0, 0, Math.PI * 2); g.fill(); }
  // fortifications across the back
  if (town.built.fort) {
    const wy = 268;
    for (let x = 0; x < SCENE_W; x += 2) { /* noop for spacing */ }
    shadedWall(g, 0, wy - 46, SCENE_W, 46, P);
    for (let x = 4; x < SCENE_W; x += 22) rect(g, x, wy - 56, 14, 10, P.stone);
    const towers = town.built.castle ? [60, 940] : [];
    if (town.built.citadel) towers.push(260, 740);
    for (const tx of towers) { shadedWall(g, tx - 26, wy - 130, 52, 130, P); spire(g, tx, wy - 130, 66, 70, P); windows(g, tx - 18, wy - 120, 36, 50, 1, 2, P, 0.8); }
  }
  // ground
  const gr = g.createLinearGradient(0, 260, 0, SCENE_H);
  gr.addColorStop(0, '#4a443a'); gr.addColorStop(1, '#2a2620');
  g.fillStyle = gr; g.fillRect(0, 262, SCENE_W, SCENE_H - 262);
  g.strokeStyle = 'rgba(20,16,12,0.35)'; g.lineWidth = 1;
  for (let y = 272; y < SCENE_H; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(SCENE_W, y); g.stroke(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,220,0.05)' : 'rgba(0,0,0,0.15)'; g.fillRect(rnd() * SCENE_W, 262 + rnd() * 160, 3, 2); }
  if (town.built.citadel) { g.fillStyle = '#1d3f3a'; g.fillRect(0, 266, SCENE_W, 8); g.fillStyle = 'rgba(140,220,200,0.3)'; for (let x = 0; x < SCENE_W; x += 30) g.fillRect(x + rnd() * 10, 268, 10, 1); }
}

function texture(g, w, h, seed) {
  const img = g.getImageData(0, 0, w, h), d = img.data, rnd = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = 1 + (rnd() - 0.5) * 0.12;
    d[i] *= n; d[i + 1] *= n; d[i + 2] *= n;
  }
  g.putImageData(img, 0, 0);
}

// Renders the static town into a canvas; returns { canvas, regions } with regions keyed by building group.
export function renderTownScene(town, scale = 1) {
  const P = PAL[town.faction] || PAL.concord;
  const c = document.createElement('canvas'); c.width = Math.round(SCENE_W * scale); c.height = Math.round(SCENE_H * scale);
  const g = c.getContext('2d'); g.scale(scale, scale);
  const rnd = mulberry32(town.id * 7919 + 13);
  backdrop(g, town, P, rnd);
  const regions = [];
  const items = [];
  items.push({ key: 'hall', L: LAYOUT.hall, draw: () => DRAW.hall(g, LAYOUT.hall, P, 0, town) });
  const gl = [1, 2, 3, 4, 5].filter(l => town.built['mg' + l]).length;
  if (gl) items.push({ key: 'guild', L: LAYOUT.guild, draw: () => DRAW.guild(g, LAYOUT.guild, P, 0, town, gl) });
  if (town.built.tavern) items.push({ key: 'tavern', L: LAYOUT.tavern, draw: () => DRAW.tavern(g, LAYOUT.tavern, P, 0) });
  if (town.built.market) items.push({ key: 'market', L: LAYOUT.market, draw: () => DRAW.market(g, LAYOUT.market, P, 0) });
  if (town.built.depot) items.push({ key: 'depot', L: LAYOUT.depot, draw: () => DRAW.depot(g, LAYOUT.depot, P, 0) });
  for (let tier = 1; tier <= 5; tier++) {
    if (!town.built['dw' + tier]) continue;
    const L = LAYOUT['dw' + tier];
    items.push({ key: 'dw' + tier, L, draw: () => DRAW.dw(g, L, P, 0, town, tier, !!town.built['dw' + tier + 'u']) });
  }
  items.sort((a, b) => a.L.z - b.L.z || a.L.y - b.L.y);
  for (const it of items) { const box = it.draw(); regions.push({ key: it.key, ...box }); }
  if (town.built.fort) regions.push({ key: 'fort', x: 0, y: 200, w: SCENE_W, h: 70, back: true });
  // light haze and texture
  const haze = g.createLinearGradient(0, 0, 0, SCENE_H); haze.addColorStop(0, 'rgba(255,160,90,0.06)'); haze.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = haze; g.fillRect(0, 0, SCENE_W, SCENE_H);
  texture(g, c.width, c.height, town.id + 99);
  return { canvas: c, regions, w: SCENE_W, h: SCENE_H };
}

// ---------------------------------------------------------------------------
// Painted town (artwork pack). Spots: [x centre, ground y, scale on original pixels, mirror].
export const ART_LAYOUT = {
  concord: {
    // Fitted to the second layout mockup on the 1920x1080 backdrop; arrowed buildings mirrored, fort 10% larger.
    fort: [964, 561, 0.61, false], dw2: [612, 601, 0.455, false], guild: [1335, 605, 0.46, false],
    hall: [300, 791, 0.499, true], tavern: [722, 824, 0.357, true], dw3: [1254, 838, 0.412, true], dw1: [1666, 701, 0.455, false],
    depot: [480, 1010, 0.27, true], market: [1003, 1054, 0.442, false], dw4: [1456, 1052, 0.461, false], dw5: [1798, 977, 0.377, false],
  },
  // Rustbound: every building is pre-placed on the wasteland backdrop (meta x/y); spot list only
  rustbound: { fort: [0, 0, 1, false], hall: [0, 0, 1, false], guild: [0, 0, 1, false], market: [0, 0, 1, false], tavern: [0, 0, 1, false], depot: [0, 0, 1, false],
    dw1: [0, 0, 1, false], dw2: [0, 0, 1, false], dw3: [0, 0, 1, false], dw4: [0, 0, 1, false], dw5: [0, 0, 1, false] },
  hollow: {
    // Cut from the town painting (1536x1024): each building stands exactly where it was painted.
    fort: [593.5, 425, 1, false], hall: [1063, 522, 1, false], guild: [1361, 207, 1, false], market: [281, 490, 1, false],
    tavern: [184, 718, 1, false], depot: [731.5, 692, 1, false], dw1: [1318, 725, 1, false], dw2: [566, 908, 1, false],
    dw3: [882.5, 908, 1, false], dw4: [1205, 885, 1, false], dw5: [231, 935, 1, false],
  },
};
// Towns whose buildings were cut from the backdrop painting itself: drawn exactly as painted, without grading or shadows.
ART_LAYOUT.palefang = ART_LAYOUT.scrapjaw = ART_LAYOUT.deathless = ART_LAYOUT.concord = ART_LAYOUT.hollow = ART_LAYOUT.rustbound;   // pre-placed too (tools/faction_town.py)
const NATIVE_ART = { concord: true, hollow: true, rustbound: true, scrapjaw: true, deathless: true, palefang: true };
// Version of each spot that appears in the layout mockup; its fitted scale is the reference.
const REF_ART = { dw1: 'dw1u', dw2: 'dw2u', dw3: 'dw3u', dw4: 'dw4', dw5: 'dw5', fort: 'castle', hall: 'hall2', guild: 'mg5', market: 'market', tavern: 'tavern', depot: 'depot' };
// Earlier levels are a touch smaller so a building visibly grows when upgraded.
const LEVEL_STEP = { hall1: 0.9, hall3: 1.08, fort: 0.86, citadel: 0.93, mg1: 0.92, mg2: 0.94, mg3: 0.96, mg4: 0.98, dw2: 0.95, dw3: 0.95, dw4u: 1.05, dw5u: 1.05, dw1: 0.96 };
// Scale for any version on a spot: match the reference's footprint by width or visible area, whichever is smaller.
function variantScale(spot, key, sc, meta) {
  const ref = meta[REF_ART[spot]], m = meta[key];
  if (!ref || !m || key === REF_ART[spot]) return sc;
  if (m.ow === ref.ow && m.oh === ref.oh) return sc;   // same picture reused for every level
  const byWidth = sc * ref.ow / m.ow;
  const byArea = ref.area && m.area ? sc * Math.sqrt(ref.area / m.area) : byWidth;
  const byHeight = sc * ref.oh / m.oh * 1.1;   // never much taller than the composed version
  return Math.min(byWidth, byArea, byHeight) * (LEVEL_STEP[key] || 1);
}
// Which image stands on a spot right now; upgraded versions replace the base one in the same place.
export function artFor(town, spot) {
  const b = town.built;
  if (spot === 'hall') return b.hall3 ? 'hall3' : b.hall2 ? 'hall2' : 'hall1';
  if (spot === 'fort') return b.castle ? 'castle' : b.citadel ? 'citadel' : 'fort';   // the fort is always standing
  if (spot === 'guild') { for (let l = 5; l >= 1; l--) if (b['mg' + l]) return 'mg' + l; return null; }
  if (/^dw\d$/.test(spot)) return b[spot + 'u'] ? spot + 'u' : b[spot] ? spot : null;
  return b[spot] ? spot : null;
}

// art: { base: Image, imgs: { key: Image }, meta: { key: { oh } } }
// Glow layers keep the buildings' own fire colours, except where a town's light is cold: Pale Fang lamps pulse
// in the moonlight blue of its night sky. The recoloured copy keeps the glow's brightness pattern.
const GLOW_TINT = { palefang: 'rgb(150,205,255)' };
const tintCache = new WeakMap();
function glowTinted(gl, fac) {
  if (!gl || !GLOW_TINT[fac]) return gl;
  if (tintCache.has(gl)) return tintCache.get(gl);
  const c = document.createElement('canvas'); c.width = gl.width; c.height = gl.height; const x = c.getContext('2d');
  x.filter = 'grayscale(1) brightness(1.15)'; x.drawImage(gl, 0, 0); x.filter = 'none';
  x.globalCompositeOperation = 'multiply'; x.fillStyle = GLOW_TINT[fac]; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(gl, 0, 0);
  tintCache.set(gl, c); return c;
}
export function renderTownArt(town, art) {
  const W = art.base.width, H = art.base.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(art.base, 0, 0);
  const layout = ART_LAYOUT[town.faction] || ART_LAYOUT.concord;
  const placed = [];
  for (const [spot, [x, y, sc, flip]] of Object.entries(layout)) {
    const key = artFor(town, spot); if (!key || !art.imgs[key]) continue;
    const im = art.imgs[key], m = art.meta[key];
    if (m.x != null) { placed.push({ key: spot, art: key, img: im, x: m.x, y: m.y, w: m.w, h: m.h, flip: false, gy: m.gy }); continue; }   // pre-placed art
    const h = m.oh * variantScale(spot, key, sc, art.meta), w = im.width * h / im.height;
    placed.push({ key: spot, art: key, img: im, x: x - w / 2, y: y - h, w, h, flip, gy: y });
  }
  // animated buildings are drawn every frame instead of into the static picture; fire and magic glow on top
  const live = [];
  placed.forEach((p, i) => {
    const an = art.anim && art.anim[p.art], gl = glowTinted(art.glow && art.glow[p.art], town.faction);
    if (an || gl) live.push({ p, an, meta: art.meta[p.art], gl, phase: i * 1.7 });
  });
  placed.sort((a, b) => a.gy - b.gy);
  const native = NATIVE_ART[town.faction];
  for (const p of placed) {
    const isAnim = art.anim && art.anim[p.art];
    if (native) { if (!isAnim) drawPlaced(g, p); addHitMask(p); continue; }
    // soft contact shadow
    const sh = g.createRadialGradient(p.x + p.w / 2, p.gy - 4, 0, p.x + p.w / 2, p.gy - 4, p.w * 0.5);
    sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(0.6, 'rgba(0,0,0,0.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(0, p.gy - 4); g.scale(1, 0.22); g.translate(0, -(p.gy - 4));
    g.fillStyle = sh; g.beginPath(); g.arc(p.x + p.w / 2, p.gy - 4, p.w * 0.58, 0, Math.PI * 2); g.fill(); g.restore();
    drawGraded(g, p, H);
    addHitMask(p);
  }
  // alpha mask for precise hit testing (quarter resolution)
  function addHitMask(p) {
    const aw = Math.max(1, Math.round(p.w / 4)), ah = Math.max(1, Math.round(p.h / 4));
    const mc = document.createElement('canvas'); mc.width = aw; mc.height = ah;
    const mg = mc.getContext('2d'); drawPlaced(mg, { ...p, x: 0, y: 0, w: aw, h: ah });
    const data = mg.getImageData(0, 0, aw, ah).data; const alpha = new Uint8Array(aw * ah);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    p.alpha = alpha; p.aw = aw; p.ah = ah;
  }
  if (native) return finish();
  // whole-scene atmosphere: low haze near the horizon and a soft vignette
  const haze = g.createLinearGradient(0, H * 0.38, 0, H * 0.68);
  haze.addColorStop(0, 'rgba(140,140,150,0)'); haze.addColorStop(0.5, 'rgba(140,140,150,0.07)'); haze.addColorStop(1, 'rgba(140,140,150,0)');
  g.fillStyle = haze; g.fillRect(0, 0, W, H);
  const vig = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  return finish();
  function finish() {
  const regions = placed.slice().reverse().map(p => ({ key: p.key, x: p.x, y: p.y, w: p.w, h: p.h, alpha: p.alpha, aw: p.aw, ah: p.ah, p }));
  return {
    canvas: c, regions, w: W, h: H, art: true,
    // per-frame layers: looping building animations, then a slow flicker of the fire, magma and magic glow
    animate(g2, kx, ky, now) {
      if (!live.length) return;
      g2.save(); g2.scale(kx, ky);
      for (const L of live) if (L.an) {
        const A = L.meta.anim, f = Math.floor(now / 1000 * A.fps) % A.n;
        const fh = A.h || L.p.h;
        g2.drawImage(L.an, f * L.p.w, 0, L.p.w, fh, L.p.x, L.p.y + (A.dy || 0), L.p.w, fh);
      }
      g2.globalCompositeOperation = 'lighter';
      for (const L of live) if (L.gl) {
        const t = now / 1000 + L.phase;
        g2.globalAlpha = Math.max(0, 0.32 + 0.22 * Math.sin(t * 2.3) + 0.12 * Math.sin(t * 7.1 + 1.3) + 0.06 * Math.sin(t * 13.7));
        g2.drawImage(L.gl, L.p.x, L.p.y, L.p.w, L.p.h);
      }
      g2.restore();
    },
    highlight(g2, key, kx, ky) {
      const r = regions.find(q => q.key === key); if (!r) return;
      g2.save(); g2.scale(kx, ky);
      g2.filter = 'brightness(1.25) drop-shadow(0 0 6px rgba(240,200,110,0.9))';
      drawPlaced(g2, r.p);
      g2.restore();
    },
  };
  }
}
// Blend a building into the painted backdrop: cooler, slightly desaturated, hazier with distance,
// darker towards the ground, with a warm lava glow from below.
function drawGraded(g, p, H) {
  const w = Math.ceil(p.w), h = Math.ceil(p.h);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.filter = 'saturate(0.85) brightness(1.02) contrast(1.05)';
  drawPlaced(x, { ...p, x: 0, y: 0 });
  x.filter = 'none';
  x.globalCompositeOperation = 'source-atop';
  const depth = 1 - Math.min(1, Math.max(0, (p.gy - H * 0.45) / (H * 0.55)));   // 0 front .. 1 back
  x.fillStyle = `rgba(120,124,132,${0.08 + depth * 0.22})`; x.fillRect(0, 0, w, h);
  const ao = x.createLinearGradient(0, h * 0.62, 0, h);
  ao.addColorStop(0, 'rgba(10,8,8,0)'); ao.addColorStop(1, 'rgba(10,8,8,0.5)');
  x.fillStyle = ao; x.fillRect(0, 0, w, h);
  const glow = x.createLinearGradient(0, h * 0.75, 0, h);
  glow.addColorStop(0, 'rgba(255,110,40,0)'); glow.addColorStop(1, 'rgba(255,110,40,0.12)');
  x.fillStyle = glow; x.fillRect(0, 0, w, h);
  g.drawImage(c, p.x, p.y, p.w, p.h);
}
function drawPlaced(g, p) {
  if (!p.flip) { g.drawImage(p.img, p.x, p.y, p.w, p.h); return; }
  g.save(); g.translate(p.x + p.w, p.y); g.scale(-1, 1); g.drawImage(p.img, 0, 0, p.w, p.h); g.restore();
}
// Precise hit test against a region's alpha mask.
export function regionHit(r, x, y) {
  if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return false;
  if (!r.alpha) return true;
  const ax = Math.min(r.aw - 1, Math.floor((x - r.x) / r.w * r.aw)), ay = Math.min(r.ah - 1, Math.floor((y - r.y) / r.h * r.ah));
  return r.alpha[ay * r.aw + ax] > 40;
}
