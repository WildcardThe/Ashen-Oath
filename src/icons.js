// Modern map markers: metal-framed badges on a short pin, pre-rendered at high resolution and cached.
// Creatures: shield badge, rim coloured by threat, pips for group size.
// Artifacts: diamond badge in rarity colour. Supply caches and watchtowers: round badges.
import { UNITS, ARTIFACTS, RARITY } from './data.js';
import { drawUnit, drawArtifactIcon, shade, hexA } from './art.js';

const RES = 3;              // render scale for crisp downsampling
const BOX = 100;            // design box: badge fits in 100 x 100, pin tip at (50, 132)
const TIP = 122;
const cache = new Map();

export const THREAT_COLORS = ['#7fd06a', '#c8d45a', '#f0c048', '#f08a3a', '#e8443a'];
export const THREAT_NAMES = ['Trivial', 'Weak', 'Even fight', 'Strong', 'Deadly'];
export function threatLevel(ratio) { return ratio < 0.4 ? 0 : ratio < 0.8 ? 1 : ratio < 1.25 ? 2 : ratio < 2 ? 3 : 4; }
export function sizeTier(n) { return n < 5 ? 1 : n < 10 ? 2 : n < 20 ? 3 : n < 50 ? 4 : n < 100 ? 5 : n < 250 ? 6 : 7; }

// ---------- shapes (in design units) ----------
function shieldPath(g, inset = 0) {
  const l = 14 + inset, r = 86 - inset, t = 6 + inset, b = 96 - inset * 1.2;
  g.beginPath();
  g.moveTo(l, t + 8); g.quadraticCurveTo(l, t, l + 8, t);
  g.lineTo(r - 8, t); g.quadraticCurveTo(r, t, r, t + 8);
  g.lineTo(r, 52); g.quadraticCurveTo(r, 78, 50, b); g.quadraticCurveTo(l, 78, l, 52);
  g.closePath();
}
function diamondPath(g, inset = 0) {
  const c = 50, h = 46 - inset, k = 6;
  g.beginPath();
  g.moveTo(c, c - h + k); g.quadraticCurveTo(c, c - h, c + k, c - h + k);
  g.lineTo(c + h - k, c - k); g.quadraticCurveTo(c + h, c, c + h - k, c + k);
  g.lineTo(c + k, c + h - k); g.quadraticCurveTo(c, c + h, c - k, c + h - k);
  g.lineTo(c - h + k, c + k); g.quadraticCurveTo(c - h, c, c - h + k, c - k);
  g.closePath();
}
function circlePath(g, inset = 0) { g.beginPath(); g.arc(50, 50, 42 - inset, 0, Math.PI * 2); }
const SHAPES = { shield: shieldPath, diamond: diamondPath, circle: circlePath };
const BOTTOM = { shield: 96, diamond: 96, circle: 92 };

