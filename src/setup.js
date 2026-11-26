// New campaign setup screen: the painted terminal (assets/ui/setup_bg.webp, 1376x768) with live controls
// on its empty slots: six player rows (control, team, faction, commander, starting bonus), map options,
// a generated map preview, the five enemy AI ranks, Begin and Back.
import * as D from './data.js';
import { generateMap, TEMPLATES, ringTemplate, MAP_SIZES, SIZE_NAMES } from './map.js';
import { at } from './terminal.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// menu icons atlas (emblems, rank badges, crests, setup icons)
let MI = null;
export const menuIconsReady = fetch('assets/ui/menu_icons.json').then(r => r.json()).then(j => { MI = j; }).catch(() => {});
export function menuIcon(id, cls = '') {
  const k = MI ? MI.ids.indexOf(id) : -1; if (k < 0) return '';
  const c = k % MI.cols, r = Math.floor(k / MI.cols);
  return `<i class="mico ${cls}" style="background-size:${MI.cols * 100}% ${MI.rows * 100}%;background-position:${c / (MI.cols - 1) * 100}% ${r / (MI.rows - 1) * 100}%"></i>`;
}

const ROW_Y = [210, 289, 367, 446, 525, 604];
const FKEYS = Object.keys(D.FACTIONS);
const OPTS = {
  template: { label: 'Map' },
  size: { label: 'Size' },
  monsters: { label: 'Monsters', vals: [[0.6, 'Weak'], [1, 'Normal'], [1.5, 'Strong'], [2, 'Deadly']] },
  treasure: { label: 'Treasure', vals: [[0.6, 'Scarce'], [1, 'Normal'], [1.5, 'Rich']] },
  startRes: { label: 'Wealth', vals: [[0.5, 'Poor'], [1, 'Normal'], [1.75, 'Rich']] },
  terrain: { label: 'Terrain', vals: [['mixed', 'Mixed'], ['volcanic', 'Volcanic'], ['wasteland', 'Wasteland']] },
  weekEvents: { label: 'Events', vals: [[true, 'On'], [false, 'Off']] },
  seed: { label: 'Seed' },
};
const OPT_POS = [['template', 888, 163], ['size', 888, 198], ['monsters', 888, 232], ['treasure', 888, 266],
  ['startRes', 1075, 163], ['terrain', 1075, 198], ['weekEvents', 1075, 232], ['seed', 1075, 266]];
const BONUS = [['random', 'Random bonus'], ['gold', '+2,500 auramite'], ['art', 'A treasure artifact'], ['res', 'Building and rare materials']];
const SAVE_KEY = 'ashen-oath-setup-v1';

function defaults() {
  return {
    rows: [
      { open: true, human: true, ally: true, faction: 'concord', commander: 'random', bonus: 'random', name: 'You' },
      { open: true, human: false, ally: false, faction: 'random', commander: 'random', bonus: 'random' },
      ...Array.from({ length: 4 }, () => ({ open: false, human: false, ally: false, faction: 'random', commander: 'random', bonus: 'random' })),
    ],
    template: 'duel', size: 'M', monsters: 1, treasure: 1, startRes: 1, terrain: 'mixed', weekEvents: true, aiLevel: 1, seed: (Math.random() * 1e9) | 0,
  };
}

