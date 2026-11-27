// Cogitator-terminal windows: a painted frame (assets/ui/*.webp, 1376x768) with live elements laid over
// the empty slots painted on it. Positions are given in frame pixels and turned into percentages, so the
// window scales with the screen and everything stays on its painted slot.
import { SPELLS, SCHOOLS, spellDesc, hstat } from './data.js';

export const FW = 1376, FH = 768;
export const at = (x, y, w, h) => `left:${(x / FW * 100).toFixed(3)}%;top:${(y / FH * 100).toFixed(3)}%;width:${(w / FW * 100).toFixed(3)}%;height:${(h / FH * 100).toFixed(3)}%`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Opens a terminal window over the game. build(root, close) fills it; resolves with the value passed to close.
export function termWindow(frame, build) {
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'overlay term-overlay';
    wrap.innerHTML = `<div class="term term-${frame}" role="dialog" aria-modal="true"><div class="term-scan"></div></div>`;
    const root = wrap.querySelector('.term');
    (document.querySelector('#modal-root') || document.body).append(wrap);
    const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(null); });
    build(root, close);
  });
}

// Green line-art glyph for each spell school (and 'all'), drawn once into a data URL.
const glyphCache = {};
export function schoolGlyph(sc) {
  if (glyphCache[sc]) return glyphCache[sc];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.strokeStyle = '#b4ff98'; g.fillStyle = 'rgba(150,255,120,0.18)'; g.lineWidth = 3.2; g.lineJoin = g.lineCap = 'round';
  g.shadowColor = 'rgba(120,255,90,0.9)'; g.shadowBlur = 6;
  g.beginPath();
  if (sc === 'fire') { g.moveTo(32, 8); g.bezierCurveTo(46, 24, 50, 34, 46, 44); g.bezierCurveTo(42, 56, 22, 58, 18, 46); g.bezierCurveTo(14, 34, 24, 30, 26, 20); g.bezierCurveTo(30, 30, 34, 30, 32, 8); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(32, 30); g.bezierCurveTo(40, 40, 38, 50, 32, 52); g.bezierCurveTo(26, 50, 26, 42, 32, 30); }
  else if (sc === 'earth') { g.moveTo(6, 52); g.lineTo(24, 18); g.lineTo(34, 34); g.lineTo(42, 24); g.lineTo(58, 52); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(20, 26); g.lineTo(26, 32); g.lineTo(30, 28); }
  else if (sc === 'water') { g.moveTo(32, 8); g.bezierCurveTo(44, 26, 50, 34, 50, 42); g.arc(32, 42, 18, 0, Math.PI); g.bezierCurveTo(14, 34, 20, 26, 32, 8); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.arc(32, 42, 10, Math.PI * 0.6, Math.PI * 1.1); }
  else if (sc === 'air') { g.arc(30, 30, 16, Math.PI * 0.2, Math.PI * 1.75); g.stroke(); g.beginPath(); g.arc(32, 32, 8, Math.PI * 1.1, Math.PI * 2.6); g.stroke(); g.beginPath(); g.moveTo(10, 50); g.lineTo(54, 50); g.moveTo(16, 57); g.lineTo(46, 57); }
  else { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); } g.moveTo(52, 32); g.arc(32, 32, 20, 0, Math.PI * 2); }
  g.stroke();
  return (glyphCache[sc] = c.toDataURL());
}

// Painted rite icons, packed in assets/ui/rite_icons.webp (order in rite_icons.json). They are green on
// black, so they are shown with 'screen' blending and the black falls away against the terminal.
let ICONS = null;
export const riteIconsReady = fetch('assets/ui/rite_icons.json').then(r => r.json()).then(j => { ICONS = j; }).catch(() => {});
export function riteIcon(id, fallback) {
  const k = ICONS ? ICONS.ids.indexOf(id) : -1;
  if (k < 0) return `<img src="${schoolGlyph(fallback)}" alt="">`;
  const c = k % ICONS.cols, r = Math.floor(k / ICONS.cols);
  return `<i class="t-rico" style="background-size:${ICONS.cols * 100}% ${ICONS.rows * 100}%;background-position:${c / (ICONS.cols - 1) * 100}% ${r / (ICONS.rows - 1) * 100}%"></i>`;
}

// ---------------- Rites (spell window) ----------------
const TABS = ['all', 'fire', 'earth', 'water', 'air'];
const TAB_Y = [205, 281, 357, 433, 509];
const ROW_X = [279, 738], ROW_Y = [261, 346, 432, 518], ROW_W = 437, ROW_H = 73;
const SORTS = [['level', 'LVL', 'Sort by level'], ['cost', 'MANA', 'Sort by mana cost'], ['name', 'A-Z', 'Sort by name']];
const DOTS = [641, 666, 691, 716, 741];
let riteMemory = { tab: 'all', sort: 'level' };

