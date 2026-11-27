// Procedural vector art: units, heroes, map objects, terrain, icons.
import { UNITS, TERRAIN, TERRAIN_TEX, RES_INFO, SITES } from './data.js';
import { mulberry32, SCENERY } from './map.js';

// Sprite sheet assets (set by main.js once loaded).
let AS = null;
export function setAssets(a) { AS = a; }
export const SPR_SCALE = 0.62;

export function shade(hex, amt) {
  const c = parseInt(hex.slice(1), 16);
  let r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function hexA(hex, a) {
  const c = parseInt(hex.slice(1), 16);
  return `rgba(${c >> 16},${(c >> 8) & 255},${c & 255},${a})`;
}

function P(g, pts, fill, stroke = true) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) g.stroke();
}
function E(g, x, y, rx, ry, fill, stroke = true) {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (stroke) g.stroke();
}
function R(g, x, y, w, h, r, fill, stroke = true) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fillStyle = fill; g.fill(); if (stroke) g.stroke();
}
function L(g, pts, color, w) {
  g.save(); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.restore();
}
function glow(g, x, y, r, color, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, hexA(color, a)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

// ---------------- unit figures (100-unit tall coordinate space, feet at y=0) ----------------
function trooper(g, m, tr, time, o = {}) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2);
  P(g, [[-12, -36], [-3, -36], [-4, -4], [-14, -4]], dk); P(g, [[3, -36], [12, -36], [14, -4], [4, -4]], dk);
  R(g, -16, -7, 13, 7, 2, '#1b1714'); R(g, 3, -7, 14, 7, 2, '#1b1714');
  P(g, [[-15, -70], [15, -70], [20, -30], [-20, -30]], m);
  if (o.armor) { P(g, [[-12, -68], [12, -68], [10, -48], [-10, -48]], lt); E(g, -15, -66, 9, 7, dk); E(g, 15, -66, 9, 7, dk); }
  R(g, -18, -46, 36, 5, 1, tr);
  E(g, 0, -79, 8, 9, o.horns ? '#2a2422' : '#c7a283');
  if (o.horns) {
    P(g, [[-7, -86], [-20, -106], [-12, -86]], tr); P(g, [[7, -86], [20, -106], [12, -86]], tr);
    R(g, -10, -92, 20, 14, 5, dk); R(g, -6, -84, 12, 3, 1, '#ff5a3a', false);
  } else if (o.goggles) {
    P(g, [[-9, -86], [9, -86], [6, -98], [-6, -98]], '#5a4a3a');
    R(g, -10, -84, 20, 7, 3, dk); E(g, -4, -80.5, 3.2, 3.2, '#e8c060', false); E(g, 5, -80.5, 3.2, 3.2, '#e8c060', false);
  } else {
    g.beginPath(); g.arc(0, -82, 11, Math.PI, 0); g.closePath(); g.fillStyle = lt; g.fill(); g.stroke();
    R(g, -13, -84, 26, 4, 1, dk);
  }
  if (o.pistol) P(g, [[4, -60], [28, -63], [28, -56], [6, -53]], '#2a2624');
  else { P(g, [[-8, -58], [40, -68], [41, -63], [-6, -52]], '#2a2624'); R(g, 34, -70, 9, 3, 1, tr, false); }
  P(g, [[6, -66], [16, -64], [20, -57], [10, -54]], m);
}

function heavy(g, m, tr, time, o = {}) {
  const dk = shade(m, -0.45), lt = shade(m, 0.25);
  if (o.pack) g.translate(0, -12 + Math.sin(time * 0.004) * 3);
  if (o.cape) P(g, [[-18, -84], [18, -84], [28, -4], [-30, -4]], o.cape);
  P(g, [[-17, -42], [-2, -42], [-3, -6], [-20, -6]], dk); P(g, [[2, -42], [17, -42], [20, -6], [3, -6]], dk);
  R(g, -22, -9, 19, 9, 3, shade(m, -0.6)); R(g, 3, -9, 19, 9, 3, shade(m, -0.6));
  if (o.pack) {
    R(g, -34, -92, 16, 40, 4, dk);
    const f = 6 * Math.sin(time * 0.02);
    P(g, [[-32, -52], [-20, -52], [-26, -26 + f]], '#ffb347', false);
    P(g, [[-29, -52], [-23, -52], [-26, -36 + f]], '#fff1a8', false);
  }
  R(g, -22, -84, 44, 46, 9, m);
  P(g, [[-13, -76], [0, -66], [13, -76], [13, -70], [0, -59], [-13, -70]], tr);
  R(g, -20, -44, 40, 5, 1, tr);
  E(g, -24, -78, 13, 11, lt); E(g, 24, -78, 13, 11, lt);
  R(g, -10, -104, 20, 22, 7, m); R(g, -7, -96, 14, 4, 1, o.eye || '#9fe3ff', false);
  if (o.laurel) { g.save(); g.strokeStyle = tr; g.lineWidth = 3; g.beginPath(); g.arc(0, -100, 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.restore(); }
  if (o.shield) {
    P(g, [[-30, -60], [-25, -60], [-25, -108], [-27.5, -114], [-30, -108]], '#d9e2ea'); R(g, -34, -62, 13, 4, 1, tr);
    R(g, 8, -82, 26, 66, 5, shade(m, -0.15));
    g.save(); g.strokeStyle = tr; g.lineWidth = 3; g.strokeRect(12, -78, 18, 58);
    g.beginPath(); g.moveTo(21, -72); g.lineTo(21, -28); g.moveTo(14, -58); g.lineTo(28, -58); g.stroke(); g.restore();
  }
  if (o.sword) { P(g, [[16, -62], [21, -64], [48, -114], [44, -116]], '#e3ecf2'); R(g, 12, -66, 12, 5, 1, tr); }
}

function walker(g, m, tr) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2);
  L(g, [[-14, -46], [-26, -24], [-20, -4]], dk, 11); L(g, [[14, -46], [24, -24], [20, -4]], dk, 11);
  R(g, -32, -8, 22, 8, 3, '#1b1714'); R(g, 10, -8, 22, 8, 3, '#1b1714');
  R(g, -20, -56, 40, 14, 4, dk);
  R(g, -32, -104, 62, 52, 7, m);
  P(g, [[-24, -96], [22, -96], [18, -64], [-20, -64]], lt);
  R(g, -32, -66, 62, 6, 0, tr);
  R(g, -10, -92, 22, 8, 2, '#9fe3ff');
  R(g, -28, -118, 7, 16, 1, dk); R(g, -18, -114, 6, 12, 1, dk);
  R(g, 26, -92, 36, 10, 2, '#2a2624'); R(g, 26, -76, 32, 10, 2, '#2a2624');
  R(g, 58, -93, 6, 12, 1, tr); R(g, 54, -77, 6, 12, 1, tr);
}

function angel(g, m, tr, time) {
  g.translate(0, -14 + Math.sin(time * 0.003) * 3);
  const wing = 'rgba(250,240,210,0.95)';
  P(g, [[-4, -80], [-58, -126], [-74, -100], [-62, -84], [-70, -70], [-50, -62], [-56, -50], [-14, -58]], wing);
  g.save(); g.strokeStyle = 'rgba(150,130,90,0.7)'; g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-10, -64 - i * 5); g.lineTo(-60 + i * 4, -110 + i * 14); g.stroke(); }
  g.restore();
  P(g, [[-15, -80], [15, -80], [24, 0], [-24, 0]], m);
  P(g, [[-15, -80], [15, -80], [11, -52], [-11, -52]], tr);
  E(g, 0, -92, 9, 10, '#ecd9b8');
  R(g, -10, -104, 20, 10, 4, tr);
  g.save(); g.strokeStyle = '#fff3b0'; g.lineWidth = 3; g.shadowColor = '#ffe680'; g.shadowBlur = 12;
  g.beginPath(); g.ellipse(0, -114, 13, 4, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  P(g, [[16, -64], [21, -64], [42, -134], [37, -134]], '#fffbe0'); R(g, 10, -68, 18, 5, 1, tr);
  P(g, [[2, -78], [50, -112], [60, -92], [46, -80], [54, -66], [14, -62]], wing);
}

function cultist(g, m, tr) {
  const dk = shade(m, -0.5);
  P(g, [[-14, -74], [14, -74], [24, -4], [18, 0], [12, -5], [6, 0], [0, -5], [-6, 0], [-12, -5], [-18, 0], [-24, -4]], m);
  R(g, -15, -48, 30, 4, 1, tr);
  P(g, [[-13, -72], [13, -72], [11, -94], [0, -106], [-11, -94]], dk);
  E(g, 0, -84, 6, 8, '#120a08', false);
  E(g, -2.5, -86, 1.8, 1.8, '#ff5a2a', false); E(g, 3, -86, 1.8, 1.8, '#ff5a2a', false);
  P(g, [[8, -66], [18, -60], [22, -54], [12, -56]], m);
  P(g, [[18, -58], [36, -86], [40, -82], [22, -54]], '#c8bfae');
  R(g, 14, -60, 8, 5, 1, tr);
}

function fiend(g, m, tr, time) {
  const dk = shade(m, -0.4), lt = shade(m, 0.25); const flap = Math.sin(time * 0.008) * 8;
  g.translate(0, -10);
  P(g, [[-6, -46], [-38, -92 - flap], [-32, -72], [-52, -74 - flap * 0.5], [-36, -58], [-48, -50], [-14, -40]], shade(m, -0.25));
  L(g, [[-26, -34], [-44, -46], [-52, -30]], dk, 4);
  P(g, [[-18, -30], [-10, -30], [-16, -4], [-26, -2]], dk);
  E(g, -4, -36, 26, 14, m);
  g.save(); g.strokeStyle = lt; g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-12 + i * 7, -36, 8, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
  g.restore();
  P(g, [[10, -30], [18, -10], [30, -2], [16, -2], [6, -22]], lt);
  L(g, [[28, -2], [37, 0]], tr, 2); L(g, [[26, -4], [36, -7]], tr, 2);
  E(g, 22, -46, 12, 10, lt);
  P(g, [[26, -42], [44, -40], [28, -34]], '#f0d6c8');
  E(g, 24, -50, 2.5, 2.5, '#ffe25a', false);
}

function engine(g, m, tr, time) {
  const dk = shade(m, -0.45);
  [[-28, -36], [-12, -14], [12, 14], [28, 36]].forEach(([x, fx]) => L(g, [[x, -30], [(x + fx) / 2 + (x < 0 ? -5 : 5), -16], [fx, -2]], dk, 8));
  R(g, -38, -84, 76, 56, 10, m);
  P(g, [[-38, -84], [-28, -102], [-16, -84]], tr); P(g, [[38, -84], [28, -102], [16, -84]], tr);
  const fl = 0.6 + 0.4 * Math.sin(time * 0.01);
  R(g, -16, -72, 32, 24, 4, '#1e0d08');
  g.save(); g.globalAlpha = fl; for (let i = 0; i < 4; i++) R(g, -13 + i * 7.5, -69, 4, 18, 1, tr, false); g.restore();
  glow(g, 0, -60, 28, tr, 0.35 * fl);
  P(g, [[24, -56], [48, -50], [24, -40]], dk);
  for (let i = 0; i < 3; i++) P(g, [[27 + i * 6, -54], [30 + i * 6, -47], [33 + i * 6, -54]], '#e8dcc0', false);
  R(g, -26, -110, 11, 28, 2, dk);
  const sm = (time * 0.02) % 20;
  g.save(); g.globalAlpha = 0.35 * (1 - sm / 20); E(g, -20, -118 - sm, 8 + sm * 0.3, 6 + sm * 0.2, '#7a7068', false); g.restore();
}

function prince(g, m, tr, time) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2);
  if (!prince.noWings) g.translate(0, -10 + Math.sin(time * 0.003) * 3);
  if (!prince.noWings) P(g, [[-6, -88], [-62, -134], [-58, -108], [-80, -100], [-58, -84], [-70, -66], [-20, -62]], shade(m, -0.35));
  P(g, [[-18, -86], [18, -86], [30, -2], [-32, -2]], shade(m, -0.6));
  P(g, [[-16, -44], [-2, -44], [-4, -4], [-20, -4]], dk); P(g, [[2, -44], [16, -44], [20, -4], [4, -4]], dk);
  R(g, -20, -92, 40, 52, 7, m);
  P(g, [[-12, -84], [0, -70], [12, -84], [0, -60]], tr);
  E(g, -22, -86, 11, 9, lt); E(g, 22, -86, 11, 9, lt);
  R(g, -10, -112, 20, 22, 6, dk);
  P(g, [[-8, -108], [-28, -128], [-30, -118], [-12, -100]], '#d9c9a6'); P(g, [[8, -108], [28, -128], [30, -118], [12, -100]], '#d9c9a6');
  glow(g, 0, -102, 10, '#ff4a3a', 0.5);
  E(g, -4, -102, 2.2, 2.2, '#ff4a3a', false); E(g, 4, -102, 2.2, 2.2, '#ff4a3a', false);
  P(g, [[18, -66], [25, -66], [34, -146], [26, -142]], '#2a1416');
  g.save(); g.strokeStyle = tr; g.lineWidth = 1.5; g.beginPath(); g.moveTo(25, -66); g.lineTo(34, -146); g.stroke(); g.restore();
  R(g, 12, -70, 20, 6, 1, tr);
  if (!prince.noWings) P(g, [[2, -84], [52, -122], [58, -100], [46, -90], [52, -74], [14, -66]], shade(m, -0.2));
}

function bug(g, m, tr, time) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2); const w = Math.sin(time * 0.02) * 2;
  for (let i = 0; i < 3; i++) {
    const x = -14 + i * 14;
    L(g, [[x, -16], [x - 8, -26], [x - 14 + w, 0]], dk, 3); L(g, [[x, -16], [x + 6, -26], [x + 10 - w, 0]], dk, 3);
  }
  E(g, -4, -18, 26, 13, m);
  g.save(); g.strokeStyle = lt; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-14 + i * 10, -18, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  g.restore();
  E(g, 24, -20, 10, 8, dk);
  P(g, [[30, -22], [42, -28], [36, -18]], tr); P(g, [[30, -16], [42, -10], [34, -14]], tr);
  E(g, 27, -24, 2, 2, '#ffcc55', false);
}