// ---------- badge frame ----------
function frame(g, shape, rim, tint, content, after) {
  const path = SHAPES[shape];
  // pin stem and its shadow
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(50, TIP, 13, 4.5, 0, 0, Math.PI * 2); g.fill();
  const stem = g.createLinearGradient(44, 0, 56, 0);
  stem.addColorStop(0, '#3a2c1c'); stem.addColorStop(0.5, '#b08a4a'); stem.addColorStop(1, '#3a2c1c');
  g.fillStyle = stem; g.beginPath(); g.moveTo(44, BOTTOM[shape] - 6); g.lineTo(56, BOTTOM[shape] - 6); g.lineTo(50.8, TIP); g.lineTo(49.2, TIP); g.closePath(); g.fill();
  g.restore();
  // drop shadow under the badge
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8; g.shadowOffsetY = 3; path(g, 0); g.fillStyle = '#1a140e'; g.fill(); g.restore();
  // metallic outer frame
  const metal = g.createLinearGradient(10, 4, 90, 98);
  metal.addColorStop(0, '#f6dc94'); metal.addColorStop(0.25, '#b88a3e'); metal.addColorStop(0.55, '#6a4a22'); metal.addColorStop(0.8, '#c8a050'); metal.addColorStop(1, '#4a3418');
  path(g, 0); g.fillStyle = metal; g.fill();
  // coloured rim (threat or rarity)
  path(g, 4); g.fillStyle = rim; g.fill();
  const rimShade = g.createLinearGradient(0, 0, 0, 100);
  rimShade.addColorStop(0, 'rgba(255,255,255,0.35)'); rimShade.addColorStop(0.5, 'rgba(255,255,255,0)'); rimShade.addColorStop(1, 'rgba(0,0,0,0.35)');
  path(g, 4); g.fillStyle = rimShade; g.fill();
  // dark inner field with a tinted glow
  path(g, 8.5); g.fillStyle = '#120e0c'; g.fill();
  const field = g.createRadialGradient(50, 40, 4, 50, 52, 52);
  field.addColorStop(0, hexA(tint, 0.55)); field.addColorStop(0.7, hexA(tint, 0.12)); field.addColorStop(1, 'rgba(0,0,0,0)');
  path(g, 8.5); g.fillStyle = field; g.fill();
  // content clipped to the field
  g.save(); path(g, 8.5); g.clip(); content(g); g.restore();
  // inner bevel and glass highlight
  g.save(); path(g, 8.5); g.clip();
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.55)'; path(g, 8.5); g.stroke();
  const glass = g.createLinearGradient(0, 8, 0, 48);
  glass.addColorStop(0, 'rgba(255,255,255,0.28)'); glass.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glass; g.beginPath(); g.ellipse(42, 18, 34, 16, -0.25, 0, Math.PI * 2); g.fill();
  g.restore();
  // fine outline
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(20,12,6,0.9)'; path(g, 0); g.stroke();
  if (after) after(g);
}

function render(key, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = BOX * RES; c.height = (TIP + 8) * RES;
  const g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round';
  draw(g);
  cache.set(key, c);
  return c;
}