// opts: hero, title, spells (ids), cost(sp), usable(sp) -> true or a reason string, onCast(sp) -> bool (close)
export async function openRites(opts) {
  await riteIconsReady;
  const h = opts.hero;
  return termWindow('rites', (root, close) => {
    let tab = riteMemory.tab, sort = riteMemory.sort, page = 0, sel = null, lastClick = 0;
    const list = () => {
      const l = opts.spells.filter(sp => tab === 'all' || SPELLS[sp].school === tab);
      const key = { level: sp => SPELLS[sp].level * 1000 + opts.cost(sp), cost: sp => opts.cost(sp) * 1000 + SPELLS[sp].level, name: () => 0 }[sort];
      return l.sort((a, b) => (key(a) - key(b)) || SPELLS[a].name.localeCompare(SPELLS[b].name));
    };
    const render = () => {
      const L = list(), pages = Math.max(1, Math.ceil(L.length / 8)); page = Math.min(page, pages - 1);
      const shown = L.slice(page * 8, page * 8 + 8);
      const S = sel && SPELLS[sel], why = sel ? opts.usable(sel) : null;
      root.querySelectorAll('.t-el').forEach(e => e.remove());
      const html = [];
      html.push(`<div class="t-el t-title" style="${at(500, 112, 376, 48)}" title="${esc(h.name)}">RITES<span>${h.mana} MANA</span></div>`);
      html.push(`<div class="t-el t-desc" style="${at(286, 188, 604, 52)}">${S ? `<div><b>${esc(S.name.toUpperCase())}</b> · ${SCHOOLS[S.school]} · level ${S.level} · ${opts.cost(sel)} mana</div><div class="t-sub">${esc(spellDesc(h, sel))}${why !== true && why ? ` · <em>${esc(why)}</em>` : ''}</div>` : `<div class="t-sub">${L.length ? 'SELECT A RITE. DOUBLE-CLICK TO INVOKE AT ONCE.' : 'NO RITES KNOWN IN THIS DISCIPLINE.'}</div>`}</div>`);
      SORTS.forEach(([k, lab, tip], i) => html.push(`<button class="t-el t-btn t-sort ${sort === k ? 'on' : ''}" data-sort="${k}" title="${tip}" style="${at([904, 999, 1092][i], 198, 82, 34)}">${lab}</button>`));
      TABS.forEach((k, i) => html.push(`<button class="t-el t-tab ${tab === k ? 'on' : ''}" data-tab="${k}" title="${k === 'all' ? 'All rites' : SCHOOLS[k]}" style="${at(152, TAB_Y[i], 86, 68)}">${riteIcon('tab_' + k, k)}</button>`));
      shown.forEach((sp, i) => {
        const x = ROW_X[i % 2], y = ROW_Y[i >> 1], Sx = SPELLS[sp], ok = opts.usable(sp) === true;
        html.push(`<button class="t-el t-row ${sel === sp ? 'on' : ''} ${ok ? '' : 'off'}" data-sp="${sp}" style="${at(x, y, ROW_W, ROW_H)}">
          <span class="t-ico">${riteIcon(sp, Sx.school)}<b>${Sx.level}</b></span>
          <span class="t-name ${Sx.name.length > 22 ? 'xlong' : Sx.name.length > 17 ? 'long' : ''}">${esc(Sx.name)}<small>${SCHOOLS[Sx.school]}${Sx.kind === 'adventure' ? ' · MAP RITE' : ''}</small></span>
          <span class="t-cost">${opts.cost(sp)}</span></button>`);
      });
      html.push(`<button class="t-el t-arrow" data-page="-1" style="${at(590, 628, 28, 34)}" ${page ? '' : 'disabled'}></button>`);
      html.push(`<button class="t-el t-arrow" data-page="1" style="${at(764, 628, 28, 34)}" ${page < pages - 1 ? '' : 'disabled'}></button>`);
      DOTS.forEach((x, i) => html.push(`<span class="t-el t-dot ${i === page ? 'on' : i >= pages ? 'gone' : ''}" style="${at(x - 6, 639, 12, 12)}"></span>`));
      html.push(`<button class="t-el t-btn t-go" data-go="1" style="${at(937, 620, 172, 47)}" ${sel && why === true ? '' : 'disabled'}>${opts.castLabel || 'INVOKE'}</button>`);
      html.push(`<button class="t-el t-x" data-close="1" title="Close (Esc)" style="${at(1124, 618, 48, 48)}"></button>`);
      root.insertAdjacentHTML('beforeend', html.join(''));
    };
    const cast = sp => { if (opts.usable(sp) !== true) return; if (opts.onCast(sp) !== false) close(sp); };
    root.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.tab) { tab = riteMemory.tab = t.dataset.tab; page = 0; sel = null; }
      else if (t.dataset.sort) sort = riteMemory.sort = t.dataset.sort;
      else if (t.dataset.page) page += +t.dataset.page;
      else if (t.dataset.sp) {
        // a second click on the same rite within a moment invokes it (the row is redrawn on the
        // first click, so the browser's own double-click never reaches it)
        const now = performance.now();
        if (sel === t.dataset.sp && now - lastClick < 450) return cast(sel);
        sel = t.dataset.sp; lastClick = now;
      }
      else if (t.dataset.go) return cast(sel);
      else if (t.dataset.close) return close(null);
      render();
    });
    render();
  });
}

// Battle and map both price spells the same way (artifacts can make them cheaper).
export const riteCost = (h, sp) => Math.max(1, SPELLS[sp].cost - hstat(h, 'spellCost'));
