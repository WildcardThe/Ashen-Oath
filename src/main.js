// UI shell: title screen, adventure map rendering, side panel, town screen, dialogs.
import * as D from './data.js';
import * as Gm from './game.js';
import * as A from './art.js';
import { runCombatView } from './combatView.js';
import { renderTownScene, renderTownArt, regionHit, SCENE_NAMES } from './townScene.js';
import * as I from './icons.js';
import * as T from './terminal.js';
import { buildSetup, menuIcon, menuIconsReady } from './setup.js';
import { TEMPLATES, MAP_SIZES, SIZE_NAMES, generateMap, roadSide } from './map.js';
import Audio from './audio.js';

const { G, io } = Gm;
const $ = s => document.querySelector(s);
const TS = 48;
const SAVE_KEY = 'ashen-oath-save-v3';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ui = {
  selId: null, path: null, target: null, cam: { x: 0, y: 0 }, terrain: null, fog: null, fogDirty: true,
  hover: null, busy: false, keys: new Set(), particles: [], drag: null, faction: 'concord', template: 'duel', size: 'M', seed: (Math.random() * 1e9) | 0, mmTick: 0, aiActive: false, pendingMove: null,
};

// ---------------- portraits & icons ----------------
const cache = new Map();
function canvasURL(key, w, h, fn) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'));
  const u = c.toDataURL(); cache.set(key, u); return u;
}
export const portrait = type => canvasURL('u:' + type, 96, 96, g => A.drawUnit(g, type, 44, 90, UNIT_PORTRAIT_SIZE(type), 1, 0));
const UNIT_PORTRAIT_SIZE = type => { const u = D.UNITS[type]; if (u.look.scale) return 74 / u.look.scale; return u.tier >= 4 ? 66 : 80; };
// Commander avatars from the art pack, alternated across the roster.
const ALL_HEROES = Object.values(D.FACTIONS).flatMap(f => f.heroes);
const PLAIN_HEROES = ALL_HEROES.filter(n => !D.HERO_DEFS[n]?.look);
const avatarNo = name => (Math.max(0, PLAIN_HEROES.indexOf(name)) % 4) + 1;
const lookOf = name => D.HERO_DEFS[name]?.look;
const heroAvatar = name => (lookOf(name) ? `assets/ui/avatars/${lookOf(name)}.webp` : `assets/sprites/commander_${avatarNo(name)}.png`);
const heroStrip = name => (lookOf(name) ? `assets/ui/avatars/${lookOf(name)}.webp` : `assets/sprites/commander_${avatarNo(name)}_strip.png`);
const heroPortrait = f => canvasURL('h:' + f, 96, 96, g => A.drawLook(g, A.HERO_LOOK[f], 48, 88, 70, 1, 0));
const resIcon = r => `assets/sprites/icon_${r}.png`;
const artIcon = id => canvasURL('a:' + id, 96, 96, g => A.drawArtifactIcon(g, id, 48, 48, 86, D.RARITY[D.ARTIFACTS[id].r].color, D.ARTIFACTS[id].slot));
// combination-set emblem (painted set icon)
const setIcon = k => canvasURL('s:' + k, 96, 96, g => { const im = A.spriteImage?.('art_' + D.SETS[k].icon); if (im) g.drawImage(im, 0, 0, 96, 96); });
const artTip = id => { const a = D.ARTIFACTS[id]; return `${a.name} (${D.RARITY[a.r].name}): ${D.artifactDesc(id)}`; };
// combination sets the commander has started: pieces worn out of four, and the bonus once complete
function setsHtml(h) {
  const worn = D.equipped(h).concat(h.backpack || []);
  const rows = Object.entries(D.SETS).map(([k, S]) => {
    const on = S.pieces.filter(p => D.equipped(h).includes(p)).length, have = S.pieces.filter(p => worn.includes(p)).length;
    if (!have) return '';
    const done = on === S.pieces.length;
    return `<div class="setrow ${done ? 'done' : ''}" title="${esc(S.pieces.map(p => D.ARTIFACTS[p].name).join(', '))}"><img src="${setIcon(k)}" alt=""><div><b>${esc(S.name)}</b> <small>${on}/${S.pieces.length} worn${done ? ' · active' : ''}</small></div></div>`;
  }).join('');
  return rows ? `<h4>Sets</h4><div class="sets">${rows}</div>` : '';
}
const resImg = r => `<img class="ri" src="${resIcon(r)}" alt="${D.RES_INFO[r].name}">`;
const costHtml = (cost, n = 1) => Object.entries(cost).filter(([, v]) => v > 0).map(([k, v]) => `<span class="cost">${resImg(k)}${(v * n).toLocaleString()}</span>`).join('');

// ---------------- assets ----------------
const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not load ' + src)); im.src = src; });
async function loadAssets() {
  const manifest = await (await fetch('assets/sprites.json')).json();
  // sprites packed into an atlas (structures, mines, their glow) are cut back out into canvases
  const names = [...Object.keys(manifest).filter(n => !manifest[n].atlas), ...D.RES.map(r => 'icon_' + r)];
  const atlases = [...new Set(Object.values(manifest).map(m => m.atlas).filter(Boolean))];
  const atlasExt = {}; for (const m of Object.values(manifest)) if (m.atlas && m.aext) atlasExt[m.atlas] = m.aext;
  const spr = {}, atl = {};
  await Promise.all([...names.map(async n => { spr[n] = await loadImage(`assets/sprites/${n}.${manifest[n]?.ext || 'png'}`); }),
    ...atlases.map(async a => { atl[a] = await loadImage(`assets/sprites/${a}.${atlasExt[a] || 'png'}`); })]);
  for (const [n, m] of Object.entries(manifest)) if (m.atlas && atl[m.atlas]) {
    const c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
    c.getContext('2d').drawImage(atl[m.atlas], m.x, m.y, m.w, m.h, 0, 0, m.w, m.h); spr[n] = c;
  }
  const ground = await loadImage('assets/ground.png');
  const texNames = [...new Set([...D.TERRAIN_TEX, 'road', ...['snow', 'scrap', 'shale', 'glass', 'ash', 'rust'].map(b => 'road_' + b)])];
  const tex = {};
  await Promise.all(texNames.map(async n => { tex[n] = await loadImage(`assets/terrain/${n}.webp`); }));
  let riverStrip = null;
  if (spr.river_strip) {
    const im = spr.river_strip; riverStrip = document.createElement('canvas'); riverStrip.width = im.width; riverStrip.height = im.height * 2;
    const rg = riverStrip.getContext('2d'); rg.drawImage(im, 0, 0); rg.drawImage(im, 0, im.height);
  }
  // one river strip per biome, doubled so any start row has a full slice below it
  const riverStrips = {};
  for (const [k, n] of ['snow', 'scrap', 'shale', 'glass', 'ash', 'rust'].map(b => [b, 'river_' + b])) {
    const im = spr[n]; if (!im) continue;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height * 2;
    const cg = c.getContext('2d'); cg.drawImage(im, 0, 0); cg.drawImage(im, 0, im.height); riverStrips[k] = c;
  }
  A.setAssets({ spr, ground, manifest, riverStrip, riverStrips, tex });
  if (spr.chest_map) I.setChestSprite(spr.chest_map);
}

// ---------------- generic modal ----------------
function modal({ title, html = '', buttons = [{ label: 'Close', value: null, primary: true }], cls = '', onMount }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'overlay';
    // short popups without a design of their own use the painted window: title plaque, text panel, buttons below;
    // the cancel (or only) button sits on the painted plate at the bottom
    const plainText = html.replace(/<[^>]+>/g, '');
    const painted = !cls && title && plainText.length < 700 && buttons.length <= 6 && !/<(table|input|select|textarea|canvas|ul|ol|img|div)\b/i.test(html);
    if (painted) {
      const plateI = buttons.length === 1 ? 0 : Math.max(0, buttons.findIndex(b => b.cancel));
      const plate = buttons.length && (buttons.length === 1 || buttons[plateI]?.cancel) ? plateI : -1;
      const rest = buttons.map((b, i) => [b, i]).filter(([, i]) => i !== plate);
      wrap.innerHTML = `<div class="panel modal choicebox painted" role="dialog" aria-modal="true"><div class="cb-frame plain">
        <h3 class="cb-t">${title}</h3><div class="cb-txt">${html}</div>
        <div class="cb-btns">${rest.map(([b, i]) => `<button class="cb-b ${b.primary ? 'primary' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div>
        ${plate >= 0 ? `<button class="cb-ok ${buttons.length === 1 ? 'primary' : ''}" data-i="${plate}">${buttons.length === 1 && /^(ok|close)$/i.test(buttons[0].label) ? '✔' : buttons[plate].label}</button>` : ''}</div>
        <div class="modal-btns" hidden></div></div>`;
    } else
    wrap.innerHTML = `<div class="panel modal ${cls}" role="dialog" aria-modal="true">
      ${title ? `<h2>${title}</h2>` : ''}<div class="modal-body">${html}</div>
      <div class="modal-btns">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    $('#modal-root').append(wrap);
    const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape' && buttons.some(b => b.esc !== false)) { e.stopPropagation(); close(buttons.find(b => b.cancel)?.value ?? null); } };
    document.addEventListener('keydown', onKey);
    wrap.querySelectorAll('.modal-btns [data-i], .cb-frame [data-i]').forEach(el => el.onclick = () => close(buttons[+el.dataset.i].value));
    onMount?.(wrap, close);
    wrap.querySelector('.btn.primary, .cb-b.primary, .cb-ok.primary')?.focus();
  });
}
const modalOpen = () => $('#modal-root').children.length > 0 || !$('#combat').hidden;

function toast(text, kind = '') {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => el.remove(), 4800);
  while ($('#toasts').children.length > 5) $('#toasts').firstChild.remove();
}

// ---------------- title ----------------
// Preview of the map the generator will build: terrain, obstacles, roads, rivers, towns, mines and structures.
// ---------------- new campaign setup ----------------
let SETUP = null;
function setupTitle(mode = 'sp') {
  if (SETUP) SETUP.setMode(mode);
  if (!SETUP) SETUP = buildSetup($('#setup-stage'), {
    heroAvatar, toast,
    onBack: () => showScreen('menu'),
    onBegin: cfg => { Gm.newGame(cfg); enterGame(); writeSlot(autoSlot(), true); },
    mode,
  });
  SETUP.render();
}

// ---------------- options ----------------
const OPT_KEY = 'ashen-oath-options-v1';
const OPT_DEFS = {
  battleSpeed: { label: 'Battle animation speed', hint: 'How fast attacks and moves play out in battle.', choices: { slow: 'Slow', normal: 'Normal', fast: 'Fast', vfast: 'Very fast' }, def: 'normal' },
  walkSpeed: { label: 'Commander movement speed', hint: 'How fast commanders march across the map.', choices: { slow: 'Slow', normal: 'Normal', fast: 'Fast', instant: 'Instant' }, def: 'normal' },
  scroll: { label: 'Map scroll speed', hint: 'Keyboard panning speed (WASD or arrows).', choices: { slow: 'Slow', normal: 'Normal', fast: 'Fast' }, def: 'normal' },
  confirmEnd: { label: 'Confirm end of turn', hint: 'Ask before ending the turn while commanders can still move.', choices: { true: 'On', false: 'Off' }, def: true },
  threat: { label: 'Threat colours on creatures', hint: 'Colour each creature badge by its danger to the selected commander.', choices: { true: 'On', false: 'Off' }, def: true },
  daylight: { label: 'Day and night light', hint: 'The map is lit by the day of the week: dawn on day 1, dusk on day 6, night on day 7.', choices: { true: 'On', false: 'Off' }, def: true },
  music: { label: 'Music volume', hint: 'Faction themes on the map, war drums in battle.', choices: { off: 'Off', low: 'Low', mid: 'Medium', high: 'High' }, def: 'mid' },
  sfx: { label: 'Sound effects volume', hint: 'Weapons, impacts, spells and interface sounds.', choices: { off: 'Off', low: 'Low', mid: 'Medium', high: 'High' }, def: 'high' },
  ash: { label: 'Falling ash', hint: 'Ambient ash drifting over the map.', choices: { true: 'On', false: 'Off' }, def: true },
  intro: { label: 'Intro at start', hint: 'Play the intro trailer when the game opens.', choices: { true: 'On', false: 'Off' }, def: true },
  shake: { label: 'Screen shake in battle', hint: 'Heavy blows and explosions shake the battlefield.', choices: { true: 'On', false: 'Off' }, def: true },
};
let OPTS = {};
try { OPTS = JSON.parse(localStorage.getItem(OPT_KEY) || '{}') || {}; } catch { OPTS = {}; }
const opt = k => (k in OPTS ? OPTS[k] : OPT_DEFS[k].def);
const setOpt = (k, v) => { OPTS[k] = v; try { localStorage.setItem(OPT_KEY, JSON.stringify(OPTS)); } catch { /* storage blocked */ } };
const BATTLE_SPEED = { slow: 1.4, normal: 1, fast: 0.6, vfast: 0.35 };
const WALK_MS = { slow: 120, normal: 70, fast: 30, instant: 0 };
const SCROLL_PX = { slow: 450, normal: 700, fast: 1100 };

function showOptions() {
  return modal({
    title: 'Options', cls: 'wide-ish', html: '<div id="opts"></div>',
    buttons: [{ label: 'Done', value: null, primary: true, cancel: true }],
    onMount: wrap => {
      const box = wrap.querySelector('#opts');
      const render = () => {
        box.innerHTML = Object.entries(OPT_DEFS).map(([k, d]) => `<div class="opt-row"><div><b>${d.label}</b><small>${d.hint}</small></div>
          <div class="seg">${Object.entries(d.choices).map(([v, l]) => `<button data-k="${k}" data-v="${v}" class="${String(opt(k)) === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`).join('')
          + '<p class="hint">Options are remembered in this browser.</p>';
      };
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        const v = b.dataset.v; setOpt(b.dataset.k, v === 'true' ? true : v === 'false' ? false : v); applyVolumes(); render();
      });
      render();
    },
  });
}

// ---------------- save slots ----------------
const SLOT_INDEX = 'ashen-oath-slots-v1';
const SLOT_IDS = ['auto', 'automp', '1', '2', '3', '4', '5', '6'];
// a multiplayer (hot-seat) game: more than one human player; it autosaves to its own slot
const isMpGame = s => !!(s && s.players.filter(q => q.human).length > 1);
const autoSlot = () => (isMpGame(G.s) ? 'automp' : 'auto');
const slotKey = id => 'ashen-oath-slot:' + id;
function slotIndex() { try { return JSON.parse(localStorage.getItem(SLOT_INDEX) || '{}') || {}; } catch { return {}; } }
function writeSlot(id, quiet = false) {
  try {
    const s = G.s, idx = slotIndex();
    localStorage.setItem(slotKey(id), JSON.stringify(s));
    const hs = Gm.heroesOf(VP());
    idx[id] = { ts: Date.now(), day: s.day, faction: s.players[VP()].faction, template: s.template || 'duel', size: s.W, mp: isMpGame(s),
      players: s.players.filter(q => q.human).map(q => q.name),
      hero: hs[0] ? hs[0].name : null, towns: Gm.townsOf(VP()).length, heroes: hs.length };
    localStorage.setItem(SLOT_INDEX, JSON.stringify(idx));
    if (!quiet) toast(id === 'auto' ? 'Autosaved.' : `Saved to slot ${id}.`);
    return true;
  } catch { if (!quiet) toast('This browser blocked saving, or storage is full.', 'bad'); return false; }
}
function readSlot(id) {
  try { const raw = localStorage.getItem(slotKey(id)); if (!raw) return false; Gm.loadState(JSON.parse(raw)); return true; }
  catch { toast('That save could not be loaded.', 'bad'); return false; }
}
function deleteSlot(id) {
  try { localStorage.removeItem(slotKey(id)); const idx = slotIndex(); delete idx[id]; localStorage.setItem(SLOT_INDEX, JSON.stringify(idx)); } catch { /* ignore */ }
}
function latestSlot() { const idx = slotIndex(); return Object.keys(idx).sort((a, b) => idx[b].ts - idx[a].ts)[0] || null; }
function migrateOldSave() {
  try {
    if (Object.keys(slotIndex()).length) return;
    const raw = localStorage.getItem('ashen-oath-save-v3'); if (!raw) return;
    Gm.loadState(JSON.parse(raw)); writeSlot('1', true); G.s = null;
  } catch { /* ignore */ }
}
const DATE_FMT = ts => new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function slotRowHtml(id, m, mode) {
  const label = id === 'auto' || id === 'automp' ? 'Autosave' : `Slot ${id}`;
  if (id === 'automp' && !m) return '';
  if (!m) return `<div class="slot-row empty"><div></div><div><b>${label}</b><small>Empty</small></div><div class="slot-btns">${mode === 'save' && !/^auto/.test(id) ? `<button class="btn sm primary" data-save="${id}">Save here</button>` : ''}</div></div>`;
  const d = m.day - 1;
  const when = `Month ${Math.floor(d / 28) + 1}, week ${Math.floor(d % 28 / 7) + 1}, day ${d % 7 + 1}`;
  return `<div class="slot-row"><img class="avatar" src="assets/sprites/commander_${{ concord: 1, hollow: 2, rustbound: 3 }[m.faction] || 1}.png" alt="">
    <div><b>${label} · ${m.mp ? esc((m.players || []).join(', ')) : esc(D.FACTIONS[m.faction]?.name || m.faction)}</b><small>${when} · ${esc(TEMPLATES[m.template]?.name || '')} ${m.size}×${m.size} · ${m.towns} town${m.towns === 1 ? '' : 's'}, ${m.heroes} commander${m.heroes === 1 ? '' : 's'} · saved ${DATE_FMT(m.ts)}</small></div>
    <div class="slot-btns">${mode === 'save' ? (!/^auto/.test(id) ? `<button class="btn sm primary" data-save="${id}">Overwrite</button>` : '') : `<button class="btn sm primary" data-load="${id}">Load</button>`}
    ${!/^auto/.test(id) || mode === 'load' ? `<button class="btn sm" data-del="${id}" title="Delete this save">Delete</button>` : ''}</div></div>`;
}
async function showSlots(mode) {
  // loading first asks which kind of game; each list shows only saves of that kind
  let kind = null;
  if (mode === 'load') {
    kind = await modal({ title: 'Load game', html: '<p class="muted">Which kind of game do you want to load?</p>',
      buttons: [{ label: 'Single Player', value: 'sp', primary: true }, { label: 'Multiplayer', value: 'mp' }, { label: 'Back', value: null, cancel: true }] });
    if (!kind) return null;
  }
  return modal({
    title: mode === 'save' ? 'Save game' : kind === 'mp' ? 'Load multiplayer game' : 'Load single player game', cls: 'wide-ish', html: '<div class="slots-list" id="slots"></div><p class="hint">Saves are kept in this browser. The game autosaves at the start of each of your turns.</p>',
    buttons: [{ label: 'Close', value: null, cancel: true }],
    onMount: (wrap, close) => {
      const box = wrap.querySelector('#slots'); let armed = null;
      const render = () => {
        const idx = slotIndex();
        const ids = mode === 'load' ? SLOT_IDS.filter(id => idx[id] && !!idx[id].mp === (kind === 'mp')) : SLOT_IDS;
        box.innerHTML = ids.map(id => slotRowHtml(id, idx[id], mode)).join('') || '<p class="muted">No saved games yet.</p>';
        if (armed) { const b = box.querySelector(`[data-del="${armed}"]`); if (b) b.textContent = 'Confirm delete'; }
      };
      box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.save) { writeSlot(b.dataset.save); render(); }
        if (b.dataset.load) { if (readSlot(b.dataset.load)) { close('loaded'); enterGame(); } }
        if (b.dataset.del) { if (armed === b.dataset.del) { deleteSlot(armed); armed = null; } else armed = b.dataset.del; render(); }
      });
      render();
    },
  });
}

