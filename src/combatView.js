// Interactive battle screen. Drives the combat engine for the human side and animates events.
import { UNITS, SPELLS, SCHOOLS, ABILITIES, HERO_DEFS, hstat, maxMana, spellDesc } from './data.js';
import { openRites, riteCost } from './terminal.js';
import * as C from './combat.js';
import { spriteImage, spriteMeta, drawUnit, drawObstacle, fillGround, drawBattleBackdrop, loadHorizon, horizonName, drawHorizonFull, animDuration, animFireTime, animMuzzle, animHitTime, animFps } from './art.js';
import { BattleFx, styleOf } from './battleFx.js';
import Audio from './audio.js';
import { RITE_FX, FX_LOOK, drawFx } from './riteFx.js';

// Stack-count badge colours: violet-blue by default, emerald with only good effects, crimson with only bad ones;
// with both, an amber that leans toward gold-green or toward red-orange by which kind outnumbers the other.
function badgeColors(s) {
  const eff = new Map();   // one vote per effect (a rite adding several stat changes counts once)
  for (const x of s.buffs) { const k = x.sp || x.src || x.stat; eff.set(k, (eff.get(k) || 0) + (x.stat === 'blind' ? -1 : Math.sign(x.amount))); }
  let good = 0, bad = 0; for (const v of eff.values()) { if (v > 0) good++; else if (v < 0) bad++; }
  if (s.frozen) bad++;
  if (!good && !bad) return ['#6c63e8', '#3b2f9e', ''];
  if (!bad) return ['#2fd48a', '#0b7a4c', 'rgba(60,230,150,0.55)'];
  if (!good) return ['#ff4d6a', '#9a1230', 'rgba(255,70,100,0.55)'];
  const t = (good - bad) / (good + bad);          // -1 mostly bad .. +1 mostly good
  const hue = 32 + t * 26;                          // 6 red-orange .. 58 gold
  return [`hsl(${hue},95%,58%)`, `hsl(${hue - 6},90%,34%)`, `hsla(${hue},100%,60%,0.5)`];
}