// ---------- content ----------
// Each figure is rendered once, measured, and fitted into the badge: tall figures show the upper body.
const figures = new Map();
function figure(type) {
  if (figures.has(type)) return figures.get(type);
  const c = document.createElement('canvas'); c.width = 640; c.height = 640;
  const g = c.getContext('2d');
  drawUnit(g, type, 320, 560, 380, -1, 0);
  const d = g.getImageData(0, 0, 640, 640).data;
  let x0 = 640, y0 = 640, x1 = 0, y1 = 0;
  for (let y = 0; y < 640; y += 2) for (let x = 0; x < 640; x += 2) {
    if (d[(y * 640 + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const f = { c, x0, y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  figures.set(type, f);
  return f;
}
function creatureContent(type) {
  return g => {
    const fl = g.createRadialGradient(50, 70, 2, 50, 70, 44); fl.addColorStop(0, 'rgba(255,170,90,0.3)'); fl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fl; g.fillRect(0, 0, 100, 100);
    const f = figure(type);
    let { x0, y0, w, h } = f;
    const tall = h > w * 1.15;
    if (tall) h = Math.max(w * 1.1, h * 0.7);           // crop to head and torso
    const k = Math.min(64 / w, (tall ? 74 : 60) / h);
    const dw = w * k, dh = h * k;
    const top = tall ? 13 : 50 - dh / 2 + 2;
    g.drawImage(f.c, x0, y0, w, h, 50 - dw / 2, top, dw, dh);
  };
}
function pips(g, n, color) {
  const w = n * 8 + 8, x0 = 50 - w / 2, y = 88;
  g.fillStyle = 'rgba(14,10,8,0.92)'; g.strokeStyle = '#b8924a'; g.lineWidth = 1.2;
  g.beginPath(); g.roundRect ? g.roundRect(x0, y, w, 11, 5) : g.rect(x0, y, w, 11); g.fill(); g.stroke();
  for (let i = 0; i < n; i++) {
    g.fillStyle = color; g.beginPath(); g.arc(x0 + 8 + i * 8, y + 5.5, 2.6, 0, Math.PI * 2); g.fill();
  }
}
function chestContent(g) {
  const fl = g.createRadialGradient(50, 60, 2, 50, 60, 36); fl.addColorStop(0, 'rgba(255,200,90,0.5)'); fl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fl; g.fillRect(0, 0, 100, 100);
  g.lineJoin = 'round'; g.strokeStyle = 'rgba(16,10,6,0.95)'; g.lineWidth = 1.6;
  // body
  const wood = g.createLinearGradient(0, 46, 0, 76); wood.addColorStop(0, '#8a5a32'); wood.addColorStop(1, '#4a2c16');
  g.fillStyle = wood; g.beginPath(); g.rect(24, 46, 52, 30); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(30,16,8,0.6)'; g.lineWidth = 1; for (const y of [56, 66]) { g.beginPath(); g.moveTo(24, y); g.lineTo(76, y); g.stroke(); }
  // glow from the gap under the lid
  g.fillStyle = 'rgba(255,214,120,0.95)'; g.fillRect(25, 44, 50, 3);
  const beam = g.createLinearGradient(0, 44, 0, 20); beam.addColorStop(0, 'rgba(255,220,130,0.55)'); beam.addColorStop(1, 'rgba(255,220,130,0)');
  g.fillStyle = beam; g.beginPath(); g.moveTo(26, 44); g.lineTo(74, 44); g.lineTo(84, 16); g.lineTo(16, 16); g.closePath(); g.fill();
  // lid
  const lid = g.createLinearGradient(0, 28, 0, 46); lid.addColorStop(0, '#a06a3a'); lid.addColorStop(1, '#5a3418');
  g.fillStyle = lid; g.strokeStyle = 'rgba(16,10,6,0.95)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(22, 44); g.lineTo(22, 38); g.quadraticCurveTo(50, 20, 78, 38); g.lineTo(78, 44); g.closePath(); g.fill(); g.stroke();
  // gold bands and lock
  const gold = g.createLinearGradient(0, 28, 0, 78); gold.addColorStop(0, '#ffe39a'); gold.addColorStop(0.5, '#d4a040'); gold.addColorStop(1, '#8a6020');
  g.fillStyle = gold;
  for (const x of [30, 66]) { g.beginPath(); g.rect(x, 31, 5, 45); g.fill(); g.stroke(); }
  g.beginPath(); g.rect(22, 43, 56, 4); g.fill(); g.stroke();
  g.beginPath(); g.roundRect ? g.roundRect(44, 46, 12, 13, 2) : g.rect(44, 46, 12, 13); g.fill(); g.stroke();
  g.fillStyle = '#2a1a0a'; g.beginPath(); g.arc(50, 51, 1.8, 0, Math.PI * 2); g.fill(); g.fillRect(49.2, 51, 1.6, 4);
  // coins spilling
  for (const [x, y] of [[20, 76], [27, 79], [74, 78], [81, 75]]) { g.fillStyle = gold; g.beginPath(); g.ellipse(x, y, 4, 2.2, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
}
function towerContent(g) {
  const sky = g.createLinearGradient(0, 0, 0, 100); sky.addColorStop(0, '#2a3a5a'); sky.addColorStop(1, '#141018');
  g.fillStyle = sky; g.fillRect(0, 0, 100, 100);
  const beam = g.createRadialGradient(50, 30, 2, 50, 30, 40); beam.addColorStop(0, 'rgba(255,230,150,0.9)'); beam.addColorStop(1, 'rgba(255,230,150,0)');
  g.fillStyle = beam; g.beginPath(); g.moveTo(50, 30); g.lineTo(96, 12); g.lineTo(96, 48); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(50, 30); g.lineTo(4, 12); g.lineTo(4, 48); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(16,10,6,0.95)'; g.lineWidth = 1.5;
  const stone = g.createLinearGradient(38, 0, 62, 0); stone.addColorStop(0, '#8a8478'); stone.addColorStop(1, '#4a4640');
  g.fillStyle = stone; g.beginPath(); g.moveTo(40, 92); g.lineTo(44, 40); g.lineTo(56, 40); g.lineTo(60, 92); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#5a4030'; g.beginPath(); g.moveTo(38, 34); g.lineTo(50, 18); g.lineTo(62, 34); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#6e6860'; g.fillRect(40, 33, 20, 8); g.strokeRect(40, 33, 20, 8);
  g.fillStyle = '#ffe28a'; g.fillRect(46, 34.5, 8, 5);
  g.fillStyle = '#1a1410'; for (const y of [54, 70]) g.fillRect(48, y, 4, 7);
}
function artifactContent(id) {
  return g => {
    const a = ARTIFACTS[id], col = RARITY[a.r].color;
    const fl = g.createRadialGradient(50, 50, 2, 50, 50, 38); fl.addColorStop(0, hexA(col, 0.55)); fl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fl; g.fillRect(0, 0, 100, 100);
    drawArtifactIcon(g, id, 50, 50, 58, col, a.slot);
  };
}

// ---------- public drawing ----------
// Draws a cached marker with its pin tip at (x, groundY). `size` is the badge width in screen pixels.
function blitMarker(g, c, x, groundY, size, lift = 0, hover = false) {
  const k = size / BOX * (hover ? 1.1 : 1);
  const w = BOX * k, h = (TIP + 8) * k;
  g.save();
  if (hover) g.filter = 'brightness(1.18)';
  g.drawImage(c, x - w / 2, groundY - TIP * k - lift, w, h);
  g.restore();
}
export function drawCreatureMarker(g, type, count, threat, x, groundY, size, t = 0, hover = false) {
  const tier = sizeTier(count), col = threat == null ? '#b8a07a' : THREAT_COLORS[threat];
  const elite = /_e$/.test(type);   // elite creatures: gold-trimmed badge
  const c = render(`m:${type}:${threat}:${tier}`, gg => frame(gg, 'shield', col, elite ? '#e2c06a' : '#a0402a', creatureContent(type), gg2 => pips(gg2, tier, col)));
  blitMarker(g, c, x, groundY, size, Math.sin(t * 0.003 + x * 0.05) * 1.2, hover);
}
export function drawArtifactMarker(g, id, x, groundY, size, t = 0, hover = false) {
  const col = RARITY[ARTIFACTS[id].r].color;
  const c = render(`a:${id}`, gg => frame(gg, 'diamond', col, col, artifactContent(id)));
  const k = size / BOX, lift = Math.sin(t * 0.004 + x) * 2;
  // pulsing aura and sparkles drawn live
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.004 + x);
  const cy = groundY - (TIP - 50) * k - lift;
  const gr = g.createRadialGradient(x, cy, 0, x, cy, size * 0.85);
  gr.addColorStop(0, hexA(col, 0.25 + 0.15 * pulse)); gr.addColorStop(1, hexA(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, cy, size * 0.85, 0, Math.PI * 2); g.fill();
  blitMarker(g, c, x, groundY, size, lift, hover);
  g.save(); g.fillStyle = '#fffbe8';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.0012 + i / 3 + x * 0.01) % 1, a = i * 2.1 + x;
    const sx = x + Math.cos(a) * size * 0.5, sy = cy + Math.sin(a) * size * 0.45 - ph * size * 0.3;
    g.globalAlpha = Math.sin(ph * Math.PI) * 0.9; const r = size * 0.05;
    g.beginPath(); g.moveTo(sx, sy - r * 2); g.lineTo(sx + r * 0.5, sy); g.lineTo(sx, sy + r * 2); g.lineTo(sx - r * 0.5, sy); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(sx - r * 2, sy); g.lineTo(sx, sy + r * 0.5); g.lineTo(sx + r * 2, sy); g.lineTo(sx, sy - r * 0.5); g.closePath(); g.fill();
  }
  g.restore();
}
let chestSprite = null;
export function setChestSprite(im) { chestSprite = im; }
export function drawChestMarker(g, x, groundY, size, t = 0, hover = false) {
  if (chestSprite) {
    const w = size * 0.95, h = chestSprite.height * w / chestSprite.width;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(x, groundY - 2, w * 0.42, w * 0.12, 0, 0, Math.PI * 2); g.fill();
    const glow = 0.18 + 0.12 * Math.sin(t * 0.004 + x);
    const gr = g.createRadialGradient(x, groundY - h * 0.5, 0, x, groundY - h * 0.5, w * 0.8);
    gr.addColorStop(0, `rgba(255,90,200,${glow})`); gr.addColorStop(1, 'rgba(255,90,200,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, groundY - h * 0.5, w * 0.8, 0, Math.PI * 2); g.fill();
    if (hover) g.filter = 'brightness(1.25)';
    g.drawImage(chestSprite, x - w / 2, groundY - h - (hover ? 3 : 0), w, h);
    g.restore();
    return;
  }
  const c = render('chest', gg => frame(gg, 'circle', '#d8a440', '#c88a30', chestContent));
  blitMarker(g, c, x, groundY, size, Math.sin(t * 0.003 + x * 0.07) * 1.2, hover);
}
export function drawTowerMarker(g, x, groundY, size, visited, t = 0, hover = false) {
  const c = render('tower:' + !!visited, gg => frame(gg, 'circle', visited ? '#6a7a8a' : '#7ab8e8', '#4a7aa8', towerContent));
  blitMarker(g, c, x, groundY, size, 0, hover);
}
// Small badge image for HTML (portrait without the pin), as a data URL.
export function markerURL(kind, arg) {
  const c = kind === 'artifact' ? render(`a:${arg}`, gg => frame(gg, 'diamond', RARITY[ARTIFACTS[arg].r].color, RARITY[ARTIFACTS[arg].r].color, artifactContent(arg)))
    : kind === 'chest' ? render('chest', gg => frame(gg, 'circle', '#d8a440', '#c88a30', chestContent))
    : render(`m:${arg}:null:1`, gg => frame(gg, 'shield', '#b8a07a', '#a0402a', creatureContent(arg)));
  const out = document.createElement('canvas'); out.width = 96; out.height = 96;
  out.getContext('2d').drawImage(c, 0, 0, BOX * RES, BOX * RES, 0, 0, 96, 96);
  return out.toDataURL();
}

// Coloured key-codex badge for Key Codex Stations and Sealed Blast Doors.
export function drawKeyMarker(g, color, x, y, s, time) {
  g.save(); g.translate(x, y); const k = s / 20; g.scale(k, k);
  g.shadowColor = color; g.shadowBlur = 6 + 3 * Math.sin(time * 0.004);
  g.fillStyle = 'rgba(14,11,9,.85)'; g.strokeStyle = color; g.lineWidth = 1.6;
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill(); g.stroke();
  g.shadowBlur = 0; g.fillStyle = color;
  g.beginPath(); g.arc(-3, 0, 3.6, 0, Math.PI * 2); g.fill();
  g.fillRect(0, -1.2, 8, 2.4); g.fillRect(5, 1, 1.8, 3); g.fillRect(2.4, 1, 1.8, 2.2);
  g.fillStyle = 'rgba(14,11,9,.9)'; g.beginPath(); g.arc(-3, 0, 1.4, 0, Math.PI * 2); g.fill();
  g.restore();
}