function stalker(g, m, tr, time) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2);
  L(g, [[-8, -36], [-20, -20], [-24, 0]], dk, 4); L(g, [[-2, -36], [-8, -18], [-6, 0]], dk, 4);
  L(g, [[4, -38], [12, -20], [14, 0]], dk, 4); L(g, [[8, -40], [22, -22], [28, 0]], dk, 4);
  E(g, -18, -38, 16, 11, dk);
  g.save(); g.translate(4, -56); g.rotate(-0.35); E(g, 0, 0, 10, 24, m); g.restore();
  P(g, [[8, -78], [26, -86], [30, -80], [12, -72]], lt); E(g, 26, -84, 2, 2, '#e0ff70', false);
  const sw = Math.sin(time * 0.006) * 4;
  P(g, [[10, -66], [30, -84 + sw], [48, -58 + sw], [44, -56 + sw], [30, -76 + sw], [12, -60]], tr);
  P(g, [[6, -60], [24, -74 - sw], [40, -46 - sw], [36, -45 - sw], [24, -66 - sw], [8, -54]], shade(tr, -0.2));
}

function hulk(g, m, tr, time) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2); const br = Math.sin(time * 0.004) * 2;
  R(g, -30, -24, 16, 24, 4, dk); R(g, 14, -24, 16, 24, 4, dk);
  E(g, 0, -56, 46 + br, 42 + br, m);
  E(g, -10, -70, 26, 20, lt, false);
  [[-30, -74, 10], [24, -82, 12], [-12, -96, 8], [34, -52, 9], [-36, -44, 7]].forEach(([x, y, r]) => {
    glow(g, x, y, r * 1.8, tr, 0.35); E(g, x, y, r, r, shade(tr, -0.1));
    E(g, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.35, 'rgba(255,255,220,0.5)', false);
  });
  P(g, [[8, -46], [38, -40], [34, -26], [10, -30]], '#1a120e');
  for (let i = 0; i < 4; i++) P(g, [[12 + i * 6, -44], [15 + i * 6, -36], [18 + i * 6, -43]], '#e8dcc0', false);
  E(g, 24, -60, 3, 3, '#ffcc55', false); E(g, 32, -58, 2.5, 2.5, '#ffcc55', false);
}

function lordH(g, m, tr, time) { prince.noWings = true; prince(g, m, tr, time); prince.noWings = false; }

function servitor(g, m, tr, time) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2);
  P(g, [[-11, -34], [-3, -34], [-5, -4], [-14, -4]], dk); P(g, [[3, -34], [11, -34], [14, -4], [5, -4]], dk);
  R(g, -15, -7, 12, 7, 2, '#1b1714'); R(g, 4, -7, 12, 7, 2, '#1b1714');
  P(g, [[-14, -66], [14, -66], [17, -30], [-17, -30]], m);
  R(g, -10, -60, 20, 14, 2, lt); for (let i = 0; i < 3; i++) R(g, -7 + i * 5, -57, 3, 8, 0, '#2a2622', false);
  E(g, 0, -76, 9, 9, '#a08878'); R(g, -9, -80, 18, 6, 2, '#3a3632'); E(g, 4, -77, 3, 3, '#ff5a2a', false);
  L(g, [[0, -86], [4, -96]], '#3a3632', 2); L(g, [[-6, -70], [-14, -92]], '#3a3632', 2.5);
  L(g, [[12, -62], [24, -52], [30, -60]], '#5a5650', 6); P(g, [[28, -64], [40, -60], [38, -54], [28, -56]], tr);
  L(g, [[-12, -62], [-20, -46]], dk, 6);
  const sp = Math.sin(time * 0.02) > 0.6; if (sp) glow(g, 40, -58, 8, '#ffcf70', 0.7);
}
function brute(g, m, tr, time) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2), bob = Math.sin(time * 0.004) * 1.5;
  P(g, [[-20, -44], [-4, -44], [-6, -4], [-24, -4]], dk); P(g, [[4, -44], [20, -44], [24, -4], [6, -4]], dk);
  R(g, -27, -9, 20, 9, 3, '#1b1714'); R(g, 6, -9, 20, 9, 3, '#1b1714');
  E(g, 0, -66 + bob, 30, 28, m);
  E(g, -8, -74 + bob, 14, 10, lt, false);
  E(g, -24, -76 + bob, 12, 10, tr); E(g, 26, -70 + bob, 9, 8, tr);
  E(g, 2, -98 + bob, 10, 9, lt); E(g, 6, -100 + bob, 2, 2, '#ffd030', false); E(g, -2, -100 + bob, 1.6, 1.6, '#ffd030', false);
  L(g, [[24, -64 + bob], [36, -46], [30, -30]], dk, 9);
  P(g, [[26, -40], [56, -84], [62, -80], [32, -36]], '#5a5650');
  R(g, 50, -92, 16, 10, 1, '#6e6a62');
}
function wraith(g, m, tr, time) {
  const f = Math.sin(time * 0.003);
  g.translate(0, -18 + f * 4);
  glow(g, 0, -50, 46, tr, 0.25);
  g.globalAlpha *= 0.92;
  P(g, [[-16, -80], [16, -80], [26, -20], [18, -8 + f * 3], [10, -18], [2, -4 - f * 3], [-6, -18], [-14, -6 + f * 3], [-24, -20]], m);
  P(g, [[-14, -80], [14, -80], [10, -100], [0, -110], [-10, -100]], shade(m, -0.4));
  E(g, 0, -88, 7, 9, '#05060a', false);
  E(g, -3, -90, 2, 2, tr, false); E(g, 3, -90, 2, 2, tr, false); glow(g, 0, -90, 9, tr, 0.6);
  L(g, [[14, -70], [32, -60 + f * 4], [44, -66]], shade(m, 0.2), 4);
  for (let i = 0; i < 3; i++) L(g, [[44, -66], [52 + i * 2, -72 + i * 5]], tr, 1.6);
}
function drake(g, m, tr, time) {
  const dk = shade(m, -0.45), lt = shade(m, 0.2), flap = Math.sin(time * 0.006) * 14;
  g.translate(0, -16 + Math.sin(time * 0.003) * 3);
  P(g, [[-10, -60], [-46, -110 - flap], [-60, -76 - flap * 0.6], [-74, -82 - flap * 0.3], [-58, -52], [-30, -44]], shade(m, -0.25));
  L(g, [[-10, -60], [-46, -110 - flap]], dk, 3); L(g, [[-46, -110 - flap], [-58, -52]], dk, 1.5);
  L(g, [[-30, -40], [-56, -36], [-70, -18]], m, 9);
  P(g, [[-74, -22], [-84, -12], [-68, -12]], tr);
  E(g, -6, -42, 30, 17, m);
  for (let i = 0; i < 5; i++) P(g, [[-26 + i * 9, -56], [-22 + i * 9, -66], [-18 + i * 9, -56]], tr);
  P(g, [[-14, -32], [-8, -32], [-12, -4], [-20, -4]], dk); P(g, [[10, -32], [18, -32], [20, -4], [12, -4]], dk);
  L(g, [[18, -50], [30, -72], [42, -80]], m, 10);
  P(g, [[36, -88], [62, -84], [66, -76], [40, -70]], lt);
  P(g, [[40, -88], [34, -102], [46, -90]], '#d8c8a8');
  E(g, 52, -82, 2.4, 2.4, '#ffd040', false);
  glow(g, 70, -78, 12, tr, 0.5 + 0.3 * Math.sin(time * 0.01));
  P(g, [[10, -60], [40, -118 + flap], [56, -86 + flap * 0.6], [64, -92], [48, -62], [26, -50]], shade(m, -0.1));
}

const KINDS = { servitor, brute, wraith, drake, trooper, heavy, walker, angel, cultist, fiend, engine, prince, bug, stalker, hulk, lordH };

export const HERO_LOOK = {
  concord: { kind: 'heavy', main: '#2f4f78', trim: '#e2c06a', opt: { sword: true, cape: '#7a1e1e', laurel: true, eye: '#ffe08a' } },
  hollow: { kind: 'lordH', main: '#4a1a24', trim: '#e05040', opt: {} },
  rustbound: { kind: 'heavy', main: '#6a5238', trim: '#b0b0a0', opt: { eye: '#9ad0ff' } },
  scrapjaw: { kind: 'heavy', main: '#7a4a2a', trim: '#d8a830', opt: { eye: '#ff5a3a' } },
  deathless: { kind: 'heavy', main: '#3a4440', trim: '#c9a24a', opt: { eye: '#5aff9a' } },
  palefang: { kind: 'heavy', main: '#3a3e44', trim: '#d8d8d0', opt: { eye: '#8ad0ff' } },
};

// Frame-animated looks (look.anim: { walk, shoot, face }): returns the frame layout for a pose, or null.
export const ANIM_FPS = { walk: 28, move: 22, shoot: 30, fly: 24, attack: 28 };
// playback rate for one look's pose (look.anim.fps overrides the defaults per unit)
export const animFps = (look, pose) => (look.anim && look.anim.fps && look.anim.fps[pose]) || ANIM_FPS[pose] || 24;
function animLayout(look, s, poseName) {
  const name = look.anim && look.anim[poseName], im = name && sprite(name), m = name && AS && AS.manifest && AS.manifest[name];
  if (!im || !m) return null;
  const k = s * (look.anim.scale || look.scale || 1.12) * 0.9 / (m.body * m.fh);
  return { im, m, k, w: m.fw * k, h: m.fh * k };
}
export const animDuration = (look, poseName) => { const m = look.anim && AS && AS.manifest && AS.manifest[look.anim[poseName]]; return m ? m.n / animFps(look, poseName) * 1000 : 0; };
export const animFireTime = look => { const m = look.anim && AS && AS.manifest && AS.manifest[look.anim.shoot]; return m && m.fire != null ? m.fire / animFps(look, 'shoot') * 1000 : 0; };
export const animHitTime = look => { const m = look.anim && AS && AS.manifest && AS.manifest[look.anim.attack]; return m && m.hit != null ? m.hit / animFps(look, 'attack') * 1000 : 0; };
// Muzzle point of the shoot animation in pixels relative to the feet, or null when the look has none.
export function animMuzzle(type, s, facing = 1) {
  const u = UNITS[type], L = animLayout(u.look, s * (u.tier >= 4 ? 1.08 : 1), 'shoot');
  if (!L || L.m.mx == null) return null;
  return { dx: facing * (u.look.anim.face || 1) * (L.m.mx - L.m.ax) * L.w, dy: -((L.m.ay ?? 1) - L.m.my) * L.h };
}

export function drawLook(g, look, x, y, s, facing = 1, time = 0, pose = null) {
  const L = pose && animLayout(look, s, pose.name);
  if (L) {
    const n = L.m.n, f = Math.max(0, Math.floor(pose.t / 1000 * animFps(look, pose.name)));
    // pose.seq plays an explicit frame order (looping when pose.loop); otherwise walk loops and the rest play once
    const fi = pose.seq ? (pose.loop ? pose.seq[f % pose.seq.length] : pose.seq[Math.min(f, pose.seq.length - 1)])
      : pose.name === 'walk' || pose.name === 'move' ? f % n : Math.min(n - 1, f);
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, L.m.body * L.h * 0.3, L.m.body * L.h * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.scale(facing * ((look.anim.faces && look.anim.faces[pose.name]) || look.anim.face || 1), 1);   // per-pose override for sheets drawn the other way
    g.drawImage(L.im, fi * L.m.fw, 0, L.m.fw, L.m.fh, -L.m.ax * L.w, -(L.m.ay ?? 1) * L.h, L.w, L.h);
    g.restore();
    return;
  }
  if (look.sprite) {
    const im = sprite(look.sprite);
    if (im) {
      const h = s * (look.scale || 1.12), w = im.width * h / im.height;
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, w * 0.36, h * 0.07, 0, 0, Math.PI * 2); g.fill();
      g.scale(facing * (look.face || 1), 1);
      g.drawImage(im, -w / 2, -h * 1.02, w, h);
      g.restore();
      return;
    }
  }
  g.save();
  g.translate(x, y); g.scale(facing * s / 100, s / 100);
  g.lineJoin = 'round'; g.lineWidth = 2.5; g.strokeStyle = 'rgba(12,9,7,0.92)';
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, 30, 7, 0, 0, Math.PI * 2); g.fill();
  KINDS[look.kind](g, look.main, look.trim, time, look.opt || {});
  if (look.opt && look.opt.vet) {
    P(g, [[-9, -124], [0, -132], [9, -124], [9, -119], [0, -127], [-9, -119]], look.trim);
  }
  g.restore();
}
export function drawUnit(g, type, x, y, s, facing = 1, time = 0, pose = null) {
  const u = UNITS[type];
  drawLook(g, u.look, x, y, s * (u.tier >= 4 ? 1.08 : 1), facing, time, pose);
}