// ---------------- screens ----------------
// music follows the screen: menu theme, the player's faction on the map, war drums in battle
// the adventure map plays a calm ambient loop (assets/audio/adventure.mp3) once it exists; until then the faction theme
let adventureTrack = false;
fetch('assets/audio/adventure.mp3', { method: 'HEAD' }).then(r => { adventureTrack = r.ok; }).catch(() => {});
// the human whose turn it is (hot-seat multiplayer): the map, fog, panels and town screens show this player's side
const VP = () => (G.s && G.s.viewer != null ? G.s.viewer : 0);
const mapMusic = () => (G.s ? (adventureTrack ? 'adventure' : G.s.players[VP()].faction || 'concord') : 'menu');
const townMusic = t => t.faction;
function applyVolumes() { const v = k => ({ off: 0, low: 0.3, mid: 0.6, high: 1 })[opt(k)]; Audio.setVolumes(v('music') * 0.8, v('sfx')); }
function showScreen(name) {
  for (const id of ['intro', 'menu', 'title', 'game', 'farewell']) $('#' + id).hidden = id !== name;
  Audio.music(name === 'game' ? mapMusic() : 'menu');
  if (name === 'menu') refreshMenu();
}
function refreshMenu() {
  const id = latestSlot(), m = id && slotIndex()[id];
  $('#mm-continue').hidden = !m;
  if (m) $('#mm-continue-sub').textContent = `${/^auto/.test(id) ? 'Autosave' : 'Slot ' + id} · ${D.FACTIONS[m.faction]?.name || ''} · day ${m.day}`;
}
// main menu: live buttons on the painted plates of assets/ui/menu_bg.webp
const MENU_PLATES = [['mm-new', 'New Game', 'm_new', 95], ['mm-load', 'Load Game', 'm_load', 217], ['mm-options', 'Options', 'm_options', 340], ['mm-credits', 'Credits', 'm_credits', 462], ['mm-quit', 'Quit', 'm_quit', 584]];
function buildMenu() {
  const st = $('#menu-stage');
  st.querySelectorAll('.mm-el').forEach(e => e.remove());
  const h = [`<div class="mm-el mm-title" style="${T.at(105, 52, 400, 80)}">ASHEN OATH</div>`,
    `<button class="mm-el mm-cont" id="mm-continue" hidden style="${T.at(190, 222, 300, 46)}">Continue<small id="mm-continue-sub"></small></button>`];
  for (const [id, label, icon, y] of MENU_PLATES) {
    h.push(`<button class="mm-el mm-plate" id="${id}" style="${T.at(1135, y + 18, 195, 50)}">${label}</button>`);
    h.push(`<span class="mm-el mm-emb" style="${T.at(1064, y + 14, 54, 54)}">${menuIcon(icon)}</span>`);
  }
  st.insertAdjacentHTML('beforeend', h.join(''));
}
function showCredits() {
  return modal({ title: '', cls: 'credits', html: `<div class="cr"><img src="assets/ui/logo.webp" alt=""><h2>Ashen Oath</h2>
    <p>A turn-based strategy game of oaths, sieges and rites, in the spirit of the classic heroic strategy games.</p>
    <h4>Design and art direction</h4><p>The Ashen Oath team</p>
    <h4>Programming, map generator and tools</h4><p>Claude (Anthropic), with the team</p>
    <h4>Art</h4><p>Painted with AI image and video generators from the team's prompts</p>
    <p class="muted">Inspired by Heroes of Might and Magic III and the grimdark far future. No affiliation with any of their owners.</p></div>`,
    buttons: [{ label: 'Close', value: null, primary: true }] });
}
function setupMenu() {
  buildMenu(); refreshMenu();
  $('#mm-continue').onclick = () => { const id = latestSlot(); if (id && readSlot(id)) enterGame(); };
  $('#mm-new').onclick = async () => {
    const mode = await modal({ title: 'New Game', html: '<p class="muted">Multiplayer is played at this computer: players take their turns one after another, each seeing only what their own commanders have discovered.</p>',
      buttons: [{ label: 'Single Player', value: 'sp', primary: true }, { label: 'Multiplayer', value: 'mp' }, { label: 'Back', value: null, cancel: true }] });
    if (!mode) return;
    setupTitle(mode); showScreen('title');
  };
  $('#mm-load').onclick = () => showSlots('load');
  $('#mm-options').onclick = () => showOptions();
  $('#mm-credits').onclick = () => showCredits();
  $('#mm-quit').onclick = async () => {
    const v = await modal({ title: 'Quit Ashen Oath?', html: '<p>Your last autosave is kept.</p>', buttons: [{ label: 'Stay', value: false, cancel: true }, { label: 'Quit', value: true, primary: true }] });
    if (!v) return;
    try { window.close(); } catch { /* browsers only close windows they opened */ }
    showScreen('farewell');
  };
  for (const [id] of MENU_PLATES) { const b = $('#' + id), e = b.nextElementSibling; b.onmouseenter = () => e.classList.add('hot'); b.onmouseleave = () => e.classList.remove('hot'); }
  $('#fw-back').onclick = () => showScreen('menu');
  // drifting embers behind the menu
  const cv = $('#menu-embers'), g = cv.getContext('2d'), parts = [];
  let last = performance.now();
  const tick = now => {
    requestAnimationFrame(tick);
    if ($('#menu').hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    while (parts.length < 70) parts.push({ x: Math.random() * w, y: h + Math.random() * h * 0.5, v: 20 + Math.random() * 50, s: 0.8 + Math.random() * 2.2, ph: Math.random() * 6, life: 0.6 + Math.random() * 0.4 });
    for (const p of parts) {
      p.y -= p.v * dt; p.x += Math.sin(p.y / 50 + p.ph) * 18 * dt;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      const a = Math.min(1, (h - p.y) / (h * 0.25)) * p.life * (0.6 + 0.4 * Math.sin(now * 0.004 + p.ph));
      g.fillStyle = `rgba(255,${140 + Math.round(p.s * 30)},60,${a})`;
      g.beginPath(); g.arc(p.x, p.y, p.s, 0, Math.PI * 2); g.fill();
    }
  };
  requestAnimationFrame(tick);
}

// ---------------- entering the game ----------------
function enterGame() {
  showScreen('game');
  ui.lastViewer = VP();
  ui.terrain = A.paintTerrain(G.s, TS, new Set(Object.values(G.s.objects).map(o => o.y * G.s.W + o.x)));
  ui.fog = document.createElement('canvas'); ui.fog.width = G.s.W; ui.fog.height = G.s.H; ui.fogDirty = true;
  ui.path = null; ui.target = null; ui.busy = false;
  const h = Gm.heroesOf(VP())[0];
  ui.selId = h ? h.id : null; ui.focus = 'hero'; ui.selTownId = Gm.townsOf(VP())[0]?.id ?? null;
  requestAnimationFrame(() => { centerOn(h || Gm.townsOf(VP())[0]); });
  updateUI();
  toast(`Day ${G.s.day}. Your commanders await orders.`);
}

// ---------------- camera & map ----------------
const view = () => $('#map');
function centerOn(o) {
  if (!o) return;
  const cv = view(); ui.cam.x = o.x * TS + TS / 2 - cv.clientWidth / 2; ui.cam.y = o.y * TS + TS / 2 - cv.clientHeight / 2; clampCam();
}
function clampCam() {
  const cv = view(), mw = G.s.W * TS, mh = G.s.H * TS, vw = cv.clientWidth, vh = cv.clientHeight;
  ui.cam.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, ui.cam.x));
  ui.cam.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, ui.cam.y));
}
function follow(h) {
  const cv = view(), x = h.x * TS - ui.cam.x, y = h.y * TS - ui.cam.y, m = TS * 2.5;
  if (x < m || y < m || x > cv.clientWidth - m || y > cv.clientHeight - m) centerOn(h);
}
const selHero = () => (G.s && ui.selId != null && ui.focus !== 'town' ? G.s.heroes[ui.selId] : null);
const explored = (x, y) => G.s.players[VP()].explored[y * G.s.W + x] === 1;

function updateFog() {
  const s = G.s, g = ui.fog.getContext('2d'), img = g.createImageData(s.W, s.H), ex = s.players[VP()].explored;
  for (let i = 0; i < s.W * s.H; i++) { img.data[i * 4 + 0] = 8; img.data[i * 4 + 1] = 7; img.data[i * 4 + 2] = 6; img.data[i * 4 + 3] = ex[i] ? 0 : 255; }
  g.putImageData(img, 0, 0); ui.fogDirty = false;
}

let lastT = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  if (!G.s || $('#game').hidden) return;
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  const cv = view(), dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); clampCam(); }
  if (!modalOpen()) {
    const sp = SCROLL_PX[opt('scroll')] * dt; let moved = false;
    if (ui.keys.has('arrowleft') || ui.keys.has('a')) { ui.cam.x -= sp; moved = true; }
    if (ui.keys.has('arrowright') || ui.keys.has('d')) { ui.cam.x += sp; moved = true; }
    if (ui.keys.has('arrowup') || ui.keys.has('w')) { ui.cam.y -= sp; moved = true; }
    if (ui.keys.has('arrowdown') || ui.keys.has('s')) { ui.cam.y += sp; moved = true; }
    if (moved) clampCam();
  }
  if (ui.fogDirty) updateFog();
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#080706'; g.fillRect(0, 0, w, h);
  g.save(); g.translate(-Math.round(ui.cam.x), -Math.round(ui.cam.y));
  g.drawImage(ui.terrain, 0, 0);
  const s = G.s;
  const x0 = Math.max(0, Math.floor(ui.cam.x / TS) - 2), x1 = Math.min(s.W - 1, Math.ceil((ui.cam.x + w) / TS) + 2);
  const y0 = Math.max(0, Math.floor(ui.cam.y / TS) - 1), y1 = Math.min(s.H - 1, Math.ceil((ui.cam.y + h) / TS) + 4);
  const items = [];
  for (const o of Object.values(s.objects)) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1 && explored(o.x, o.y)) items.push(o);
  for (const hh of Object.values(s.heroes)) if (hh.x >= x0 && hh.x <= x1 && hh.y >= y0 && hh.y <= y1 && explored(hh.x, hh.y)) items.push({ type: 'hero', h: hh, x: hh.x, y: hh.y });
  // pickups and guards: obstacle pieces around them are fitted so they never hide them. Not commanders: they move,
  // and refitting the pieces around them every step made forests and peaks change shape as they walked past
  // (commanders show through anything covering them as a faint ghost instead)
  const small = new Set();
  for (const it of items) if (/^(pile|chest|relic|monster)$/.test(it.type)) small.add(it.y * s.W + it.x);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const T = s.tiles[y * s.W + x];
    if (T.t === 4 && explored(x, y)) items.push({ type: 'obst', T, x, y, near: laneNear(x, y, small) });
  }
  for (const sc of s.scenery || []) if (sc.x >= x0 - 2 && sc.x <= x1 + 2 && sc.y >= y0 && sc.y <= y1 && explored(sc.x, sc.y)) items.push({ type: 'scenery', sc, x: sc.x, y: sc.y });
  items.sort((a, b) => a.y - b.y || (a.type === 'hero') - (b.type === 'hero'));
  const sel = selHero();
  if (sel) {
    const cx = sel.x * TS + TS / 2, cy = sel.y * TS + TS * 0.82;
    g.strokeStyle = 'rgba(240,207,114,0.9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, TS * 0.38, TS * 0.13, 0, 0, Math.PI * 2); g.stroke();
  }
  drawPath(g);
  // shimmering acid pools and rivers
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const T = s.tiles[y * s.W + x];
    if ((T.t === 5 || T.river) && explored(x, y)) A.drawLiquidShimmer(g, x, y, TS, t, T.v, T.t === 5 ? 'acid' : 'river');
  }
  for (const it of items) drawItem(g, it, t);
  // commanders stay visible behind tall mountains and buildings: a faint ghost is drawn over whatever covers them
  g.save(); g.globalAlpha = 0.5;
  for (const it of items) if (it.type === 'hero') drawItem(g, it, t);
  g.restore();
  if (opt('daylight')) A.drawDayTint(g, ui.cam.x - 2, ui.cam.y - 2, w + 4, h + 4, s.day);
  g.imageSmoothingEnabled = true;
  g.drawImage(ui.fog, 0, 0, s.W * TS, s.H * TS);
  if (ui.hover && !ui.drag?.moved) {
    g.strokeStyle = 'rgba(232,223,207,0.35)'; g.lineWidth = 1; g.strokeRect(ui.hover.x * TS + 0.5, ui.hover.y * TS + 0.5, TS - 1, TS - 1);
  }
  g.restore();
  drawAsh(g, w, h, dt);
  if (++ui.mmTick % 12 === 0) drawMinimap();
}

// older saves have no flip stored: work it out from the roads once
const faceRoad = o => { const s = Gm.G.s; return o.flip ?? (o.flip = roadSide(s.tiles, s.W, s.H, o.x, o.y) > 0); };
// roads and rivers next to an obstacle tile (the piece drawn there is fitted so it does not cover them),
// and how deep inside a mountain range the tile sits (deep tiles stack extra peaks for a dense range)
function laneNear(x, y, small) {
  const s = G.s, T0 = s.tiles[y * s.W + x];
  const lane = (X, Y) => { if (X < 0 || Y < 0 || X >= s.W || Y >= s.H) return false; const T = s.tiles[Y * s.W + X]; return !!(T.road || T.river) || (small && small.has(Y * s.W + X)); };
  const rng = (X, Y) => { if (X < 0 || Y < 0 || X >= s.W || Y >= s.H) return true; const T = s.tiles[Y * s.W + X]; return T.t === 4 && (T.b === 0 || T.b === 3); };
  let mass = 0, woods = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) {
    if (rng(x + dx, y + dy)) mass++;
    const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < s.W && Y < s.H && s.tiles[Y * s.W + X].t === 4 && s.tiles[Y * s.W + X].b === 4) woods++;
  }
  const n = { l: lane(x - 1, y) || lane(x - 1, y - 1), r: lane(x + 1, y) || lane(x + 1, y - 1),
    up1: lane(x, y - 1) || lane(x - 1, y - 1) || lane(x + 1, y - 1), up2: lane(x, y - 2) || lane(x - 1, y - 2) || lane(x + 1, y - 2),
    mass: T0.b === 0 || T0.b === 3 ? mass : 0, above: rng(x, y - 1), woods };
  // a small piece (scrap, ruin, pool) touching another one is drawn as a crag, so they never pile up
  if (T0.b === 1 || T0.b === 2) {
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0]]) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= s.W || Y >= s.H) continue;
      const T = s.tiles[Y * s.W + X]; if (T.t === 4 && (T.b === 1 || T.b === 2)) { n.crowd = true; break; }
    }
  }
  return n;
}
const isHover = it => ui.hover && ui.hover.x === it.x && ui.hover.y === it.y;
function drawItem(g, it, t) {
  const cx = it.x * TS + TS / 2, cy = it.y * TS + TS / 2, s = G.s;
  const ownerColor = o => (o.owner == null ? D.NEUTRAL_COLOR : s.players[o.owner].color);
  switch (it.type) {
    case 'town': A.drawTown(g, cx, cy, TS, it.faction, ownerColor(it), t); break;
    case 'obst': A.drawObstacleTile(g, it.T, it.x, it.y, TS, t, it.near); break;
    case 'scenery': A.drawScenery(g, it.sc, TS); break;
    case 'mine': A.drawMine(g, cx, cy, TS, it.res, ownerColor(it), t, faceRoad(it)); break;
    case 'pile': A.drawPile(g, cx, cy, TS, it.res); break;
    case 'site': {
      const S = D.SITES[it.kind], h = selHero();
      const spent = D.siteSpent(it, h, s.day);
      if (it.kind === 'derelict' && it.cleared && it.owner != null) A.drawMine(g, cx, cy, TS, it.res, ownerColor(it), t, faceRoad(it), 'derelict_mining_complex');
      else A.drawSite(g, cx, cy, TS, it.kind, spent, faceRoad(it), t);
      if ((it.kind === 'keystation' || it.kind === 'blastdoor') && it.color) I.drawKeyMarker?.(g, D.KEY_COLORS[it.color], cx - TS * 0.9, cy + TS * 0.2, TS * 0.5, t);
      if (S.guarded && !it.cleared) {
        const threat = opt('threat') && h ? I.threatLevel(it.guard.count * D.unitValue(it.guard.unit) / Math.max(1, Gm.armyStrength(h.army, h))) : null;
        A.drawMapCreature(g, it.guard.unit, cx + TS * 1.05, cy + TS * 0.45, TS * 0.72, -1, t, threat == null ? null : I.THREAT_COLORS[threat], isHover(it));
      }
      break;
    }
    case 'chest': I.drawChestMarker(g, cx, cy + TS * 0.44, TS * 1.0, t, isHover(it)); break;
    case 'relic': I.drawArtifactMarker(g, it.relic, cx, cy + TS * 0.44, TS * 1.05, t, isHover(it)); break;
    case 'tower': A.drawTower(g, cx, cy, TS, t, faceRoad(it)); I.drawTowerMarker(g, cx + TS * 0.38, cy - TS * 0.15, TS * 0.62, (it.visited || []).includes(0), t, isHover(it)); break;
    case 'monster': {
      const h = selHero();
      const threat = opt('threat') && h ? I.threatLevel(it.count * D.unitValue(it.unit) / Math.max(1, Gm.armyStrength(h.army, h))) : null;
      A.drawMapCreature(g, it.unit, cx, cy + TS * 0.42, TS * 0.95, it.id % 2 ? -1 : 1, t, threat == null ? null : I.THREAT_COLORS[threat], isHover(it));
      break;
    }
    case 'hero': {
      const h = it.h; const p = s.players[h.owner];
      const town = Gm.objAt(h.x, h.y);
      if (town && town.type === 'town') { A.drawHero(g, cx + TS * 0.2, cy + TS * 0.2, TS * 0.8, h.faction, p.color, t, 1, lookOf(h.name)); }
      else A.drawHero(g, cx, cy, TS, h.faction, p.color, t, h.facing || (h.owner === VP() ? 1 : -1), lookOf(h.name), t - (h._mt || 0) < 450);
      break;
    }
  }
}