export function buildSetup(root, { heroAvatar, onBegin, onBack, toast }) {
  let st = defaults();
  try { const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (saved && saved.rows) st = { ...st, ...saved, seed: (Math.random() * 1e9) | 0 }; } catch { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch { /* ignore */ } };
  const open = () => st.rows.filter(r => r.open);
  const nPlayers = () => open().length;
  const minSize = n => (n >= 5 ? 'L' : n >= 3 ? 'M' : 'S');
  const sizes = () => Object.keys(MAP_SIZES).filter(k => MAP_SIZES[k] >= MAP_SIZES[minSize(nPlayers())]);
  const templates = () => (nPlayers() === 2 ? ['duel', 'crossroads', 'ring'] : ['ring']);
  const tplInfo = k => (k === 'ring' ? ringTemplate(nPlayers()) : TEMPLATES[k]);
  const fit = () => {
    if (!templates().includes(st.template)) st.template = templates()[0];
    if (!sizes().includes(st.size)) st.size = sizes()[0];
  };
  const commanders = r => (r.faction === 'random' ? ['random'] : ['random', ...D.FACTIONS[r.faction].heroes]);
  const takenBy = (name, me) => name !== 'random' && st.rows.some(r => r !== me && r.open && r.commander === name);
  const cycle = (list, cur, dir) => list[(list.indexOf(cur) + dir + list.length) % list.length];
  const optValue = k => (k === 'template' ? tplInfo(st.template).name : k === 'size' ? `${SIZE_NAMES[st.size]} · ${MAP_SIZES[st.size]}` : k === 'seed' ? String(st.seed) : (OPTS[k].vals.find(v => v[0] === st[k]) || OPTS[k].vals[1])[1]);
  const stepOpt = (k, dir) => {
    if (k === 'template') st.template = cycle(templates(), st.template, dir);
    else if (k === 'size') st.size = cycle(sizes(), st.size, dir);
    else if (k === 'seed') st.seed = (Math.random() * 1e9) | 0;
    else { const vals = OPTS[k].vals.map(v => v[0]); st[k] = cycle(vals, st[k], dir); }
  };
  const step = (r, what, dir) => {
    if (what === 'faction') { r.faction = cycle(['random', ...FKEYS], r.faction, dir); r.commander = 'random'; }
    if (what === 'commander') { const list = commanders(r); let c = r.commander; for (let k = 0; k < list.length; k++) { c = cycle(list, c, dir); if (!takenBy(c, r)) break; } r.commander = c; }
    if (what === 'bonus') r.bonus = cycle(BONUS.map(b => b[0]), r.bonus, dir);
  };
  const enemies = () => open().filter(r => !r.human && !r.ally).length;

  // ---- map preview (regenerated a moment after the options change) ----
  let pvTimer = 0;
  function preview() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => {
      const cv = root.querySelector('#su-preview'); if (!cv) return;
      const rows = st.rows.map((r, i) => ({ ...r, i })).filter(r => r.open);
      let m;
      try { m = generateMap(st.seed, { template: st.template, size: st.size, players: rows.length, monsters: st.monsters, treasure: st.treasure, terrain: st.terrain, homeGround: rows.map(r => ({ concord: 0, hollow: 6, rustbound: 7, scrapjaw: 1, deathless: 3 }[r.faction] ?? 0)) }); } catch { return; }
      const g = cv.getContext('2d'), W = cv.width, H = cv.height, k = Math.min(W, H) / m.W, ox = (W - m.W * k) / 2, oy = (H - m.H * k) / 2;
      g.clearRect(0, 0, W, H);
      const ROCK = ['#4a3c32', '#3c4a2c', '#5a2414', '#26242a', '#2c3a22'];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const T = m.tiles[y * m.W + x];
        g.fillStyle = T.road ? '#a4a6aa' : T.river ? '#58c070' : T.t === 4 ? ROCK[T.b || 0] : D.TERRAIN[T.t].base;
        g.fillRect(ox + x * k, oy + y * k, k + 0.5, k + 0.5);
      }
      for (const o of m.objects) if (o.type === 'mine' || o.type === 'site') { g.fillStyle = o.type === 'mine' ? '#e0b84a' : '#7ab8ff'; g.fillRect(ox + (o.x + 0.25) * k, oy + (o.y + 0.25) * k, Math.max(2, k * 0.6), Math.max(2, k * 0.6)); }
      m.towns.forEach(t => {
        const c = t.owner == null ? '#b8b0a0' : D.PLAYER_COLORS[rows[t.owner].i];
        const s = Math.max(6, k * 2); g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 1.5;
        g.fillRect(ox + (t.x + 0.5) * k - s / 2, oy + (t.y + 0.5) * k - s / 2, s, s); g.strokeRect(ox + (t.x + 0.5) * k - s / 2, oy + (t.y + 0.5) * k - s / 2, s, s);
      });
    }, 120);
  }

  function render() {
    fit();
    const h = [];
    h.push(`<div class="su-el su-title" style="${at(490, 103, 390, 40)}">NEW CAMPAIGN</div>`);
    [['PLAYER', 180, 290], ['LORD', 486, 34], ['SIDE', 521, 36], ['FACTION', 596, 63], ['LEADER', 667, 63], ['BONUS', 746, 63]].forEach(([t, x, w]) => h.push(`<div class="su-el su-head" style="${at(x, 168, w, 24)}">${t}</div>`));
    st.rows.forEach((r, i) => {
      const y = ROW_Y[i], dim = r.open ? '' : 'closed';
      const fname = r.faction === 'random' ? 'Random faction' : D.FACTIONS[r.faction].name;
      const team = r.human ? 'Your forces' : r.ally ? 'Ally' : 'Enemy';
      h.push(r.human
        ? `<input class="su-el su-name" data-name="1" maxlength="18" value="${esc(r.name || 'You')}" style="${at(186, y + 10, 278, 40)}" aria-label="Your name">`
        : `<div class="su-el su-name ${dim}" style="${at(186, y + 10, 278, 40)}">${r.open ? `${esc(fname)} <small>${team}</small>` : '<small>Closed slot</small>'}</div>`);
      h.push(`<button class="su-el su-tog ${dim}" data-row="${i}" data-act="ctrl" title="${r.human ? 'You' : r.open ? 'Computer player · click to close this slot' : 'Click to add a computer player'}" style="${at(491, y + 18, 26, 26)}">${menuIcon(r.human ? 'human' : 'ai')}</button>`);
      if (!r.human) h.push(`<button class="su-el su-tog ${dim}" data-row="${i}" data-act="team" title="${r.ally ? 'Ally: fights on your side' : 'Enemy: fights against everyone not on its side'} · click to switch" style="${at(526, y + 18, 26, 26)}">${menuIcon(r.ally ? 'ally' : 'enemy')}</button>`);
      if (r.open) {
        const cmd = r.commander;
        const slot = (x, what, inner, tip) => `<button class="su-el su-sq" data-row="${i}" data-sq="${what}" title="${esc(tip)} · click for next, right-click for previous" style="${at(x, y, 59, 59)}">${inner}</button>`;
        h.push(slot(598, 'faction', menuIcon(r.faction === 'random' ? 'random' : 'f_' + r.faction), fname));
        h.push(slot(669, 'commander', cmd === 'random' ? menuIcon('random') : `<img src="${heroAvatar(cmd)}" alt="">`, cmd === 'random' ? 'Random commander' : cmd));
        h.push(slot(748, 'bonus', menuIcon({ random: 'random', gold: 'b_gold', art: 'b_art', res: 'b_res' }[r.bonus]), BONUS.find(b => b[0] === r.bonus)[1]));
        h.push(`<button class="su-el su-arr" data-row="${i}" data-arr="-1" title="Previous commander" style="${at(576, y + 4, 20, 52)}"></button>`);
        h.push(`<button class="su-el su-arr" data-row="${i}" data-arr="1" title="Next commander" style="${at(810, y + 4, 20, 52)}"></button>`);
      } else h.push(`<div class="su-el su-shade" style="${at(124, y - 2, 712, 66)}"></div>`);
    });
    for (const [k, x, y] of OPT_POS) h.push(`<button class="su-el su-opt" data-opt="${k}" title="${k === 'seed' ? 'Click for a new map' : 'Click for next, right-click for previous'}" style="${at(x + 3, y, 132, 24)}"><b>${OPTS[k].label}</b> ${esc(optValue(k))}</button>`);
    h.push(`<button class="su-el su-round" data-opt="seed" title="Generate a different map" style="${at(1240, 265, 26, 26)}">${menuIcon('reroll')}</button>`);
    h.push(`<canvas id="su-preview" class="su-el" width="726" height="384" style="${at(895, 310, 363, 192)}"></canvas>`);
    const L = D.AI_LEVELS[st.aiLevel];
    h.push(`<div class="su-el su-ailabel" style="${at(895, 482, 363, 20)}">ENEMY AI · ${L.name.toUpperCase()} · ${L.diff.toUpperCase()}</div>`);
    [890, 969, 1047, 1125, 1203].forEach((x, k) => h.push(`<button class="su-el su-rank ${k === st.aiLevel ? 'on' : ''}" data-rank="${k}" title="${D.AI_LEVELS[k].name} (${D.AI_LEVELS[k].diff})" style="${at(x + 4, 532, 54, 54)}">${menuIcon('rank' + k)}</button>`));
    const ok = enemies() > 0;
    h.push(`<button class="su-el su-begin" id="btn-begin" ${ok ? '' : 'disabled'} title="${ok ? 'Start the campaign' : 'Add at least one enemy'}" style="${at(905, 620, 205, 54)}">BEGIN</button>`);
    h.push(`<button class="su-el su-back" id="btn-back" style="${at(1150, 628, 115, 36)}">BACK</button>`);
    root.querySelectorAll('.su-el').forEach(e => e.remove());
    root.insertAdjacentHTML('beforeend', h.join(''));
    preview();
  }
  function act(e, dir) {
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    const r = t.dataset.row != null ? st.rows[+t.dataset.row] : null;
    if (t.id === 'btn-back') return onBack();
    if (t.id === 'btn-begin') {
      save();
      const players = [];
      st.rows.forEach((q, i) => { if (q.open) players.push({ faction: q.faction, human: q.human, team: q.human || q.ally ? 0 : i + 1, commander: q.commander, bonus: q.bonus, color: D.PLAYER_COLORS[i], name: q.human ? q.name || 'You' : null }); });
      onBegin({ players, template: st.template, size: st.size, seed: st.seed, aiLevel: st.aiLevel, monsters: st.monsters, treasure: st.treasure, startRes: st.startRes, terrain: st.terrain, weekEvents: st.weekEvents });
      st.seed = (Math.random() * 1e9) | 0;
      return;
    }
    if (t.dataset.act === 'ctrl' && r && !r.human) {
      if (r.open && nPlayers() <= 2) { toast?.('A campaign needs at least two lords.', 'bad'); return; }
      r.open = !r.open; if (r.open) r.ally = false;
    } else if (t.dataset.act === 'team' && r) { if (r.open) r.ally = !r.ally; }
    else if (t.dataset.sq && r) step(r, t.dataset.sq, dir);
    else if (t.dataset.arr && r) step(r, 'commander', +t.dataset.arr);
    else if (t.dataset.opt) stepOpt(t.dataset.opt, dir);
    else if (t.dataset.rank) st.aiLevel = +t.dataset.rank;
    else return;
    save(); render();
  }
  root.addEventListener('click', e => act(e, 1));
  root.addEventListener('contextmenu', e => { if (e.target.closest('[data-sq],[data-opt]')) { e.preventDefault(); act(e, -1); } });
  root.addEventListener('input', e => { if (e.target.dataset.name) { st.rows[0].name = e.target.value; save(); } });
  return { render };
}