// ---------------- map objects ----------------
// Wandering creatures on the adventure map: the same figure as on the battlefield (its idle pose),
// standing on the tile, with a soft ring under its feet coloured by threat when that option is on.
export function drawMapCreature(g, type, x, y, s, facing, time, ringColor = null, hover = false) {
  const u = UNITS[type]; if (!u) return;
  if (ringColor) {
    g.save(); g.globalAlpha = 0.55 + 0.15 * Math.sin(time * 0.004 + x);
    g.strokeStyle = ringColor; g.lineWidth = Math.max(1.5, s * 0.05);
    g.beginPath(); g.ellipse(x, y, s * 0.42, s * 0.13, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  const an = u.look.anim, poseName = an && (an.idle && an[an.idle] ? an.idle : ['move', 'walk', 'fly', 'run', 'attack', 'shoot'].find(k => an[k]));
  const pose = poseName ? { name: poseName, t: 0, seq: [0] } : null;
  g.save();
  if (hover) g.filter = 'brightness(1.25)';
  drawUnit(g, type, x, y, s * (u.big ? 1.15 : 1), facing, time, pose);
  g.restore();
}
// Cloth banner on a pole: the free edge ripples in the wind (drawn as vertical strips along a travelling wave).
function flag(g, x, top, color, time) {
  L(g, [[x, top + 34], [x, top - 2]], '#2a2420', 2.5);
  E(g, x, top - 3, 2, 2, '#c9a24a', false);
  const W = 22, H = 14, N = 11, ph = time * 0.006 + x * 0.3;
  const wave = i => Math.sin(ph - i * 0.55) * (i / N) * 3.2;
  const shd = shade(color, -0.35), lt = shade(color, 0.18);
  for (let i = 0; i < N; i++) {
    const x0 = x + i * W / N, x1 = x + (i + 1) * W / N, y0 = wave(i), y1 = wave(i + 1);
    const slope = y1 - y0;
    g.fillStyle = slope > 0.25 ? shd : slope < -0.25 ? lt : color;
    g.beginPath(); g.moveTo(x0, top + y0); g.lineTo(x1 + 0.4, top + y1); g.lineTo(x1 + 0.4, top + H - (i + 1) * 0.25 + y1); g.lineTo(x0, top + H - i * 0.25 + y0); g.fill();
  }
  // trim along the bottom and a dark outline
  g.strokeStyle = 'rgba(12,9,7,.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, top);
  for (let i = 1; i <= N; i++) g.lineTo(x + i * W / N, top + wave(i));
  for (let i = N; i >= 0; i--) g.lineTo(x + i * W / N, top + H - i * 0.25 + wave(i));
  g.stroke();
  g.strokeStyle = '#c9a24a'; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i <= N; i++) { const yy = top + H - 2.2 - i * 0.25 + wave(i); i ? g.lineTo(x + i * W / N, yy) : g.moveTo(x, yy); }
  g.stroke();
}

// Town gate on the entrance tile: stone gatehouse with an open arch, braziers and the owner's banners.
function drawTownGate(g, cx, cy, ts, color, time) {
  const k = ts / 48;
  g.save(); g.translate(cx, cy + ts * 0.5); g.scale(k, k);
  g.lineJoin = 'round'; g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,8,6,.95)';
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(0, 0, 25, 6, 0, 0, Math.PI * 2); g.fill();
  // towers
  for (const sx of [-1, 1]) {
    const x0 = sx * 15;
    P(g, [[x0 - 7, 0], [x0 - 7, -34], [x0 + 7, -34], [x0 + 7, 0]], sx < 0 ? '#6a625c' : '#565049');
    P(g, [[x0 - 9, -34], [x0 - 9, -40], [x0 - 5, -40], [x0 - 5, -37], [x0 - 2, -37], [x0 - 2, -40], [x0 + 2, -40], [x0 + 2, -37], [x0 + 5, -37], [x0 + 5, -40], [x0 + 9, -40], [x0 + 9, -34]], '#7a726a');
    // banner
    const wv = Math.sin(time * 0.004 + sx) * 1.5;
    P(g, [[x0 - 4, -31], [x0 + 4, -31], [x0 + 4 + wv * 0.3, -16], [x0 + wv * 0.3, -19], [x0 - 4 + wv * 0.3, -16]], color);
    // brazier glow
    glow(g, x0, -44, 7, '#ffb050', 0.55 + 0.25 * Math.sin(time * 0.012 + sx * 2));
    g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x0, -43, 1.6, 0, Math.PI * 2); g.fill();
  }
  // arch wall and open gateway
  P(g, [[-8, 0], [-8, -26], [8, -26], [8, 0]], '#615a53');
  g.fillStyle = '#16100c'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-6, -14); g.arc(0, -14, 6, Math.PI, 0); g.lineTo(6, 0); g.closePath(); g.fill(); g.stroke();
  glow(g, 0, -6, 8, '#ff9a40', 0.35);
  // raised portcullis teeth
  g.strokeStyle = '#3a3430'; g.lineWidth = 1;
  for (let i = -4; i <= 4; i += 2) { g.beginPath(); g.moveTo(i, -19); g.lineTo(i, -16); g.stroke(); }
  g.restore();
}

export function drawTown(g, cx, cy, ts, faction, color, time) {
  const im = sprite('town_' + faction);
  if (im) {
    const k = ts * 3.7 / im.width, w = im.width * k, h = im.height * k, bottom = cy + ts * 0.62;
    const mk = sprite('town_' + faction + '_mask'), gl = sprite('town_' + faction + '_glow');
    g.drawImage(mk && color ? tintedTown(faction, im, mk, PAINT[color] || color) : im, cx - w / 2, bottom - h, w, h);
    if (gl) {   // fires and green lights breathe
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.32 + 0.14 * Math.sin(time * 0.0021 + cx * 0.01);
      g.drawImage(gl, cx - w / 2, bottom - h, w, h); g.restore();
    }
    if (faction === 'concord') drawTownGate(g, cx, cy, ts, color, time);   // Hollow and Rustbound fortresses have their own gates
    if (mk && color) return;   // its own painted banners carry the owner's colour
    g.save(); g.translate(cx - w * 0.04, bottom - h * 0.94); g.scale(ts / 48, ts / 48);
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,8,6,.9)';
    flag(g, 0, -26, color, time);
    g.restore();
    return;
  }
  g.save(); g.translate(cx, cy + ts * 0.42); const k = ts / 48; g.scale(k, k);
  g.lineWidth = 2; g.strokeStyle = 'rgba(10,8,6,.9)'; g.lineJoin = 'round';
  E(g, 0, 0, 64, 12, 'rgba(0,0,0,0.4)', false);
  let top;
  if (faction === 'concord') {
    const st = '#8e8a84', sd = '#5e5a55', roof = '#c9a24a';
    R(g, -56, -30, 112, 30, 2, sd);
    for (let i = -56; i < 56; i += 10) R(g, i, -36, 6, 7, 0, sd);
    [-50, 50].forEach(x => { R(g, x - 9, -52, 18, 52, 2, st); P(g, [[x - 11, -52], [x + 11, -52], [x, -72]], roof); });
    [-30, 30].forEach(x => { R(g, x - 7, -64, 14, 64, 2, st); P(g, [[x - 9, -64], [x + 9, -64], [x, -88]], roof); });
    R(g, -16, -82, 32, 82, 2, st); P(g, [[-19, -82], [19, -82], [0, -116]], roof);
    glow(g, 0, -66, 16, '#ffd877', 0.5); R(g, -5, -72, 10, 14, 4, '#ffd877', false);
    g.beginPath(); g.arc(0, 0, 11, Math.PI, 0); g.fillStyle = '#1a1512'; g.fill();
    top = -150;
  } else {
    const st = '#4a302c', sd = '#2e1f1d';
    R(g, -56, -28, 112, 28, 2, sd);
    for (let i = -56; i < 56; i += 12) P(g, [[i, -28], [i + 6, -42], [i + 12, -28]], sd);
    [[-46, -62], [46, -62], [-28, -84], [28, -84]].forEach(([x, h]) => P(g, [[x - 10, 0], [x + 10, 0], [x + 3, h], [x, h - 14], [x - 3, h]], st));
    P(g, [[-16, 0], [16, 0], [8, -100], [0, -128], [-8, -100]], st);
    glow(g, 0, -70, 30, '#ff4a2a', 0.45 * (0.8 + 0.2 * Math.sin(time * 0.004)));
    R(g, -4, -78, 8, 14, 3, '#ff7a3a', false);
    P(g, [[-12, 0], [0, -20], [12, 0]], '#120a08');
    top = -162;
  }
  flag(g, 0, top, color, time);
  g.restore();
}

export function drawChest(g, cx, cy, ts) {
  g.save(); g.translate(cx, cy + ts * 0.25); g.scale(ts / 48, ts / 48);
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,8,6,.9)';
  E(g, 0, 0, 16, 4, 'rgba(0,0,0,0.35)', false);
  R(g, -13, -16, 26, 16, 2, '#5c4a32'); R(g, -13, -16, 26, 5, 1, '#6e5a3c');
  R(g, -3, -14, 6, 12, 1, '#c9a24a'); R(g, -13, -9, 26, 2, 0, '#c9a24a', false);
  g.restore();
}

export function drawRelic(g, cx, cy, ts, time, color = '#ffe28a') {
  g.save(); g.translate(cx, cy + ts * 0.3); g.scale(ts / 48, ts / 48);
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,8,6,.9)';
  R(g, -9, -10, 18, 10, 1, '#6a645c'); R(g, -12, -2, 24, 4, 1, '#55504a');
  const b = Math.sin(time * 0.004) * 2;
  glow(g, 0, -22 + b, 18, color, 0.7);
  P(g, [[0, -32 + b], [6, -22 + b], [0, -12 + b], [-6, -22 + b]], '#ffe9a8');
  g.restore();
}

export function drawTower(g, cx, cy, ts, time, flip = false) {
  if (sprite('site_auspex_array')) { drawStructure(g, 'site_auspex_array', cx, cy, ts, 2.1, flip, time, false, cx + cy); return; }
  g.save(); g.translate(cx, cy + ts * 0.4); g.scale(ts / 48, ts / 48);
  g.lineWidth = 2; g.strokeStyle = 'rgba(10,8,6,.9)';
  E(g, 0, 0, 16, 5, 'rgba(0,0,0,0.35)', false);
  P(g, [[-10, 0], [10, 0], [6, -56], [-6, -56]], '#5a5550');
  R(g, -10, -66, 20, 10, 1, '#6e6862');
  glow(g, 0, -61, 14, '#ffe08a', 0.45 + 0.2 * Math.sin(time * 0.005));
  R(g, -3, -64, 6, 6, 1, '#ffe08a', false);
  g.restore();
}

// Battle ground: the painted texture of the terrain where the fight happens (rock tiles fall back to scrub).
export function fillGround(g, w, h, scale = 1, terrain = null) {
  if (!AS) return false;
  const texName = terrain != null && AS.tex ? TERRAIN_TEX[terrain === 4 ? 0 : terrain] : null;
  const src = (texName && AS.tex[texName]) || AS.ground; if (!src) return false;
  if (src !== AS.ground) scale *= 0.55 * (TEX_SCALE[texName] || 1);
  const pat = g.createPattern(src, 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(scale));
  g.fillStyle = pat; g.fillRect(0, 0, w, h);
  return true;
}