function drawPath(g) {
  const h = selHero(); if (!h || !ui.path) return;
  let cum = 0;
  ui.path.forEach((st, i) => {
    cum = st.total;
    const cx = st.x * TS + TS / 2, cy = st.y * TS + TS / 2;
    const ok = cum <= h.mp; const last = i === ui.path.length - 1;
    g.fillStyle = ok ? '#8fd16a' : '#d8574a'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1.5;
    if (last) {
      const o = Gm.objAt(st.x, st.y), other = Gm.heroAt(st.x, st.y);
      const hostile = (o && (o.type === 'monster' || (o.type === 'town' && Gm.isEnemy(o.owner, VP())))) || (other && Gm.isEnemy(other.owner, VP()));
      if (hostile) {
        g.strokeStyle = ok ? '#8fd16a' : '#d8574a'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx - 8, cy - 8); g.lineTo(cx + 8, cy + 8); g.moveTo(cx + 8, cy - 8); g.lineTo(cx - 8, cy + 8); g.stroke();
      } else { g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill(); g.stroke(); }
    } else {
      const nx = ui.path[i + 1], a = Math.atan2(nx.y - st.y, nx.x - st.x);
      g.save(); g.translate(cx, cy); g.rotate(a);
      g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, -5); g.lineTo(-2, 0); g.lineTo(-4, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  });
}

function drawAsh(g, w, h, dt) {
  if (!opt('ash') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  while (ui.particles.length < 40) ui.particles.push({ x: Math.random() * w, y: Math.random() * h, v: 8 + Math.random() * 18, s: 1 + Math.random() * 1.6, d: Math.random() * 6 });
  g.fillStyle = 'rgba(230,215,195,0.35)';
  for (const p of ui.particles) {
    p.y += p.v * dt; p.x += Math.sin((p.y + p.d * 40) / 40) * 10 * dt;
    if (p.y > h) { p.y = -4; p.x = Math.random() * w; }
    g.fillRect(p.x, p.y, p.s, p.s);
  }
}

function drawMinimap() {
  const s = G.s, cv = $('#minimap'), dpr = window.devicePixelRatio || 1;
  const size = cv.clientWidth; if (!size) return;
  if (cv.width !== Math.round(size * dpr)) { cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = size / s.W;
  g.fillStyle = '#080706'; g.fillRect(0, 0, size, size);
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    if (!explored(x, y)) continue;
    const T = s.tiles[y * s.W + x];
    g.fillStyle = T.road ? '#a4a6aa' : D.TERRAIN[T.t].base; g.fillRect(x * k, y * k, k + 0.5, k + 0.5);
  }
  for (const o of Object.values(s.objects)) {
    if (!explored(o.x, o.y)) continue;
    if (o.type === 'town' || o.type === 'mine') {
      g.fillStyle = o.owner == null ? D.NEUTRAL_COLOR : s.players[o.owner].color;
      const r = o.type === 'town' ? 2.2 : 1.3; g.fillRect((o.x - r / 2 + 0.5) * k - 1, (o.y - r / 2 + 0.5) * k - 1, r * k + 1, r * k + 1);
    }
  }
  for (const h of Object.values(s.heroes)) {
    if (!explored(h.x, h.y)) continue;
    g.fillStyle = h.id === ui.selId ? '#ffffff' : s.players[h.owner].color;
    g.beginPath(); g.arc((h.x + 0.5) * k, (h.y + 0.5) * k, Math.max(2, k * 0.7), 0, Math.PI * 2); g.fill();
  }
  const mv = view();
  g.strokeStyle = '#e8dfcf'; g.lineWidth = 1;
  g.strokeRect(ui.cam.x / TS * k, ui.cam.y / TS * k, mv.clientWidth / TS * k, mv.clientHeight / TS * k);
}

// ---------------- map input ----------------
function tileFromEvent(e) {
  const r = view().getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left + ui.cam.x) / TS), y = Math.floor((e.clientY - r.top + ui.cam.y) / TS);
  if (x < 0 || y < 0 || x >= G.s.W || y >= G.s.H) return null;
  return { x, y, sx: e.clientX - r.left, sy: e.clientY - r.top };
}

function describeTile(x, y) {
  const s = G.s;
  if (!explored(x, y)) return 'Unexplored';
  const T = s.tiles[y * s.W + x], o = Gm.objAt(x, y) || Gm.footAt(x, y), h = Gm.heroAt(x, y);
  const lines = [];
  if (h) lines.push(`<b>${esc(h.name)}</b> · ${h.owner === VP() ? 'your commander' : 'enemy commander'} · level ${h.level}`);
  if (o) {
    switch (o.type) {
      case 'town': lines.push(`<b>${esc(o.name)}</b> · ${o.owner == null ? 'unclaimed' : o.owner === VP() ? 'your town' : 'enemy town'}`); break;
      case 'mine': lines.push(`<b>${D.MINES[o.res].name}</b> · +${D.MINES[o.res].yield} ${D.RES_INFO[o.res].name}/day · ${o.owner == null ? 'unclaimed' : o.owner === VP() ? 'yours' : 'enemy'}`); break;
      case 'pile': lines.push(`<b>${D.RES_INFO[o.res].name}</b> · ${o.amount}`); break;
      case 'chest': lines.push('<b>Supply cache</b>'); break;
      case 'relic': { const a = D.ARTIFACTS[o.relic]; lines.push(`<b style="color:${D.RARITY[a.r].color}">${a.name}</b> · ${D.RARITY[a.r].name} artifact<br>${D.artifactDesc(o.relic)}`); break; }
      case 'tower': lines.push('<b>Watchtower</b> · reveals the land around it'); break;
      case 'site': {
        const S = D.SITES[o.kind], sel = selHero();
        lines.push(`<b>${S.name}</b><br>${S.desc}`);
        if (S.guarded) lines.push(o.cleared ? 'Plundered' : `Guarded by ${D.qtyWord(o.guard.count).toLowerCase()} ${D.UNITS[o.guard.unit].name}${sel ? ` · ${threat(sel, { unit: o.guard.unit, count: o.guard.count })}` : ''}`);
        if (S.perHero && sel) lines.push(o.visited.includes(sel.id) ? `${esc(sel.name)} has visited` : `Not yet visited by ${esc(sel.name)}`);
        else if (D.siteSpent(o, sel, s.day)) lines.push(S.weekly || S.heroWeekly ? 'Used this week' : 'Empty');
        if (o.color) lines.push(`<span style="color:${D.KEY_COLORS[o.color]}">${o.color[0].toUpperCase() + o.color.slice(1)} key-codex</span>${o.kind === 'blastdoor' && !(s.players[VP()].keys || []).includes(o.color) ? ' · you lack this key' : ''}`);
        if (o.spell && D.SPELLS[o.spell]) lines.push(`Teaches ${D.SPELLS[o.spell].name}`);
        if (o.skill && D.SKILLS[o.skill]) lines.push(`Teaches ${D.SKILLS[o.skill].name}`);
        if (o.kind === 'derelict' && o.cleared) lines.push(`+${D.MINES[o.res].yield} ${D.RES_INFO[o.res].name}/day · ${o.owner == null ? 'unclaimed' : o.owner === VP() ? 'yours' : 'enemy'}`);
        if (o.kind === 'penal') lines.push(o.freed ? 'Empty' : 'A prisoner waits inside');
        break;
      }
      case 'monster': {
        const sel = selHero();
        lines.push(`<b>${D.qtyWord(o.count)} ${D.UNITS[o.unit].name}</b>${D.UNITS[o.unit].elite ? ' · <span class="warn">elite</span>' : ''}${sel ? ` · ${threat(sel, o)}` : ''}`);
        break;
      }
    }
  }
  const guarded = !o && Gm.isGuarded(y * s.W + x);
  lines.push(`${D.TERRAIN[T.t].name}${T.road ? ' · road' : ''}${guarded ? ' · <span class="warn">guarded</span>' : ''}`);
  return lines.join('<br>');
}
function threat(h, o) {
  const r = (o.count * D.unitValue(o.unit)) / Math.max(1, Gm.armyStrength(h.army, h));
  if (r < 0.4) return '<span class="t0">Trivial</span>';
  if (r < 0.8) return '<span class="t1">Weak</span>';
  if (r < 1.25) return '<span class="t2">Even fight</span>';
  if (r < 2) return '<span class="t3">Strong</span>';
  return '<span class="t4">Deadly</span>';
}

function setupMapInput() {
  const cv = view(), tip = $('#tip');
  cv.addEventListener('pointerdown', e => { ui.drag = { x: e.clientX, y: e.clientY, cx: ui.cam.x, cy: ui.cam.y, moved: false, id: e.pointerId }; });
  cv.addEventListener('pointermove', e => {
    if (ui.drag && (e.buttons || e.pointerType === 'touch')) {
      const dx = e.clientX - ui.drag.x, dy = e.clientY - ui.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) ui.drag.moved = true;
      if (ui.drag.moved) { ui.cam.x = ui.drag.cx - dx; ui.cam.y = ui.drag.cy - dy; clampCam(); tip.hidden = true; return; }
    }
    const t = tileFromEvent(e); ui.hover = t;
    if (t && e.pointerType !== 'touch') {
      tip.innerHTML = describeTile(t.x, t.y); tip.hidden = false;
      const vw = cv.clientWidth; const left = t.sx + 18 + 260 > vw ? t.sx - 268 : t.sx + 18;
      tip.style.left = `${Math.max(4, left)}px`; tip.style.top = `${Math.max(4, t.sy + 14)}px`;
    } else tip.hidden = true;
  });
  cv.addEventListener('pointerleave', () => { ui.hover = null; tip.hidden = true; });
  cv.addEventListener('pointerup', e => {
    const d = ui.drag; ui.drag = null;
    if (d && d.moved) return;
    const t = tileFromEvent(e); if (t) onMapClick(t.x, t.y);
  });
  cv.addEventListener('dblclick', e => {
    const t = tileFromEvent(e); if (!t || ui.busy || !explored(t.x, t.y)) return;
    const o = Gm.objAt(t.x, t.y) || Gm.footAt(t.x, t.y);
    if (o && o.type === 'town' && o.owner === VP()) { clearTimeout(ui.pendingMove); ui.pendingMove = null; ui.path = null; ui.target = null; openTown(o); }
  });
  $('#minimap').addEventListener('pointerdown', e => {
    const r = e.currentTarget.getBoundingClientRect(); const k = r.width / G.s.W;
    centerOn({ x: Math.floor((e.clientX - r.left) / k), y: Math.floor((e.clientY - r.top) / k) });
  });
  document.addEventListener('keydown', e => {
    if (!G.s || $('#game').hidden || modalOpen() || e.target.matches('input')) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) { ui.keys.add(k); e.preventDefault(); }
    if (ui.busy) return;
    if (k === ' ' || k === 'enter') { e.preventDefault(); doMove(); }
    if (k === 'e') endTurn();
    if (k === 'h') nextHero();
    if (k === 't') { const h = selHero(); const t = h && Gm.objAt(h.x, h.y); openTown(ui.focus === 'town' && selTown() ? selTown() : t && t.type === 'town' ? t : Gm.townsOf(VP())[0]); }
    if (k === 'i' && selHero()) openHero(selHero());
    if (k === 'k') showKingdom();
    if (k === 'z' && selHero()) { const h = selHero(); h.sleep = !h.sleep; toast(`${h.name} ${h.sleep ? 'rests until woken (Z)' : 'is ready for orders'}.`); updateSide(); }
    if (k === 'b' && selHero()) openSpellbook(selHero());
  });
  document.addEventListener('keyup', e => ui.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => ui.keys.clear());
}

async function onMapClick(x, y) {
  if (ui.busy || !G.s || G.s.over) return;
  if (!explored(x, y)) return;
  const foot = Gm.footAt(x, y);
  if (foot && !Gm.objAt(x, y)) { x = foot.x; y = foot.y; }   // clicked the building picture: go to its entrance
  const h = selHero(), o = Gm.objAt(x, y), other = Gm.heroAt(x, y);
  if (other && other.owner === VP() && other !== h) {
    if (h && Math.max(Math.abs(h.x - x), Math.abs(h.y - y)) === 1 && !(o && o.type === 'town')) { await openExchange(h, other); return; }
    selectHero(other); return;
  }
  const ownTown = o && o.type === 'town' && o.owner === VP();
  if (ownTown && (!h || (h.x === x && h.y === y))) { await openTown(o); return; }
  if (!h) return;
  if (h.x === x && h.y === y) return;
  if (ui.target && ui.target.x === x && ui.target.y === y && ui.path) {
    // A second click on your own town may be the start of a double-click that opens it: wait briefly.
    if (ownTown) { clearTimeout(ui.pendingMove); ui.pendingMove = setTimeout(() => { ui.pendingMove = null; doMove(); }, 280); return; }
    await doMove(); return;
  }
  planPath(h, x, y, true);
}

function planPath(h, x, y, notify) {
  const paths = Gm.computePaths(h, G.s.players[VP()].explored);
  const path = Gm.pathTo(paths, x, y);
  ui.path = path; ui.target = path ? { x, y } : null;
  h.dest = path ? { x, y } : null;
  if (!path && notify) toast('No route there.');
  updateSide();
}

async function doMove() {
  const h = selHero(); if (!h || !ui.path || ui.busy) return;
  if (ui.path[0].step > h.mp) { toast(`${h.name} has no movement left today.`); return; }
  ui.busy = true; setBusy(true);
  const path = ui.path, tgt = ui.target;
  ui.path = null; ui.target = null;
  const res = await Gm.moveHero(h, path);
  ui.busy = false; setBusy(false);
  if (G.s.heroes[h.id]) {
    if (res === 'nomp' && tgt) planPath(h, tgt.x, tgt.y, false);
    else h.dest = null;
  } else { ui.selId = Gm.heroesOf(VP())[0]?.id ?? null; }
  updateUI();
}

function selectHero(h) {
  ui.selId = h.id; ui.focus = 'hero'; ui.path = null; ui.target = null;
  if (h.dest) planPath(h, h.dest.x, h.dest.y, false);
  centerOn(h); updateUI();
}
function nextHero() {
  const hs = Gm.heroesOf(VP()); if (!hs.length) return;
  const i = hs.findIndex(h => h.id === ui.selId);
  const order = [...hs.slice(i + 1), ...hs.slice(0, i + 1)];
  selectHero(order.find(h => h.mp >= 100 && !h.sleep) || order.find(h => !h.sleep) || order[0]);
}

async function endTurn() {
  if (ui.busy || G.s.over) return;
  if (opt('confirmEnd') && Gm.heroesOf(VP()).some(h => h.mp >= 300 && !h.sleep)) {
    const ok = await modal({ title: 'End turn?', html: '<p>Some of your commanders can still move.</p>', buttons: [{ label: 'Keep playing', value: false, cancel: true }, { label: 'End turn', value: true, primary: true }] });
    if (!ok) return;
  }
  ui.busy = true; ui.path = null; ui.target = null; setBusy(true); Audio.sfx('turn');
  await Gm.endTurn();
  ui.busy = false; setBusy(false);
  updateUI();
}
function setBusy(b) { $('#btn-end').disabled = b; $('#btn-next').disabled = b; }

// ---------------- side panel & top bar ----------------
function updateUI() { if (!G.s) return; updateTop(); updateSide(); drawMinimap(); }

function updateTop() {
  const s = G.s, p = s.players[VP()], inc = Gm.dailyIncome(VP());
  $('#res').innerHTML = D.RES.map(r => `<div class="res" title="${D.RES_INFO[r].name}: ${p.res[r].toLocaleString()} (+${inc[r]} per day)">${resImg(r)}<b>${p.res[r].toLocaleString()}</b>${inc[r] ? `<small>+${inc[r].toLocaleString()}</small>` : ''}</div>`).join('');
  const d = s.day - 1;
  $('#date').innerHTML = `<span>Month ${Math.floor(d / 28) + 1}</span><span>Week ${Math.floor(d % 28 / 7) + 1}</span><span>Day ${d % 7 + 1}</span>`;
}

function armySlots(army, attrs = '') {
  return `<div class="slots">${army.map((st, i) => st
    ? `<button class="slot" data-idx="${i}" ${attrs} title="${esc(D.UNITS[st.type].name)}"><img src="${portrait(st.type)}" alt=""><span>${st.count}</span></button>`
    : `<button class="slot empty" data-idx="${i}" ${attrs} aria-label="Empty slot"></button>`).join('')}</div>`;
}