// Painted siege art per faction (tools/siege_art.py): wall, gate, tower, keep and moat pieces cut from rectified ground
// blocks, the courtyard paving and the siege gun's firing frames, in one atlas each plus assets/siege/meta.json.
const SIEGE_ART = { meta: null, img: {} };
const STRIP = { meta: null, img: {} };
function stripArt(fac) {
  if (!STRIP.meta) STRIP.meta = fetch('assets/siege/strip.json').then(r => r.json()).catch(() => ({}));
  if (!STRIP.img[fac]) STRIP.img[fac] = STRIP.meta.then(m => (m[fac] ? new Promise(res => {
    const im = new Image(); im.onload = () => res({ im, m: m[fac] }); im.onerror = () => res(null); im.src = `assets/siege/strip_${fac}.webp`;
  }) : null));
  return STRIP.img[fac];
}
function siegeArt(fac) {
  if (!SIEGE_ART.meta) SIEGE_ART.meta = fetch('assets/siege/meta.json').then(r => r.json()).catch(() => ({}));
  if (!SIEGE_ART.img[fac]) SIEGE_ART.img[fac] = SIEGE_ART.meta.then(m => (m[fac] ? new Promise(res => {
    const im = new Image(); im.onload = () => res({ im, m: m[fac], g: m._ }); im.onerror = () => res(null); im.src = `assets/siege/${fac}.webp`;
  }) : null));
  return SIEGE_ART.img[fac];
}

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S3 = Math.sqrt(3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function runCombatView(b, humanSide, opts) {
  return new Promise(resolve => {
    const root = $('#combat'); root.hidden = false;
    const cv = $('#cb-canvas'); const g = cv.getContext('2d');
    const colors = opts.colors;
    const V = {
      rfx: [], curSpell: null, cmdCast: [0, 0],
      r: 20, ox: 0, oy: 0, w: 0, h: 0, bg: null, disp: new Map(), floats: [], beams: [],
      mouse: null, intent: null, spell: null, auto: false, reach: null, pending: null, done: false,
      decor: Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: 0.02 + Math.random() * 0.06, k: Math.random() })),
      retreatArm: false, fx: Object.assign(new BattleFx(), { noShake: opts.shake === false }),
    };
    const norm = (c, r) => ({ nx: S3 * (c + 0.5 * (r & 1)) + S3 / 2, ny: 1 + 1.5 * r });
    // Visual centre of a stack standing with its head at (c, r): two-hex units sit between their hexes.
    const vis = (s, c = s.c, r = s.r) => {
      const a = norm(c, r); if (!s.big) return a;
      const t = norm(c + (s.side === 0 ? -1 : 1), r);
      return { nx: (a.nx + t.nx) / 2, ny: a.ny };
    };
    const px = d => ({ x: V.ox + d.nx * V.r, y: V.oy + d.ny * V.r });
    const center = (c, r) => px(norm(c, r));
    for (const s of b.stacks) V.disp.set(s.id, { ...vis(s), count: s.count, alpha: 1, flash: 0, lx: 0, ly: 0, rot: 0, dead: false });

    function layout() {
      const rect = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(rect.width * dpr)); cv.height = Math.max(1, Math.round(rect.height * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      V.w = rect.width; V.h = rect.height;
      // a painted backdrop strip runs along the top; the hex field sits below it
      V.band = Math.round(V.h * 0.19);
      V.r = Math.max(8, Math.min((V.w - 16) / ((C.COLS + 0.5) * S3), (V.h - V.band - 24) / (C.ROWS * 1.5 + 0.5)));
      const gw = (C.COLS + 0.5) * S3 * V.r, gh = (C.ROWS * 1.5 + 0.5) * V.r;
      V.ox = (V.w - gw) / 2; V.oy = V.band + (V.h - V.band - gh) / 2 + 4;
      V.bg = makeBg(dpr);
    }
    function hexPath(ctx, c, r, shrink = 0) {
      const { x, y } = center(c, r); const rr = V.r - shrink;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const X = x + rr * Math.cos(a), Y = y + rr * Math.sin(a); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.closePath();
    }
    function makeBg(dpr) {
      const c = document.createElement('canvas'); c.width = Math.round(V.w * dpr); c.height = Math.round(V.h * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      const gr = x.createLinearGradient(0, 0, 0, V.h);
      gr.addColorStop(0, '#2a2420'); gr.addColorStop(0.5, '#3a322b'); gr.addColorStop(1, '#2a231e');
      x.fillStyle = gr; x.fillRect(0, 0, V.w, V.h);
      const hzTop = Math.max(V.band, V.oy + V.r * 0.1);
      const fullHz = drawHorizonFull(x, V.w, V.h, hzTop, horizonName(b.terrain, b.siege && b.siege.faction));
      if (fullHz) {
        // the field: a soft darkening below the horizon so hexes and units read clearly on the painted ground
        const dk = x.createLinearGradient(0, hzTop - V.r * 0.3, 0, V.h);
        dk.addColorStop(0, 'rgba(10,8,6,0)'); dk.addColorStop(0.08, 'rgba(10,8,6,0.22)'); dk.addColorStop(1, 'rgba(10,8,6,0.38)');
        x.fillStyle = dk; x.fillRect(0, hzTop - V.r * 0.3, V.w, V.h);
      } else if (fillGround(x, V.w, V.h, Math.max(0.8, V.r / 30), b.terrain)) { x.fillStyle = 'rgba(10,8,6,0.18)'; x.fillRect(0, 0, V.w, V.h); }
      // backcloth: horizon painting for the terrain, fading into the ground below
      const top = Math.max(V.band, V.oy + V.r * 0.1);
      if (!fullHz) {
      x.save(); x.beginPath(); x.rect(0, 0, V.w, top + V.r * 0.6); x.clip();
      if (b.bgSeed == null) b.bgSeed = (Math.random() * 1e6) | 0;
      drawBattleBackdrop(x, V.w, top, b.terrain, b.bgSeed, b.siege ? (b.siege.faction || true) : false);
      x.restore();
      }
      const fade = x.createLinearGradient(0, top - V.r * 0.5, 0, top + V.r * 0.7);
      fade.addColorStop(0, 'rgba(20,16,12,0)'); fade.addColorStop(0.5, 'rgba(20,16,12,0.55)'); fade.addColorStop(1, 'rgba(20,16,12,0)');
      if (!fullHz) { x.fillStyle = fade; x.fillRect(0, top - V.r * 0.5, V.w, V.r * 1.2); }
      const rg = x.createRadialGradient(V.w / 2, V.h * 0.1, 0, V.w / 2, V.h * 0.1, V.w * 0.6);
      rg.addColorStop(0, 'rgba(200,80,40,0.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(0, 0, V.w, V.h);
      for (const d of V.decor) {
        const cx = d.x * V.w, cy = d.y * V.h, rr = d.r * Math.min(V.w, V.h);
        x.fillStyle = d.k < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,230,200,0.03)';
        x.beginPath(); x.ellipse(cx, cy, rr * 1.6, rr * 0.6, 0, 0, Math.PI * 2); x.fill();
      }
      if (b.siege && wallArt) {
        const A = wallArt, k = artK(A), [yx, yy, yw, yh] = A.m.yard;
        // courtyard: the faction's paving inside the walls
        const yc = document.createElement('canvas'); yc.width = yw; yc.height = yh; yc.getContext('2d').drawImage(A.im, yx, yy, yw, yh, 0, 0, yw, yh);
        const pat = x.createPattern(yc, 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(V.r * 3.2 / yw));
        x.save(); x.fillStyle = pat; x.globalAlpha = 0.55;
        for (let r = 0; r < C.ROWS; r++) for (let c2 = C.WALL_COL + 1; c2 < C.COLS; c2++) { hexPath(x, c2, r, -0.5); x.fill(); }
        x.restore();
        // moat: the channel piece repeated down the moat column
        if (b.siege.moat && !strip) {
          // the channel window repeated end to end (same depth window every time, so the banks line up at each joint)
          const xm = (center(C.MOAT_COL, 0).x + center(C.MOAT_COL, 1).x) / 2, win = [150, 850], len = (win[1] - win[0]) * artKv(A);
          for (let y = rowTop(0) - V.r * 0.4; y < rowBot(C.ROWS - 1); y += len - 1) drawPart(x, A, 'moat', win[0], win[1], xm, y, 0.41);
        }
      } else if (b.siege) {
        // courtyard paving behind the walls
        x.fillStyle = 'rgba(70,64,58,0.55)';
        for (let r = 0; r < C.ROWS; r++) for (let c2 = C.WALL_COL + 1; c2 < C.COLS; c2++) { hexPath(x, c2, r, 0); x.fill(); }
        if (b.siege.moat) {
          for (let r = 0; r < C.ROWS; r++) {
            hexPath(x, C.MOAT_COL, r, 0); x.fillStyle = '#1d3f3a'; x.fill();
            const p = center(C.MOAT_COL, r); x.strokeStyle = 'rgba(140,220,200,0.35)'; x.lineWidth = 1.2;
            x.beginPath(); x.arc(p.x - V.r * 0.2, p.y, V.r * 0.3, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
          }
        }
      }
      x.strokeStyle = 'rgba(232,223,207,0.17)'; x.lineWidth = 1;
      for (let r = 0; r < C.ROWS; r++) for (let c2 = 0; c2 < C.COLS; c2++) { hexPath(x, c2, r, 0.5); x.stroke(); }
      let k = 1;
      for (const key of b.obstacles) { const c2 = key % C.COLS, r = Math.floor(key / C.COLS); const p = center(c2, r); drawObstacle(x, p.x, p.y, V.r * 0.95, key * 7919 + k++); }
      return c;
    }

    loadHorizon(horizonName(b.terrain, b.siege && b.siege.faction)).then(im => { if (im) b.bgDirty = true; });
    // ---------- painted siege art ----------
    let wallArt = null, gunArt = null, gunFireAt = -1e9, strip = null;
    if (b.siege) {
      stripArt(b.siege.faction || 'concord').then(a => { if (a) { strip = a; b.bgDirty = true; } });
      siegeArt(b.siege.faction || 'concord').then(a => { if (a) { wallArt = a; b.bgDirty = true; } });
      siegeArt(b.siege.cannon || 'concord').then(a => { if (a) gunArt = a; });
    }
    const WALL_U = 0.73, WALL_W = 2.3;   // wall centre across a rectified tile; drawn wall band width in hex radii
    const artK = A => WALL_W * V.r / ((A.m.pieces.wall.u1 - A.m.pieces.wall.u0) * A.g.RW);   // screen px per tile unit
    const rowTop = r => center(C.WALL_COL, r).y - V.r * 0.75, rowBot = r => center(C.WALL_COL, r).y + V.r * 0.75;
    const wallX = () => (center(C.WALL_COL, 0).x + center(C.WALL_COL, 1).x) / 2 + V.r * 0.25;   // nudged inward: the moat column stays clear
    // Pieces are drawn at one scale and joined end to end down the wall column, the way the blocks fit together on a
    // table: every wall section shows the same depth window of its tile, so the wall line and the moat banks meet
    // straight across each joint. Tiles are foreshortened along the wall (SQUASH) to fit the eleven rows.
    const SQUASH = 1.5;
    const artKv = A => artK(A) / SQUASH;
    // draw tile rows va..vb of a piece with tile row va at screen y and the tile's wall centre at screen x xc
    function drawPart(ctx, A, name, va, vb, xc, y, uc = WALL_U) {
      const P = A.m.pieces[name]; if (!P) return;
      const k = artK(A), kv = artKv(A), sc = A.m.scale, [ax, ay, aw, ah] = P.r;
      const lo = Math.max(va, P.v0), hi = Math.min(vb, P.v0 + ah / sc); if (hi <= lo) return;
      ctx.drawImage(A.im, ax, ay + (lo - P.v0) * sc, aw, (hi - lo) * sc,
        xc + (P.u0 - uc) * A.g.RW * k, y + (lo - va) * kv, (P.u1 - P.u0) * A.g.RW * k, (hi - lo) * kv);
    }
    // the wall line from far (top) to near (bottom): slot = [piece kind, section, first row, last row] in row units
    const WALL_SLOTS = [['wall', 'top', 0.0, 1.6], ['wall', 'top', 1.6, 3.0], ['wall', 'upper', 3.0, 4.3], ['gate', null, 4.3, 5.7],
      ['wall', 'lower', 5.7, 7.0], ['wall', 'bottom', 7.0, 8.4], ['wall', 'bottom', 8.4, 10.0]];
    const rowY = t => rowTop(0) + t * V.r * 1.5;   // row units (0 = top edge of row 0) to screen y
    function drawSiegeArt(A) {
      const S = b.siege, kv = artKv(A), xc = wallX(), ABOVE = A.g.ABOVE;
      const state = (hp, base) => (hp >= 2 ? base : hp > 0 ? base + '_d' : base + '_x');
      WALL_SLOTS.forEach(([kind, sec, t0, t1], i) => {
        const y0 = rowY(t0), len = (rowY(t1) - y0) / kv;
        const name = kind === 'gate' ? state(S.gate, 'gate') : state(S.walls[sec], 'wall');
        const vc = kind === 'gate' ? 470 : 500, va = vc - len / 2;
        // the far end also shows what rises above its tile (battlements, smoke) into the horizon band
        if (i === 0) drawPart(g, A, name, va - ABOVE, va + len, xc, y0 - ABOVE * kv);
        else drawPart(g, A, name, va, va + len, xc, y0);
      });
      // towers stand on the wall line at its two ends, the keep in the courtyard behind the gate; tile row 720 is a tower's foot
      const FOOT = 720;
      for (const tw of S.towers) {
        const name = (tw.id === 'keep' ? 'keep' : 'tower') + (tw.hp > 0 ? '' : '_x'), P = A.m.pieces[name]; if (!P) continue;
        let x = xc, footY;
        if (tw.id === 'north') footY = rowY(1.9);
        else if (tw.id === 'south') footY = rowY(10.4);
        else { x = center(C.COLS - 1, C.GATE_ROW).x + V.r * 0.35; footY = rowBot(C.GATE_ROW) + V.r * 0.6; }
        drawPart(g, A, name, P.v0, FOOT + 60, x, footY - (FOOT - P.v0) * kv, 0.58);
      }
    }
    // Complete wall strip: one painting of moat, wall, gate and end towers in three aligned states; each of its parts
    // along the length shows the state of the structure it stands for. Moat centre (u 0.40) on the moat column, the
    // wall line (u 0.62) on the wall column; the strip spans the field from the top of row 0 to the bottom of the last row.
    const STRIP_PARTS = [[0, 0.15, 'north'], [0.15, 0.3, 'top'], [0.3, 0.42, 'upper'], [0.42, 0.58, 'gate'], [0.58, 0.7, 'lower'], [0.7, 0.85, 'bottom'], [0.85, 1, 'south']];
    function stripState(key) {
      const S = b.siege, lvl = h => (h >= 2 ? 0 : h > 0 ? 1 : 2);
      if (key === 'gate') return lvl(S.gate);
      if (key === 'north' || key === 'south') { const t = S.towers.find(x => x.id === key); return !t ? 0 : t.hp <= 0 ? 2 : t.hp < 2 ? 1 : 0; }
      return lvl(S.walls[key]);
    }
    let stripFade = null;
    function drawStrip(A) {
      const { im, m } = A, xm = (center(C.MOAT_COL, 0).x + center(C.MOAT_COL, 1).x) / 2, xw = wallX() - V.r * 0.25;
      const k = (xw - xm) / (0.22 * m.w);                  // screen px per strip px across
      const y0 = rowTop(0) + V.r * 0.1, y1 = rowBot(C.ROWS - 1) + V.r * 0.2, kv = (y1 - y0) / m.h;
      const u0 = 0.2, u1 = 0.86, x0 = xm - (0.40 - u0) * m.w * k, wpx = (u1 - u0) * m.w;
      STRIP_PARTS.forEach(([a, c, key], i) => {
        const st = stripState(key), sx = st * m.w + u0 * m.w;
        let sy = m.above + a * m.h, sh = (c - a) * m.h, dy = y0 + a * m.h * kv;
        g.drawImage(im, sx, sy, wpx, sh, x0, dy, wpx * k, sh * kv + 0.5);
        if (i === 0) {
          // what rises above the far edge (tower top, smoke, the block's far rim) fades into the horizon: no hard edge
          const ah = m.above * kv, c = stripFade || (stripFade = document.createElement('canvas'));
          c.width = Math.ceil(wpx * k); c.height = Math.ceil(ah); const cx = c.getContext('2d');
          cx.drawImage(im, sx, sy - m.above, wpx, m.above, 0, 0, c.width, c.height);
          cx.globalCompositeOperation = 'destination-in';
          const gr = cx.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
          cx.fillStyle = gr; cx.fillRect(0, 0, c.width, c.height);
          g.drawImage(c, x0, dy - ah);
        }
      });
    }
    function keepFoot() { return { x: center(C.COLS - 4, 0).x + V.r * 0.4, y: rowTop(0) - V.r * 0.05 }; }
    // siege gun at the attackers' edge: rests on its first frame, plays the firing frames when it shoots
    function gunBox() { const p = center(0, C.ROWS - 3); return { x: p.x - V.r * 1.4, y: rowBot(C.ROWS - 3) + V.r * 0.2, w: V.r * 3.8 }; }
    function drawGun(now) {
      const A = gunArt; if (!A || !b.siege) return;
      const fr = A.m.fire; if (!fr || !fr.length) return;
      const t = (now - gunFireAt) / 1000, i = t >= 0 && t < 1.1 ? Math.min(fr.length - 1, Math.floor(t / 1.1 * fr.length)) : 0;
      const [ax, ay, aw, ah] = fr[i], B = gunBox(), h = B.w * ah / aw;
      g.drawImage(A.im, ax, ay, aw, ah, B.x - B.w / 2, B.y - h, B.w, h);
    }
    // ---------- siege structures (drawn live, they change during battle) ----------
    function drawSiege(now) {
      const S = b.siege; if (!S) return;
      if (strip) {
        drawStrip(strip);
        // the keep stands behind the field's top edge (in the horizon band), clear of every hex
        const tw = S.towers.find(x => x.id === 'keep');
        if (tw && wallArt) {
          const P = wallArt.m.pieces[tw.hp > 0 ? 'keep' : 'keep_x'], f = keepFoot();
          if (P) { const [ax, ay, aw, ah] = P.r, w = V.r * 2.6, h = w * ah / aw; g.drawImage(wallArt.im, ax, ay, aw, ah, f.x - w / 2, f.y - h * 0.9, w, h); }
        }
        return;
      }
      if (wallArt) { drawSiegeArt(wallArt); return; }
      for (let r = 0; r < C.ROWS; r++) {
        const p = center(C.WALL_COL, r);
        const isGate = r === C.GATE_ROW;
        const hp = isGate ? S.gate : S.walls[r <= 2 ? 'top' : r <= 4 ? 'upper' : r <= 7 ? 'lower' : 'bottom'];
        const w = V.r * 1.5, h = V.r * 1.9;
        if (hp <= 0) {
          g.fillStyle = '#4a443e';
          for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(p.x + (i - 2) * V.r * 0.3, p.y + V.r * 0.3 + (i % 2) * 4, V.r * 0.25, 0, Math.PI * 2); g.fill(); }
          continue;
        }
        if (isGate) {
          g.fillStyle = '#5a5650'; g.fillRect(p.x - w / 2, p.y - h * 0.75, w, h);
          g.fillStyle = hp >= 2 ? '#5a3a22' : '#3e2818';
          g.beginPath(); g.moveTo(p.x - w * 0.32, p.y + h * 0.25); g.lineTo(p.x - w * 0.32, p.y - h * 0.25); g.arc(p.x, p.y - h * 0.25, w * 0.32, Math.PI, 0); g.lineTo(p.x + w * 0.32, p.y + h * 0.25); g.fill();
          g.strokeStyle = '#2a2622'; g.lineWidth = 2;
          for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(p.x + i * w * 0.15, p.y - h * 0.45); g.lineTo(p.x + i * w * 0.15, p.y + h * 0.25); g.stroke(); }
        } else {
          const grd = g.createLinearGradient(p.x - w / 2, 0, p.x + w / 2, 0);
          grd.addColorStop(0, '#6e6a62'); grd.addColorStop(1, '#4e4a44');
          g.fillStyle = grd; g.fillRect(p.x - w / 2, p.y - h * 0.75, w, h);
          g.fillStyle = '#7e7a70';
          for (let i = 0; i < 3; i++) g.fillRect(p.x - w / 2 + i * w / 3 + 1, p.y - h * 0.75 - V.r * 0.25, w / 3 - 3, V.r * 0.25);
          g.strokeStyle = 'rgba(30,26,22,0.6)'; g.lineWidth = 1;
          for (let yy = 0; yy < 4; yy++) { g.beginPath(); g.moveTo(p.x - w / 2, p.y - h * 0.75 + yy * h / 4); g.lineTo(p.x + w / 2, p.y - h * 0.75 + yy * h / 4); g.stroke(); }
          if (hp === 1) { g.strokeStyle = '#1a1612'; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x - w * 0.2, p.y - h * 0.6); g.lineTo(p.x + w * 0.05, p.y - h * 0.2); g.lineTo(p.x - w * 0.1, p.y + h * 0.1); g.stroke(); }
        }
      }
      for (const tw of S.towers) {
        const pos = tw.id === 'keep' ? center(C.COLS - 1, C.GATE_ROW) : tw.id === 'north' ? center(C.WALL_COL, 0) : center(C.WALL_COL, C.ROWS - 1);
        const x = tw.id === 'keep' ? pos.x + V.r * 1.1 : pos.x + V.r * 0.2, y = tw.id === 'north' ? pos.y - V.r * 0.4 : pos.y;
        const w = V.r * (tw.id === 'keep' ? 1.5 : 1.1), h = V.r * (tw.id === 'keep' ? 3.2 : 2.5);
        g.globalAlpha = tw.hp > 0 ? 1 : 0.45;
        g.fillStyle = '#5e5a54'; g.fillRect(x - w / 2, y - h, w, h);
        g.fillStyle = '#3a2f28'; g.beginPath(); g.moveTo(x - w * 0.65, y - h); g.lineTo(x, y - h - V.r * 1.1); g.lineTo(x + w * 0.65, y - h); g.fill();
        if (tw.hp > 0) { g.fillStyle = `rgba(255,200,120,${0.6 + 0.3 * Math.sin(now * 0.004)})`; g.fillRect(x - w * 0.12, y - h * 0.7, w * 0.24, h * 0.14); }
        g.globalAlpha = 1;
      }
    }

    // ---------- drawing ----------
    let last = performance.now();
    function frame(now) {
      if (V.done) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      g.clearRect(0, 0, V.w, V.h);
      V.fx.update(dt);
      const [shx, shy] = V.fx.shakeOffset();
      g.save(); g.translate(shx, shy);
      if (V.bg) g.drawImage(V.bg, -8, -8, V.w + 16, V.h + 16);
      const act = b.stacks[b.active];
      const humanTurn = act && act.side === humanSide && !V.auto && V.pending;
      if (humanTurn && V.reach && !V.spell) {
        g.fillStyle = 'rgba(230,200,120,0.12)';
        for (const k of V.reach.dist.keys()) { hexPath(g, k % C.COLS, Math.floor(k / C.COLS), 1.5); g.fill(); }
      }
      const it = V.intent;
      if (humanTurn && it) {
        g.fillStyle = 'rgba(240,210,130,0.35)';
        if ((it.type === 'move' || it.type === 'melee' || it.type === 'batter') && act) for (const [c, r] of C.cells(act, it.c, it.r)) { hexPath(g, c, r, 1.5); g.fill(); }
        if (it.type === 'spell' && it.hex) {
          g.fillStyle = 'rgba(255,140,60,0.28)';
          for (const [c, r] of C.areaHexes(it.hex.c, it.hex.r)) { hexPath(g, c, r, 1.5); g.fill(); }
        }
        if (it.target && (it.type === 'melee' || it.type === 'shoot' || it.type === 'spell')) {
          g.strokeStyle = it.type === 'spell' ? '#9fd0ff' : '#ff6a50'; g.lineWidth = 3;
          for (const [c, r] of C.cells(it.target)) { hexPath(g, c, r, 2); g.stroke(); }
        }
        if (it.type === 'batter') { g.strokeStyle = '#ff6a50'; g.lineWidth = 3; hexPath(g, C.WALL_COL, C.GATE_ROW, 2); g.stroke(); }
      }
      if (act && !b.over) {
        g.strokeStyle = '#f0cf72'; g.lineWidth = 2.5; g.shadowColor = '#f0cf72'; g.shadowBlur = 8;
        for (const [c, r] of C.cells(act)) { hexPath(g, c, r, 2); g.stroke(); }
        g.shadowBlur = 0;
      }
      drawSiege(now);
      drawGun(now);
      drawCommanders(now);
      // stacks summoned mid-battle get their display state here; rites that move obstacles redraw the field
      for (const s of b.stacks) if (!V.disp.has(s.id)) V.disp.set(s.id, { ...vis(s), count: s.count, alpha: 0, flash: 1, lx: 0, ly: 0, rot: 0, dead: false });
      if (b.bgDirty) { b.bgDirty = false; V.bg = makeBg(window.devicePixelRatio || 1); }
      const order = b.stacks.map(s => s).sort((a, c) => V.disp.get(a.id).ny - V.disp.get(c.id).ny);
      for (const s of order) {
        const d = V.disp.get(s.id);
        if (d.dead) d.alpha = Math.max(0, d.alpha - dt * 1.6);
        if (d.alpha <= 0) continue;
        d.flash = Math.max(0, d.flash - dt * 3);
        const p = px(d); const x = p.x + d.lx * V.r, y = p.y + d.ly * V.r;
        // units face the enemy side by default and turn towards where they move or strike
        const size = V.r * (s.big ? 2.25 : 1.75), face = d.face || (s.side === 0 ? 1 : -1);
        g.globalAlpha = d.alpha;
        if (d.flash > 0) g.filter = `brightness(${1 + d.flash * 1.6})`;
        const an = s.u.look.anim;
        const pose = d.pose && !d.dead ? { ...d.pose, t: (now - d.pose.t0) * d.pose.rate }
          : an && an.idle ? { name: an.idle, t: 0, seq: [0] } : null;
        if (d.rot) {
          g.save(); g.translate(x, y + V.r * 0.5); g.rotate(d.rot);
          drawUnit(g, s.type, 0, 0, size, face, now + s.id * 400, pose);
          g.restore();
        } else drawUnit(g, s.type, x, y + V.r * 0.5, size, face, now + s.id * 400, pose);
        g.filter = 'none';
        if (d.count > 0) {
          const bx = x + (s.side === 0 ? 0.35 : -1.25) * V.r + (s.big ? face * V.r * 0.5 : 0), by = y + V.r * 0.42;
          const txt = String(d.count); g.font = `600 ${Math.max(10, V.r * 0.52)}px "Barlow Condensed", sans-serif`;
          const w = Math.max(V.r * 0.9, g.measureText(txt).width + 8);
          const bh = V.r * 0.62, [c1, c2, glow] = badgeColors(s);
          const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
          g.save(); g.shadowColor = glow; g.shadowBlur = glow ? 7 : 0;
          g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(bx, by, w, bh, 3) : g.rect(bx, by, w, bh); g.fill(); g.restore();
          // a thin edge in the army's colour keeps the two sides apart; a soft highlight across the top
          g.strokeStyle = colors[s.side]; g.lineWidth = 1.5; g.beginPath(); g.roundRect ? g.roundRect(bx, by, w, bh, 3) : g.rect(bx, by, w, bh); g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(bx + 2, by + 1.5, w - 4, bh * 0.32);
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 2; g.fillText(txt, bx + w / 2, by + V.r * 0.33); g.shadowBlur = 0;
          if (s.defending) { g.fillStyle = '#e8dfcf'; g.fillRect(bx - 6, by + 2, 4, V.r * 0.5); }
        }
        g.globalAlpha = 1;
      }
      V.fx.draw(g, px, V.r, now);
      // rite animations: lingering auras on stacks whose rite is still active, then one-shots and flights
      for (const s of b.stacks) {
        if (s.count <= 0) continue;
        const bf = s.buffs.find(x => x.sp && RITE_FX[x.sp] && RITE_FX[x.sp].aura); if (!bf) continue;
        const d = V.disp.get(s.id), id = RITE_FX[bf.sp].aura, pt = fxPoint(d, id);
        drawFx(g, id, pt.x, pt.y, V.r, ((now / 1000 * 18) + s.id * 7) % 25, 0.38 * d.alpha, 0, s.big ? 1.3 : 1);
      }
      for (const f of V.rfx) {
        const k = (now - f.t0) / f.dur; if (k < 0) continue;
        if (f.from) {   // flying: looping frames, moving along the line
          const kk = Math.min(1, k), x = f.from.x + (f.to.x - f.from.x) * kk, y = f.from.y + (f.to.y - f.from.y) * kk;
          drawFx(g, f.id, x, y, V.r, (now / 1000 * 30) % 25, 1, f.angle);
        } else { const pt = f.d ? fxPoint(f.d, f.id) : fxAt(f.at, f.id); drawFx(g, f.id, pt.x, pt.y, V.r, k * 25, 1, 0, f.mul || 1); }
      }
      V.rfx = V.rfx.filter(f => now - f.t0 < f.dur);
      for (const bm of V.beams) {
        const t = (now - bm.t0) / bm.dur; const p = px(bm.at);
        g.fillStyle = `rgba(255,240,190,${0.8 * (1 - t)})`;
        g.fillRect(p.x - V.r * 0.25 * (1 - t), 0, V.r * 0.5 * (1 - t), p.y);
      }
      V.beams = V.beams.filter(bm => now - bm.t0 < bm.dur);
      for (const f of V.floats) {
        const t = (now - f.t0) / 1100; const p = px(f.at);
        g.globalAlpha = Math.max(0, 1 - t);
        g.font = `700 ${Math.max(12, V.r * (f.big ? 0.62 : 0.5))}px "Barlow Condensed", sans-serif`;
        g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)';
        const y = p.y - V.r * (1.6 + t * 1.2) + f.off;
        g.strokeText(f.text, p.x, y); g.fillStyle = f.color; g.fillText(f.text, p.x, y);
        g.globalAlpha = 1;
      }
      V.floats = V.floats.filter(f => now - f.t0 < 1100);
      g.restore();
    }

    // ---------- animation helpers ----------
    function tween(d, to, ms, keys = ['nx', 'ny']) {
      return new Promise(res => {
        const from = keys.map(k => d[k]); const t0 = performance.now();
        const step = now => {
          const t = Math.min(1, (now - t0) / ms); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          keys.forEach((k, i) => { d[k] = from[i] + (to[k] - from[i]) * e; });
          if (t < 1 && !V.done) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }
    function addFloat(d, text, color, big = false, off = 0) { V.floats.push({ at: { nx: d.nx, ny: d.ny }, text, color, t0: performance.now(), big, off }); }
    const body = d => ({ nx: d.nx + d.lx, ny: d.ny + d.ly - 0.35 });
    const gateAt = () => ({ ...norm(C.WALL_COL, C.GATE_ROW), ny: norm(C.WALL_COL, C.GATE_ROW).ny - 0.3 });
    function siegeTargetPos(t) {
      if (t.kind === 'gate') return gateAt();
      if (t.kind === 'wall') { const r = { top: 1, upper: 3, lower: 7, bottom: 9 }[t.sec]; const n = norm(C.WALL_COL, r); return { nx: n.nx, ny: n.ny - 0.4 }; }
      if (t.id === 'keep' && strip) { const f = keepFoot(); return { nx: (f.x - V.ox) / V.r, ny: (f.y - V.oy) / V.r - 1.2 }; }
      const n = t.id === 'keep' ? norm(C.COLS - 1, C.GATE_ROW) : t.id === 'north' ? norm(C.WALL_COL, 0) : norm(C.WALL_COL, C.ROWS - 1);
      return { nx: n.nx + (t.id === 'keep' ? 1.1 : 0.2), ny: n.ny - 1.5 };
    }
    function towerPos(id) { const t = siegeTargetPos({ kind: 'tower', id }); return { nx: t.nx, ny: t.ny - 0.6 }; }

    function landHit(ev, t, dir) {
      t.flash = 1; t.count = ev.countAfter;
      addFloat(t, `-${ev.dmg}`, '#ffb4a2', true);
      if (ev.killed) addFloat(t, `${ev.killed} slain`, '#f2e9d8', false, V.r * 0.7);
      if (ev.luck === 'good') addFloat(t, 'Lucky strike!', '#ffd76a', true, -V.r * 0.8);
      if (ev.luck === 'bad') addFloat(t, 'Unlucky', '#c8b8a8', false, -V.r * 0.8);
      t.lx = dir * 0.16; tween(t, { lx: 0 }, 220, ['lx']);
      if (ev.countAfter === 0) {
        t.dead = true; V.fx.dust(body(t), 12, true); Audio.sfx('death', 120);
        tween(t, { rot: dir * 1.25, ly: 0.15 }, 520, ['rot', 'ly']);
      }
    }
    // ---------- commanders beside the field (painted commanders only) ----------
    function drawCommanders(now) {
      for (const side of [0, 1]) {
        const h = b.sides[side].hero, look = h && HERO_DEFS[h.name]?.look; if (!look) continue;
        const castT = now - V.cmdCast[side], cm = spriteMeta(`cmd_${look}_cast`), casting = V.cmdCast[side] && cm && castT < cm.n / 20 * 1000;
        // standing still on the first frame of the casting sheet; the sheet plays only when a rite is cast
        const name = `cmd_${look}_cast`, m = spriteMeta(name), im = spriteImage(name); if (!m || !im) continue;
        const figH = Math.max(V.r * 2.4, V.band * 1.05), k = figH / (m.body0 * m.fh), w = m.fw * k, hh = m.fh * k;
        const fi = casting ? Math.min(m.n - 1, Math.floor(castT / 1000 * 20)) : 0;
        const x = side === 0 ? V.ox + V.r * 0.5 : V.w - V.ox - V.r * 0.5, y = V.oy + V.r * 0.35;
        g.save(); g.translate(x, y); if (side === 1) g.scale(-1, 1);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, V.r * 0.9, V.r * 0.25, 0, 0, Math.PI * 2); g.fill();
        g.drawImage(im, fi * m.fw, 0, m.fw, m.fh, -m.ax * w, -hh, w, hh);
        g.restore();
      }
    }

    // ---------- rite animations ----------
    // where a sheet sits on a stack: feet on the ground line, mid on the body, top above the head
    function fxPoint(d, id) {
      const mode = (FX_LOOK[id] || [0, 'mid'])[1];
      const n = mode === 'mid' ? body(d) : { nx: d.nx + d.lx, ny: d.ny + d.ly + 0.5 };
      const p = px(n); return mode === 'top' ? { x: p.x, y: p.y - V.r * 0.2 } : p;
    }
    function fxAt(n, id) { const mode = (FX_LOOK[id] || [0, 'mid'])[1]; return px(mode === 'mid' ? { nx: n.nx, ny: n.ny - 0.3 } : { nx: n.nx, ny: n.ny + 0.45 }); }
    function playFx(id, where, dur, mul = 1) { V.rfx.push({ id, ...where, t0: performance.now(), dur, mul }); }
    function fly(id, from, to, dur, angle = Math.atan2(to.y - from.y, to.x - from.x)) {
      V.rfx.push({ id, from, to, angle, t0: performance.now(), dur }); return sleep(dur);
    }
    async function riteCastFx(ev, S, F, t, fast) {
      const mine = s => s.count > 0 && s.side === ev.side, theirs = s => s.count > 0 && s.side !== ev.side;
      const many = S.kind === 'mass_buff' || S.kind === 'mass_heal' ? b.stacks.filter(mine) : S.kind === 'mass_debuff' ? b.stacks.filter(theirs) : null;
      if (F.proj && t) {   // from the caster's edge of the field to the target
        const to = fxPoint(t, F.proj), from = { x: ev.side === 0 ? V.ox + V.r * 0.5 : V.w - V.ox - V.r * 0.5, y: to.y - V.r * 1.2 };
        Audio.sfx('spell_' + S.school);
        await fly(F.proj, from, to, Math.max(260, Math.hypot(to.x - from.x, to.y - from.y) / (V.r * 22) * 1000) * fast);
        return;
      }
      if (F.on) {
        const list = many ? many.map(s => V.disp.get(s.id)) : t ? [t] : [];
        for (const d of list) playFx(F.on, { d }, 1100 * fast);
        await sleep(list.length ? 700 * fast : 100);
        return;
      }
      if (F.at && ev.at) {
        const n = norm(ev.at.c, ev.at.r); playFx(F.at, { at: n }, (F.at === 'barrier' ? 1000 : 850) * fast);
        if (F.at === 'explosion' || F.at === 'debris') V.fx.addShake(8);
        await sleep((F.at === 'barrier' ? 700 : 420) * fast);
        return;
      }
      if (F.gate) { playFx(F.gate, { at: gateAt() }, 900 * fast, 1.2); V.fx.addShake(9); await sleep(600 * fast); return; }
      await sleep(160 * fast);
    }
    async function animateStrike(ev, fast) {
      const t = V.disp.get(ev.target), tS = b.stacks[ev.target];
      if (ev.spell) {
        const S = SPELLS[ev.spell], hit = body(t), dirS = tS.side === 0 ? -1 : 1;
        Audio.sfx('spell_' + S.school);
        const F = RITE_FX[ev.spell];
        if (F && (F.hit || F.fall)) {
          if (F.fall) { const to = fxPoint(t, F.fall); await fly(F.fall, { x: to.x - V.r * 2.6, y: to.y - V.r * 4.2 }, to, 380 * fast, 0); }
          if (F.hit) playFx(F.hit, { d: t }, 800 * fast);
          if (S.school !== 'water') V.fx.addShake(F.hit === 'explosion' || F.hit === 'pillar' || F.hit === 'beam' ? 7 : 4);
          await sleep(160 * fast);
          landHit(ev, t, dirS);
          await sleep(220 * fast);
          return;
        }
        if (S.school === 'fire') { V.fx.explosion(hit); }
        else if (S.school === 'water') { V.fx.burst(hit, { n: 22, colors: ['#e0f6ff', '#9fdcff', '#5ab0ff'], speed: 3, life: 0.5, size: 0.06, grav: 3, kind: 'spark' }); V.fx.add('star', { at: hit, color: '#bfe8ff', size: 0.9 }, 220); }
        else if (S.school === 'air') { V.beams.push({ at: { nx: t.nx, ny: t.ny }, t0: performance.now(), dur: 420 }); await sleep(140 * fast); V.fx.add('flash', { at: hit, color: '#fff6c0' }, 220); V.fx.sparks(hit, ['#ffffff', '#fff2a0', '#a0d8ff'], 18); V.fx.addShake(5); }
        else { V.fx.add('ring', { at: { nx: hit.nx, ny: hit.ny + 0.4 }, color: '#c8b080' }, 380); V.fx.dust(hit, 14, true); V.fx.addShake(5); }
        landHit(ev, t, dirS);
        await sleep(220 * fast);
        return;
      }
      const a = V.disp.get(ev.id), aS = b.stacks[ev.id];
      const dir = Math.sign(t.nx - a.nx) || (aS.side === 0 ? 1 : -1);
      const heavy = aS.u.tier >= 4 || aS.count * aS.u.hp > 600;
      a.face = dir;
      if (ev.ranged) {
        const style = styleOf(aS.type, true);
        let muzzle = { nx: a.nx + dir * (aS.big ? 1.1 : 0.75), ny: a.ny - 0.45 }, hit = body(t);
        const look = aS.u.look, shootMs = animDuration(look, 'shoot');
        if (shootMs) {
          // frame-animated shooter: play the shoot strip and fire on its muzzle-flash frame
          const size = V.r * (aS.big ? 2.25 : 1.75), mz = animMuzzle(aS.type, size, dir);
          if (mz) muzzle = { nx: a.nx + mz.dx / V.r, ny: a.ny + 0.5 + mz.dy / V.r };
          a.pose = { name: 'shoot', t0: performance.now(), rate: 1 / fast };
          await sleep(animFireTime(look) * fast);
          setTimeout(() => { if (a.pose && a.pose.name === 'shoot') a.pose = null; }, (shootMs - animFireTime(look)) * fast);
        } else tween(a, { lx: -dir * 0.1 }, 60 * fast, ['lx']).then(() => tween(a, { lx: 0 }, 160 * fast, ['lx']));
        Audio.sfx(Audio.has(style) ? style : 'bullet');
        if (style === 'hellfire') {
          V.fx.add('muzzle', { at: muzzle, dir, color: '#ffb040' }, 180);
          V.fx.burst(muzzle, { n: 10, colors: ['#ffdf70', '#ff8a30', '#d03a10'], speed: 1.4, life: 0.4, size: 0.08, grav: -2, drag: 2, kind: 'flame', grow: 0.1, jitter: 0.1 });
          V.fx.add('shell', { from: muzzle, to: hit }, 320 * fast);
          await sleep(320 * fast);
          V.fx.explosion(hit); V.fx.impact('fire', hit, dir, true);
        } else if (style === 'las') {
          V.fx.add('muzzle', { at: muzzle, dir, color: '#bff2ff' }, 120);
          V.fx.add('beam', { from: muzzle, to: hit, color: '#7fe0ff' }, 240);
          await sleep(90 * fast);
          V.fx.sparks(hit, ['#e8fbff', '#7fe0ff', '#3fb0ff'], 14);
        } else if (style === 'cannon') {
          V.fx.add('muzzle', { at: muzzle, dir, color: '#ffd080' }, 160);
          V.fx.dust({ nx: a.nx + dir * 0.4, ny: a.ny - 0.4 }, 6); V.fx.addShake(3);
          V.fx.add('shell', { from: muzzle, to: hit }, 380 * fast);
          await sleep(380 * fast);
          V.fx.explosion(hit);
        } else {
          const nShots = style === 'storm' ? 8 : 3, gap = style === 'storm' ? 45 : 70;
          for (let i = 0; i < nShots; i++) {
            V.fx.add('muzzle', { at: muzzle, dir, color: '#ffe08a', delay: i * gap * fast }, 80);
            V.fx.add('tracer', { from: muzzle, to: { nx: hit.nx + (Math.random() - 0.5) * 0.25, ny: hit.ny + (Math.random() - 0.5) * 0.25 }, color: '#ffd060', delay: i * gap * fast }, 150 * fast);
          }
          await sleep((nShots * gap * 0.6 + 100) * fast);
          V.fx.sparks(hit, ['#fff0b0', '#ffc050'], style === 'storm' ? 22 : 10);
        }
        landHit(ev, t, dir);
      } else {
        const style = styleOf(aS.type, false);
        const atkMs = animDuration(aS.u.look, 'attack');
        if (atkMs) { // frame-animated melee: play the attack strip and land the blow on its impact frame
          const hitMs = animHitTime(aS.u.look);
          a.pose = { name: 'attack', t0: performance.now(), rate: 1 / fast };
          await sleep(hitMs * fast);
          V.fx.impact(style, body(t), dir, heavy); Audio.sfx(Audio.has(style) ? style : 'hit');
          landHit(ev, t, dir);
          await sleep((atkMs - hitMs) * fast);
          a.pose = null; a.face = 0;
          if (ev.selfCount != null) a.count = ev.selfCount;
          await sleep(120 * fast);
          return;
        }
        const dx = t.nx - a.nx, dy = t.ny - a.ny, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        await tween(a, { lx: -ux * 0.14, ly: -uy * 0.14, rot: -dir * 0.16 }, 150 * fast, ['lx', 'ly', 'rot']);
        await tween(a, { lx: ux * 0.5, ly: uy * 0.5, rot: dir * 0.2 }, 90 * fast, ['lx', 'ly', 'rot']);
        V.fx.impact(style, body(t), dir, heavy); Audio.sfx(Audio.has(style) ? style : 'hit');
        landHit(ev, t, dir);
        await sleep((style === 'smash' ? 110 : 70) * fast);
        await tween(a, { lx: 0, ly: 0, rot: 0 }, 160 * fast, ['lx', 'ly', 'rot']);
      }
      if (ev.selfCount != null) a.count = ev.selfCount;
      a.face = 0;
      await sleep(160 * fast);
    }
    async function play(evs) {
      const fast = (V.auto ? 0.5 : 1) * (opts.speed || 1);
      for (const ev of evs || []) {
        if (ev.type === 'move') {
          const s = b.stacks[ev.id], d = V.disp.get(ev.id); const pts = ev.path.map(([c, r]) => vis(s, c, r));
          const walks = (!!animDuration(s.u.look, 'walk') && !s.u.ab.includes('flyer')) || !!animDuration(s.u.look, 'move');
          const flies = !!animDuration(s.u.look, 'fly');
          const range = (a, z) => Array.from({ length: Math.abs(z - a) + 1 }, (_, i) => a + i * Math.sign(z - a));
          const playSeq = async seq => { d.pose = { name: 'fly', t0: performance.now(), rate: 1 / fast, seq }; await sleep(seq.length / animFps(s.u.look, 'fly') * 1000 * fast); };
          const turn = dx => { if (Math.abs(dx) > 0.05) d.face = Math.sign(dx); };
          turn(pts[pts.length - 1].nx - pts[0].nx);
          if (walks) d.pose = { name: animDuration(s.u.look, 'move') ? 'move' : 'walk', t0: performance.now(), rate: 1 / fast };
          if (flies) { // take off (frames 1-7), loop the flight while moving, land by playing take-off backwards
            await playSeq(range(0, 6));
            d.pose = { name: 'fly', t0: performance.now(), rate: 1 / fast, seq: range(7, 24), loop: true };
          }
          // animated walkers stride at a pace that matches their walk cycle
          const stepMs = walks ? (s.u.ab.includes('flyer') ? 140 : 260) : flies ? 150 : pts.length === 2 ? 300 : 110;
          const jet = s.u.look.jet;
          for (let i = 1; i < pts.length; i++) {
            turn(pts[i].nx - d.nx);
            if (jet) { // jump-pack exhaust trailing behind the flyer
              const at = { nx: d.nx - (d.face || 1) * 0.35, ny: d.ny - 0.2 };
              V.fx.burst(at, { n: 8, colors: ['#ffdf70', '#ff8a30', '#d03a10'], speed: 0.9, life: 0.35, size: 0.07, grav: -1, drag: 2, kind: 'flame', grow: 0.1, jitter: 0.12 });
              V.fx.burst(at, { n: 4, colors: ['#4a403a', '#5a5048', '#3a322c'], speed: 0.5, life: 0.9, size: 0.14, grav: -0.6, drag: 2, kind: 'smoke', grow: 0.3, jitter: 0.15 });
            }
            const segMs = flies ? Math.max(420, Math.hypot(pts[i].nx - pts[i - 1].nx, pts[i].ny - pts[i - 1].ny) * 75) : stepMs;
            await tween(d, pts[i], segMs * fast);
          }
          if (walks) d.pose = null;
          if (flies) { await playSeq(range(6, 0)); d.pose = null; }
          d.face = 0;
        } else if (ev.type === 'strike') {
          await animateStrike(ev, fast);
        } else if (ev.type === 'heal') {
          const t = V.disp.get(ev.target); t.count = ev.countAfter; t.dead = false; t.alpha = 1; t.rot = 0;
          if (!(V.curSpell && RITE_FX[V.curSpell])) V.fx.burst(body(t), { n: 16, colors: ['#c8ffb0', '#8ff0a0', '#ffffff'], speed: 1.2, life: 0.8, size: 0.06, grav: -2, kind: 'dot', jitter: 0.3 });
          addFloat(t, 'Restored', '#a8f0a0', true); await sleep(200 * fast);
        } else if (ev.type === 'spell') {
          const S = SPELLS[ev.spell];
          if (S.kind.includes('buff')) Audio.sfx(S.kind === 'debuff' ? 'debuff' : 'buff');
          const t = ev.target >= 0 ? V.disp.get(ev.target) : null;
          const at = t ? t : ev.at ? norm(ev.at.c, ev.at.r) : { nx: S3 * 7.5, ny: 8 };
          addFloat(at, S.name, '#cfe3ff', false, -V.r * 0.7);
          if (S.kind.includes('buff')) {
            const targets = S.kind === 'mass_buff' ? b.stacks.filter(s => s.side === ev.side && s.count > 0).map(s => V.disp.get(s.id)) : S.kind === 'mass_debuff' ? b.stacks.filter(s => s.side !== ev.side && s.count > 0).map(s => V.disp.get(s.id)) : S.kind === 'mass_buff' ? b.stacks.filter(s => s.side === ev.side && s.count > 0).map(s => V.disp.get(s.id)) : t ? [t] : [];
            for (const d of targets) V.fx.add('ring', { at: { nx: d.nx, ny: d.ny + 0.45 }, color: S.kind === 'debuff' ? '#e07050' : '#9fd0ff' }, 500);
          }
          if (S.kind === 'debuff' && t) V.fx.add('ring', { at: { nx: t.nx, ny: t.ny + 0.45 }, color: '#e07050' }, 500);
          V.curSpell = ev.spell;
          // a painted commander performs the rite before its effect lands
          const hc = b.sides[ev.side].hero;
          if (hc && HERO_DEFS[hc.name]?.look) { V.cmdCast[ev.side] = performance.now(); await sleep(520 * fast); }
          const F = RITE_FX[ev.spell];
          if (F) await riteCastFx(ev, S, F, t, fast);
          else { if ((S.kind === 'area' || S.kind === 'ring') && ev.at) { const p = norm(ev.at.c, ev.at.r); V.fx.explosion({ nx: p.nx, ny: p.ny - 0.3 }); } await sleep(220 * fast); }
        } else if (ev.type === 'morale') {
          const d = V.disp.get(ev.id);
          if (ev.good) { addFloat(d, 'High morale!', '#ffe08a', true, -V.r * 0.4); V.fx.burst(body(d), { n: 14, colors: ['#ffe08a', '#fff6d0'], speed: 1.5, life: 0.8, size: 0.05, grav: -2.5, jitter: 0.25 }); }
          else { addFloat(d, 'Low morale', '#9fb8d8', true, -V.r * 0.4); d.flash = 0.4; }
          await sleep(420 * fast);
        } else if (ev.type === 'catapult') {
          const to = siegeTargetPos(ev.target);
          let from = { nx: -0.5, ny: 4 + Math.random() * 8 };
          if (gunArt) {
            gunFireAt = performance.now(); await sleep(260 * fast);
            const B = gunBox(); from = { nx: (B.x + B.w * 0.45 - V.ox) / V.r, ny: (B.y - B.w * 0.32 - V.oy) / V.r };
            V.fx.add('muzzle', { at: from, dir: 1, color: '#ffd080' }, 160);
          }
          V.fx.add('shell', { from, to }, 420 * fast);
          await sleep(420 * fast);
          if (ev.hit) { V.fx.explosion(to); if (ev.destroyed) V.fx.dust(to, 20, true); }
          else V.fx.dust({ nx: to.nx - 0.8, ny: to.ny + 0.6 }, 8);
          await sleep(200 * fast);
        } else if (ev.type === 'tower') {
          const t = V.disp.get(ev.target), from = towerPos(ev.tower);
          V.fx.add('muzzle', { at: from, dir: -1, color: '#ffd080' }, 140);
          V.fx.add('tracer', { from, to: body(t), color: '#ffcf70' }, 200 * fast);
          await sleep(200 * fast);
          V.fx.sparks(body(t), ['#fff0b0', '#ffc050'], 12);
          landHit(ev, t, -1);
          await sleep(220 * fast);
        } else if (ev.type === 'batter') {
          const a = V.disp.get(ev.id), gp = gateAt();
          const dx = gp.nx - a.nx, dy = gp.ny - a.ny, len = Math.hypot(dx, dy) || 1;
          await tween(a, { lx: -dx / len * 0.12, ly: 0 }, 140 * fast, ['lx', 'ly']);
          await tween(a, { lx: dx / len * 0.45, ly: dy / len * 0.3 }, 90 * fast, ['lx', 'ly']);
          V.fx.impact('smash', gp, 1, true);
          if (ev.destroyed) { V.fx.explosion(gp); addFloat(gp, 'Gate destroyed!', '#ffd76a', true); }
          await tween(a, { lx: 0, ly: 0 }, 160 * fast, ['lx', 'ly']);
        } else if (ev.type === 'summon') {
          const s = b.stacks[ev.id]; if (!V.disp.has(s.id)) V.disp.set(s.id, { ...vis(s), count: s.count, alpha: 0, flash: 1, lx: 0, ly: 0, rot: 0, dead: false });
          const d = V.disp.get(s.id); V.fx.add('ring', { at: { nx: d.nx, ny: d.ny + 0.45 }, color: '#b4ff98' }, 700);
          const SF = V.curSpell && RITE_FX[V.curSpell]; if (SF && SF.summon) { playFx(SF.summon, { d }, 1500 * fast, s.big ? 1.15 : 1); await sleep(650 * fast); }
          addFloat(d, `${s.u.name} arrive`, '#b4ff98', true); await tween(d, { alpha: 1 }, 400 * fast, ['alpha']);
        } else if (ev.type === 'defend') { addFloat(V.disp.get(ev.id), 'Defend', '#e8dfcf'); await sleep(160 * fast); }
        else if (ev.type === 'wait') { addFloat(V.disp.get(ev.id), 'Wait', '#e8dfcf'); await sleep(120 * fast); }
      }
      for (const s of b.stacks) {
        const d = V.disp.get(s.id); const n = vis(s);
        d.nx = n.nx; d.ny = n.ny; d.count = s.count; d.lx = 0; d.ly = 0;
        if (s.count <= 0) d.dead = true; else { d.dead = false; d.alpha = 1; d.rot = 0; }
      }
      hud();
    }

    // ---------- input ----------
    function hexAt(mx, my) {
      let best = null, bd = Infinity;
      for (let r = 0; r < C.ROWS; r++) for (let c = 0; c < C.COLS; c++) {
        const p = center(c, r); const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < bd) { bd = d; best = { c, r }; }
      }
      return bd <= V.r * V.r ? best : null;
    }
    function nearestSpot(act, spots, mx, my) {
      let best = null, bd = Infinity;
      for (const [c, r] of spots) { const p = px(vis(act, c, r)); const d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < bd) { bd = d; best = { c, r }; } }
      return best;
    }
    function computeIntent() {
      const act = b.stacks[b.active];
      if (!V.mouse || !act || !V.pending) return null;
      const { x: mx, y: my } = V.mouse; const hx = hexAt(mx, my);
      if (!hx) return null;
      const tgt = C.stackAt(b, hx.c, hx.r);
      if (V.spell) {
        const S = SPELLS[V.spell];
        if (S.target === 'any') return C.validSpellTarget(b, humanSide, V.spell, null, hx) ? { type: 'spell', hex: hx, target: null } : { type: 'none', target: tgt };
        return C.validSpellTarget(b, humanSide, V.spell, tgt) ? { type: 'spell', target: tgt } : { type: 'none', target: tgt };
      }
      if (tgt && tgt.side !== act.side) {
        if (C.canShoot(b, act)) return { type: 'shoot', target: tgt, range: C.damageRange(b, act, tgt, true), half: C.stackDist(act, tgt) > 10 };
        const spot = nearestSpot(act, C.meleeSpots(b, act, tgt, V.reach), mx, my);
        if (spot) return { type: 'melee', target: tgt, c: spot.c, r: spot.r, range: C.damageRange(b, act, tgt, false) };
        return { type: 'none', target: tgt, msg: 'Out of reach' };
      }
      if (b.siege && hx.c === C.WALL_COL && hx.r === C.GATE_ROW && b.siege.gate > 0 && act.side === 0 && !act.u.ab.includes('flyer')) {
        const spot = nearestSpot(act, C.gateSpots(b, act, V.reach), mx, my);
        return spot ? { type: 'batter', c: spot.c, r: spot.r } : { type: 'none', msg: 'Get next to the gate to batter it' };
      }
      if (!tgt && V.reach.dist.has(C.hk(hx.c, hx.r)) && !(hx.c === act.c && hx.r === act.r)) return { type: 'move', c: hx.c, r: hx.r };
      return { type: 'none', target: tgt };
    }
    function local(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onMove(e) { V.mouse = local(e); V.intent = computeIntent(); hud(); showInfo(V.intent?.target); }
    function onClick(e) {
      V.mouse = local(e); V.intent = computeIntent();
      const it = V.intent; const act = b.stacks[b.active];
      if (!it || !V.pending || !act) return;
      let ev = null;
      if (it.type === 'move') ev = C.actMove(b, act, it.c, it.r);
      else if (it.type === 'melee') ev = C.actMelee(b, act, it.target, it.c, it.r);
      else if (it.type === 'shoot') ev = C.actShoot(b, act, it.target);
      else if (it.type === 'batter') ev = C.actBatter(b, act, it.c, it.r);
      else if (it.type === 'spell') { ev = C.actCast(b, humanSide, V.spell, it.target, it.hex); V.spell = null; }
      if (ev) submit(ev);
    }
    function submit(ev) { const p = V.pending; V.pending = null; V.intent = null; V.retreatArm = false; p(ev); }
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('click', onClick);
    cv.addEventListener('pointerleave', () => { V.mouse = null; V.intent = null; showInfo(null); hud(); });

    const btn = id => $(id);
    const onKey = e => {
      if (V.done) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (V.spell) { V.spell = null; hud(); } $('#cb-spells').hidden = true; }
      else if (k === 'w') btn('#cb-wait').click();
      else if (k === 'd') btn('#cb-defend').click();
      else if (k === 'a') btn('#cb-auto').click();
      else if (k === 's') btn('#cb-spell').click();
    };
    document.addEventListener('keydown', onKey);

    btn('#cb-wait').onclick = () => { const a = b.stacks[b.active]; if (V.pending && a) { const ev = C.actWait(b, a); if (ev) submit(ev); } };
    btn('#cb-defend').onclick = () => { const a = b.stacks[b.active]; if (V.pending && a) { const ev = C.actDefend(b, a); if (ev) submit(ev); } };
    btn('#cb-auto').onclick = () => { V.auto = !V.auto; if (V.auto && V.pending) submit([]); hud(); };
    btn('#cb-retreat').onclick = () => {
      if (!V.pending || !b.sides[humanSide].hero) return;
      if (!V.retreatArm) { V.retreatArm = true; hud(); return; }
      C.actRetreat(b, humanSide); submit([]);
    };
    btn('#cb-spell').onclick = () => {
      const h = b.sides[humanSide].hero;
      if (!V.pending || !h || !C.canCast(b, humanSide) || document.querySelector('.term-rites')) return;
      const list = h.spells.filter(sp => SPELLS[sp].kind !== 'adventure');
      openRites({
        hero: h, spells: list, cost: sp => riteCost(h, sp), castLabel: 'INVOKE',
        usable: sp => (C.castable(h, sp) ? true : 'not enough mana'),
        onCast: sp => {
          if (!C.spellNeedsTarget(sp)) { const ev = C.actCast(b, humanSide, sp, null, null); if (ev) submit(ev); return true; }
          V.spell = sp; hud(); return true;
        },
      });
    };

    // ---------- HUD ----------
    const sign = n => (n > 0 ? `+${n}` : `${n}`);
    function sideHtml(side) {
      const sd = b.sides[side]; const h = sd.hero;
      const name = h ? h.name : (opts.names[side] || 'Defenders');
      const st = b.stacks.find(s => s.side === side);
      const ml = st ? `<span>Morale ${sign(st.morale)}</span><span>Luck ${sign(st.luck)}</span>` : '';
      const stats = h ? `<span>ATK ${hstat(h, 'atk')}</span><span>DEF ${hstat(h, 'def')}</span><span>POW ${hstat(h, 'pow')}</span><span>Mana ${h.mana}/${maxMana(h)}</span>${ml}` : `<span>No commander</span>${ml}`;
      return `<div class="cb-name" style="--side:${colors[side]}">${esc(name)}</div><div class="cb-stats">${stats}</div>`;
    }
    function hud() {
      $('#cb-left').innerHTML = sideHtml(0);
      $('#cb-right').innerHTML = sideHtml(1);
      const q = C.turnOrder(b).slice(0, 12);
      $('#cb-queue').innerHTML = q.map((s, i) => `<div class="q ${i === 0 ? 'now' : ''}" style="--side:${colors[s.side]}" title="${esc(s.u.name)}"><img src="${opts.portrait(s.type)}" alt=""><span>${s.count}</span></div>`).join('');
      const act = b.stacks[b.active]; const it = V.intent;
      let status = '';
      if (b.over) status = 'The battle is over.';
      else if (!act) status = '';
      else if (act.side !== humanSide || V.auto) status = V.auto ? 'Auto-combat is on. Press Auto to take command again.' : `${esc(act.u.name)} (${opts.names[act.side] || 'enemy'}) are acting…`;
      else if (V.spell) status = `Choose a target for <b>${SPELLS[V.spell].name}</b>. Esc cancels.`;
      else if (it && it.type === 'move') status = `Move ${esc(act.u.name)} here.`;
      else if (it && it.type === 'batter') status = `Batter the gate with ${esc(act.u.name)}.`;
      else if (it && (it.type === 'melee' || it.type === 'shoot')) {
        const [lo, hi] = it.range; const k1 = C.killsFor(it.target, lo), k2 = C.killsFor(it.target, hi);
        status = `${it.type === 'shoot' ? 'Shoot' : 'Attack'} ${esc(it.target.u.name)} · ${lo}–${hi} damage · ${k1 === k2 ? k1 : `${k1}–${k2}`} slain${it.half ? ' · long range, half damage' : ''}${it.type === 'melee' && act.u.shots ? ' · melee penalty' : ''}`;
      } else if (it && it.msg) status = it.msg;
      else status = `Your <b>${esc(act.u.name)}</b> (${act.count}) await orders. Click a lit hex to move or an enemy to attack.${b.siege ? ' Click the gate to batter it.' : ''}`;
      $('#cb-status').innerHTML = status;
      $('#cb-log').innerHTML = b.log.slice(-3).map(l => `<div>${esc(l)}</div>`).join('');
      const mine = act && act.side === humanSide && !V.auto && V.pending;
      btn('#cb-wait').disabled = !mine || act.waited;
      btn('#cb-defend').disabled = !mine;
      btn('#cb-spell').disabled = !mine || !C.canCast(b, humanSide);
      btn('#cb-retreat').disabled = !mine || !b.sides[humanSide].hero;
      btn('#cb-retreat').textContent = V.retreatArm ? 'Confirm retreat' : 'Retreat';
      btn('#cb-auto').classList.toggle('on', V.auto);
    }
    function showInfo(s) {
      const box = $('#cb-info');
      if (!s || s.count <= 0) { box.hidden = true; return; }
      const ab = s.u.ab.map(a => `<li>${ABILITIES[a]}</li>`).join('') + (s.big ? '<li>Large: occupies two hexes</li>' : '') + (s.u.shots ? `<li>Shots left: ${s.shots}</li>` : '');
      const bf = s.buffs.map(x => { const neg = x.amount < 0, num = /%|^(Attack|Defence|Speed|Morale|Luck)$/.test(x.label || ''); return `<li class="${neg ? 'debuff' : 'buff'}">${num ? `${x.amount > 0 ? '+' : ''}${x.amount} ` : ''}${esc(x.label || x.stat.toUpperCase())} (${x.rounds} rd)</li>`; }).join('') + (s.summoned ? '<li class="buff">Summoned: gone after the battle</li>' : '');
      box.innerHTML = `<div class="ci-head" style="--side:${colors[s.side]}"><img src="${opts.portrait(s.type)}" alt=""><div><b>${esc(s.u.name)}</b><span>${s.count} in stack</span></div></div>
        <dl><dt>Attack</dt><dd>${C.atkOf(b, s)}</dd><dt>Defence</dt><dd>${C.defOf(b, s)}</dd><dt>Damage</dt><dd>${s.u.min}–${s.u.max}</dd>
        <dt>Health</dt><dd>${s.top}/${s.u.hp}</dd><dt>Speed</dt><dd>${C.spd(b, s)}</dd><dt>Morale</dt><dd>${sign(s.morale)}</dd><dt>Luck</dt><dd>${sign(s.luck)}</dd></dl>${ab || bf ? `<ul>${ab}${bf}</ul>` : ''}`;
      box.hidden = false;
    }

    // ---------- main loop ----------
    async function loop() {
      if (b.q.length) await play(b.q.splice(0));
      while (!b.over) {
        const s = b.stacks[b.active]; if (!s) break;
        hud();
        if (s.side !== humanSide || V.auto) {
          await sleep((V.auto ? 120 : 340) * (opts.speed || 1));
          if (b.over) break;
          const cast = C.aiCast(b, s.side);
          if (cast) { await play(cast); if (b.over) break; }
          if (b.stacks[b.active] !== s) continue;
          await play(C.aiAct(b, s));
        } else {
          const ev = await new Promise(res => { V.pending = res; V.reach = C.reachable(b, s); V.intent = computeIntent(); hud(); });
          V.reach = null; $('#cb-spells').hidden = true;
          await play(ev);
        }
        if (b.q.length) await play(b.q.splice(0));
      }
      hud();
      await sleep(400);
      await showResult();
      V.done = true;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', layout);
      cv.removeEventListener('pointermove', onMove); cv.removeEventListener('click', onClick);
      $('#cb-info').hidden = true; $('#cb-spells').hidden = true;
      root.hidden = true;
      resolve();
    }

    function lossList(side) {
      const m = new Map();
      for (const s of b.stacks) if (s.side === side) {
        const lost = b.retreated === side ? s.start : s.start - s.count;
        if (lost > 0) m.set(s.type, (m.get(s.type) || 0) + lost);
      }
      if (!m.size) return '<p class="muted">None</p>';
      return `<ul class="losses">${[...m].map(([t, n]) => `<li><img src="${opts.portrait(t)}" alt=""><span>${n}</span><small>${esc(UNITS[t].name)}</small></li>`).join('')}</ul>`;
    }
    function showResult() {
      return new Promise(res => {
        const el = $('#cb-result');
        const won = b.winner === humanSide; const ret = b.retreated === humanSide;
        Audio.sfx(won ? 'victory' : 'defeat');
        const h = b.sides[humanSide].hero;
        const xp = b.kills[1 - humanSide];
        el.innerHTML = `<h2 class="${won ? 'win' : 'lose'}">${ret ? 'Retreat' : won ? 'Victory' : 'Defeat'}</h2>
          <p>${ret ? `${esc(h.name)} withdraws from the field. The army is lost.` : won ? 'The field is yours.' : 'Your forces have been destroyed.'}</p>
          <div class="cas"><div><h4>Your losses</h4>${lossList(humanSide)}</div><div><h4>Enemy losses</h4>${lossList(1 - humanSide)}</div></div>
          ${won && h ? `<p class="xp">${esc(h.name)} gains ${xp} experience.</p>` : ''}
          <button class="btn primary" id="cb-continue">Continue</button>`;
        el.hidden = false;
        $('#cb-continue').focus();
        $('#cb-continue').onclick = () => { el.hidden = true; res(); };
      });
    }

    window.addEventListener('resize', layout);
    requestAnimationFrame(() => { layout(); hud(); requestAnimationFrame(frame); loop(); });
  });
}