// ---------------- battle backdrops: a painted horizon strip per terrain, like a stage backcloth ----------------
const BACKDROPS = {
  0: { sky: ['#1a0f14', '#5a1e14', '#c2501e', '#f0a050'], hills: ['#2a1c18', '#1c1310'], kind: 'hive' },    // scrubland: burning hive city
  1: { sky: ['#20141a', '#6a3020', '#d07a3a', '#f2c27a'], hills: ['#4a3426', '#2e2018'], kind: 'mesa' },    // broken ground: canyon mesas, volcano
  2: { sky: ['#101612', '#2a3a1c', '#6a7a2a', '#b8c060'], hills: ['#26201a', '#18140f'], kind: 'refinery' }, // toxic marsh: refinery stacks in green haze
  3: { sky: ['#0c0a18', '#2a1a3a', '#6a3a6a', '#c07a8a'], hills: ['#1e1a2a', '#120f1c'], kind: 'bones' },    // bone fields: titan ribs and a ruined cathedral
};
// Painted horizons (assets/ui/horizon): one per homeland for open battles, one per faction for sieges. The picture's
// horizon (HORIZON_AT of its height) is laid on the battlefield's top edge and it is scaled to the full width,
// so only the skyline and a little sky show; until it has loaded the painted-by-code backdrop below stands in.
const HORIZON_AT = 0.65, horizonCache = {};
const TERRAIN_BIOME = { 0: 'snow', 1: 'scrap', 2: 'shale', 3: 'glass', 4: 'rust', 5: 'shale', 6: 'ash', 7: 'rust' };
export function horizonName(terrain, siegeFaction) { return siegeFaction ? 'siege_' + siegeFaction : (TERRAIN_BIOME[terrain] || 'rust'); }
export function loadHorizon(name) {
  if (!horizonCache[name]) horizonCache[name] = new Promise(res => { const im = new Image(); im.onload = () => { horizonCache[name].img = im; res(im); }; im.onerror = () => res(null); im.src = `assets/ui/horizon/${name}.webp`; });
  return horizonCache[name];
}
// The whole landscape fills the battle screen: its horizon on the battlefield's top edge, its own painted ground running
// down under the hexes (cover-scaled, so it always reaches the bottom), so ground and skyline meet without a seam.
export function drawHorizonFull(g, w, h, band, name) {
  const im = horizonCache[name] && horizonCache[name].img; if (!im) return false;
  // sky and skyline at the width's scale, horizon on the battlefield's top edge; the picture's own ground (below its
  // horizon) stretched down to the bottom of the screen: one continuous picture, so no seam where the field begins
  const k = w / im.width, hy = HORIZON_AT * im.height, skyH = hy * k;
  g.drawImage(im, 0, 0, im.width, hy, 0, band - skyH, w, skyH);
  g.drawImage(im, 0, hy, im.width, im.height - hy, 0, band, w, h - band);
  if (band - skyH > 0) { g.fillStyle = 'rgb(14,12,12)'; g.fillRect(0, 0, w, band - skyH + 1); }
  return true;
}
function drawHorizon(g, w, band, name) {
  const im = horizonCache[name] && horizonCache[name].img; if (!im) return false;
  const k = w / im.width, h = im.height * k, y = band - HORIZON_AT * h;
  g.drawImage(im, 0, y, w, h);
  return true;
}
export function drawBattleBackdrop(g, w, band, terrain, seed = 1, siege = false) {
  if (drawHorizon(g, w, band, horizonName(terrain, typeof siege === 'string' ? siege : null))) return;
  const B = BACKDROPS[{ 4: 0, 6: 1, 7: 0, 5: 2 }[terrain] ?? (terrain == null ? 0 : terrain)] || BACKDROPS[0];
  const rnd = mulberry32(seed * 31 + 7);
  const H = band;
  // sky
  const sk = g.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, B.sky[0]); sk.addColorStop(0.45, B.sky[1]); sk.addColorStop(0.8, B.sky[2]); sk.addColorStop(1, B.sky[3]);
  g.fillStyle = sk; g.fillRect(0, 0, w, H);
  // glowing sun or fire behind the skyline
  const sx = w * (0.2 + rnd() * 0.6), sy = H * 0.78;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, H * 1.3);
  sg.addColorStop(0, B.sky[3] + 'cc'); sg.addColorStop(0.25, B.sky[2] + '66'); sg.addColorStop(1, B.sky[2] + '00');
  g.fillStyle = sg; g.fillRect(0, 0, w, H);
  // streaked clouds
  g.save(); g.globalAlpha = 0.22;
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? B.sky[0] : B.sky[1]; const y = H * (0.1 + rnd() * 0.55), x = rnd() * w, l = w * (0.15 + rnd() * 0.3);
    g.beginPath(); g.ellipse(x, y, l / 2, H * (0.025 + rnd() * 0.03), 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // ridge helper: a jagged silhouette across the strip
  const ridge = (base, amp, color, step, jag) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, H + 2);
    let y = base;
    for (let x = 0; x <= w + step; x += step) { y += (rnd() - 0.5) * amp * jag; y = Math.max(base - amp, Math.min(base + amp * 0.4, y)); g.lineTo(x, H * y); }
    g.lineTo(w, H + 2); g.closePath(); g.fill();
  };
  ridge(0.62, 0.12, B.hills[0] + 'aa', w / 40, 0.9);
  const lit = (x, y, ww, hh, n) => { for (let i = 0; i < n; i++) if (rnd() < 0.5) { g.fillStyle = rnd() < 0.7 ? 'rgba(255,190,90,0.85)' : 'rgba(255,120,40,0.8)'; g.fillRect(x + rnd() * (ww - 2), y + rnd() * (hh - 2), Math.max(1, ww * 0.08), Math.max(1, H * 0.012)); } };
  const smoke = (x, y, r) => { for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(30,24,22,${0.35 - k * 0.045})`; g.beginPath(); g.ellipse(x + k * r * 0.5, y - k * r * 0.9, r * (1 + k * 0.35), r * (0.7 + k * 0.25), 0, 0, Math.PI * 2); g.fill(); } };
  const dark = B.hills[1];
  if (B.kind === 'hive') {
    // gothic hive towers, some broken, with lit windows and fires
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, tw = w * (0.012 + rnd() * 0.03), th = H * (0.25 + rnd() * 0.55), top = H - th;
      g.fillStyle = i < 10 ? B.hills[0] : dark; g.fillRect(x, top, tw, th);
      if (rnd() < 0.6) { g.beginPath(); g.moveTo(x - tw * 0.1, top); g.lineTo(x + tw / 2, top - H * (0.08 + rnd() * 0.12)); g.lineTo(x + tw * 1.1, top); g.fill(); }
      else { g.beginPath(); g.moveTo(x, top); g.lineTo(x + tw * 0.3, top - H * 0.05); g.lineTo(x + tw * 0.6, top + H * 0.03); g.lineTo(x + tw, top - H * 0.02); g.lineTo(x + tw, top + 4); g.fill(); }
      lit(x, top + H * 0.05, tw, th * 0.7, 6);
      if (rnd() < 0.25) smoke(x + tw / 2, top - H * 0.05, H * 0.035);
    }
  } else if (B.kind === 'mesa') {
    // flat-topped mesas and a distant smouldering volcano
    const vx = w * (0.55 + rnd() * 0.3);
    g.fillStyle = B.hills[0]; g.beginPath(); g.moveTo(vx - w * 0.16, H); g.lineTo(vx - w * 0.025, H * 0.3); g.lineTo(vx + w * 0.025, H * 0.3); g.lineTo(vx + w * 0.17, H); g.fill();
    const vg = g.createRadialGradient(vx, H * 0.3, 0, vx, H * 0.3, H * 0.25); vg.addColorStop(0, 'rgba(255,140,40,0.9)'); vg.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = vg; g.fillRect(vx - H * 0.3, 0, H * 0.6, H * 0.6);
    smoke(vx, H * 0.22, H * 0.07);
    for (let i = 0; i < 7; i++) {
      const x = rnd() * w, mw = w * (0.06 + rnd() * 0.1), mh = H * (0.2 + rnd() * 0.3);
      g.fillStyle = i % 2 ? dark : B.hills[0];
      g.beginPath(); g.moveTo(x - mw * 0.2, H); g.lineTo(x, H - mh); g.lineTo(x + mw, H - mh * (0.95 + rnd() * 0.1)); g.lineTo(x + mw * 1.25, H); g.fill();
      g.fillStyle = 'rgba(255,200,140,0.12)'; g.fillRect(x, H - mh, mw, 2);
    }
  } else if (B.kind === 'refinery') {
    // refinery stacks, pipes and gas flares in a sick green haze; dead trees in front
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w, tw = w * (0.008 + rnd() * 0.012), th = H * (0.3 + rnd() * 0.5);
      g.fillStyle = dark; g.fillRect(x, H - th, tw, th);
      g.fillRect(x - tw * 0.4, H - th, tw * 1.8, H * 0.02);
      if (rnd() < 0.5) { const fg = g.createRadialGradient(x + tw / 2, H - th - 4, 0, x + tw / 2, H - th - 4, H * 0.08); fg.addColorStop(0, 'rgba(220,255,120,0.9)'); fg.addColorStop(1, 'rgba(120,200,40,0)'); g.fillStyle = fg; g.fillRect(x - H * 0.1, H - th - H * 0.12, H * 0.2, H * 0.2); }
      else smoke(x + tw / 2, H - th - 2, H * 0.03);
    }
    for (let i = 0; i < 4; i++) { const x = rnd() * w, y = H * (0.6 + rnd() * 0.2); g.fillStyle = dark; g.fillRect(x, y, w * (0.1 + rnd() * 0.15), H * 0.025); }
    g.strokeStyle = B.hills[1]; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const x = rnd() * w, th = H * (0.2 + rnd() * 0.25); g.lineWidth = Math.max(2, w * 0.004);
      g.beginPath(); g.moveTo(x, H); g.lineTo(x + (rnd() - 0.5) * 8, H - th); g.stroke();
      for (let k = 0; k < 3; k++) { const by = H - th * (0.5 + k * 0.18), d = (rnd() < 0.5 ? -1 : 1); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, by); g.lineTo(x + d * th * 0.25, by - th * 0.15); g.stroke(); } }
    const hz = g.createLinearGradient(0, H * 0.5, 0, H); hz.addColorStop(0, 'rgba(150,190,60,0)'); hz.addColorStop(1, 'rgba(150,190,60,0.22)'); g.fillStyle = hz; g.fillRect(0, 0, w, H);
  } else {
    // titan ribcage arching out of the ground, bone spires and a ruined cathedral
    const cx = w * (0.25 + rnd() * 0.5);
    g.fillStyle = B.hills[0]; g.beginPath(); g.moveTo(cx - w * 0.06, H); g.lineTo(cx - w * 0.06, H * 0.45); g.lineTo(cx, H * 0.18); g.lineTo(cx + w * 0.06, H * 0.45); g.lineTo(cx + w * 0.06, H); g.fill();
    for (const o of [-0.09, 0.09]) { g.beginPath(); g.moveTo(cx + w * o - w * 0.012, H); g.lineTo(cx + w * o, H * 0.4); g.lineTo(cx + w * o + w * 0.012, H); g.fill(); }
    g.fillStyle = 'rgba(255,170,200,0.55)'; g.beginPath(); g.arc(cx, H * 0.55, w * 0.018, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#cfc3b0'; g.globalAlpha = 0.55;
    for (let side of [-1, 1]) for (let k = 0; k < 6; k++) {
      const bx = (side < 0 ? w * 0.08 : w * 0.72) + k * w * 0.032; g.lineWidth = Math.max(2, w * 0.005);
      g.beginPath(); g.moveTo(bx, H); g.quadraticCurveTo(bx + side * w * 0.05, H * (0.15 + k * 0.03), bx + side * w * 0.09, H * (0.35 + k * 0.04)); g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 14; i++) { const x = rnd() * w, th = H * (0.15 + rnd() * 0.3); g.fillStyle = i % 3 ? dark : '#3a3044'; g.beginPath(); g.moveTo(x - w * 0.008, H); g.lineTo(x, H - th); g.lineTo(x + w * 0.008, H); g.fill(); }
  }
  // near ridge and the haze where the backcloth meets the battlefield
  ridge(0.9, 0.06, dark, w / 70, 1.2);
  if (siege) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, w, H); }
}

const BATTLE_OBST = ['ov_0', 'ov_1', 'ov_2', 'ov_4', 'ov_10', 'ow_3', 'ow_4', 'ow_10', 'mw_12', 'mv_13'];
export function drawObstacle(g, x, y, r, seed) {
  const rnd = mulberry32(seed);
  if (AS) {
    const name = BATTLE_OBST[Math.floor(rnd() * BATTLE_OBST.length)];
    const im = sprite(name);
    if (im) { const k = (r * 2.1) / Math.max(im.width, im.height * 0.9); blit(g, name, x, y + r * 0.7, k); return; }
  }
  g.save(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,8,6,.9)';
  E(g, x, y + r * 0.35, r * 0.85, r * 0.3, 'rgba(0,0,0,0.35)', false);
  if (rnd() < 0.5) {
    for (let i = 0; i < 4; i++) {
      const ox = (rnd() - 0.5) * r * 0.9, oy = (rnd() - 0.5) * r * 0.4, s = r * (0.3 + rnd() * 0.3);
      P(g, [[x + ox - s, y + oy + s * 0.5], [x + ox - s * 0.4, y + oy - s], [x + ox + s * 0.6, y + oy - s * 0.6], [x + ox + s, y + oy + s * 0.5]], i % 2 ? '#5a5048' : '#6e6258');
    }
  } else {
    P(g, [[x - r * 0.7, y + r * 0.3], [x - r * 0.5, y - r * 0.6], [x + r * 0.1, y - r * 0.9], [x + r * 0.2, y - r * 0.2], [x + r * 0.7, y + r * 0.3]], '#3e3a38');
    L(g, [[x - r * 0.4, y - r * 0.3], [x + r * 0.5, y - r * 0.5]], '#7a6a5a', 2);
    glow(g, x + r * 0.2, y - r * 0.1, r * 0.4, '#ff7a30', 0.3);
  }
  g.restore();
}

// Procedural artifact icon: a glyph per slot type on a rarity-coloured medallion.
export function drawArtifactIcon(g, id, x, y, s, rarityColor, slot) {
  // painted icon when there is one: a soft glow in the rarity colour behind it
  const pic = sprite('art_' + id);
  if (pic) {
    g.save();
    const gr = g.createRadialGradient(x, y, s * 0.05, x, y, s * 0.55);
    gr.addColorStop(0, hexA(rarityColor, 0.45)); gr.addColorStop(1, hexA(rarityColor, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.55, 0, Math.PI * 2); g.fill();
    g.drawImage(pic, x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1);
    g.restore();
    return;
  }
  g.save(); g.translate(x, y); g.scale(s / 64, s / 64);
  g.lineJoin = 'round'; g.lineWidth = 2.2; g.strokeStyle = 'rgba(12,9,7,.95)';
  const gr = g.createRadialGradient(0, -4, 4, 0, 0, 32);
  gr.addColorStop(0, hexA(rarityColor, 0.55)); gr.addColorStop(1, hexA(rarityColor, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 32, 0, Math.PI * 2); g.fill();
  const steel = '#c8ccd0', gold = '#e2b84e', dark = '#3a3632', leather = '#7a5232', h = (id.length * 37) % 360;
  const gem = `hsl(${h},70%,55%)`;
  switch (slot) {
    case 'weapon':
      if (/maul/.test(id)) { R(g, -4, -10, 8, 34, 2, leather); R(g, -16, -24, 32, 16, 3, steel); E(g, 0, -16, 4, 4, gem); }
      else { P(g, [[-3, 18], [3, 18], [4, -22], [0, -30], [-4, -22]], steel); R(g, -12, 14, 24, 5, 2, gold); R(g, -2.5, 19, 5, 9, 1, leather); if (/chain/.test(id)) for (let i = -18; i < 14; i += 5) R(g, 3, i, 3, 3, 0, dark, false); }
      break;
    case 'shield': P(g, [[-18, -22], [18, -22], [16, 6], [0, 24], [-16, 6]], /bastion/.test(id) ? '#4a6a8c' : steel); P(g, [[-3, -16], [3, -16], [3, 14], [-3, 14]], gold, false); P(g, [[-12, -4], [12, -4], [12, 2], [-12, 2]], gold, false); break;
    case 'head':
      if (/crown|diadem/.test(id)) { P(g, [[-18, 10], [18, 10], [20, -14], [10, -4], [0, -20], [-10, -4], [-20, -14]], gold); E(g, 0, 2, 4, 4, gem); }
      else { g.beginPath(); g.arc(0, 2, 18, Math.PI, 0); g.lineTo(18, 14); g.lineTo(-18, 14); g.closePath(); g.fillStyle = steel; g.fill(); g.stroke(); R(g, -12, 0, 24, 4, 1, '#14110f', false); P(g, [[-3, -16], [3, -16], [2, -26], [-2, -26]], '#b02a1e'); }
      break;
    case 'neck': g.save(); g.strokeStyle = gold; g.lineWidth = 3; g.beginPath(); g.arc(0, -12, 16, 0.2, Math.PI - 0.2); g.stroke(); g.restore(); P(g, [[0, 2], [10, 12], [0, 24], [-10, 12]], gem); break;
    case 'armor': P(g, [[-20, -16], [-8, -22], [8, -22], [20, -16], [16, 22], [-16, 22]], /carapace/.test(id) ? '#5a2622' : steel); P(g, [[-8, -12], [0, -4], [8, -12], [8, -6], [0, 4], [-8, -6]], gold, false); break;
    case 'cloak': P(g, [[-10, -22], [10, -22], [22, 24], [8, 18], [0, 26], [-8, 18], [-22, 24]], /star/.test(id) ? '#2a2a5a' : /shroud/.test(id) ? '#2a2622' : '#8a2a22'); E(g, 0, -20, 5, 4, gold); break;
    case 'boots': P(g, [[-14, -20], [-2, -20], [-2, 12], [14, 12], [16, 22], [-14, 22]], /jet/.test(id) ? steel : leather); if (/jet|treads/.test(id)) glow(g, -8, 24, 10, '#7fe0ff', 0.7); break;
    case 'ring': g.save(); g.strokeStyle = gold; g.lineWidth = 6; g.beginPath(); g.arc(0, 6, 14, 0, Math.PI * 2); g.stroke(); g.restore(); E(g, 0, -10, 7, 7, gem); break;
    default:
      if (/codex/.test(id)) { R(g, -16, -20, 32, 40, 3, '#5a2a22'); R(g, -12, -16, 24, 32, 2, '#d8c8a0', false); E(g, 0, 0, 5, 5, gold); }
      else if (/die/.test(id)) { R(g, -14, -14, 28, 28, 5, '#e8dcc0'); for (const [a, b] of [[-6, -6], [6, 6], [0, 0], [6, -6], [-6, 6]]) E(g, a, b, 2.5, 2.5, '#1a1612', false); }
      else if (/medal/.test(id)) { P(g, [[-8, -24], [8, -24], [4, -6], [-4, -6]], '#2a4a8a'); E(g, 0, 6, 13, 13, gold); }
      else if (/reliquary/.test(id)) { R(g, -16, -8, 32, 26, 3, gold); P(g, [[-16, -8], [0, -22], [16, -8]], gold); E(g, 0, 4, 5, 5, gem); }
      else if (/scope/.test(id)) { E(g, 0, 0, 16, 14, '#d8c8a8'); E(g, -6, -2, 4, 4, '#1a1612', false); R(g, 4, -6, 16, 10, 2, steel); glow(g, 20, -1, 8, '#ff4a3a', 0.8); }
      else { E(g, 0, 0, 16, 16, gem); glow(g, 0, 0, 20, '#ffffff', 0.35); E(g, -5, -5, 4, 4, 'rgba(255,255,255,0.7)', false); }
  }
  g.restore();
}

export function drawResIcon(g, res, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s / 20, s / 20); g.lineWidth = 1.2; g.strokeStyle = 'rgba(10,8,6,.9)';
  if (res === 'credits') { E(g, 0, 0, 8, 8, '#e2b84e'); E(g, 0, 0, 5, 5, '#c9993a', false); }
  else if (res === 'alloy') { P(g, [[-8, 4], [-4, -4], [8, -4], [4, 4]], '#aab6c0'); }
  else if (res === 'fuel') { P(g, [[0, -9], [6, 2], [0, 8], [-6, 2]], '#e2772f'); }
  else { P(g, [[0, -9], [6, 0], [0, 9], [-6, 0]], '#a97dff'); }
  g.restore();
}

// ---------------- sprite-based map art ----------------
const sprite = name => AS && AS.spr[name];
export const spriteImage = name => sprite(name);
export const spriteMeta = name => AS && AS.manifest && AS.manifest[name];
function blit(g, name, cx, bottom, scale) {
  const im = sprite(name); if (!im) return null;
  const w = im.width * scale, h = im.height * scale;
  g.drawImage(im, cx - w / 2, bottom - h, w, h);
  return { w, h };
}

// Obstacle sets per homeland biome, chosen from the zone's ground (tile.g): frozen wastes, scrap wastes,
// shale coast, black glass desert, ash plains, rust flats. Each biome has one mountain (plus composed
// ridges mtn1-4), trees, rocks, a log and a lake; per tile.b: 0 ranges, 1 scattered obstacles, 2 pools,
// 3 crags and rubble, 4 forest.
const BIOME = { 0: 'snow', 1: 'scrap', 2: 'shale', 3: 'glass', 5: 'shale', 6: 'ash', 7: 'rust' };
export const biomeOf = T => BIOME[T.g] || BIOME[T.t] || 'rust';
const biomeSets = {};
function OBSTfor(b) {
  if (biomeSets[b]) return biomeSets[b];
  const z = p => `tz_${b}_${p}`;
  return (biomeSets[b] = [
    [z('mountain'), z('mtn1'), z('mtn2'), z('mtn3'), z('mtn4'), z('mtn1'), z('mtn2'), z('mountain')],
    [z('rocks'), z('log'), z('tree'), z('trees'), z('rocks'), z('mtn4')],
    [z('lake')],
    [z('rocks'), z('log'), z('mtn3'), z('mtn4'), z('rocks')],
    [z('tree'), z('trees'), z('tree')],
  ]);
}
const FLAT = /_lake$/;
const HOT = new Set([1, 6]);
const isHot = T => HOT.has(T.g);
// ground under mountain ranges and woods, per biome (light on snow, dark elsewhere)
const BED = { snow: '70,80,92', shale: '18,20,24', glass: '14,16,14', ash: '16,12,10', scrap: '30,18,12', rust: '32,20,14' };
// Thick woods: three trees packed into each forest tile (two behind, shaded, one in front), so a forest
// reads as a solid mass like a mountain range. Beside a road or a pickup only one small tree is drawn.
function drawForestTile(g, T, x, y, TS, list, near) {
  if (!list.length) return;
  const tight = near && (near.l || near.r || near.up1);
  const deep = near && near.woods >= 6;
  const spots = tight ? [[0.5, 1.0, 0.9, false]]
    : deep ? [[0.15, 0.3, 1.05, true], [0.55, 0.22, 1.1, true], [0.9, 0.45, 1.05, true], [0.28, 0.82, 1.2, false], [0.75, 1.02, 1.25, false]]
      : [[0.2, 0.4, 1.05, true], [0.8, 0.48, 1.05, true], [0.35, 0.95, 1.2, false], [0.75, 1.05, 1.1, false]];
  spots.forEach(([fx, fy, size, back], k) => {
    const v = (T.v >> (k * 5)) + k * 7, name = list[v % list.length], im = sprite(name);
    if (!im) return;
    const j = ((v >> 3) % 100) / 100;
    let tiles = size * (0.95 + j * 0.3) * (tight ? 1 : 1.05);
    tiles = Math.min(tiles, (tight ? 1.5 : 2.0) * im.width / im.height);   // tall obelisks and pillars: cap the height
    const sc = tiles * TS / im.width, w = im.width * sc, h = im.height * sc;
    const cx = (x + fx + (j - 0.5) * 0.18) * TS, by = (y + fy + 0.02) * TS;
    const mirror = (v >> 2) & 1;
    g.save();
    if (mirror) { g.translate(cx * 2, 0); g.scale(-1, 1); }
    g.drawImage(back ? shadedPiece(name) : im, cx - w / 2, by - h, w, h);
    g.restore();
  });
}
// back peaks of a range are drawn a shade darker; the darkened copy is made once per piece
const shadeCache = {};
function shadedPiece(name) {
  if (shadeCache[name]) return shadeCache[name];
  const im = sprite(name), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.filter = 'brightness(0.86)'; x.drawImage(im, 0, 0);
  return (shadeCache[name] = c);
}
export function drawObstacleTile(g, T, x, y, TS, time = 0, near = null) {
  if (!AS) return;
  const sets = OBSTfor(biomeOf(T));
  if (T.b === 4) { drawForestTile(g, T, x, y, TS, sets[4].filter(n => sprite(n)), near); return; }
  let list = sets[near && near.crowd ? 3 : T.b || 0].filter(n => sprite(n));
  if (!list.length) return;
  // next to a road or river: pick a low piece (foothills, rubble) instead of a tall peak when the lane
  // runs just above, and keep the piece inside its own tile, nudged away from the lane, when it runs beside
  const laneSide = near && (near.l || near.r || near.up1 || near.up2);
  // inside a range only the wide ridge-shaped pieces are used: tall blocky crags look like towers when stacked
  if (near && near.mass >= 3 && !laneSide) {
    const wide = list.filter(n => { const im = sprite(n); return im.height / im.width <= 0.62 && !FLAT.test(n); });
    if (wide.length >= 4) list = wide;
  }
  if (near && (near.up1 || near.up2)) {
    const low = list.filter(n => { const im = sprite(n); return im.height / im.width < (near.up1 ? 0.62 : 0.85); });
    if (low.length) list = low;
  }
  const name = list[T.v % list.length], im = sprite(name), m = AS.manifest[name] || {};
  const j = ((T.v >> 8) % 100) / 100, j2 = ((T.v >> 15) % 100) / 100;
  // one piece per tile, at its painted size; neighbours overlap into ranges and fields
  let tiles = Math.min(3.0, Math.max(0.9, m.tiles || im.width / 130)) * (0.9 + j2 * 0.2);
  let shift = (j - 0.5) * 0.3;
  const range = near && near.mass >= 3 && !laneSide && !FLAT.test(name);
  // deep inside a range: a bigger main peak, as hand-made maps pack their mountains shoulder to shoulder
  if (range && near.mass >= 6) tiles = Math.max(tiles, 2.3 + j2 * 0.7);
  if (near && laneSide) {
    if (near.l && near.r) { tiles = Math.min(tiles, 1.05); shift = 0; }
    else if (near.l || near.r) { tiles = Math.min(tiles, 1.3); shift = near.l ? 0.14 : -0.14; }
    const maxH = near.up1 ? 1.15 : near.up2 ? 2.05 : Infinity;   // height in tiles above the tile's foot
    tiles = Math.min(tiles, maxH * im.width / im.height);
    tiles = Math.max(tiles, 0.75);
  }
  const sc = tiles * TS / im.width, cx = (x + 0.5 + shift) * TS;
  // mirror pieces beside a lane on their right so the heavier side of the art leans away from it
  const mirror = near && near.r && !near.l ? (T.v & 1) : !laneSide && ((T.v >> 21) & 1);
  if (FLAT.test(name)) {
    const w = im.width * sc, h = im.height * sc, cy = (y + 0.55) * TS;
    g.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    if (name === 'tz_ash_lake') lavaGlow(g, cx, cy, w * 0.4, time, T.v);
    return;
  }
  // stacked peaks behind the main one (different pieces, offset and smaller), so no ground shows through
  if (range) {
    const extra = near.mass >= 8 && near.above ? 2 : 1;
    for (let k = 0; k < extra; k++) {
      const v2 = (T.v >> (5 + k * 7)) + k * 13, bn = list[(v2 + 3) % list.length], bim = sprite(bn), bm = AS.manifest[bn] || {};
      if (!bim) continue;
      const side = ((v2 >> 3) & 1 ? 1 : -1) * (k ? -1 : 1);
      const bt = Math.min(3.0, Math.max(0.9, bm.tiles || bim.width / 130)) * (near.mass >= 6 ? 0.85 : 0.7) * (k ? 0.85 : 1);
      const bx = (x + 0.5 + side * (0.28 + ((v2 >> 6) % 20) / 100)) * TS, by = (y + (k ? 0.75 : 0.5)) * TS;
      const flipB = (v2 >> 4) & 1;
      if (flipB) { g.save(); g.translate(bx * 2, 0); g.scale(-1, 1); }
      const dk = shadedPiece(bn), sc2 = bt * TS / bim.width, w2 = bim.width * sc2, h2 = bim.height * sc2;
      g.drawImage(dk, bx - w2 / 2, by - h2, w2, h2);
      if (flipB) g.restore();
    }
  }
  let r;
  if (mirror) { g.save(); g.translate(cx * 2, 0); g.scale(-1, 1); r = blit(g, name, cx, (y + 1.05) * TS, sc); g.restore(); }
  else r = blit(g, name, cx, (y + 1.05) * TS, sc);
  // ash-plain volcanoes: animated smoke rising from the crater of the main peak
  if (r && /^tz_ash_(mountain|mtn1|mtn4)$/.test(name)) volcanoSmoke(g, cx, (y + 1.05) * TS - r.h * 0.97, TS, time, T.v);
}
// molten surface breathing: additive orange glow with slow drifting hot spots
function lavaGlow(g, cx, cy, r, time, v) {
  const a = 0.18 + 0.12 * Math.sin(time * 0.0021 + (v % 97)) + 0.06 * Math.sin(time * 0.0057 + (v % 13));
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  gr.addColorStop(0, `rgba(255,150,50,${a})`); gr.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
  const hx = cx + Math.sin(time * 0.0011 + v) * r * 0.4, hy = cy + Math.cos(time * 0.0013 + v) * r * 0.25;
  const hg = g.createRadialGradient(hx, hy, 0, hx, hy, r * 0.35); hg.addColorStop(0, `rgba(255,230,120,${a * 1.2})`); hg.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = hg; g.fillRect(hx - r * 0.4, hy - r * 0.4, r * 0.8, r * 0.8);
  g.restore();
}
// rising, spreading ash column with a glow at the crater
function volcanoSmoke(g, cx, cy, TS, time, v) {
  const k = TS / 48;
  g.save(); g.globalCompositeOperation = 'lighter';
  const fl = 0.35 + 0.2 * Math.sin(time * 0.004 + v);
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 14 * k); gr.addColorStop(0, `rgba(255,120,40,${fl})`); gr.addColorStop(1, 'rgba(255,60,20,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 14 * k, 0, Math.PI * 2); g.fill(); g.restore();
  for (let i = 0; i < 7; i++) {
    const t = ((time * 0.00025 + i / 7 + (v % 100) / 100) % 1);
    const px = cx + Math.sin(t * 5 + i) * 4 * k + t * 26 * k, py = cy - t * 70 * k, rr = (4 + t * 16) * k;
    g.fillStyle = `rgba(${60 + t * 30 | 0},${54 + t * 28 | 0},${52 + t * 26 | 0},${0.5 * (1 - t) * Math.min(1, t * 6)})`;
    g.beginPath(); g.ellipse(px, py, rr, rr * 0.8, 0, 0, Math.PI * 2); g.fill();
  }
}
// glints moving across acid pools and rivers
export function drawLiquidShimmer(g, x, y, TS, time, v, kind) {
  const ph = time * 0.0016 + (v % 1000) / 160;
  const a = Math.max(0, Math.sin(ph)) ** 3 * (kind === 'acid' ? 0.35 : 0.25);
  if (a < 0.01) return;
  const cx = (x + 0.3 + ((v >> 3) % 40) / 100) * TS + Math.sin(ph * 0.7) * TS * 0.15, cy = (y + 0.35 + ((v >> 7) % 30) / 100) * TS;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, TS * 0.32);
  gr.addColorStop(0, kind === 'acid' ? `rgba(220,255,120,${a})` : `rgba(190,255,190,${a})`); gr.addColorStop(1, 'rgba(120,255,80,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, TS * 0.32, TS * 0.14, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}
// Light of the day: dawn on day 1 of each week, midday, dusk, and night on the seventh day.
const DAY_TINT = [
  { c: 'rgba(255,170,150,0.10)', mode: 'soft-light', glow: 'rgba(255,140,90,0.10)' },
  { c: 'rgba(255,240,210,0.05)', mode: 'soft-light' },
  { c: 'rgba(255,250,230,0.0)', mode: 'soft-light' },
  { c: 'rgba(255,230,190,0.06)', mode: 'soft-light' },
  { c: 'rgba(255,170,90,0.14)', mode: 'soft-light', glow: 'rgba(255,120,40,0.08)' },
  { c: 'rgba(120,70,140,0.22)', mode: 'multiply', glow: 'rgba(255,90,60,0.06)' },
  { c: 'rgba(60,70,130,0.36)', mode: 'multiply' },
];
export function drawDayTint(g, x, y, w, h, day) {
  const T = DAY_TINT[(day - 1) % 7];
  g.save(); g.globalCompositeOperation = T.mode; g.fillStyle = T.c; g.fillRect(x, y, w, h); g.restore();
  if (T.glow) { g.save(); const gr = g.createLinearGradient(x, y, x + w, y); gr.addColorStop(0, T.glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.globalCompositeOperation = 'screen'; g.fillRect(x, y, w, h); g.restore(); }
}
export function drawScenery(g, sc, TS) {
  const k = TS / 48;
  blit(g, sc.sprite, (sc.x + SCENERY[sc.sprite].cx) * TS, (sc.y + 1.05) * TS, SPR_SCALE * k);
}

// Structures and mines: painted pictures anchored at their entrance tile, mirrored toward the road,
// with a flickering additive glow layer (fire, beams, crystals) where the picture has one.
const SITE_W = { gladiator_pit: 2.9, atmospheric_processor: 2.4, penal_stockade: 2.8, fallen_cathedral_treasury: 2.8, wyrm_sanctum: 2.9,
  crashed_frigate: 2.9, data_monolith: 2.0, relic_obelisk: 2.0, watch_eye: 1.8, rally_standard: 1.8, weapons_proving_ground: 2.1, bastion_watchtower: 2.3,
  kite_rookery: 2.2, void_font: 2.1, medicae_fountain: 2.2, auspex_array: 2.3, alien_tomb_pyramid: 2.8, sanctuary_basilica: 2.8, grand_librarium: 2.5 };
const FACES_RIGHT = new Set(['smuggler_s_den', 'geothermal_tap']);
function drawStructure(g, name, cx, cy, ts, wTiles, flip, time, spent, seed = 0) {
  const im = sprite(name); if (!im) return null;
  const w = ts * wTiles, h = im.height * w / im.width, x = cx - w / 2, y = cy + ts * 0.62 - h;
  const mirror = flip !== FACES_RIGHT.has(name.replace(/^site_/, ''));
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, cy + ts * 0.4, w * 0.42, ts * 0.32, 0, 0, Math.PI * 2); g.fill();
  if (mirror) { g.translate(cx * 2, 0); g.scale(-1, 1); }
  if (spent) g.filter = 'brightness(0.62) saturate(0.6)';
  g.drawImage(im, x, y, w, h);
  const gl = !spent && sprite(name + '_glow');
  if (gl) {
    const t = time * 0.001 + seed * 1.7;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.max(0, Math.min(1, 0.55 + 0.25 * Math.sin(t * 2.3) + 0.12 * Math.sin(t * 7.1 + 1.3) + 0.08 * Math.sin(t * 13.7)));
    g.drawImage(gl, x, y, w, h);
  }
  g.restore();
  return { w, h, mirror };
}
export function drawMine(g, cx, cy, ts, res, color, time, flip = false, art = null) {
  const r = drawStructure(g, art ? 'site_' + art : 'mine_' + res, cx, cy, ts, 2.55, flip, time, false, cx + cy);
  if (!r || color == null) return;
  const k = ts / 48;
  g.save(); g.translate(cx + (r.mirror ? 1 : -1) * r.w * 0.36, cy + ts * 0.62 - r.h * 0.72); g.scale(k, k);
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,8,6,.9)';
  flag(g, 0, -10, color, time);
  g.restore();
}
export function drawSite(g, cx, cy, ts, kind, spent, flip = false, time = 0) {
  const art = (SITES[kind] && SITES[kind].art) || kind;
  drawStructure(g, 'site_' + art, cx, cy, ts, SITE_W[art] || 2.55, flip, time, spent, cx * 0.7 + cy);
}

export function drawPile(g, cx, cy, ts, res) {
  const im = sprite('icon_' + res); if (!im) return;
  const s = ts * 0.62;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + ts * 0.28, s * 0.42, s * 0.12, 0, 0, Math.PI * 2); g.fill();
  g.drawImage(im, cx - s / 2, cy + ts * 0.32 - s, s, s);
}

// Original armoured transport used for commanders on the map.
// Drawn once as vectors into a small canvas, then given a painted, weathered pixel texture.
function vehicleVectors(g, color, faction) {
  g.lineJoin = 'round'; g.lineWidth = 1.4; g.strokeStyle = 'rgba(14,11,9,.95)';
  const main = color, lt = shade(color, 0.2), top = shade(color, 0.34), dk = shade(color, -0.38), dk2 = shade(color, -0.55);
  const metal = '#55504a', metalLt = '#8a847c';
  const trim = faction === 'hollow' ? '#d8c8a0' : '#d9b55a';
  const D = [10, -9];
  // far track
  R(g, -46 + D[0], -16 + D[1], 94, 15, 7, '#1c1917');
  // hull top with vents and seams
  P(g, [[-42, -36], [34, -36], [34 + D[0], -36 + D[1]], [-42 + D[0], -36 + D[1]]], top);
  g.save(); g.strokeStyle = dk; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(-14, -36); g.lineTo(-14 + D[0], -36 + D[1]); g.moveTo(12, -36); g.lineTo(12 + D[0], -36 + D[1]); g.stroke();
  g.restore();
  for (let i = 0; i < 5; i++) P(g, [[-36 + i * 3.2, -38.5], [-34.6 + i * 3.2, -38.5], [-34.6 + i * 3.2 + 6, -44], [-36 + i * 3.2 + 6, -44]], dk2, false);
  // sloped front plate with cross bars
  P(g, [[34, -36], [34 + D[0], -36 + D[1]], [47 + D[0], -16 + D[1]], [47, -16]], lt);
  g.save(); g.strokeStyle = dk; g.lineWidth = 1.1;
  for (const t of [0.55, 0.75]) { g.beginPath(); g.moveTo(34 + 13 * t, -36 + 20 * t); g.lineTo(34 + 13 * t + D[0], -36 + 20 * t + D[1]); g.stroke(); }
  g.restore();
  // side face with vertical shading
  const gr = g.createLinearGradient(0, -36, 0, -13);
  gr.addColorStop(0, lt); gr.addColorStop(0.45, main); gr.addColorStop(1, dk);
  P(g, [[-42, -36], [34, -36], [47, -16], [47, -13], [-42, -13]], gr);
  R(g, -42, -37, 76, 3, 0, trim, false);
  // panel seams and armour plates
  g.save(); g.strokeStyle = dk2; g.lineWidth = 0.9;
  g.beginPath();
  for (const x of [-24, 12, 26]) { g.moveTo(x, -33); g.lineTo(x, -14); }
  g.moveTo(-42, -21); g.lineTo(-24, -21); g.moveTo(12, -21); g.lineTo(40, -21);
  g.stroke(); g.restore();
  // side door
  R(g, -18, -32, 24, 17, 1.5, shade(color, 0.06));
  g.save(); g.strokeStyle = dk2; g.lineWidth = 0.9; g.strokeRect(-15.5, -29.5, 19, 12); g.restore();
  R(g, 1, -25.5, 3, 2, 0.5, metalLt, false);
  g.fillStyle = dk2; for (const [rx, ry] of [[-16.5, -31], [4.5, -31], [-16.5, -17], [4.5, -17], [-40, -34], [31, -34], [-40, -16], [-26, -34], [-26, -16], [14, -34], [14, -16]]) g.fillRect(rx, ry, 1.4, 1.4);
  // spare track links at the rear
  for (let i = 0; i < 3; i++) R(g, -41, -33 + i * 4.2, 9, 3.4, 1, metal);
  // emblem
  if (faction === 'hollow') {
    E(g, 20, -26, 5.5, 5.5, '#1a1210'); E(g, 20, -26, 3, 1.9, '#e0503a', false); E(g, 20, -26, 1.1, 1.5, '#1a1210', false);
    for (let i = 0; i < 6; i++) { const x = -38 + i * 12; P(g, [[x, -36], [x + D[0] * 0.4 + 2, -36 + D[1] * 0.4 - 7], [x + 5, -36]], trim); }
  } else {
    E(g, 20, -26, 6, 6, dk);
    P(g, [[20, -31.5], [24.2, -23], [20, -25.5], [15.8, -23]], trim, false);
  }
  // vision slits and lamps
  P(g, [[38, -32], [42, -35.5], [44, -31.5], [40, -28.5]], '#14110f', false);
  P(g, [[41, -27], [45, -30.5], [47, -26.5], [43, -23.5]], '#14110f', false);
  R(g, 45, -19, 3, 3, 1, '#ffd36a', false);
  R(g, 45 + D[0] * 0.8, -19 + D[1] * 0.8, 3, 3, 1, '#ffd36a', false);
  // hatch
  E(g, -4, -40.5, 9, 3.6, dk); E(g, -4, -41.5, 6, 2.4, lt); R(g, -5, -43, 2, 1.5, 0.5, metalLt, false);
  // exhausts
  for (const ex of [-38, -31]) { R(g, ex + 4, -56, 4.5, 16, 1, metal); R(g, ex + 3.5, -57, 5.5, 2.5, 1, '#2a2622'); R(g, ex + 5, -54, 1.2, 12, 0, metalLt, false); }
  // weapon pod
  R(g, 16, -50, 12, 8, 2, dk); R(g, 17, -49, 10, 2, 1, lt, false);
  R(g, 27, -48.5, 16, 2.2, 1, '#2a2624', false); R(g, 27, -45.5, 16, 2.2, 1, '#2a2624', false);
  // near track, track plates and road wheels
  R(g, -47, -16, 97, 16, 7.5, '#2a2622');
  g.save(); g.strokeStyle = '#4a433d'; g.lineWidth = 1;
  for (let x = -44; x < 46; x += 4) { g.beginPath(); g.moveTo(x, -15.5); g.lineTo(x, -13.5); g.moveTo(x + 1, -1.5); g.lineTo(x + 1, 0); g.stroke(); }
  g.restore();
  for (const wx of [-37, -23, -9, 5, 19, 33]) { E(g, wx, -7.5, 5.6, 5.6, '#4b4540'); E(g, wx, -7.5, 3.4, 3.4, '#3a3430', false); E(g, wx, -7.5, 1.4, 1.4, '#8a827a', false); }
  E(g, -41, -9, 4, 4, '#3a3430'); E(g, 43, -9, 4, 4, '#3a3430');
}

// Hollow Host transport: a long, low furnace-crawler with a bone-white ram, a spiked spine and a
// smoking furnace stack at the rear. Same footprint as the Concord transport, different silhouette.
function hollowVectors(g, color) {
  g.lineJoin = 'round'; g.lineWidth = 1.4; g.strokeStyle = 'rgba(14,11,9,.95)';
  const main = color, lt = shade(color, 0.18), top = shade(color, 0.3), dk = shade(color, -0.4), dk2 = shade(color, -0.6);
  const iron = '#3a3430', ironLt = '#6a625a', bone = '#d8cbb0', boneDk = '#9a8c72', brass = '#a8803a';
  const D = [10, -9];
  // far track
  R(g, -50 + D[0], -14 + D[1], 100, 13, 6, '#181412');
  // furnace tower at the rear (behind the hull)
  P(g, [[-44, -30], [-44, -58], [-24, -58], [-20, -30]], dk);
  P(g, [[-44, -58], [-24, -58], [-24 + D[0] * 0.6, -58 + D[1] * 0.6], [-44 + D[0] * 0.6, -58 + D[1] * 0.6]], main);
  R(g, -40, -54, 12, 10, 2, '#2a0e08');                     // furnace mouth
  R(g, -38, -52, 8, 6, 1, '#ff7a24', false);
  R(g, -36, -51, 4, 3, 1, '#ffd070', false);
  for (const [ex, h] of [[-42, 20], [-33, 26]]) { R(g, ex, -58 - h, 6, h, 1, iron); R(g, ex - 1, -59 - h, 8, 3, 1, '#201a16'); R(g, ex + 1, -56 - h, 1.2, h - 4, 0, ironLt, false); }
  // hull: wedge that rises towards the furnace
  P(g, [[-38, -40], [30, -30], [30 + D[0], -30 + D[1]], [-38 + D[0], -40 + D[1]]], top);
  const gr = g.createLinearGradient(0, -40, 0, -12);
  gr.addColorStop(0, lt); gr.addColorStop(0.5, main); gr.addColorStop(1, dk);
  P(g, [[-46, -40], [-38, -40], [30, -30], [44, -14], [-46, -12]], gr);
  // riveted iron bands and chains
  g.save(); g.strokeStyle = dk2; g.lineWidth = 1;
  g.beginPath(); for (const x of [-28, -6, 16]) { g.moveTo(x, -38 + (x + 38) * 0.14); g.lineTo(x, -13); } g.stroke(); g.restore();
  R(g, -46, -41, 10, 3, 0, brass, false);
  g.fillStyle = dk2; for (let x = -42; x < 28; x += 7) g.fillRect(x, -16, 1.5, 1.5);
  g.save(); g.strokeStyle = '#7a7068'; g.lineWidth = 1.2;
  g.beginPath(); for (let x = -26; x < 12; x += 4) { g.ellipse(x, -24 + Math.sin(x) * 1.2, 2, 1.2, 0, 0, Math.PI * 2); } g.stroke(); g.restore();
  // spiked spine along the top
  for (let i = 0; i < 6; i++) { const x = -32 + i * 11, y = -40 + (x + 38) * 0.147; P(g, [[x - 3, y], [x + D[0] * 0.3 + 1, y - 10 - (i % 2) * 3], [x + 4, y]], bone); }
  // bone ram and skull at the prow
  P(g, [[30, -30], [52, -20], [50, -12], [44, -14]], bone);
  P(g, [[44, -14], [50, -12], [56, -6], [42, -9]], boneDk);
  E(g, 37, -22, 5.5, 5, bone); E(g, 35.5, -23, 1.5, 1.6, '#1a1210', false); E(g, 39, -23, 1.5, 1.6, '#1a1210', false);
  R(g, 35, -19.5, 5, 1.8, 0.5, '#1a1210', false);
  // horns on the furnace tower
  P(g, [[-44, -56], [-54, -66], [-50, -60], [-44, -52]], bone);
  P(g, [[-24, -56], [-16, -68], [-18, -60], [-24, -52]], bone);
  // glowing rune vents
  for (const vx of [-18, -4, 10]) { R(g, vx, -30 + (vx + 38) * 0.06, 6, 2, 0.8, '#ff5a2a', false); }
  // near track: jagged, with spiked wheels
  R(g, -52, -14, 104, 15, 7, '#241e1a');
  g.save(); g.strokeStyle = '#4a3a32'; g.lineWidth = 1;
  for (let x = -48; x < 50; x += 5) { g.beginPath(); g.moveTo(x, -14); g.lineTo(x + 1.5, -16.5); g.moveTo(x, 1); g.lineTo(x + 1.5, 3); g.stroke(); }
  g.restore();
  for (const wx of [-40, -24, -8, 8, 24, 40]) { E(g, wx, -6.5, 5.4, 5.4, '#3a302a'); E(g, wx, -6.5, 2.4, 2.4, brass, false); }
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const vehicleCache = new Map();
function vehicleSprite(color, faction) {
  const key = color + faction;
  if (vehicleCache.has(key)) return vehicleCache.get(key);
  const W = 150, H = faction === 'hollow' ? 116 : 92, S = 1.28;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.translate(W * 0.43, H - 4); g.scale(S, S);
  if (faction === 'hollow') hollowVectors(g, color); else vehicleVectors(g, color, faction);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Painted texture: blotchy paint, lit upper edges, shaded lower edges, chips and grime towards the tracks.
  const img = g.getImageData(0, 0, W, H), d = img.data, o = new Uint8ClampedArray(d);
  const seed = parseInt(color.slice(1), 16) & 0xffff;
  const lum = i => o[i] * 0.3 + o[i + 1] * 0.59 + o[i + 2] * 0.11;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (o[i + 3] < 100) continue;
    const n = hash2(x >> 1, y >> 1, seed) - 0.5, n2 = hash2(x >> 2, y >> 2, seed + 7) - 0.5;
    let f = 1 + n * 0.16 + n2 * 0.1;
    const up = i - W * 4 * 1, dn = i + W * 4 * 2;
    if (y < 1 || o[up + 3] < 100) f *= 1.4;
    else if (lum(up) < lum(i) - 45) f *= 1.18;
    if (y + 2 >= H || o[dn + 3] < 100) f *= 0.72;
    let r = o[i] * f, gg = o[i + 1] * f, b = o[i + 2] * f;
    const gy = (y - H * 0.45) / (H * 0.55);
    if (gy > 0) {
      const m = Math.min(0.6, Math.max(0, gy * 0.55 + n2 * 0.35));
      r = r * (1 - m) + 74 * m; gg = gg * (1 - m) + 58 * m; b = b * (1 - m) + 40 * m;
    }
    const chip = hash2(x, y, seed + 3);
    if (chip > 0.985) { r = r * 0.4 + 170 * 0.6; gg = gg * 0.4 + 165 * 0.6; b = b * 0.4 + 155 * 0.6; }
    else if (chip < 0.012) { r *= 0.55; gg *= 0.55; b *= 0.55; }
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  g.putImageData(img, 0, 0);
  const out = { c, ox: W * 0.43, oy: H - 4, unit: S };
  vehicleCache.set(key, out);
  return out;
}

export function drawVehicle(g, cx, cy, size, color, faction, facing = 1, time = 0) {
  const v = vehicleSprite(color, faction);
  const k = size / 100 / v.unit;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(cx + 4 * facing * size / 100, cy, size * 0.52, size * 0.09, 0, 0, Math.PI * 2); g.fill();
  g.translate(cx, cy); g.scale(facing * k, k);
  g.drawImage(v.c, -v.ox, -v.oy);
  g.restore();
  const u = size / 100;
  if (faction === 'hollow') {
    // furnace glow and two dark smoke plumes with embers
    g.save(); g.globalCompositeOperation = 'lighter';
    const fl = 0.55 + 0.25 * Math.sin(time * 0.013) + 0.1 * Math.sin(time * 0.041);
    const fx = cx + facing * -34 * u, fy = cy - 49 * u;
    const gl = g.createRadialGradient(fx, fy, 0, fx, fy, 16 * u); gl.addColorStop(0, `rgba(255,140,50,${fl * 0.7})`); gl.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(fx, fy, 16 * u, 0, Math.PI * 2); g.fill(); g.restore();
    for (const [sx, top, ph] of [[-39, -82, 0], [-30, -88, 9]]) {
      for (let i = 0; i < 3; i++) {
        const sm = ((time * 0.018 + ph + i * 6) % 18);
        g.save(); g.globalAlpha = 0.4 * (1 - sm / 18); g.fillStyle = i ? '#3a302c' : '#5a4a42';
        g.beginPath(); g.ellipse(cx + facing * (sx - sm * 0.5) * u, cy + (top - sm * 1.2) * u, (3 + sm * 0.4) * u, (2.6 + sm * 0.3) * u, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      const em = (time * 0.03 + ph * 3) % 14;
      g.fillStyle = `rgba(255,${150 + em * 5 | 0},60,${0.9 - em / 15})`; g.fillRect(cx + facing * (sx + 2 + Math.sin(em) * 2) * u, cy + (top - em * 1.6) * u, 1.6 * u, 1.6 * u);
    }
    return;
  }
  const sm = (time * 0.02) % 18;
  g.save(); g.globalAlpha = 0.35 * (1 - sm / 18); g.fillStyle = '#8a837c';
  g.beginPath(); g.ellipse(cx + facing * (-30 - sm * 0.6) * u, cy + (-60 - sm) * u, (3 + sm * 0.35) * u, (2.5 + sm * 0.25) * u, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

const PAINT = { '#3f86e0': '#2f5fae', '#d23b30': '#a3312a', '#4fae4a': '#3a8a38', '#d8a830': '#b08420', '#9a52c8': '#7a3ea6', '#2fb0b0': '#238a8a' };
export function drawHero(g, cx, cy, ts, faction, color, time, facing = 1, look = null, moving = false) {
  if (look && drawCommanderMap(g, cx, cy, ts, look, PAINT[color] || color, time, facing, moving)) return;
  drawVehicle(g, cx, cy + ts * 0.36, ts * 1.25, PAINT[color] || color, faction, facing, time);
}
// Painted commanders on the map: their movement sheet (frame 0 while standing), with the blank banner
// painted in the player's colour (a multiply tint through the banner mask), or a small pennant added
// when the vehicle carries no banner of its own.
const tintCache = {};
function tintedTown(faction, im, mk, color) {
  const key = 'town' + faction + color; if (tintCache[key]) return tintCache[key];
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  const l = document.createElement('canvas'); l.width = im.width; l.height = im.height; const lx = l.getContext('2d');
  lx.drawImage(mk, 0, 0); lx.globalCompositeOperation = 'source-in'; lx.fillStyle = color; lx.fillRect(0, 0, l.width, l.height);
  x.globalCompositeOperation = 'multiply'; x.drawImage(l, 0, 0);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
  return (tintCache[key] = c);
}
function tintedStrip(look, color) {
  const key = look + color; if (tintCache[key]) return tintCache[key];
  const im = sprite(`cmd_${look}_map`), mk = sprite(`cmd_${look}_map_mask`); if (!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  if (mk) {
    const l = document.createElement('canvas'); l.width = im.width; l.height = im.height; const lx = l.getContext('2d');
    lx.drawImage(mk, 0, 0); lx.globalCompositeOperation = 'source-in'; lx.fillStyle = color; lx.fillRect(0, 0, l.width, l.height);
    x.globalCompositeOperation = 'multiply'; x.drawImage(l, 0, 0);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
  }
  return (tintCache[key] = c);
}
function drawCommanderMap(g, cx, cy, ts, look, color, time, facing, moving) {
  const m = AS && AS.manifest[`cmd_${look}_map`], im = m && tintedStrip(look, color); if (!im) return false;
  const h = ts * 1.5, k = h / m.fh, w = m.fw * k, fi = moving ? Math.floor(time / 1000 * 14) % m.n : 0;
  const fy = cy + ts * 0.46;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(cx, fy - ts * 0.04, ts * 0.5, ts * 0.15, 0, 0, Math.PI * 2); g.fill();
  g.translate(cx, fy); if (facing < 0) g.scale(-1, 1);
  g.drawImage(im, fi * m.fw, 0, m.fw, m.fh, -m.ax * w, -h, w, h);
  if (!m.banner) { const kk = ts / 48; g.translate(-w * 0.22, -h * 0.62); g.scale(kk * facing, kk); g.lineWidth = 1.5; g.strokeStyle = 'rgba(10,8,6,.9)'; flag(g, 0, -10, color, time); }
  g.restore();
  return true;
}

// ---------------- terrain ----------------
const SMALL_CRATERS = ['crater_1', 'crater_4', 'crater_5', 'crater_7', 'crater_9', 'crater_10'];
const BIG_CRATERS = ['crater_2', 'crater_3', 'crater_6', 'crater_8'];
const GOO = ['goo_1', 'goo_2', 'goo_3', 'goo_4'];
// [sprite or list, chance, size in tiles (0 = default sprite scale)]
// Ground scatter per terrain: craters, stones, bones, and small acid or lava cracks from the new obstacle sheets.
const ROCKS = b => [`tz_${b}_rocks`];
const DECOR = {
  0: [[SMALL_CRATERS, 0.05, 0.75], ['stones_s', 0.05, 0], [ROCKS('snow'), 0.025, 0.7], [BIG_CRATERS, 0.01, 1.5], ['skeleton', 0.008, 0]],
  1: [['stones_s', 0.08, 0], [SMALL_CRATERS, 0.08, 0.8], [BIG_CRATERS, 0.025, 1.6], [ROCKS('scrap'), 0.03, 0.75], ['skeleton', 0.02, 0]],
  2: [[ROCKS('shale'), 0.035, 0.7], [SMALL_CRATERS, 0.03, 0.7], ['stones_s', 0.05, 0], ['skeleton', 0.01, 0]],
  3: [['skeleton', 0.04, 0], ['stones_s', 0.08, 0], [SMALL_CRATERS, 0.06, 0.8], [ROCKS('glass'), 0.025, 0.7], [BIG_CRATERS, 0.02, 1.5]],
  6: [[SMALL_CRATERS, 0.08, 0.75], ['stones_s', 0.08, 0], [ROCKS('ash'), 0.025, 0.7], [BIG_CRATERS, 0.02, 1.5], ['skeleton', 0.015, 0]],
  7: [['stones_s', 0.1, 0], [SMALL_CRATERS, 0.06, 0.75], [ROCKS('rust'), 0.025, 0.75], ['skeleton', 0.02, 0], [BIG_CRATERS, 0.015, 1.4]],
};
// ---------------- rivers: a seamless strip swept along a smoothed path ----------------
function riverPoints(pts, TS) {
  let p = pts.map(([x, y]) => [x * TS + TS / 2, y * TS + TS / 2]);
  for (let it = 0; it < 3; it++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]); p = q;
  }
  return p;
}
function drawRivers(g, s, TS) {
  if (!AS || !s.rivers) return;
  for (const rv of s.rivers) {
    // the river of the biome most of its course runs through (frozen, oil, sea channel, energy, magma, acid)
    const cnt = {}; for (const [x, y] of rv.pts) { const b = biomeOf(s.tiles[y * s.W + x]); cnt[b] = (cnt[b] || 0) + 1; }
    const bio = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    const strip = (AS.riverStrips && AS.riverStrips[bio]) || AS.riverStrip; if (!strip) continue;
    const SW = strip.width, SH = strip.height / 2;          // doubled strip: any start row has a full slice below it
    const width = TS * 1.2, k = width / SW, step = 2, sliceH = step * 1.6;
    const p = riverPoints(rv.pts, TS); let dist = 0;
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[i], [x1, y1] = p[i + 1];
      const seg = Math.hypot(x1 - x0, y1 - y0); if (!seg) continue;
      const n = Math.max(1, Math.ceil(seg / step)), ang = Math.atan2(-(x1 - x0), y1 - y0);
      for (let j = 0; j < n; j++) {
        const t = j / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const v = ((dist + seg * t) / k) % SH;
        g.save(); g.translate(x, y); g.rotate(ang);
        g.drawImage(strip, 0, v, SW, sliceH / k, -width / 2, -sliceH / 2, width, sliceH);
        g.restore();
      }
      dist += seg;
    }
    const pond = sprite(`tz_${bio}_lake`) || sprite('pond_' + (1 + (rv.pts.length % 3)));
    if (pond && rv.pond) { const w = TS * 1.9, h = pond.height * w / pond.width; g.drawImage(pond, (rv.pond[0] + 0.5) * TS - w / 2, (rv.pond[1] + 0.5) * TS - h / 2, w, h); }
  }
}

function texPattern(g, im, k) {
  const pat = g.createPattern(im, 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(k));
  return pat;
}
// Ground textures per terrain type, blended along ragged, softened borders. A terrain-id map at four
// cells per tile samples the tiles through a smooth noise warp, so borders wander instead of following the grid.
const TEX_SCALE = { ground_bone: 0.75 };
// Craters drawn for the map's oblique view and coloured from the ground they are dug into:
// squashed vertically, hue and tone taken from that terrain's texture, the texture itself worked into
// the crater floor, and a darker back wall with a lit front rim so the bowl reads as sunk into the ground.
const CRATER_SQUASH = 0.58;
const craterCache = {};
const texStats = {};
function texTone(name) {
  if (texStats[name]) return texStats[name];
  const im = AS.tex[name], c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 16);
  const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4; return (texStats[name] = { r: r / n, g: g / n, b: b / n, lum: (0.3 * r + 0.59 * g + 0.11 * b) / n });
}
function craterFor(name, t) {
  const key = name + ':' + t; if (craterCache[key]) return craterCache[key];
  const im = sprite(name); if (!im) return null;
  const texName = TERRAIN_TEX[t] || TERRAIN_TEX[0];
  if (!AS.tex || !AS.tex[texName]) return im;
  const tone = texTone(texName);
  const w = im.width, h = Math.max(1, Math.round(im.height * CRATER_SQUASH));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  // brightness follows the terrain (craters on dark soil are dark, on tan earth light)
  const k = Math.max(0.62, Math.min(1.15, 0.3 + tone.lum / 150));
  x.filter = `brightness(${k}) saturate(0.8)`; x.drawImage(im, 0, 0, w, h); x.filter = 'none';
  x.globalCompositeOperation = 'source-atop';
  // take the terrain's hue
  x.globalCompositeOperation = 'color'; x.fillStyle = `rgb(${tone.r | 0},${tone.g | 0},${tone.b | 0})`; x.fillRect(0, 0, w, h);
  // the ground texture worked into the surface
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.45;
  const pat = x.createPattern(AS.tex[texName], 'repeat');
  if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(0.35, 0.35 * CRATER_SQUASH));
  x.fillStyle = pat; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
  // depth: shaded far wall, lit near rim
  x.globalCompositeOperation = 'source-atop';
  const gr = x.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,0.38)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.75, 'rgba(255,235,200,0.08)'); gr.addColorStop(1, 'rgba(255,235,200,0.2)');
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  // restore the sprite's own transparency (colour blends can touch transparent pixels)
  x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0, w, h);
  return (craterCache[key] = c);
}   // skulls read better a little smaller than a tile
function paintGrounds(g, s, TS) {
  const W = s.W, H = s.H, SUB = 4, mw = W * SUB, mh = H * SUB;
  const rnd = mulberry32((s.seed || 7) * 7919 + 13);
  const lat = (n) => { const a = new Float32Array((W + 2) * (H + 2) * n * n); for (let i = 0; i < a.length; i++) a[i] = rnd() * 2 - 1; return a; };
  const noise = (gx, gy, f, arr) => {   // bilinear value noise on a lattice f cells per tile
    const LW = (W + 2) * f, x = gx * f, y = gy * f, x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const v = (i, j) => arr[((j + 1) % ((H + 2) * f)) * LW + ((i + 1) % LW)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
  };
  const nxA = lat(1), nyA = lat(1), nxB = lat(2), nyB = lat(2);
  const id = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const gx = (x + 0.5) / SUB, gy = (y + 0.5) / SUB;
    const wx = gx + noise(gx, gy, 1, nxA) * 0.45 + noise(gx, gy, 2, nxB) * 0.2;
    const wy = gy + noise(gx, gy, 1, nyA) * 0.45 + noise(gx, gy, 2, nyB) * 0.2;
    const tx = Math.min(W - 1, Math.max(0, Math.floor(wx))), ty = Math.min(H - 1, Math.max(0, Math.floor(wy)));
    const TT = s.tiles[ty * W + tx]; id[y * mw + x] = TT.t === 4 || TT.t === 5 ? (TT.g ?? 0) : TT.t;   // mountains and pools stand on their zone's ground
  }
  const k = TS / 48 * 0.33;
  // rock first (it underlies everything), then each ground type painted through its own soft mask
  g.fillStyle = texPattern(g, AS.tex[TERRAIN_TEX[4]], k); g.fillRect(0, 0, W * TS, H * TS);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, W * TS, H * TS);
  const mask = document.createElement('canvas'); mask.width = mw; mask.height = mh;
  const mg = mask.getContext('2d'); const md = mg.createImageData(mw, mh);
  const layer = document.createElement('canvas'); layer.width = W * TS; layer.height = H * TS;
  const lg = layer.getContext('2d');
  const groups = {};
  TERRAIN_TEX.forEach((name, t) => { if (t !== 4) (groups[name] = groups[name] || []).push(t); });
  for (const [name, ts] of Object.entries(groups)) {
    let any = false;
    for (let i = 0; i < id.length; i++) { const on = ts.includes(id[i]); md.data[i * 4 + 3] = on ? 255 : 0; any = any || on; }
    if (!any) continue;
    mg.putImageData(md, 0, 0);
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, layer.width, layer.height);
    lg.fillStyle = texPattern(lg, AS.tex[name], k * (TEX_SCALE[name] || 1)); lg.fillRect(0, 0, layer.width, layer.height);
    lg.globalCompositeOperation = 'destination-in';
    lg.imageSmoothingEnabled = true; lg.filter = `blur(${Math.round(TS * 0.12)}px)`;
    lg.drawImage(mask, 0, 0, layer.width, layer.height);
    lg.filter = 'none';
    g.drawImage(layer, 0, 0);
  }
  // slow light and shade variation over the whole map breaks up texture repeats
  const vs = document.createElement('canvas'); vs.width = W; vs.height = H; const vg = vs.getContext('2d'); const vd = vg.createImageData(W, H);
  const lA = lat(1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = noise(x / 3, y / 3, 1, lA); const i = (y * W + x) * 4; vd.data[i + 3] = Math.round(Math.abs(n) * 70); const dark = n < 0; vd.data[i] = dark ? 0 : 255; vd.data[i + 1] = dark ? 0 : 230; vd.data[i + 2] = dark ? 0 : 200; }
  vg.putImageData(vd, 0, 0);
  g.save(); g.globalAlpha = 0.5; g.imageSmoothingEnabled = true; g.filter = `blur(${TS}px)`; g.drawImage(vs, 0, 0, W * TS, H * TS); g.restore();
}

export function paintTerrain(s, TS, occupied) {
  const c = document.createElement('canvas'); c.width = s.W * TS; c.height = s.H * TS;
  const g = c.getContext('2d');
  if (AS && AS.tex) paintGrounds(g, s, TS);
  else {
    g.fillStyle = TERRAIN[0].base; g.fillRect(0, 0, c.width, c.height);
  }
  // mountain ranges sit on a dark rock bed, so no light ground shows between their stacked peaks
  if (AS && AS.tex) {
    const isR = (x, y) => x < 0 || y < 0 || x >= s.W || y >= s.H || (s.tiles[y * s.W + x].t === 4 && (s.tiles[y * s.W + x].b === 0 || s.tiles[y * s.W + x].b === 3));
    g.save();
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      if (!isR(x, y) || x === 0 || y === 0 || x === s.W - 1 || y === s.H - 1) continue;
      let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && isR(x + dx, y + dy)) m++;
      if (m < 7) continue;
      const cx = (x + 0.5) * TS, cy = (y + 0.5) * TS, r = TS * (0.42 + (m - 7) * 0.12);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      const bc = BED[biomeOf(s.tiles[y * s.W + x])] || '22,18,16';
      gr.addColorStop(0, `rgba(${bc},${0.3 + (m - 5) * 0.08})`); gr.addColorStop(0.7, `rgba(${bc},${0.15 + (m - 5) * 0.04})`); gr.addColorStop(1, `rgba(${bc},0)`);
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();
  }
  // forest floor: woods stand on darker, leaf-litter ground
  if (AS && AS.tex) {
    g.save();
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      const T = s.tiles[y * s.W + x]; if (T.t !== 4 || T.b !== 4) continue;
      const cx = (x + 0.5) * TS, cy = (y + 0.6) * TS, r = TS * 0.95;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      const bc = BED[biomeOf(T)] || '24,20,12';
      gr.addColorStop(0, `rgba(${bc},0.7)`); gr.addColorStop(0.6, `rgba(${bc},0.4)`); gr.addColorStop(1, `rgba(${bc},0)`);
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.restore();
  }
  // acid pools: one pond sprite per connected cluster (split along its length when elongated)
  const seenP = new Uint8Array(s.W * s.H);
  for (let i0 = 0; i0 < s.W * s.H; i0++) {
    if (seenP[i0] || s.tiles[i0].t !== 5) continue;
    const st = [i0]; seenP[i0] = 1; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    while (st.length) {
      const i = st.pop(), x = i % s.W, y = (i / s.W) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= s.W || ny >= s.H) continue;
        const j = ny * s.W + nx; if (!seenP[j] && s.tiles[j].t === 5) { seenP[j] = 1; st.push(j); }
      }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, n = Math.max(1, Math.round(Math.max(w, h) / Math.min(w, h) / 1.6));
    const list = [`tz_${biomeOf(s.tiles[i0])}_lake`];
    for (let k = 0; k < n; k++) {
      const im = sprite(list[(i0 + k) % list.length]) || sprite('pond_' + (1 + (i0 + k) % 3));
      if (!im) continue;
      // keep the painted proportions: fit the pool's width to the cluster (plus a rim), never stretch it
      const pw = (w >= h ? w / n : w) + 0.5, ph = (w >= h ? h : h / n) + 0.5;
      const ww = Math.min(pw, ph * im.width / im.height * 1.15) * TS, hh = ww * im.height / im.width;
      const cx = x0 + (w >= h ? (k + 0.5) * w / n : w / 2), cy = y0 + (w >= h ? h / 2 : (k + 0.5) * h / n);
      g.drawImage(im, (cx + 0.5) * TS - ww / 2 - TS / 2, (cy + 0.5) * TS - hh / 2 - TS / 2, ww, hh);
    }
  }
  drawRivers(g, s, TS);
  // roads: packed dirt tracks
  const segs = [];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    if (!s.tiles[y * s.W + x].road) continue;
    let any = false;
    if (x + 1 < s.W && s.tiles[y * s.W + x + 1].road) { segs.push([x, y, x + 1, y]); any = true; }
    if (y + 1 < s.H && s.tiles[(y + 1) * s.W + x].road) { segs.push([x, y, x, y + 1]); any = true; }
    if (!any) segs.push([x, y, x, y]);
  }
  const path = () => { g.beginPath(); for (const [a, b, c2, d] of segs) { g.moveTo(a * TS + TS / 2, b * TS + TS / 2); g.lineTo(c2 * TS + TS / 2, d * TS + TS / 2); } };
  const stroke = (color, w) => { path(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); };
  const roadTex = AS && AS.tex && AS.tex.road;
  if (roadTex && segs.length) {
    // paved road: dark curb and soft shadow, then grey flagstones clipped to the road's shape
    stroke('rgba(10,8,8,0.35)', TS * 0.62); stroke('#1e1814', TS * 0.5);
    const rc = document.createElement('canvas'); rc.width = c.width; rc.height = c.height;
    const rg = rc.getContext('2d');
    rg.beginPath(); for (const [a, b, c2, d] of segs) { rg.moveTo(a * TS + TS / 2, b * TS + TS / 2); rg.lineTo(c2 * TS + TS / 2, d * TS + TS / 2); }
    rg.strokeStyle = '#fff'; rg.lineWidth = TS * 0.42; rg.lineCap = 'round'; rg.lineJoin = 'round'; rg.stroke();
    rg.globalCompositeOperation = 'source-in';
    rg.fillStyle = texPattern(rg, roadTex, TS / 48 * 0.2); rg.fillRect(0, 0, rc.width, rc.height);
    // worn centre and darker edges so the paving reads as a surface, not a sticker
    rg.globalCompositeOperation = 'source-atop';
    rg.beginPath(); for (const [a, b, c2, d] of segs) { rg.moveTo(a * TS + TS / 2, b * TS + TS / 2); rg.lineTo(c2 * TS + TS / 2, d * TS + TS / 2); }
    rg.strokeStyle = 'rgba(255,240,220,0.08)'; rg.lineWidth = TS * 0.16; rg.stroke();
    g.drawImage(rc, 0, 0);
  } else { stroke('rgba(40,30,20,0.35)', TS * 0.5); stroke('#6e5a40', TS * 0.36); stroke('#857052', TS * 0.24); }
  // bridges where roads cross rivers
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const T = s.tiles[y * s.W + x]; if (!T.road || !T.river) continue;
    const horiz = (x > 0 && s.tiles[y * s.W + x - 1].road) || (x < s.W - 1 && s.tiles[y * s.W + x + 1].road);
    g.save(); g.translate(x * TS + TS / 2, y * TS + TS / 2); if (!horiz) g.rotate(Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-TS * 0.62, -TS * 0.2, TS * 1.24, TS * 0.48);
    g.fillStyle = '#6a4a2c'; g.fillRect(-TS * 0.6, -TS * 0.24, TS * 1.2, TS * 0.48);
    g.strokeStyle = '#3a2614'; g.lineWidth = 1;
    for (let k = -0.55; k < 0.6; k += 0.12) { g.beginPath(); g.moveTo(k * TS, -TS * 0.24); g.lineTo(k * TS, TS * 0.24); g.stroke(); }
    g.fillStyle = '#4a3220'; g.fillRect(-TS * 0.6, -TS * 0.28, TS * 1.2, TS * 0.06); g.fillRect(-TS * 0.6, TS * 0.22, TS * 1.2, TS * 0.06);
    g.restore();
  }
  g.fillStyle = 'rgba(60,45,30,0.5)';
  for (const [a, b] of segs) { const r = mulberry32(a * 977 + b * 131); for (let i = 0; i < 4; i++) g.fillRect(a * TS + TS * (0.25 + r() * 0.5), b * TS + TS * (0.25 + r() * 0.5), 2, 2); }
  // walkable decorations
  if (AS) {
    for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
      const i = y * s.W + x, T = s.tiles[i];
      if (T.road || T.blk || T.river || !DECOR[T.t] || (occupied && occupied.has(i))) continue;
      const rnd = mulberry32(T.v ^ 0x51ed);
      for (const [name, p] of DECOR[T.t]) {
        if (rnd() < p) {
          const nm = Array.isArray(name) ? name[Math.floor(rnd() * name.length)] : name;
          const size = DECOR[T.t].find(d => d[0] === name)[2], im = /^crater_/.test(nm) ? craterFor(nm, T.t) : sprite(nm);
          const sc = size && im ? (size * TS) / im.width * (0.85 + rnd() * 0.3) : SPR_SCALE * TS / 48 * (0.8 + rnd() * 0.3);
          if (size && im) { const w = im.width * sc, h = im.height * sc; g.drawImage(im, (x + 0.5) * TS - w / 2 + (rnd() - 0.5) * TS * 0.3, (y + 0.5) * TS - h / 2 + (rnd() - 0.5) * TS * 0.3, w, h); }
          else blit(g, nm, (x + 0.3 + rnd() * 0.4) * TS, (y + 0.75 + rnd() * 0.2) * TS, sc);
          break;
        }
      }
    }
  }
  return c;
}