// Small stat icons for the info box (attack, defence, power, knowledge).
const statIcon = k => canvasURL('st:' + k, 40, 40, g => {
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#1a120a'; g.lineWidth = 2;
  const gold = g.createLinearGradient(0, 0, 0, 40); gold.addColorStop(0, '#ffe39a'); gold.addColorStop(1, '#9a6c22');
  const steel = g.createLinearGradient(0, 0, 40, 40); steel.addColorStop(0, '#f2f4f6'); steel.addColorStop(1, '#7a828a');
  const poly = (pts, f) => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = f; g.fill(); g.stroke(); };
  if (k === 'atk') { poly([[20, 3], [24, 9], [24, 26], [16, 26], [16, 9]], steel); poly([[9, 26], [31, 26], [31, 30], [9, 30]], gold); poly([[17, 30], [23, 30], [23, 38], [17, 38]], '#6a3a1a'); }
  if (k === 'def') { poly([[6, 5], [34, 5], [34, 18], [20, 37], [6, 18]], steel); poly([[18, 9], [22, 9], [22, 30], [18, 30]], gold); poly([[10, 15], [30, 15], [30, 19], [10, 19]], gold); }
  if (k === 'pow') { const fl = g.createLinearGradient(0, 4, 0, 38); fl.addColorStop(0, '#fff2a0'); fl.addColorStop(0.5, '#ff9a30'); fl.addColorStop(1, '#c02a10'); poly([[20, 3], [29, 16], [27, 24], [33, 21], [30, 33], [20, 38], [10, 33], [7, 21], [13, 24], [11, 15]], fl); }
  if (k === 'dmg') { g.save(); g.translate(20, 20); g.rotate(-0.7); poly([[-2, -17], [2, -17], [2, 8], [-2, 8]], steel); poly([[-8, 8], [8, 8], [8, 11], [-8, 11]], gold); poly([[-2, 11], [2, 11], [2, 18], [-2, 18]], '#6a3a1a'); g.restore(); }
  if (k === 'hp') { g.beginPath(); g.moveTo(20, 35); g.bezierCurveTo(2, 22, 4, 6, 14, 7); g.bezierCurveTo(18, 7, 20, 11, 20, 13); g.bezierCurveTo(20, 11, 22, 7, 26, 7); g.bezierCurveTo(36, 6, 38, 22, 20, 35); g.closePath(); g.fillStyle = '#d23a2a'; g.fill(); g.stroke(); }
  if (k === 'spd') poly([[24, 3], [9, 22], [19, 22], [15, 37], [31, 16], [21, 16]], gold);
  if (k === 'grow') { g.fillStyle = gold; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('#', 20, 21); g.strokeText('#', 20, 21); }
  if (k === 'know') { poly([[4, 10], [20, 6], [20, 34], [4, 37]], '#7a3a2a'); poly([[36, 10], [20, 6], [20, 34], [36, 37]], '#8a4a32'); poly([[7, 12], [18, 9], [18, 31], [7, 34]], '#efe4c8'); poly([[33, 12], [22, 9], [22, 31], [33, 34]], '#efe4c8'); }
});
const TOWN_SPRITE = { concord: true, hollow: true, rustbound: true, scrapjaw: true, deathless: true, palefang: true };
const townThumb = t => (TOWN_SPRITE[t.faction] ? `assets/sprites/town_${t.faction}.png`
  : canvasURL('tt:' + t.faction, 120, 100, g => A.drawTown(g, 60, 58, 42, t.faction, '#8d8478', 0)));
const selTown = () => (G.s && ui.selTownId != null ? G.s.objects[ui.selTownId] : null);

function heroInfoHtml(h) {
  const nextXp = D.xpForLevel(h.level + 1);
  return `<div class="ib-top"><button class="ib-face" data-act="hero" title="Open the commander screen (I)"><img src="${heroAvatar(h.name)}" alt="${esc(h.name)}"></button>
      <div><h3>${esc(h.name)}</h3><p>Level ${h.level} ${h.cls === 'magic' ? 'battle-mystic' : 'warlord'} · ${h.xp.toLocaleString()} / ${nextXp.toLocaleString()} XP</p>
        <div class="ib-stats">${['atk', 'def', 'pow', 'know'].map(k => `<div title="${D.STAT_NAMES[k]}"><img src="${statIcon(k)}" alt="${D.STAT_NAMES[k]}"><b>${D.hstat(h, k)}</b></div>`).join('')}</div></div></div>
    <div class="ib-line"><span title="Morale: extra turns when high, lost turns when low">Morale <b>${fmtSign(D.heroMorale(h))}</b></span><span title="Luck: chance of double damage">Luck <b>${fmtSign(D.heroLuck(h))}</b></span><span>Mana <b>${h.mana}/${D.maxMana(h)}</b></span><span>Move <b>${h.mp}</b></span></div>
    <div class="ib-army">${armySlots(h.army, 'data-act="unit"')}</div>
    <div class="hc-btns"><button class="btn sm" data-act="hero" title="Commander screen (I)">Commander</button><button class="btn sm" data-act="book" title="Rites (B)">Rites</button></div>
    <div class="hc-btns">${(() => { const tt = Gm.objAt(h.x, h.y); return tt && tt.type === 'town' && tt.owner === VP() ? `<button class="btn sm primary" data-act="enter" data-id="${tt.id}">Enter ${esc(tt.name)}</button>` : ''; })()}<button class="btn sm" data-act="sleep" title="Rest: skipped by Next (Z)">${h.sleep ? 'Wake' : 'Rest'}</button></div>
    ${ui.path ? `<p class="route">Route: ${Math.ceil(ui.path[ui.path.length - 1].total / D.DAY_MP * 10) / 10} days of travel. Click the target again or press Space to march.</p>` : ''}`;
}
function townInfoHtml(t) {
  const vh = Gm.heroAt(t.x, t.y);
  return `<div class="ib-top"><button class="ib-face town" data-act="town" title="Open ${esc(t.name)}"><img src="${townThumb(t)}" alt="${esc(t.name)}"></button>
      <div><h3>${esc(t.name)}</h3><p>${esc(D.FACTIONS[t.faction].name)}</p><p>Income ${Gm.townIncome(t).toLocaleString()} a day · ${t.builtToday ? 'built today' : 'can build today'}</p>
      <p>${vh ? `Visiting: ${esc(vh.name)}` : 'No commander in town'}</p></div></div>
    <div class="ib-line"><span>Garrison</span></div>
    <div class="ib-army">${armySlots(t.garrison, 'data-act="gunit"')}</div>
    <div class="hc-btns"><button class="btn sm primary" data-act="town">Open town (T)</button>${vh ? `<button class="btn sm" data-act="selvh">Select ${esc(vh.name.split(' ').slice(-1)[0])}</button>` : ''}</div>`;
}

function updateSide() {
  const s = G.s, h = selHero(), t = selTown();
  const card = $('#hero-card');
  if (t && ui.focus === 'town') card.innerHTML = townInfoHtml(t);
  else if (h) card.innerHTML = heroInfoHtml(h);
  else card.innerHTML = '<p class="muted">Select a commander or a town.</p>';
  card.querySelectorAll('[data-act="unit"]').forEach(el => el.onclick = () => { const st = h && h.army[+el.dataset.idx]; if (st) unitInfo(st.type, st.count); });
  card.querySelectorAll('[data-act="gunit"]').forEach(el => el.onclick = () => { const st = t && t.garrison[+el.dataset.idx]; if (st) unitInfo(st.type, st.count); });
  card.querySelectorAll('[data-act="hero"]').forEach(el => el.onclick = () => h && openHero(h));
  card.querySelectorAll('[data-act="book"]').forEach(el => el.onclick = () => h && openSpellbook(h));
  card.querySelectorAll('[data-act="enter"]').forEach(el => el.onclick = () => openTown(G.s.objects[+el.dataset.id]));
  card.querySelectorAll('[data-act="sleep"]').forEach(el => el.onclick = () => { if (h) { h.sleep = !h.sleep; updateSide(); } });
  card.querySelectorAll('[data-act="town"]').forEach(el => el.onclick = () => t && openTown(t));
  card.querySelectorAll('[data-act="selvh"]').forEach(el => el.onclick = () => { const vh = t && Gm.heroAt(t.x, t.y); if (vh) selectHero(vh); });

  const heroes = Gm.heroesOf(VP());
  const hs = heroes.map(x => {
    const mp = Math.round(100 * x.mp / D.maxMp(x)), mn = D.maxMana(x) ? Math.round(100 * x.mana / D.maxMana(x)) : 0;
    return `<button class="pf ${x.id === ui.selId && ui.focus !== 'town' ? 'sel' : ''}" data-id="${x.id}" title="${esc(x.name)} · click to select, double-click for details">
      <img src="${heroStrip(x.name)}" alt="${esc(x.name)}" style="${x.sleep ? 'filter:grayscale(.8) brightness(.6)' : ''}">${x.sleep ? '<span class="zz">Zz</span>' : ''}<span class="vb mp"><i style="height:${mp}%"></i></span><span class="vb mana"><i style="height:${mn}%"></i></span><span class="lbl">${esc(x.name.split(' ').slice(-1)[0])}</span></button>`;
  });
  const rows = Math.max(2, Gm.heroesOf(VP()).length, Gm.townsOf(VP()).length);
  while (hs.length < rows) hs.push('<div class="pf empty" aria-hidden="true"></div>');
  $('#hero-list').innerHTML = hs.join('');
  $('#hero-list').querySelectorAll('.pf[data-id]').forEach(el => {
    el.onclick = () => selectHero(s.heroes[+el.dataset.id]);
    el.ondblclick = () => openHero(s.heroes[+el.dataset.id]);
  });
  const towns = Gm.townsOf(VP());
  const ts = towns.map(x => `<button class="pf town ${x.id === ui.selTownId && ui.focus === 'town' ? 'sel' : ''}" data-id="${x.id}" title="${esc(x.name)} · click to select, double-click to open">
      <img src="${townThumb(x)}" alt="${esc(x.name)}">${x.builtToday ? '' : '<span class="dot" title="Can build today"></span>'}<span class="lbl">${esc(x.name)}</span></button>`);
  while (ts.length < rows) ts.push('<div class="pf empty" aria-hidden="true"></div>');
  $('#town-list').innerHTML = ts.join('');
  $('#town-list').querySelectorAll('.pf[data-id]').forEach(el => {
    el.onclick = () => selectTown(s.objects[+el.dataset.id]);
    el.ondblclick = () => openTown(s.objects[+el.dataset.id]);
  });
}
function selectTown(t) {
  if (!t) return;
  ui.selTownId = t.id; ui.focus = 'town'; ui.path = null; ui.target = null;
  centerOn(t); updateSide();
}

const fmtSign = n => (n > 0 ? `+${n}` : `${n}`);
function unitStatsLine(u) {
  return `ATK ${u.atk} · DEF ${u.def} · DMG ${u.min}–${u.max} · HP ${u.hp} · SPD ${u.spd}${u.shots ? ` · Shots ${u.shots}` : ''}`;
}
function unitInfo(type, count) {
  const u = D.UNITS[type];
  return modal({
    title: `${count ? count + ' ' : ''}${esc(u.name)}`,
    html: `<div class="uinfo"><img src="${portrait(type)}" alt=""><div><p>${esc(u.desc)}</p><p class="mono">${unitStatsLine(u)}</p>
      ${u.ab.length ? `<ul>${u.ab.map(a => `<li>${D.ABILITIES[a]}</li>`).join('')}</ul>` : ''}${u.shots ? '<p class="muted">Ranged: shoots unless an enemy stands next to it.</p>' : ''}</div></div>`,
  });
}

// ---------------- army management ----------------
function armyEditor(container, armies, rerender) {
  let sel = null;
  container.addEventListener('click', e => {
    const el = e.target.closest('.slot[data-army]'); if (!el) return;
    const key = el.dataset.army, idx = +el.dataset.idx, arr = armies[key].arr;
    if (!sel) { if (arr[idx]) { sel = { key, idx }; el.classList.add('picked'); } return; }
    const fi = sel.idx, from = armies[sel.key], to = armies[key], a = from.arr[fi], b = to.arr[idx];
    const sameSlot = sel.key === key && fi === idx; sel = null;
    if (sameSlot || !a) { rerender(); return; }
    const leavesEmpty = from.hero && from !== to && from.arr.filter(Boolean).length === 1;
    if (e.shiftKey) {
      if (b && b.type !== a.type) { rerender(); return; }
      const n = Math.floor(a.count / 2); if (n < 1) { rerender(); return; }
      a.count -= n; if (b) b.count += n; else to.arr[idx] = { type: a.type, count: n };
    } else if (!b || b.type === a.type) {
      if (leavesEmpty) { toast('A commander must keep at least one stack.', 'bad'); rerender(); return; }
      if (b) b.count += a.count; else to.arr[idx] = a;
      from.arr[fi] = null;
    } else {
      from.arr[fi] = b; to.arr[idx] = a;
    }
    rerender();
  });
}
function armyRow(key, army, label) {
  return `<div class="army-row"><h4>${esc(label)}</h4><div class="slots">${army.map((st, i) => st
    ? `<button class="slot" data-army="${key}" data-idx="${i}" title="${esc(D.UNITS[st.type].name)}"><img src="${portrait(st.type)}" alt=""><span>${st.count}</span></button>`
    : `<button class="slot empty" data-army="${key}" data-idx="${i}" aria-label="Empty slot"></button>`).join('')}</div></div>`;
}

async function openExchange(a, b) {
  await modal({
    title: 'Commanders meet', cls: 'wide-ish',
    html: '<div id="xchg"></div><p class="hint">Click a stack, then another slot to move, merge or swap. Shift-click splits a stack in half.</p>',
    buttons: [{ label: 'Done', value: null, primary: true }],
    onMount: wrap => {
      const box = wrap.querySelector('#xchg');
      const armies = { a: { arr: a.army, hero: true }, b: { arr: b.army, hero: true } };
      const render = () => { box.innerHTML = armyRow('a', a.army, a.name) + armyRow('b', b.army, b.name); };
      render(); armyEditor(box, armies, render);
    },
  });
  updateUI();
}

// ---------------- town screen (HoMM-style panorama) ----------------
const townArt = {};
const TOWN_ART_FACTIONS = ['concord', 'hollow', 'rustbound', 'scrapjaw', 'deathless', 'palefang'];
// Picture of one building for cards and windows: cut from the loaded town art (buildings live in an atlas).
const townArtLoaded = {}, bpicCache = {};
function buildingPic(faction, id) {
  const key = faction + '/' + id;
  if (bpicCache[key]) return bpicCache[key];
  const im = townArtLoaded[faction]?.imgs[id];
  if (!im) return `assets/town/${faction}/${id}.webp`;
  const c = document.createElement('canvas'), k = Math.min(1, 320 / Math.max(im.width, im.height));
  c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  return (bpicCache[key] = c.toDataURL('image/webp', 0.85));
}
function loadTownArt(faction) {
  if (!TOWN_ART_FACTIONS.includes(faction)) return Promise.resolve(null);
  if (!townArt[faction]) {
    townArt[faction] = (async () => {
      const dir = `assets/town/${faction}/`;
      const meta = await (await fetch(dir + 'meta.json')).json();
      const imgs = {};
      const glow = {}, anim = {};
      if (meta.atlas) {   // buildings and their glow packed into one picture (tools/pack_town.py)
        const at = await loadImage(dir + 'atlas.webp');
        const cut = ([x, y, w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(at, x, y, w, h, 0, 0, w, h); return c; };
        const keys = Object.keys(meta).filter(k => k !== 'base' && k !== 'atlas');
        for (const k of keys) { if (meta[k].r) imgs[k] = cut(meta[k].r); if (meta[k].gr) glow[k] = cut(meta[k].gr); }
        await Promise.all(keys.filter(k => meta[k].anim).map(async k => { anim[k] = await loadImage(dir + k + '_anim.webp').catch(() => null); }));
        return { base: await loadImage(dir + 'base.webp'), imgs, meta, glow, anim };
      }
      await Promise.all(Object.keys(meta).filter(k => k !== 'base').map(async k => {
        imgs[k] = await loadImage(dir + k + '.webp');
        if (meta[k].glow) glow[k] = await loadImage(dir + k + '_glow.webp').catch(() => null);
        if (meta[k].anim) anim[k] = await loadImage(dir + k + '_anim.webp').catch(() => null);
      }));
      return { base: await loadImage(dir + 'base.webp'), imgs, meta, glow, anim };
    })().then(a => (townArtLoaded[faction] = a)).catch(() => null);
  }
  return townArt[faction];
}
function openTown(t) {
  if (!t || t.type !== 'town' || t.owner !== VP()) return Promise.resolve();
  return new Promise(resolve => {
    const wrap = document.createElement('div'); wrap.className = 'overlay';
    wrap.innerHTML = `<div class="panel townv" role="dialog" aria-modal="true">
      <div class="tv-scene"><canvas id="tv-canvas" aria-label="Town view"></canvas><div class="tv-label" hidden></div></div>
      <div class="tv-panel"></div>
      <div class="tv-bottom"></div>
      <div class="tv-pop" hidden><div class="tv-pop-head"><h3></h3><button class="tv-x" data-act="popclose" aria-label="Close" title="Close (Esc)">✕</button></div><div class="tv-pop-body"></div></div></div>`;
    $('#modal-root').append(wrap);
    const root = wrap.firstChild, cv = root.querySelector('#tv-canvas'), label = root.querySelector('.tv-label');
    const panel = root.querySelector('.tv-panel'), bottom = root.querySelector('.tv-bottom');
    let scene = null, hover = null, current = 'none', popup = null, fortPick = null, hallPick = null, armies = {}, raf = 0;
    const pop = root.querySelector('.tv-pop');
    Audio.music(townMusic(t));   // each town plays its faction's theme
    const close = () => { cancelAnimationFrame(raf); wrap.remove(); document.removeEventListener('keydown', onKey); Audio.music(mapMusic()); updateUI(); resolve(); };
    const onKey = e => { if (e.key !== 'Escape' || e.target.matches('input') || $('#modal-root').lastChild !== wrap) return; if (popup === 'hall' && hallPick) { hallPick = null; render(); } else if (popup) { popup = null; render(); } else close(); };
    document.addEventListener('keydown', onKey);

    async function rebuildScene() {
      const art = await loadTownArt(t.faction);
      scene = art ? renderTownArt(t, art) : renderTownScene(t, Math.min(2, window.devicePixelRatio || 1));
      const box = root.querySelector('.tv-scene');
      box.style.aspectRatio = `${scene.w} / ${scene.h}`;
      box.style.width = `min(100%, calc(64vh * ${(scene.w / scene.h).toFixed(3)}))`;
      cancelAnimationFrame(raf); drawScene();
    }
    function drawScene() {
      if (!scene) return;
      const w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
      if (!w) return;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(scene.canvas, 0, 0, cv.width, cv.height);
      const kx = cv.width / scene.w, ky = cv.height / scene.h;
      if (scene.animate) scene.animate(g, kx, ky, performance.now());
      const r = hover && scene.regions.find(x => x.key === hover);
      if (r && scene.highlight) scene.highlight(g, hover, kx, ky);
      else if (r) {
        g.save(); g.strokeStyle = 'rgba(240,207,114,0.95)'; g.lineWidth = 2 * dpr; g.shadowColor = '#f0cf72'; g.shadowBlur = 14 * dpr;
        g.strokeRect(r.x * kx, r.y * ky, r.w * kx, r.h * ky); g.restore();
      }
      // ambient chimney smoke and window flicker
      const now = performance.now();
      g.fillStyle = 'rgba(120,110,100,0.18)';
      for (const rr of scene.regions) { if (rr.back) continue; const p = ((now * 0.02 + rr.x) % 60) / 60; g.beginPath(); g.ellipse((rr.x + rr.w * 0.3) * kx, (rr.y + 10 - p * 50) * ky, (6 + p * 10) * kx, (4 + p * 6) * ky, 0, 0, Math.PI * 2); g.fill(); }
      raf = requestAnimationFrame(drawScene);
    }
    function regionAt(e) {
      if (!scene) return null;
      const rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) / rc.width * scene.w, y = (e.clientY - rc.top) / rc.height * scene.h;
      if (scene.art) return scene.regions.find(r => regionHit(r, x, y)) || null;
      const hits = scene.regions.filter(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      hits.sort((a, b) => (a.back ? 1 : 0) - (b.back ? 1 : 0) || (b.y + b.h) - (a.y + a.h));
      return hits[0] || null;
    }
    const regionName = key => (key === 'guild' ? `Mage Guild level ${Gm.guildLevel(t)}` : key.startsWith('dw') ? D.buildingName(t.faction, t.built[key + 'u'] ? key + 'u' : key) : key === 'hall' ? (t.built.hall3 ? 'Capitol' : t.built.hall2 ? 'City Hall' : 'Town Hall') : key === 'fort' ? (t.built.castle ? 'Castle' : t.built.citadel ? 'Citadel' : 'Fort') : SCENE_NAMES[key]);
    cv.addEventListener('pointermove', e => {
      const r = regionAt(e); hover = r ? r.key : null; cv.style.cursor = r ? 'pointer' : 'default';
      if (r) { label.textContent = regionName(r.key); label.hidden = false; const rc = cv.getBoundingClientRect(); label.style.left = `${Math.min(rc.width - 180, e.clientX - rc.left + 14)}px`; label.style.top = `${e.clientY - rc.top + 10}px`; }
      else label.hidden = true;
    });
    cv.addEventListener('pointerleave', () => { hover = null; label.hidden = true; });
    cv.addEventListener('click', e => { const r = regionAt(e); if (!r) return; if (r.key === 'tavern') { openRecruitment(t).then(render); return; } if (r.key === 'guild') { openGuildRoom(t).then(render); return; } if (r.key === 'market' && t.built.market) { openMarket().then(() => { render(); updateTop(); }); return; } if (/^dw\d$/.test(r.key) && t.built[r.key]) { openDwelling(t, D.FACTIONS[t.faction].units[+r.key[2] - 1]).then(() => { render(); updateTop(); }); return; } if (r.key === 'hall' || r.key === 'fort') { popup = r.key; fortPick = null; hallPick = null; } else current = r.key; render(); });

    // ---- panels ----
    function hallPanel(p) {
      const art = TOWN_ART_FACTIONS.includes(t.faction);
      const pic = id => (art ? `<img src="${buildingPic(t.faction, id)}" alt="">` : `<span class="ph">${esc(D.buildingName(t.faction, id)[0])}</span>`);
      // Each chain shows one card: its next unbuilt step, or its top level once complete.
      const chain = ids => ids.find(id => !t.built[id]) || ids[ids.length - 1];
      const groups = [
        ['Civic', [chain(['hall2', 'hall3']), 'tavern', 'market', 'depot']],
        ['Fortifications & magic', [chain(['fort', 'citadel', 'castle']), chain(['mg1', 'mg2', 'mg3', 'mg4', 'mg5'])]],
        ['Army', [1, 2, 3, 4, 5].map(n => chain(['dw' + n, 'dw' + n + 'u']))],
      ];
      const card = id => {
        const st = Gm.buildStatus(t, id, p.res), cost = D.buildingCost(t.faction, id);
        const reqNames = D.BUILDINGS[id].req.filter(r => !t.built[r]).map(r => D.buildingName(t.faction, r)).join(', ');
        const ribbon = st === 'built' ? '<span>Built</span><span>✓</span>'
          : st === 'ok' ? `<span>Can build</span><button class="btn sm primary" data-act="build" data-id="${id}">Build</button>`
          : st === 'cost' ? '<span>Not enough resources</span>'
          : st === 'today' ? '<span>Already built today</span>'
          : `<span>Requires ${esc(reqNames)}</span>`;
        return `<div class="bc2 ${st}"><div class="pic">${pic(id)}</div>
          <div class="txt"><b>${esc(D.buildingName(t.faction, id))}</b><p>${esc(D.buildingDesc(t.faction, id))}</p>${st !== 'built' ? `<div class="costs">${costHtml(cost)}</div>` : ''}</div>
          <div class="ribbon">${ribbon}</div></div>`;
      };
      return `<h3>${t.built.hall3 ? 'Capitol' : t.built.hall2 ? 'City Hall' : 'Town Hall'} · construction <small class="muted">${t.builtToday ? 'One structure was raised today. Come back tomorrow.' : 'One structure may be raised each day.'}</small></h3>
        ${groups.map(([name, ids]) => `<div class="hall-group"><h4>${name}</h4><div class="hall-grid">${ids.map(card).join('')}</div></div>`).join('')}`;
    }
    // Construction window (painted): eleven cards in rows of 4, 3 and 4, each with a status ribbon
    // (gold built, green can build, red cannot) and a tick or cross; a card opens its build panel.
    function hallWindow(p) {
      const art = TOWN_ART_FACTIONS.includes(t.faction);
      const chain = ids => ids.find(id => !t.built[id]) || ids[ids.length - 1];
      const ids = [chain(['hall2', 'hall3']), chain(['fort', 'citadel', 'castle']), chain(['mg1', 'mg2', 'mg3', 'mg4', 'mg5']), 'tavern',
        'market', 'depot', chain(['dw1', 'dw1u']), ...[2, 3, 4, 5].map(n => chain(['dw' + n, 'dw' + n + 'u']))];
      const rows = [ids.slice(0, 4), ids.slice(4, 7), ids.slice(7)];
      const name = id => D.buildingName(t.faction, id);
      const card = id => {
        const st = Gm.buildStatus(t, id, p.res), rib = st === 'built' ? 'gold' : st === 'ok' ? 'green' : 'red';
        const mark = st === 'built' ? 'tick' : st === 'ok' ? '' : 'x';
        return `<button class="th-card ${st} ${hallPick === id ? 'sel' : ''}" data-act="hpick" data-id="${id}" title="${esc(name(id))}">
          <span class="th-pic">${art ? `<img src="${buildingPic(t.faction, id)}" alt="">` : `<span class="ph">${esc(name(id)[0])}</span>`}</span>
          ${mark ? `<img class="th-mark" src="assets/ui/townhall/mark_${mark}.webp" alt="">` : ''}
          <span class="th-rib" style="background-image:url(assets/ui/townhall/ribbon_${rib}.webp)"><span>${esc(name(id))}</span></span></button>`;
      };
      let detail = '';
      if (hallPick) {
        const id = hallPick, st = Gm.buildStatus(t, id, p.res), cost = D.buildingCost(t.faction, id);
        const reqNames = D.BUILDINGS[id].req.filter(r => !t.built[r]).map(r => name(r)).join(', ');
        const why = st === 'built' ? 'Already built.' : st === 'ok' ? '' : st === 'cost' ? 'Not enough resources.' : st === 'today' ? 'A structure was already raised today.' : `Requires ${reqNames}.`;
        detail = `<div class="th-detail"><div class="th-dpic">${art ? `<img src="${buildingPic(t.faction, id)}" alt="">` : ''}</div>
          <div class="th-dtxt"><h4>${esc(name(id))}</h4><p>${esc(D.buildingDesc(t.faction, id))}</p>
          ${st !== 'built' ? `<div class="costs">${costHtml(cost)}</div>` : ''}${why ? `<p class="th-why ${st}">${esc(why)}</p>` : ''}
          <div class="th-dbtn">${st === 'ok' ? `<button class="btn primary" data-act="build" data-id="${id}">Build</button>` : ''}<button class="btn" data-act="hpclose">${st === 'ok' ? 'Cancel' : 'Close'}</button></div></div></div>`;
      }
      return `<div class="th-win"><div class="th-title">${esc(t.built.hall3 ? 'Capitol' : t.built.hall2 ? 'City Hall' : 'Town Hall')}</div>
        <div class="th-area">${rows.map(r => `<div class="th-row">${r.map(card).join('')}</div>`).join('')}</div>
        <div class="th-bar">${t.builtToday ? 'One structure was raised today. Come back tomorrow.' : 'One structure may be raised each day.'}</div>
        <button class="th-close" data-act="popclose" title="Close (Esc)" aria-label="Close"></button>${detail}</div>`;
    }
    function recruitRow(u, i, p) {
      const ty = Gm.recruitType(t, u), U = D.UNITS[ty], avail = t.avail[u] || 0, max = Gm.maxRecruit(t, u, p.res);
      return `<div class="rrow big">
        <button class="rimg" data-act="info" data-u="${ty}" title="Details"><img src="${portrait(ty)}" alt=""></button>
        <div class="rmid"><b>${esc(U.name)}</b> <small class="muted">Tier ${U.tier}${U.upgraded ? ' · upgraded' : ''}${U.big ? ' · large' : ''}</small><div class="mono">${unitStatsLine(U)}</div>
          <p class="muted">${esc(U.desc)}</p><div class="costs">${costHtml(U.cost)}<span class="muted">each · ${Math.floor(D.UNITS[u].growth * Gm.growthMult(t))} a week</span></div></div>
        <div class="rright"><small>${avail} available</small>
          <div class="rq"><input type="number" id="rq-${u}" min="0" max="${max}" value="${max}" aria-label="Number to recruit">
          <button class="btn sm" data-act="max" data-u="${u}">Max</button>
          <button class="btn sm primary" data-act="recruit" data-u="${u}" ${max ? '' : 'disabled'}>Recruit</button></div></div></div>`;
    }
    function guildPanel(h) {
      const lvl = Gm.guildLevel(t);
      return `<h3>Mage Guild · level ${lvl}</h3><p class="muted">Commanders who visit learn every spell here up to the level their Wisdom allows (level 2 without Wisdom).${h ? ` ${esc(h.name)} can learn up to level ${D.maxSpellLevel(h)}.` : ''}</p>
        <div class="guild">${[1, 2, 3, 4, 5].map(l => `<div class="glevel ${l > lvl ? 'locked' : ''}"><h4>Level ${l}</h4>${(t.guild?.[l] || []).map(sp => {
          const S = D.SPELLS[sp]; return `<div class="gspell school-${S.school}" title="${esc(D.spellDesc(h, sp))}"><b>${S.name}</b><small>${D.SCHOOLS[S.school]} · ${S.cost} mana${S.kind === 'adventure' ? ' · map spell' : ''}</small>${l <= lvl ? `<p>${esc(D.spellDesc(h, sp))}</p>` : '<p>Build this level to reveal.</p>'}</div>`;
        }).join('')}</div>`).join('')}</div>`;
    }
    function fortWindow(p) {
      const us = D.FACTIONS[t.faction].units, art = TOWN_ART_FACTIONS.includes(t.faction);
      const stat = (k, label, v) => `<div class="fs"><img src="${statIcon(k)}" alt=""><span>${label}</span><b>${v}</b></div>`;
      const cards = us.map((u, i) => {
        const tier = i + 1, built = t.built['dw' + tier], bk = t.built['dw' + tier + 'u'] ? 'dw' + tier + 'u' : 'dw' + tier;
        const ty = Gm.recruitType(t, u), U = D.UNITS[ty];
        return `<button class="fcard2 ${built ? '' : 'locked'} ${fortPick === u ? 'sel' : ''}" data-act="fpick" data-u="${u}" ${built ? '' : 'disabled'} title="${built ? 'Click to recruit' : 'Not built yet'}">
          <div class="fc-build"><b>${esc(U.name)}</b><div class="fc-pic">${art ? `<img src="${buildingPic(t.faction, bk)}" alt="">` : ''}</div>
            <small>${esc(D.buildingName(t.faction, bk))}</small><small class="avail">${built ? `Available: ${t.avail[u] || 0}` : 'Not built'}</small></div>
          <div class="fc-unit"><img src="${portrait(ty)}" alt="${esc(U.name)}"></div>
          <div class="fc-stats">${stat('atk', 'Attack', U.atk)}${stat('def', 'Defence', U.def)}${stat('dmg', 'Damage', `${U.min}–${U.max}`)}${stat('hp', 'Health', U.hp)}${stat('spd', 'Speed', U.spd)}${stat('grow', 'Growth', Math.floor(D.UNITS[u].growth * Gm.growthMult(t)))}</div></button>`;
      }).join('');
      const walls = `${t.built.castle ? 'Castle' : t.built.citadel ? 'Citadel' : 'Fort'}: attackers face walls and a gate${t.built.citadel ? ', a moat and a gun tower' : ''}${t.built.castle ? ', plus two flanking towers' : ''}. Weekly growth ×${Gm.growthMult(t).toFixed(1)}.`;
      const pickRow = '<p class="hint">Click a creature to open its dwelling and recruit.</p>';
      return `<div class="fort-top"><p class="muted">${walls}</p><button class="btn sm primary" data-act="recruitall" title="Recruit every creature you can afford">Recruit all</button></div><div class="fort-grid">${cards}</div>${pickRow}
        <div class="fort-res">${D.RES.map(r => `<span class="cost" title="${D.RES_INFO[r].name}">${resImg(r)}${p.res[r].toLocaleString()}</span>`).join('')}</div>`;
    }
    function fortPanel() {
      const us = D.FACTIONS[t.faction].units;
      return `<h3>${t.built.castle ? 'Castle' : t.built.citadel ? 'Citadel' : 'Fort'}</h3>
        <p class="muted">${t.built.fort ? `Attackers face walls and a gate${t.built.citadel ? ', a moat and a gun tower' : ''}${t.built.castle ? ', plus two flanking towers' : ''}.` : 'Build a Fort in the town hall to defend against sieges.'} Weekly growth ×${Gm.growthMult(t).toFixed(1)}.</p>
        <table class="growth"><tr><th>Unit</th><th>Per week</th><th>Available</th></tr>${us.map((u, i) => t.built['dw' + (i + 1)] ? `<tr><td>${esc(D.UNITS[Gm.recruitType(t, u)].name)}</td><td>${Math.floor(D.UNITS[u].growth * Gm.growthMult(t))}</td><td>${t.avail[u] || 0}</td></tr>` : '').join('')}</table>`;
    }
    function marketPanel(p) {
      const opts = D.RES.map(r => `<option value="${r}">${D.RES_INFO[r].name}</option>`).join('');
      const markets = Gm.townsOf(VP()).filter(x => x.built.market).length;
      return `<h3>Trade Exchange <small class="muted">${markets} exchange${markets > 1 ? 's' : ''} owned · more exchanges give better barter rates</small></h3>
        <div class="barter"><label>Give <select id="bt-give">${opts}</select></label><label>for <select id="bt-get">${opts.replace('value="adamantium"', 'value="adamantium" selected')}</select></label>
          <span id="bt-rate" class="muted"></span><button class="btn sm" data-act="barter" data-q="1">Trade 1</button><button class="btn sm" data-act="barter" data-q="5">Trade 5</button></div>
        <div class="market">${D.RES.filter(r => r !== 'auramite').map(r => `
        <div class="mrow">${resImg(r)}<span>${D.RES_INFO[r].name}</span><b>${p.res[r]}</b>
        <button class="btn sm" data-act="sell" data-r="${r}" ${p.res[r] >= 1 ? '' : 'disabled'}>Sell · +${D.MARKET.sell(r)}</button>
        <button class="btn sm" data-act="buy" data-r="${r}" ${p.res.auramite >= D.MARKET.buy(r) ? '' : 'disabled'}>Buy · −${D.MARKET.buy(r)}</button></div>`).join('')}</div>`;
    }
    function tavernPanel(h) {
      return `<h3>Recruitment Office</h3><p class="muted">Commanders wait here for a lord who can pay.</p><button class="btn primary" data-act="recruit-open">Open the Recruitment Office</button>`;
    }
    function render() {
      const s = G.s, p = s.players[VP()], h = Gm.heroAt(t.x, t.y), us = D.FACTIONS[t.faction].units;
      armies = { gar: { arr: t.garrison, hero: false } };
      if (h) armies.hero = { arr: h.army, hero: true };
      let html = '';
      if (current === 'none' || current === 'hall' || current === 'fort') html = '';
      else if (current.startsWith('dw')) { const tier = +current[2]; html = `<h3>${esc(regionName(current))}</h3><div class="rlist">${recruitRow(us[tier - 1], tier - 1, p)}</div>${t.built['dw' + tier + 'u'] ? '' : `<p class="muted">Build ${esc(D.FACTIONS[t.faction].dwellU[tier - 1])} in the town hall to recruit ${esc(D.UNITS[D.UNITS[us[tier - 1]].upgrade].name)}.</p>`}`; }
      else if (current === 'guild') html = guildPanel(h);
      else if (current === 'market') html = marketPanel(p);
      else if (current === 'tavern') html = tavernPanel(h);
      else if (current === 'depot') html = '<h3>Supply Depot</h3><p class="muted">Stores and convoys raise the weekly growth of every unit by 50%.</p>';
      const quote = Gm.upgradeQuote(t, [t.garrison, ...(h ? [h.army] : [])]);
      panel.innerHTML = html; panel.hidden = !html;
      showRate();
      pop.hidden = !popup;
      if (popup) {
        pop.className = 'tv-pop ' + popup + (popup === 'hall' ? ' th' : '');
        if (popup === 'hall') pop.querySelector('.tv-pop-body').innerHTML = hallWindow(p);
        else {
        pop.querySelector('h3').textContent = popup === 'hall' ? `${t.built.hall3 ? 'Capitol' : t.built.hall2 ? 'City Hall' : 'Town Hall'} · construction` : `${regionName('fort')} · ${t.name}`;
        pop.querySelector('.tv-pop-body').innerHTML = popup === 'hall' ? hallPanel(p).replace(/^<h3>[\s\S]*?<\/h3>/, `<p class="muted">${t.builtToday ? 'One structure was raised today. Come back tomorrow.' : 'One structure may be raised each day.'}</p>`) : fortWindow(p);
        }
      }
      bottom.innerHTML = `
        <div class="tvb-head"><div><small class="eyebrow">${esc(D.FACTIONS[t.faction].name)}</small><h2>${esc(t.name)}</h2>
          <p class="muted">Income ${Gm.townIncome(t).toLocaleString()} a day</p></div>
          <div class="town-res">${D.RES.map(r => `<span class="cost" title="${D.RES_INFO[r].name}">${resImg(r)}${p.res[r].toLocaleString()}</span>`).join('')}</div></div>
        <div class="tvb-armies">
          <div class="tvb-row">${h ? `<button class="tvb-face" data-act="hero" title="Open ${esc(h.name)}'s commander screen"><img class="avatar" src="${heroAvatar(h.name)}" alt="${esc(h.name)}"></button>` : '<div class="tvb-face empty" title="No commander in town"><span>No commander</span></div>'}
            ${h ? armyRow('hero', h.army, h.name) : '<div class="army-row"><h4>Visiting commander</h4><p class="muted">None in town</p></div>'}</div>
          <div class="tvb-row"><div class="tvb-face crest" title="Town garrison">${TOWN_SPRITE[t.faction] ? `<img src="${townThumb(t)}" alt="">` : '<span>Garrison</span>'}</div>${armyRow('gar', t.garrison, 'Garrison')}</div></div>
        <div class="tvb-nav">
          <button class="btn sm ${popup === 'hall' ? 'on' : ''}" data-act="pop" data-k="hall">Town hall</button>
          ${t.built.mg1 ? `<button class="btn sm ${current === 'guild' ? 'on' : ''}" data-act="nav" data-k="guild">Mage Guild</button>` : ''}
          ${t.built.tavern ? `<button class="btn sm ${current === 'tavern' ? 'on' : ''}" data-act="nav" data-k="tavern">Hire</button>` : ''}
          ${t.built.market ? `<button class="btn sm ${current === 'market' ? 'on' : ''}" data-act="nav" data-k="market">Trade</button>` : ''}
          <button class="btn sm ${popup === 'fort' ? 'on' : ''}" data-act="pop" data-k="fort">Fort &amp; creatures</button>
          ${quote.count ? `<button class="btn sm primary" data-act="upgrade" title="${quote.count} troops can be upgraded">Upgrade troops</button>` : ''}
          <button class="btn sm" data-act="close">Leave town</button></div>`;
    }
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, p = G.s.players[VP()];
      if (act === 'close') return close();
      if (act === 'nav' && b.dataset.k === 'tavern') { openRecruitment(t).then(render); return; }
      if (act === 'nav' && b.dataset.k === 'guild') { openGuildRoom(t).then(render); return; }
      if (act === 'nav' && b.dataset.k === 'market') { openMarket().then(() => { render(); updateTop(); }); return; }
      if (act === 'recruit-open') { openRecruitment(t).then(render); return; }
      if (act === 'nav') { current = b.dataset.k; popup = null; return render(); }
      if (act === 'pop') { popup = b.dataset.k; fortPick = null; hallPick = null; return render(); }
      if (act === 'hpick') { hallPick = b.dataset.id; return render(); }
      if (act === 'hpclose') { hallPick = null; return render(); }
      if (act === 'popclose') { popup = null; return render(); }
      if (act === 'fpick') { openDwelling(t, b.dataset.u).then(() => { render(); updateTop(); }); return; }
      if (act === 'hero') { const h = Gm.heroAt(t.x, t.y); if (h) openHero(h).then(() => render()); return; }
      if (act === 'build') { const id = b.dataset.id; hallPick = null; if (Gm.build(t, id)) { Audio.sfx('build'); toast(`${D.buildingName(t.faction, id)} completed.`); rebuildScene(); const h = Gm.heroAt(t.x, t.y); if (h && /^mg/.test(id)) Gm.visitTown(h, t); } }
      if (act === 'info') return unitInfo(b.dataset.u);
      if (act === 'max') { const inp = root.querySelector(`#rq-${b.dataset.u}`); inp.value = inp.max; return; }
      if (act === 'recruit') {
        const u = b.dataset.u, n = Math.max(0, Math.min(+root.querySelector(`#rq-${u}`).value || 0, Gm.maxRecruit(t, u, p.res)));
        const h = Gm.heroAt(t.x, t.y);
        if (n > 0 && !Gm.recruit(t, u, n, h ? h.army : t.garrison)) toast('No free slot for that unit type.', 'bad');
        else if (n > 0) Audio.sfx('recruit');
      }
      if (act === 'upgrade') { const h = Gm.heroAt(t.x, t.y); const n = Gm.upgradeArmies(t, [t.garrison, ...(h ? [h.army] : [])]); toast(n ? `${n} troops upgraded.` : 'Not enough materials to upgrade.', n ? '' : 'bad'); }
      if (act === 'hire') { const h = Gm.hireHero(t); if (h) { toast(`${h.name} joins your cause.`); ui.selId = h.id; ui.focus = 'hero'; } }
      if (act === 'barter') {
        const give = root.querySelector('#bt-give').value, get = root.querySelector('#bt-get').value, q = +b.dataset.q;
        const cost = Gm.barter(VP(), give, get, q);
        toast(cost ? `Traded ${cost} ${D.RES_INFO[give].name} for ${q} ${D.RES_INFO[get].name}.` : 'That trade is not possible.', cost ? '' : 'bad');
        render(); updateTop();
        const g2 = root.querySelector('#bt-give'), t2 = root.querySelector('#bt-get'); if (g2) { g2.value = give; t2.value = get; showRate(); }
        return;
      }
      if (act === 'recruitall') { const h = Gm.heroAt(t.x, t.y); const n = Gm.recruitAll(t, h ? h.army : t.garrison); if (n) Audio.sfx('recruit'); toast(n ? `${n} troops recruited.` : 'Nothing could be recruited.', n ? '' : 'bad'); }
      if (act === 'sell') Gm.trade(VP(), b.dataset.r, -1);
      if (act === 'buy') Gm.trade(VP(), b.dataset.r, 1);
      render(); updateTop();
    });
    const showRate = () => { const g2 = root.querySelector('#bt-give'), t2 = root.querySelector('#bt-get'), el = root.querySelector('#bt-rate'); if (!g2) return; const r = Gm.barterRate(VP(), g2.value, t2.value); el.textContent = r ? `${r} ${D.RES_INFO[g2.value].name} for 1 ${D.RES_INFO[t2.value].name}` : 'Pick two different materials'; };
    root.addEventListener('change', e => { if (e.target.matches('#bt-give, #bt-get')) showRate(); });
    armyEditor(bottom, new Proxy({}, { get: (_, k) => armies[k] }), () => render());
    render();
    requestAnimationFrame(rebuildScene);
  });
}

// ---------------- creature dwelling (mini recruit window, HoMM-style) ----------------
function openDwelling(t, u) {
  const tier = D.UNITS[u].tier, bk = t.built['dw' + tier + 'u'] ? 'dw' + tier + 'u' : 'dw' + tier;
  const ty = Gm.recruitType(t, u), U = D.UNITS[ty], art = TOWN_ART_FACTIONS.includes(t.faction);
  return modal({
    title: esc(D.buildingName(t.faction, bk)), cls: 'dwell', buttons: [],
    html: '<div id="dw"></div>',
    onMount: (wrap, close) => {
      const el = wrap.querySelector('#dw');
      let n = null;
      const stat = (k, label, v) => `<div class="fs"><img src="${statIcon(k)}" alt=""><span>${label}</span><b>${v}</b></div>`;
      const costs = (mult) => Object.entries(U.cost).filter(([, v]) => v > 0).map(([r, v]) => `<span class="cost" title="${D.RES_INFO[r].name}">${resImg(r)}${(v * mult).toLocaleString()}</span>`).join('');
      const render = () => {
        const p = G.s.players[VP()], max = Gm.maxRecruit(t, u, p.res), avail = t.avail[u] || 0, h = Gm.heroAt(t.x, t.y);
        if (n == null || n > max) n = max;
        el.innerHTML = `
          <div class="dw-top">
            ${art ? `<div class="dw-build"><img src="${buildingPic(t.faction, bk)}" alt=""></div>` : ''}
            <button class="dw-unit" data-dw="info" title="Details"><img src="${portrait(ty)}" alt="${esc(U.name)}"></button>
            <div class="dw-stats"><b class="dw-name">${esc(U.name)}</b><small class="muted">Tier ${U.tier}${U.upgraded ? ' · upgraded' : ''}${U.big ? ' · large' : ''}</small>
              ${stat('atk', 'Attack', U.atk)}${stat('def', 'Defence', U.def)}${stat('dmg', 'Damage', `${U.min}–${U.max}`)}${stat('hp', 'Health', U.hp)}${stat('spd', 'Speed', U.spd)}${U.shots ? stat('atk', 'Shots', U.shots) : ''}</div>
          </div>
          <p class="dw-desc muted">${esc(U.desc)}</p>
          <div class="dw-counts"><div><small>Available</small><b>${avail}</b></div><div><small>Growth</small><b>${Math.floor(D.UNITS[u].growth * Gm.growthMult(t))} / week</b></div><div><small>Recruit</small><b>${n}</b></div></div>
          <div class="dw-slider"><button class="btn sm" data-dw="minus" ${n > 0 ? '' : 'disabled'}>−</button>
            <input type="range" id="dw-n" min="0" max="${max}" value="${n}" ${max ? '' : 'disabled'} aria-label="Number to recruit">
            <button class="btn sm" data-dw="plus" ${n < max ? '' : 'disabled'}>+</button><button class="btn sm" data-dw="max" ${max ? '' : 'disabled'}>Max</button></div>
          <div class="dw-cost"><div><small>Cost per troop</small><div class="costs">${costs(1)}</div></div><div><small>Total cost</small><div class="costs">${costs(n)}</div></div></div>
          <p class="dw-dest muted">${avail ? `Troops join ${h ? esc(h.name) + "'s army" : 'the town garrison'}.` : 'None available. New troops muster at the start of each week.'}${!t.built['dw' + tier + 'u'] && D.UNITS[u].upgrade ? ` Build ${esc(D.FACTIONS[t.faction].dwellU[tier - 1])} to recruit ${esc(D.UNITS[D.UNITS[u].upgrade].name)}.` : ''}</p>
          <div class="rc-btns"><button class="btn primary" data-dw="buy" ${n > 0 ? '' : 'disabled'}>Recruit</button><button class="btn" data-dw="close">Close</button></div>`;
      };
      el.addEventListener('input', e => {
        if (e.target.id !== 'dw-n') return;
        n = +e.target.value; const max = +e.target.max;
        el.querySelector('.dw-counts > div:nth-child(3) b').textContent = n;
        el.querySelector('.dw-cost > div:nth-child(2) .costs').innerHTML = costs(n);
        el.querySelector('[data-dw="minus"]').disabled = n <= 0; el.querySelector('[data-dw="plus"]').disabled = n >= max;
        el.querySelector('[data-dw="buy"]').disabled = n <= 0;
      });
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-dw]'); if (!b) return;
        const k = b.dataset.dw, p = G.s.players[VP()], max = Gm.maxRecruit(t, u, p.res);
        if (k === 'close') return close(null);
        if (k === 'info') return unitInfo(ty);
        if (k === 'minus') n = Math.max(0, n - 1);
        if (k === 'plus') n = Math.min(max, n + 1);
        if (k === 'max') n = max;
        if (k === 'buy') {
          const h = Gm.heroAt(t.x, t.y);
          if (!Gm.recruit(t, u, n, h ? h.army : t.garrison)) { toast('No free slot for that unit type.', 'bad'); return; }
          Audio.sfx('recruit'); toast(`${n} ${U.name} recruited.`); updateTop(); return close(n);
        }
        render();
      });
      render();
    },
  });
}

// ---------------- Mage guild window: the faction's painted room, rites in the niches, vaults for unbuilt levels ----------------
let GUILD_NICHES = null;
async function openGuildRoom(t) {
  if (!GUILD_NICHES) GUILD_NICHES = await (await fetch('assets/ui/guild/niches.json')).json().catch(() => ({}));
  const fac = GUILD_NICHES[t.faction] ? t.faction : 'concord', N = GUILD_NICHES[fac], lvl = Gm.guildLevel(t), h = Gm.heroAt(t.x, t.y);
  const { riteIcon, riteIconsReady } = await import('./terminal.js'); await riteIconsReady;
  const pct = ([x0, y0, x1, y1]) => `left:${x0 / 13.76}%;top:${y0 / 7.68}%;width:${(x1 - x0) / 13.76}%;height:${(y1 - y0) / 7.68}%`;
  let html = `<div class="gr-room" style="background-image:url(assets/ui/guild/room_${fac}.webp)">`;
  for (let l = 1; l <= 5; l++) (N[l] || []).forEach((box, i) => {
    const sp = (t.guild?.[l] || [])[i];
    if (!sp) return;
    if (l > lvl) html += `<div class="gr-niche locked" style="${pct(box)}" title="Level ${l}: build the next level of the guild to reveal this rite"><img src="assets/ui/guild/vault_${fac}.webp" alt=""></div>`;
    else { const S = D.SPELLS[sp]; html += `<button class="gr-niche" data-sp="${sp}" style="${pct(box)}" title="${esc(S.name)} · level ${l} · ${S.cost} mana">${riteIcon(sp, S.school)}</button>`; }
  });
  html += `<div class="gr-info" id="gr-info">${h ? `${esc(h.name)} can learn rites up to level ${D.maxSpellLevel(h)}.` : 'Commanders who visit learn every rite here up to the level their Wisdom allows.'} Click a rite to read it.</div></div>`;
  return modal({ title: `Mage Guild · level ${lvl}`, cls: 'guildroom', html, buttons: [{ label: 'Close', value: null, primary: true }],
    onMount: wrap => wrap.querySelector('.gr-room').addEventListener('click', e => {
      const b = e.target.closest('[data-sp]'); if (!b) return; const S = D.SPELLS[b.dataset.sp];
      wrap.querySelectorAll('.gr-niche.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
      wrap.querySelector('#gr-info').innerHTML = `<b>${esc(S.name)}</b> · ${D.SCHOOLS[S.school]} · level ${S.level} · ${S.cost} mana${S.kind === 'adventure' ? ' · map rite' : ''}<br>${esc(D.spellDesc(h, b.dataset.sp))}`;
    }) });
}

// ---------------- Recruitment Office (two commanders for hire, as in a tavern) ----------------
const RUMOURS = [
  'The clerk lowers his voice: they say the Hollow pay their reavers in skulls, and the reavers prefer it.',
  'A scarred veteran mutters that the Spore Hulks only sleep in the cold; never march on them at dawn.',
  'Word from the rail-yards: a Teleportarium Gate in the wastes still hums, if you can get past its guards.',
  'An old servitor rasps that the Wyrm Sanctum holds three relics, and three hundred bones of those who tried.',
  'They say a Sealed Blast Door opens only for a key-codex carried from the start of the war.',
  'A drunk mercenary swears he saw a commander rise from the dead after the Rite of Resurrection.',
  'The quartermaster grumbles that a Supply Depot doubles nothing if the walls fall first.',
  'Rumour has it the Rust Wastes hide an Alien Tomb Pyramid, and a rite no living mind should know.',
  'A tithe-scribe notes that commanders who visit the Grand Librarium come back changed, and better.',
  'Someone has scratched into the bench: "Acid pools burn boots. Fly over them or walk around."',
];
function openRecruitment(t) {
  const offers = Gm.hireOffers(VP());
  let pick = offers[0] || null;
  const rumour = RUMOURS[Math.floor(Math.random() * RUMOURS.length)];
  return modal({
    title: 'Recruitment Office', cls: 'recruit', buttons: [],
    html: '<div id="rc"></div>',
    onMount: (wrap, close) => {
      const el = wrap.querySelector('#rc');
      const render = () => {
        const here = Gm.heroAt(t.x, t.y), full = Gm.heroesOf(VP()).length >= D.MAX_HEROES, p = G.s.players[VP()];
        const block = here ? `${esc(here.name)} is stationed in the town. Move them out to hire another commander.` : full ? 'You already command the maximum of four commanders.' : !offers.length ? 'No commanders are waiting for hire.' : '';
        const def = pick && D.HERO_DEFS[pick], ret = pick && p.retreated.find(x => x.name === pick);
        const lvl = ret ? ret.level : 1, arts = ret ? D.equipped(ret).length + ret.backpack.length : 0;
        el.innerHTML = `
          <div class="rc-scene"><img src="assets/ui/recruit_scene.webp" alt=""></div>
          <div class="rc-rumour"><p>${esc(rumour)}</p></div>
          <h4>Commanders for hire</h4>
          <div class="rc-row">
            <div class="rc-faces">${offers.map(n => `<button class="rc-face ${n === pick ? 'on' : ''}" data-pick="${esc(n)}" title="${esc(n)}"><img src="${heroAvatar(n)}" alt=""></button>`).join('')}</div>
            <div class="rc-price"><span>${resImg('auramite')}</span><b>${D.HIRE_COST.toLocaleString()}</b></div>
          </div>
          <div class="rc-info">${def ? `<b>${esc(pick)}</b> is a level ${lvl} ${def.cls === 'magic' ? 'battle-mystic' : 'warlord'} with ${arts} artifact${arts === 1 ? '' : 's'}.
            <small>Specialty: ${esc(D.specText(pick))} Starts with ${esc(D.SKILLS[def.skill].name)} and ${esc(D.SPELLS[def.spell]?.name || '')}.</small>${def.bio ? `<p class="rc-bio">${esc(def.bio)}</p>` : ''}` : ''}
            ${block ? `<p class="warn">${esc(block)}</p>` : ''}</div>
          <div class="rc-btns"><button class="btn primary" data-hire="1" ${pick && Gm.canHire(t) ? '' : 'disabled'}>Hire</button><button class="btn" data-close="1">Close</button></div>`;
      };
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.pick) { pick = b.dataset.pick; render(); }
        else if (b.dataset.close) close(null);
        else if (b.dataset.hire) {
          const h = Gm.hireHero(t, pick);
          if (h) { toast(`${h.name} joins your cause.`); Audio.sfx('recruit'); ui.selId = h.id; ui.focus = 'hero'; updateTop(); close(h); }
        }
      });
      render();
    },
  });
}

// ---------------- commander screen (cogitator terminal) ----------------
// slot positions on the painted frame (assets/ui/commander.webp, 1376x768)
// The hologram figure lights up part by part in the rarity colour of the artifact worn there (assets/ui/holo_parts.*:
// one mask per body part, frame lines cut out so they stay green on top). Rings tint the sword hand, trinkets the belt.
const HOLO = { img: null, meta: null };
const holoReady = Promise.all([fetch('assets/ui/holo_parts.json').then(r => r.json()), loadImage('assets/ui/holo_parts.webp')])
  .then(([m, im]) => { HOLO.meta = m; HOLO.img = im; }).catch(() => {});
const HOLO_PART = { head: 'head', neck: 'neck', armor: 'armor', cloak: 'cloak', weapon: 'weapon', shield: 'shield', boots: 'boots', ring1: 'ring1', ring2: 'ring1', misc1: 'misc1', misc2: 'misc1', misc3: 'misc1' };
async function paintHoloParts(cv, h) {
  if (!cv) return; await holoReady; if (!HOLO.img || !cv.isConnected) return;
  const { w, h: hh, order } = HOLO.meta, g = cv.getContext('2d'); g.clearRect(0, 0, w, hh);
  const best = {}, rank = { T: 0, m: 1, M: 2, R: 3 };
  for (const [sl, id] of Object.entries(h.equip || {})) { if (!id) continue; const part = HOLO_PART[sl], r = D.ARTIFACTS[id].r; if (part && (best[part] == null || rank[r] > rank[best[part]])) best[part] = r; }
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = hh; const tg = tmp.getContext('2d');
  for (const [part, r] of Object.entries(best)) {
    const k = order.indexOf(part); if (k < 0) continue;
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, w, hh); tg.drawImage(HOLO.img, 0, k * hh, w, hh, 0, 0, w, hh);
    tg.globalCompositeOperation = 'source-in'; tg.fillStyle = D.RARITY[r].color; tg.fillRect(0, 0, w, hh);
    g.globalAlpha = 0.6; g.drawImage(tmp, 0, 0);
  }
}
const CMD_SLOTS = {
  ring1: [131, 268], ring2: [205, 268], weapon: [131, 355], cloak: [131, 443],
  head: [692, 268], neck: [779, 268], shield: [692, 355], armor: [779, 355],
  misc1: [569, 443], misc2: [640, 443], misc3: [710, 443], boots: [779, 443],
};
const CMD_STATS_X = [104, 200, 296, 392, 489, 585, 682, 779];
function openHero(h) {
  let pick = null, packPage = 0, showBio = false;
  return T.termWindow('commander', (root, close) => {
    const render = () => {
      root.querySelectorAll('.t-el').forEach(e => e.remove());
      const html = [];
      html.push(`<img class="t-el t-por" src="${heroAvatar(h.name)}" alt="" style="${T.at(124, 88, 90, 90)}">`);
      html.push(`<div class="t-el t-name-big" style="${T.at(234, 81, 629, 41)}">${esc(h.name.toUpperCase())}</div>`);
      html.push(`<div class="t-el t-line" style="${T.at(234, 131, 341, 21)};font-size:.88em">LVL ${h.level} ${h.cls === 'magic' ? 'BATTLE-MYSTIC' : 'WARLORD'} · ${h.xp.toLocaleString()}/${D.xpForLevel(h.level + 1).toLocaleString()} XP</div>`);
      html.push(`<div class="t-el t-line" style="${T.at(234, 160, 629, 21)}" title="${esc(D.specText(h.name))}">SPECIALTY // ${esc(D.specText(h.name))}</div>`);
      const stats = [['ATK', D.hstat(h, 'atk')], ['DEF', D.hstat(h, 'def')], ['POW', D.hstat(h, 'pow')], ['KNW', D.hstat(h, 'know')],
        ['MOR', fmtSign(D.heroMorale(h))], ['LCK', fmtSign(D.heroLuck(h))], ['MANA', `${h.mana}/${D.maxMana(h)}`], ['MOVE', `${Math.floor(h.mp / 100)}/${Math.floor(D.maxMp(h) / 100)}`]];
      stats.forEach(([l, v], i) => {
        const x = CMD_STATS_X[i];
        html.push(`<div class="t-el t-stat-l" style="${T.at(x + 16, 198, 52, 14)}">${l}</div>`);
        html.push(`<div class="t-el t-stat-v" style="${T.at(x, 213, 86, 28)}">${v}</div>`);
      });
      html.push(`<div class="t-el t-holo" style="${T.at(244, 278, 270, 392)}"></div>`);
      html.push(`<canvas class="t-el t-parts" width="360" height="450" style="${T.at(200, 250, 360, 450)}"></canvas>`);
      for (const [sl, [x, y]] of Object.entries(CMD_SLOTS)) {
        const id = h.equip[sl], fits = pick != null && D.slotsFor(D.ARTIFACTS[h.backpack[pick]].slot).includes(sl);
        html.push(`<button class="t-el t-slot ${id ? 'full' : ''} ${fits ? 'fits' : ''}" data-slot="${sl}" title="${id ? esc(artTip(id)) : D.SLOT_NAMES[sl] + ' (empty)'}" style="${T.at(x, y, 66, 66)}">${id ? `<img src="${artIcon(id)}" alt="">` : ''}</button>`);
      }
      // backpack: five slots; the bag slot turns the page when there are more
      const pages = Math.max(1, Math.ceil(h.backpack.length / 5)); packPage = Math.min(packPage, pages - 1);
      html.push(`<button class="t-el t-slot t-bag" data-bag="1" title="Backpack: ${h.backpack.length} item${h.backpack.length === 1 ? '' : 's'}${pages > 1 ? ' (click for the next page)' : ''}" style="${T.at(588, 532, 39, 40)}">${pages > 1 ? `<i>${packPage + 1}/${pages}</i>` : ''}</button>`);
      for (let k = 0; k < 5; k++) {
        const i = packPage * 5 + k, id = h.backpack[i], x = 632 + k * 44;
        html.push(`<button class="t-el t-slot ${id ? 'full' : ''} ${pick === i && id ? 'picked' : ''}" ${id ? `data-pack="${i}" title="${esc(artTip(id))}"` : 'disabled'} style="${T.at(x, 532, 38, 40)}">${id ? `<img src="${artIcon(id)}" alt="">` : ''}</button>`);
      }
      // combination sets the commander has started
      const owned = D.equipped(h).concat(h.backpack);
      Object.entries(D.SETS).filter(([, S]) => S.pieces.some(p => owned.includes(p))).slice(0, 3).forEach(([k, S], i) => {
        const on = S.pieces.filter(p => D.equipped(h).includes(p)).length, done = on === S.pieces.length, y = [586, 620, 655][i];
        html.push(`<span class="t-el t-seticon" style="${T.at(589, y + 1, 27, 27)}"><img src="${setIcon(k)}" alt=""></span>`);
        html.push(`<div class="t-el t-set ${done ? 'done' : ''}" title="${esc(S.pieces.map(p => D.ARTIFACTS[p].name).join(', '))}" style="${T.at(623, y, 222, 29)}">${esc(S.name.replace(/^(Panoply|Regalia|Dynasty) of the /, '').toUpperCase())} ${on}/${S.pieces.length}${done ? ' ACTIVE' : ''}</div>`);
      });
      // the upper right panel shows skills, or the commander's dossier (bio) for painted commanders
      const bio = D.HERO_DEFS[h.name]?.bio;
      html.push(`<div class="t-el t-head" style="${T.at(905, 86, 363, 36)}">${bio ? `<button class="t-tabtxt ${showBio ? '' : 'on'}" data-panel="skills">SKILLS · ${Object.keys(h.skills).length}/${D.MAX_SKILLS}</button><button class="t-tabtxt ${showBio ? 'on' : ''}" data-panel="bio">DOSSIER</button>` : `SKILLS · ${Object.keys(h.skills).length}/${D.MAX_SKILLS}`}</div>`);
      if (bio && showBio) html.push(`<div class="t-el t-bio" style="${T.at(918, 134, 340, 248)}">${esc(bio)}</div>`);
      else {
      const sk = Object.entries(h.skills);
      [137, 186, 222, 258].forEach((y, r) => {
        const pair = sk.length > 4 ? sk.slice(r * 2, r * 2 + 2) : sk.slice(r, r + 1); if (!pair.length) return;
        // one skill per bar while they fit, two per bar beyond four; the level shows as I-III
        const two = sk.length > 4;
        pair.forEach(([k, l], c) => html.push(`<div class="t-el t-skill ${two ? 'two' : ''}" title="${esc(D.SKILL_LEVELS[l - 1] + ' ' + D.SKILLS[k].name + ': ' + D.SKILLS[k].desc(D.skillValue(h, k)))}" style="${T.at(918 + c * 171, y + 1, two ? 169 : 340, 28)}"><span>${esc(D.SKILLS[k].name.toUpperCase())} ${'I'.repeat(l)}${two ? '' : ` <small>· ${esc(D.SKILLS[k].desc(D.skillValue(h, k)))}</small>`}</span></div>`));
      });
      if (!sk.length) html.push(`<div class="t-el t-skill" style="${T.at(918, 138, 340, 28)}"><span>NO SKILLS RECORDED</span></div>`);
      }
      html.push(`<div class="t-el t-head" style="${T.at(905, 406, 366, 24)}">RITES · ${h.spells.length}</div>`);
      html.push(`<div class="t-el t-spells" style="${T.at(915, 436, 347, 186)}">${h.spells.map(sp => { const S = D.SPELLS[sp]; return `<span class="t-pill ${S.kind === 'adventure' ? 'adv' : ''}" title="${esc(D.spellDesc(h, sp))}">${esc(S.name.toUpperCase())} · L${S.level}</span>`; }).join('') || '<span class="t-pill">NONE</span>'}</div>`);
      html.push(`<button class="t-el t-btn t-cmd" data-cmd="dismiss" style="${T.at(905, 650, 108, 34)}">DISMISS</button>`);
      html.push(`<button class="t-el t-btn t-cmd" data-cmd="book" style="${T.at(1033, 650, 109, 34)}">RITES</button>`);
      html.push(`<button class="t-el t-btn t-cmd" data-cmd="close" style="${T.at(1161, 650, 110, 34)}">CLOSE</button>`);
      root.insertAdjacentHTML('beforeend', html.join(''));
      paintHoloParts(root.querySelector('.t-parts'), h);
    };
    root.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.cmd) return close(t.dataset.cmd);
      if (t.dataset.panel) { showBio = t.dataset.panel === 'bio'; render(); return; }
      if (t.dataset.bag) { packPage = (packPage + 1) % Math.max(1, Math.ceil(h.backpack.length / 5)); }
      else if (t.dataset.pack) { const i = +t.dataset.pack; pick = pick === i ? null : i; }
      else if (t.dataset.slot) {
        const sl = t.dataset.slot;
        if (pick != null) { if (Gm.equipFromBackpack(h, pick, sl)) pick = null; else toast('That item does not fit there.', 'bad'); }
        else if (h.equip[sl]) Gm.unequip(h, sl);
        updateSide();
      }
      render();
    });
    render();
  }).then(async v => {
    if (v === 'book') openSpellbook(h);
    if (v === 'dismiss') {
      if (Gm.heroesOf(VP()).length <= 1) { toast('You cannot dismiss your last commander.', 'bad'); return; }
      const ok = await modal({ title: `Dismiss ${esc(h.name)}?`, html: '<p>The commander leaves your service with their army and artifacts. This cannot be undone.</p>', buttons: [{ label: 'Keep', value: false, cancel: true }, { label: 'Dismiss', value: true, primary: true }] });
      if (ok && Gm.dismissHero(h)) { ui.selId = Gm.heroesOf(VP())[0]?.id ?? null; toast(`${h.name} leaves your service.`); }
    }
    updateUI();
  });
}

// The Rites window on the map: every known rite; map rites can be cast from here once a day.
function openSpellbook(h) {
  return T.openRites({
    hero: h, spells: h.spells.slice(), cost: sp => T.riteCost(h, sp), castLabel: 'INVOKE',
    usable: sp => D.SPELLS[sp].kind !== 'adventure' ? 'battle rite: invoke it in battle' : h.castToday ? 'one map rite a day' : Gm.canCastAdventure(h, sp) ? true : 'not enough mana',
    onCast: sp => {
      const r = Gm.castAdventure(h, sp);
      if (!r.ok) { toast(r.msg, 'bad'); return false; }
      toast(`${D.SPELLS[sp].name} cast.`); centerOn(h); ui.path = null; ui.target = null; updateUI();
      return true;
    },
  });
}

// ---------------- io hooks ----------------
// hot-seat: news for a human who is not at the keyboard waits for their turn
const hotSeat = () => G.s && G.s.players.filter(q => q.human && q.alive).length > 1;
io.message = (text, pid) => {
  if (pid != null && hotSeat() && pid !== VP()) { (G.s.players[pid].inbox = G.s.players[pid].inbox || []).push(text); return; }
  toast(text);
};
io.fogChanged = () => { ui.fogDirty = true; };
io.step = async h => {
  Object.defineProperty(h, '_mt', { value: performance.now(), writable: true, configurable: true, enumerable: false });
  const ms = WALK_MS[opt('walkSpeed')];
  if (h.owner === VP()) { follow(h); Audio.sfx('move'); if (ms) await sleep(ms); }
  else if (explored(h.x, h.y)) { follow(h); if (ms) await sleep(ms * 1.5); }
};
io.battle = (b, side) => { Audio.music(b.siege ? 'siege' : 'battle'); return runCombatView(b, side, {
  colors: b.sides.map(sd => (sd.owner == null ? D.NEUTRAL_COLOR : G.s.players[sd.owner].color)),
  names: b.sides.map(sd => (sd.hero ? sd.hero.name : sd.owner == null ? 'Wild creatures' : 'Garrison')),
  portrait, speed: BATTLE_SPEED[opt('battleSpeed')], shake: opt('shake'),
}).finally(() => Audio.music(mapMusic())); };
io.confirmMonster = (h, o) => modal({
  title: o.site ? `${D.SITES[o.site].name}: ${D.qtyWord(o.count).toLowerCase()} ${esc(D.UNITS[o.unit].name)}` : `${D.qtyWord(o.count)} ${esc(D.UNITS[o.unit].name)}`,
  html: `<div class="uinfo"><img src="${portrait(o.unit)}" alt=""><div><p>${esc(D.UNITS[o.unit].desc)}</p><p>Threat to ${esc(h.name)}: ${threat(h, o)}</p></div></div>`,
  buttons: [{ label: 'Withdraw', value: false, cancel: true }, { label: 'Quick battle', value: 'quick' }, { label: 'Attack', value: true, primary: true }],
});
io.quickResult = (b, side) => {
  const won = b.winner === side;
  const list = sd => { const m = new Map(); for (const st of b.stacks) if (st.side === sd && st.start > st.count) m.set(st.type, (m.get(st.type) || 0) + st.start - st.count);
    return m.size ? [...m].map(([t, n]) => `<li><img src="${portrait(t)}" alt=""><span>${n}</span><small>${esc(D.UNITS[t].name)}</small></li>`).join('') : '<li class="muted">None</li>'; };
  return modal({ title: won ? 'Victory' : 'Defeat', cls: 'quickres',
    html: `<p>${won ? 'The battle was decided quickly in your favour.' : 'Your forces were overwhelmed.'}</p><div class="cas"><div><h4>Your losses</h4><ul class="losses">${list(side)}</ul></div><div><h4>Enemy losses</h4><ul class="losses">${list(1 - side)}</ul></div></div>${won ? `<p class="xp">${b.kills[1 - side]} experience gained.</p>` : ''}` });
};
io.chest = h => modal({
  title: '', cls: 'choicebox', buttons: [],
  html: `<div class="cb-frame"><h3 class="cb-t">Supply cache</h3>
    <p class="cb-txt">Your scouts break open a sealed supply cache from the last war. Take the auramite, or have ${esc(h.name)} study the battle logs inside?</p>
    <button class="cb-pic l" data-v="auramite"><img src="assets/ui/guild/choice_gold.webp" alt=""></button>
    <button class="cb-pic r" data-v="xp"><img src="assets/ui/guild/choice_xp.webp" alt=""></button>
    <span class="cb-val l">1,000 auramite</span><span class="cb-val r">750 experience</span>
    <button class="cb-ok" data-v="pick">Take</button></div>`,
  onMount: (wrap, close) => {
    let pick = 'auramite';
    const sel = v => { pick = v; wrap.querySelectorAll('.cb-pic').forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
    sel('auramite');
    wrap.querySelectorAll('.cb-pic').forEach(b => { b.onclick = () => sel(b.dataset.v); b.ondblclick = () => close(b.dataset.v); });
    wrap.querySelector('.cb-ok').onclick = () => close(pick);
  },
}).then(v => v || 'auramite');
// ---------------- Trade Exchange (HoMM-style marketplace) ----------------
// Left: your materials; right: what each would fetch for the one picked on the left. Below: the trade, a quantity
// slider, Max and Trade. Rates: materials sell for and are bought with auramite at the market price; material for
// material is bartered at a rate that improves with every Trade Exchange you own.
function marketOffer(give, get) {
  if (give === get) return null;
  if (get === 'auramite') return { g: 1, r: D.MARKET.sell(give) };            // 1 material -> n auramite
  if (give === 'auramite') return { g: D.MARKET.buy(get), r: 1 };              // n auramite -> 1 material
  const rate = Gm.barterRate(VP(), give, get); return rate ? { g: rate, r: 1 } : null;
}
function openMarket() {
  let give = null, get = null, qty = 0;
  return modal({ title: '', cls: 'market-win', buttons: [{ label: 'Close', value: null, cancel: true }],
    html: '<div class="mk" id="mk"></div>',
    onMount: (wrap, close) => {
      const box = wrap.querySelector('#mk'); wrap.querySelector('.modal-btns').hidden = true;
      const p = () => G.s.players[VP()];
      const max = () => { const o = give && get && marketOffer(give, get); return o ? Math.floor(p().res[give] / o.g) : 0; };
      const tile = (r, sub, attr, on) => `<button class="mk-t ${on ? 'on' : ''}" ${attr} title="${D.RES_INFO[r].name}"><img src="${resIcon(r)}" alt=""><span>${sub}</span></button>`;
      const markets = Gm.townsOf(VP()).filter(x => x.built.market).length;
      const render = () => {
        const o = give && get ? marketOffer(give, get) : null, mx = max(); qty = Math.min(qty, mx);
        const msg = !give ? 'Pick a material of yours on the left to sell.' : !get ? `What would you like for your ${D.RES_INFO[give].name}?`
          : o ? (o.g === 1 ? `I can offer you ${o.r.toLocaleString()} ${D.RES_INFO[get].name} for 1 ${D.RES_INFO[give].name}.` : `I can offer you 1 ${D.RES_INFO[get].name} for ${o.g.toLocaleString()} ${D.RES_INFO[give].name}.`) : 'That trade is not possible.';
        box.innerHTML = `<h3 class="mk-title">Trade Exchange <small>${markets} exchange${markets > 1 ? 's' : ''} owned</small></h3>
          <div class="mk-cols">
            <div class="mk-col"><div class="mk-msg dim">More exchanges in your realm give better barter rates.</div><h4>Your materials</h4>
              <div class="mk-grid">${D.RES.map(r => tile(r, p().res[r].toLocaleString(), `data-give="${r}"`, give === r)).join('')}</div></div>
            <div class="mk-col"><div class="mk-msg">${esc(msg)}</div><h4>Available for trade</h4>
              <div class="mk-grid">${D.RES.map(r => { const of = give ? marketOffer(give, r) : null; return tile(r, !give ? '' : of ? (of.g === 1 ? of.r.toLocaleString() : `1/${of.g.toLocaleString()}`) : 'n/a', `data-get="${r}"`, get === r); }).join('')}</div></div>
          </div>
          <div class="mk-deal">
            <div class="mk-side">${give ? `<img src="${resIcon(give)}" alt=""><b>${o ? (qty * o.g).toLocaleString() : 0}</b>` : ''}</div>
            <div class="mk-mid"><div class="mk-arrow">Quantity to trade</div>
              <input type="range" id="mk-q" min="0" max="${mx}" value="${qty}" ${o && mx ? '' : 'disabled'} aria-label="Quantity">
              <div class="mk-btns"><button class="btn sm" data-mk="max" ${o && mx ? '' : 'disabled'}>Max</button><button class="btn sm primary" data-mk="deal" ${o && qty ? '' : 'disabled'}>Trade</button></div></div>
            <div class="mk-side">${get ? `<img src="${resIcon(get)}" alt=""><b>${o ? (qty * o.r).toLocaleString() : 0}</b>` : ''}</div>
          </div>
          <button class="mk-ok" data-mk="close" title="Close (Esc)">✔</button>`;
      };
      box.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.dataset.give) { give = b.dataset.give; if (get === give) get = null; qty = 0; }
        else if (b.dataset.get) { if (b.dataset.get !== give) { get = b.dataset.get; qty = Math.min(1, max()); } }
        else if (b.dataset.mk === 'max') qty = max();
        else if (b.dataset.mk === 'close') return close(null);
        else if (b.dataset.mk === 'deal') {
          const o = marketOffer(give, get); if (!o || !qty) return;
          const ok = get === 'auramite' ? Gm.trade(VP(), give, -qty) : give === 'auramite' ? Gm.trade(VP(), get, qty) : Gm.barter(VP(), give, get, qty);
          if (ok) { Audio.sfx('build'); toast(`Traded ${(qty * o.g).toLocaleString()} ${D.RES_INFO[give].name} for ${(qty * o.r).toLocaleString()} ${D.RES_INFO[get].name}.`); updateTop(); }
          qty = 0;
        }
        render();
      });
      box.addEventListener('input', e => { if (e.target.id === 'mk-q') { qty = +e.target.value; const o = marketOffer(give, get);
        const sides = box.querySelectorAll('.mk-side b'); if (o && sides.length === 2) { sides[0].textContent = (qty * o.g).toLocaleString(); sides[1].textContent = (qty * o.r).toLocaleString(); }
        box.querySelector('[data-mk="deal"]').disabled = !qty; } });
      render();
    } });
}
// shrine teaching a rite: the painted window with one frame, the rite's icon in the middle
io.riteShrine = async (h, sp, title, text, learned) => {
  await T.riteIconsReady;
  const S = D.SPELLS[sp];
  return modal({ title: '', cls: 'choicebox', buttons: [{ label: 'OK', value: true, primary: true, cancel: true }],
    html: `<div class="cb-frame single"><h3 class="cb-t">${esc(title)}</h3>
      <p class="cb-txt">${esc(text)} <span class="muted">(${D.SCHOOLS[S.school]} rite, level ${S.level})</span></p>
      <div class="cb-pic c ${learned ? '' : 'locked'}" title="${esc(D.spellDesc(h, sp))}">${T.riteIcon(sp, S.school)}</div>
      <span class="cb-val c">${esc(S.name)}</span>
      <button class="cb-ok" data-v="ok">✔</button></div>`,
    onMount: (wrap, close) => { wrap.querySelector('.cb-ok').onclick = () => close(true); wrap.querySelector('.modal-btns').hidden = true; } });
};
io.choose = (title, text, buttons) => modal({ title: esc(title), html: `<p>${esc(text)}</p>`, buttons: buttons.map((b, i) => ({ ...b, cancel: i === 0 })) });
io.notice = (title, text) => modal({ title: esc(title), html: `<p>${esc(text)}</p>` });
io.levelUp = (h, stat, opts) => (Audio.sfx('levelup'), modal({
  title: `${esc(h.name)} reaches level ${h.level}`,
  html: `<p class="lvl-stat">+1 ${D.STAT_NAMES[stat]}</p><p>Choose a skill to learn or improve:</p>`,
  buttons: opts.map((k, i) => { const l = (h.skills[k] || 0) + 1; return { label: `${D.SKILL_LEVELS[l - 1]} ${D.SKILLS[k].name}: ${D.SKILLS[k].desc(D.SKILLS[k].v[l - 1])}`, value: k, primary: i === 0, cancel: i === 0 }; }),
  cls: 'levelup',
}).then(v => v || opts[0]));
io.artifactFound = (h, id, slot) => modal({
  title: 'Artifact recovered',
  html: `<div class="uinfo"><img src="${artIcon(id)}" alt=""><div><p><b style="color:${D.RARITY[D.ARTIFACTS[id].r].color}">${esc(D.ARTIFACTS[id].name)}</b> · ${D.RARITY[D.ARTIFACTS[id].r].name}</p><p>${esc(D.artifactDesc(id))}</p><p class="muted">${slot ? `${esc(h.name)} equips it (${D.SLOT_NAMES[slot]}).` : 'That slot is taken, so it goes into the backpack. Open the commander screen (I) to swap it in.'}</p></div></div>`,
}).then(() => updateUI());
io.exchange = (a, b) => openExchange(a, b);
io.openTown = t => openTown(t);
io.aiStart = p => { ui.aiActive = true; const el = $('#ai-banner'); el.textContent = `${p.name} is on the move…`; el.hidden = false; };
io.aiEnd = () => { ui.aiActive = false; $('#ai-banner').hidden = true; };
io.turnStart = async () => {
  const s = G.s;
  writeSlot(autoSlot(), true);
  if (hotSeat() && ui.lastViewer !== VP()) {
    // hand the computer over: the map stays hidden until the next player is ready
    const p = s.players[VP()];
    ui.lastViewer = VP(); ui.selId = null; ui.selTownId = Gm.townsOf(VP())[0]?.id ?? null; ui.path = null; ui.target = null; ui.fogDirty = true;
    await modal({ cls: 'handover', title: '', html: `<div class="ho"><i style="background:${p.color}"></i><h2>${esc(p.name)}</h2><p>Day ${s.day} · your turn</p><p class="muted">The other players should look away.</p></div>`,
      buttons: [{ label: 'Begin turn', value: true, primary: true, esc: false }] });
    for (const m of (p.inbox || []).splice(0)) toast(m);
  }
  if (s.weekEvent && !s.weekEvent.seen) { s.weekEvent.seen = true; setTimeout(() => showWeek(), 50); }
  const h = (selHero() && selHero().owner === VP() ? selHero() : null) || Gm.heroesOf(VP())[0];
  ui.selId = h ? h.id : null; if (h) ui.focus = 'hero';
  if (h && h.dest) planPath(h, h.dest.x, h.dest.y, false);
  if (h) centerOn(h);
  toast(`Day ${s.day}. ${(s.day - 1) % 7 === 0 ? 'A new week: troops have mustered in your towns.' : hotSeat() ? `${esc(s.players[VP()].name)}'s turn.` : 'Your turn.'}`);
  updateUI();
};
io.gameOver = kind => {
  setTimeout(() => modal({
    title: kind === 'victory' ? 'Victory' : 'Defeat',
    html: kind === 'victory' ? (hotSeat() || (G.s.winners || []).length > 1 ? `<p>The war is over. Victory to ${esc((G.s.winners || []).join(' and '))}.</p>` : '<p>The enemy is broken. The sector is yours.</p>') : '<p>Your last stronghold has fallen and your commanders are dead.</p>',
    buttons: [{ label: 'Main menu', value: 'new', primary: true }],
  }).then(() => showScreen('menu')), 300);
};

// ---------------- week announcement & kingdom overview ----------------
function showWeek() {
  const e = G.s.weekEvent; if (!e) return;
  const pic = e.type === 'unit' ? `<img src="${portrait(e.unit)}" alt="">` : '';
  return modal({ title: `Week ${e.week}`, cls: 'weekev', html: `<div class="uinfo">${pic}<div><h3 class="wk">${esc(e.title)}</h3><p>${esc(e.desc)}</p></div></div>` });
}
function showKingdom() {
  const s = G.s, p = s.players[VP()], inc = Gm.dailyIncome(VP());
  const mines = {}; for (const o of Object.values(s.objects)) if (o.type === 'mine' && o.owner === VP()) mines[o.res] = (mines[o.res] || 0) + 1;
  const towns = Gm.townsOf(VP()).map(t => {
    const vh = Gm.heroAt(t.x, t.y), us = D.FACTIONS[t.faction].units;
    return `<tr><td><button class="link" data-town="${t.id}">${esc(t.name)}</button></td><td>${Gm.townIncome(t).toLocaleString()}</td><td>${Object.keys(t.built).length} / ${D.BUILD_ORDER.length}</td>
      <td>${us.map(u => t.avail[u] ? `<span title="${esc(D.UNITS[Gm.recruitType(t, u)].name)}"><img class="mini" src="${portrait(Gm.recruitType(t, u))}" alt="">${t.avail[u]}</span>` : '').join('') || '<span class="muted">none</span>'}</td><td>${vh ? esc(vh.name) : '<span class="muted">—</span>'}</td></tr>`;
  }).join('');
  const heroes = Gm.heroesOf(VP()).map(h => `<tr><td><button class="link" data-hero="${h.id}">${esc(h.name)}</button>${h.sleep ? ' <small class="muted">(resting)</small>' : ''}</td><td>${h.level}</td><td>${Math.round(Gm.armyStrength(h.army, h)).toLocaleString()}</td><td>${h.mp} / ${D.maxMp(h)}</td><td>${h.mana} / ${D.maxMana(h)}</td></tr>`).join('');
  return modal({
    title: 'Kingdom overview', cls: 'wide-ish kingdom',
    html: `<h4>Daily income</h4><div class="costs">${D.RES.map(r => `<span class="cost">${resImg(r)}+${inc[r].toLocaleString()}</span>`).join('')}</div>
      <h4>Mines</h4><div class="costs">${D.RES.map(r => `<span class="cost">${resImg(r)}${mines[r] || 0}</span>`).join('')}</div>
      <h4>Towns</h4><table class="ktab"><tr><th>Town</th><th>Income</th><th>Buildings</th><th>Ready to recruit</th><th>Visitor</th></tr>${towns}</table>
      <h4>Commanders</h4><table class="ktab"><tr><th>Name</th><th>Level</th><th>Army strength</th><th>Movement</th><th>Mana</th></tr>${heroes}</table>
      ${G.s.weekEvent ? `<p class="muted">This week: <b>${esc(G.s.weekEvent.title)}</b>. ${esc(G.s.weekEvent.desc)}</p>` : ''}`,
    onMount: (wrap, close) => wrap.addEventListener('click', e => {
      const t = e.target.closest('[data-town]'), h = e.target.closest('[data-hero]');
      if (t) { close(null); openTown(G.s.objects[+t.dataset.town]); }
      if (h) { close(null); selectHero(G.s.heroes[+h.dataset.hero]); }
    }),
  });
}

// ---------------- menu ----------------
function showHelp() {
  return modal({
    title: 'How to play', cls: 'wide-ish',
    html: `<div class="help">
      <p><b>Goal.</b> Take every enemy town and defeat every enemy commander. You lose if you have no towns and no commanders left.</p>
      <p><b>Map.</b> Click a tile to plot a route, then click it again (or press Space) to march. Green arrows are reachable today, red ones are not. Walking next to wild creatures starts a fight. Drag or use WASD / arrow keys to pan.</p>
      <p><b>Resources.</b> Claim mines by visiting them. Pick up piles and supply caches. Towns pay auramite every day. Each faction needs two rare materials for its elite troops: the Concord uses plasteel and psy-reactive crystals, the Host uses blackstone and wraithbone.</p>
      <p><b>Towns.</b> Build one structure per day. Troops muster every week. Recruit into the garrison or the visiting commander's army.</p>
      <p><b>Battle.</b> Stacks act in order of speed. Click a lit hex to move, click an enemy to attack (the side you hover decides where you strike from). Ranged troops shoot unless an enemy is adjacent. Each stack retaliates once per round. W waits, D defends, S opens battle rites, A toggles auto-combat.</p>
      <p><b>Commanders.</b> Each has a specialty and learns secondary skills as they level up: you pick one of two. Artifacts fill twelve equipment slots; open the commander screen with I. Morale can grant an extra turn or cost one; luck can double or halve a blow.</p>
      <p><b>Magic.</b> Spells come in four schools and five levels. Commanders learn them by visiting a town's Mage Guild; Wisdom unlocks levels 3 to 5. Town Portal and Far Sight are cast from the spellbook (B) on the map.</p>
      <p><b>Sieges.</b> Every town has a Fort with walls and a gate; a Citadel adds a moat and gun tower, a Castle two more towers. Your bombard fires every round (Ballistics adds shots), and troops next to the gate can batter it.</p>
      <p><b>Keys.</b> E ends the turn, H selects the next commander, T opens a town (or double-click it), I opens the commander screen, B the spellbook, K the kingdom overview, Z rests or wakes a commander.</p>
      <p><b>Weeks.</b> Every week has a theme: a creature musters in greater numbers, convoys bring materials, or famine and swarms strike.</p></div>`,
  });
}
// Desktop app only: the launcher exposes ashenDisplay(mode) and ashenDisplayMode(); the choice is remembered there.
async function showDisplay() {
  const cur = window.ashenDisplayMode ? await window.ashenDisplayMode() : 'fullscreen';
  const name = { fullscreen: 'Fullscreen', maximized: 'Window with borders', windowed: 'Windowed' };
  const v = await modal({ title: 'Display', html: `<p class="muted">Current: <b>${name[cur] || cur}</b>. F11 also switches between fullscreen and a window.</p>`,
    buttons: [{ label: 'Fullscreen', value: 'fullscreen', primary: cur === 'fullscreen' }, { label: 'Window with borders', value: 'maximized', primary: cur === 'maximized' },
      { label: 'Windowed', value: 'windowed', primary: cur === 'windowed' }, { label: 'Close', value: null, cancel: true }] });
  if (v) window.ashenDisplay(v);
}
async function showMenu() {
  const v = await modal({
    title: 'Command menu',
    buttons: [
      { label: 'Save game', value: 'save', primary: true }, { label: 'Load game', value: 'load' }, { label: 'Options', value: 'options' },
      ...(window.ashenDisplay ? [{ label: 'Display', value: 'display' }] : []),
      { label: 'How to play', value: 'help' }, { label: 'Main menu', value: 'menu' }, { label: 'Close', value: null, cancel: true },
    ],
  });
  if (v === 'save') showSlots('save');
  if (v === 'load') showSlots('load');
  if (v === 'options') showOptions();
  if (v === 'display') showDisplay();
  if (v === 'help') showHelp();
  if (v === 'menu') { writeSlot(autoSlot(), true); showScreen('menu'); }
}

// ---------------- boot ----------------
// Intro trailer: plays once at start (option), any click or key goes straight to the main menu.
function playIntro() {
  return new Promise(resolve => {
    const sec = $('#intro'), v = $('#intro-video'), snd = $('#intro-sound');
    if (opt('intro') === false || !v.canPlayType('video/mp4')) return resolve();
    for (const id of ['menu', 'title', 'game', 'farewell']) $('#' + id).hidden = true;
    sec.hidden = false;
    let done = false;
    const finish = () => { if (done) return; done = true; v.pause(); sec.hidden = true; removeEventListener('keydown', onKey, true); resolve(); };
    const onKey = e => { e.preventDefault(); finish(); };
    sec.onclick = finish; addEventListener('keydown', onKey, true);
    v.onended = finish; v.onerror = finish;
    snd.onclick = e => { e.stopPropagation(); v.muted = false; snd.hidden = true; };
    v.currentTime = 0; v.muted = false;
    // browsers refuse sound before the first click: play muted and offer the sound button
    v.play().catch(() => { v.muted = true; snd.hidden = false; v.play().catch(finish); });
  });
}
async function boot(data) {
  const assets = loadAssets().catch(e => toast(e.message, 'bad'));
  const intro = data && data.save ? Promise.resolve() : playIntro();
  await Promise.all([assets, menuIconsReady]);
  migrateOldSave();
  setupMenu();
  await intro;
  showScreen('menu');
  setupMapInput();
  $('#btn-end').onclick = endTurn;
  $('#btn-next').onclick = nextHero;
  $('#btn-menu').onclick = showMenu;
  $('#btn-help').onclick = showHelp;
  $('#btn-kingdom').onclick = () => G.s && showKingdom();
  requestAnimationFrame(frame);
  if (data && data.save) {
    try { Gm.loadState(JSON.parse(data.save)); enterGame(); } catch { showScreen('menu'); }
  }
}
const hot = window.claude?.hot;
hot?.snapshot?.(() => ({ save: G.s && !G.s.over ? JSON.stringify(G.s) : null }));
if (hot?.ready) hot.ready(boot); else boot(hot?.data ?? {});
window.__game = { G, Gm, ui };

// audio starts on the first click or key press (browser rule); every button clicks
applyVolumes();
const unlockAudio = () => { Audio.unlock(); applyVolumes(); };
document.addEventListener('pointerdown', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) Audio.sfx('click'); }, true);
