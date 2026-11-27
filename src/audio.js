// Sound and music, synthesised live with the Web Audio API (no audio files).
// Music: generative tracks scheduled a little ahead of time on a step clock, with crossfades between them.
// Effects: short synthesised sounds for weapons, impacts, spells and interface actions.

let ctx = null, master = null, musicBus = null, sfxBus = null, verb = null, noiseBuf = null;
let musicVol = 0.6, sfxVol = 0.8, meter = null;
let current = null, wanted = null;

const A = {};
export default A;

function makeImpulse(sec, decay) {
  const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}
function makeNoise() {
  const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// Start the audio context; browsers only allow this after a click or key press.
A.unlock = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createDynamicsCompressor(); master.threshold.value = -14; master.ratio.value = 4; master.connect(ctx.destination);
  meter = ctx.createAnalyser(); meter.fftSize = 2048; master.connect(meter);
  musicBus = ctx.createGain(); sfxBus = ctx.createGain();
  musicBus.gain.value = musicVol; sfxBus.gain.value = sfxVol;
  verb = ctx.createConvolver(); verb.buffer = makeImpulse(3.2, 2.6);
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.55; verb.connect(verbGain); verbGain.connect(master);
  // music runs through a low shelf of warmth and a lowpass so it sits dark and muffled under the effects
  const dark = ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 1250; dark.Q.value = 0.4;
  const warm = ctx.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 180; warm.gain.value = 5;
  musicBus.connect(warm); warm.connect(dark); dark.connect(master); sfxBus.connect(master);
  noiseBuf = makeNoise();
  setInterval(tick, 40);
  if (wanted) A.music(wanted, true);
};
A.setVolumes = (m, s) => {
  musicVol = m; sfxVol = s;
  if (ctx) { musicBus.gain.setTargetAtTime(m, ctx.currentTime, 0.1); sfxBus.gain.setTargetAtTime(s, ctx.currentTime, 0.05); }
};

// ---------------------------------------------------------------- building blocks
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(gain, t, a, peak, d, sustain, r, len) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + a);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), t + a + d);
  gain.gain.setValueAtTime(Math.max(0.0001, peak * sustain), t + len);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len + r);
}
function voice(out, { type = 'sawtooth', freq, t, len, a = 0.01, d = 0.1, s = 0.6, r = 0.2, peak = 0.2, cutoff = 2000, q = 1, detune = 0, wet = 0.3, sweep = null }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, t + len);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, peak, d, s, r, len);
  o.connect(f); f.connect(g); g.connect(out);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  o.start(t); o.stop(t + len + r + 0.05);
  return { o, f, g };
}
function noise(out, { t, len, a = 0.005, d = 0.05, s = 0.3, r = 0.1, peak = 0.3, type = 'bandpass', freq = 1000, q = 1, sweep = null, wet = 0.2, rate = 1 }) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = rate;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + len + r);
  const g = ctx.createGain(); env(g, t, a, peak, d, s, r, len);
  src.connect(f); f.connect(g); g.connect(out);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  src.start(t, Math.random() * 1.5); src.stop(t + len + r + 0.05);
}
const kick = (out, t, p = 0.9) => { voice(out, { type: 'sine', freq: 120, sweep: 38, t, len: 0.22, a: 0.002, d: 0.18, s: 0.2, r: 0.25, peak: p, cutoff: 600, wet: 0.15 }); noise(out, { t, len: 0.02, peak: p * 0.25, freq: 2500, wet: 0 }); };
const tom = (out, t, f = 90, p = 0.6) => { voice(out, { type: 'triangle', freq: f * 1.6, sweep: f, t, len: 0.25, a: 0.002, d: 0.2, s: 0.25, r: 0.3, peak: p, cutoff: 900, wet: 0.35 }); noise(out, { t, len: 0.06, peak: p * 0.3, freq: 600, q: 0.8, wet: 0.3 }); };
const anvil = (out, t, p = 0.18) => { for (const m of [1, 2.76, 5.4]) voice(out, { type: 'sine', freq: 620 * m, t, len: 0.05, a: 0.001, d: 0.3, s: 0.05, r: 1.2, peak: p / m, cutoff: 9000, wet: 0.6 }); };
const bell = (out, t, midi, p = 0.12) => { for (const [m, k] of [[1, 1], [2.01, 0.5], [3.0, 0.3], [4.2, 0.18]]) voice(out, { type: 'sine', freq: mtof(midi) * m, t, len: 0.02, a: 0.002, d: 0.6, s: 0.3, r: 2.6, peak: p * k, cutoff: 8000, wet: 0.8 }); };
function pad(out, t, midis, len, { type = 'sawtooth', peak = 0.05, cutoff = 900, wet = 0.6 } = {}) {
  for (const m of midis) for (const det of [-9, 8]) voice(out, { type, freq: mtof(m), t, len, a: len * 0.35, d: 0.3, s: 0.85, r: len * 0.5, peak, cutoff, detune: det, wet });
}
function choir(out, t, midi, len, peak = 0.05) {
  // vowel-like formants on a buzzing source
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.2; vg.gain.value = 4; vib.connect(vg); vg.connect(o.detune);
  const g = ctx.createGain(); env(g, t, len * 0.4, peak, 0.3, 0.9, len * 0.6, len);
  for (const [f, k] of [[700, 1], [1150, 0.5], [2600, 0.25]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 9; const kg = ctx.createGain(); kg.gain.value = k * 3; o.connect(bp); bp.connect(kg); kg.connect(g); }
  g.connect(out); const w = ctx.createGain(); w.gain.value = 0.8; g.connect(w); w.connect(verb);
  o.start(t); vib.start(t); o.stop(t + len * 1.7); vib.stop(t + len * 1.7);
}

// ---------------------------------------------------------------- music
// Each track: step length in seconds, and a function scheduling the notes of one step.
const TRACKS = {
  menu: {
    step: 0.75,
    play(out, i, t) {
      const bar = Math.floor(i / 16) % 4, chords = [[38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 51, 55], [33, 45, 48, 52]];
      if (i % 16 === 0) pad(out, t, chords[bar], 11, { peak: 0.035, cutoff: 520 });
      if (i % 16 === 0) voice(out, { type: 'sine', freq: mtof(chords[bar][0] - 24), t, len: 11, a: 3, s: 0.9, r: 3, peak: 0.16, cutoff: 200, wet: 0.2 });
      if (i % 8 === 4 && Math.random() < 0.7) bell(out, t, [50, 53, 57, 55, 58, 49][Math.floor(Math.random() * 6)], 0.05);
      if (i % 32 === 0) noise(out, { t, len: 6, a: 2.5, d: 1, s: 0.8, r: 3, peak: 0.05, type: 'lowpass', freq: 500, sweep: 900, wet: 0.5, rate: 0.5 });
    },
  },
  concord: {
    // stately organ hymn over a steady low drum, D minor
    step: 0.64,
    play(out, i, t) {
      const bar = Math.floor(i / 16) % 8, prog = [[38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 51, 55], [38, 50, 53, 57], [31, 43, 46, 50], [34, 46, 49, 53], [33, 45, 48, 52], [38, 50, 53, 57]];
      const c = prog[bar];
      if (i % 16 === 0) { pad(out, t, c, 9.8, { type: 'square', peak: 0.016, cutoff: 700, wet: 0.8 }); pad(out, t, [c[0] - 12], 9.8, { type: 'sawtooth', peak: 0.045, cutoff: 200 }); pad(out, t, [c[0] - 24], 9.8, { type: 'sine', peak: 0.08, cutoff: 160, wet: 0.1 }); }
      if (i % 8 === 0) tom(out, t, 55, 0.4);
      if (i % 16 === 12) tom(out, t, 48, 0.3);
      if (i % 4 === 2 && bar % 2 === 1) voice(out, { type: 'triangle', freq: mtof(c[1 + (i / 4 | 0) % 3]), t, len: 1.1, a: 0.12, d: 0.4, s: 0.6, r: 1.4, peak: 0.05, cutoff: 900, wet: 0.8 });
      if (i % 64 === 48) bell(out, t, 50, 0.08);
    },
  },
  hollow: {
    // low drone, heartbeat, a wordless choir and metal scraping, C minor / Phrygian
    step: 0.58,
    play(out, i, t) {
      const bar = Math.floor(i / 16) % 4, roots = [36, 37, 36, 34];
      if (i % 16 === 0) {
        voice(out, { type: 'sawtooth', freq: mtof(roots[bar] - 24), t, len: 8.8, a: 2.5, s: 0.9, r: 2.5, peak: 0.09, cutoff: 160, q: 5, wet: 0.3 });
        voice(out, { type: 'sawtooth', freq: mtof(roots[bar] - 17), t, len: 8.8, a: 3, s: 0.9, r: 2.5, peak: 0.035, cutoff: 300, detune: 12, wet: 0.6 });
      }
      if (i % 32 === 0) choir(out, t, [48, 49, 46, 51][(i / 32 | 0) % 4], 11, 0.05);
      if (i % 8 === 0) { kick(out, t, 0.5); kick(out, t + 0.3, 0.32); }   // heartbeat
      if (i % 32 === 22) noise(out, { t, len: 1.2, a: 0.3, d: 0.3, s: 0.6, r: 0.6, peak: 0.05, type: 'bandpass', freq: 3200, q: 12, sweep: 1400, wet: 0.7 });
      if (i % 64 === 40) anvil(out, t, 0.08);
    },
  },
  rustbound: {
    // the dead hive: a low industrial drone, slow metal clanks, a distant siren and void hiss
    step: 0.6,
    play(out, i, t) {
      const bar = Math.floor(i / 16) % 4, roots = [33, 33, 36, 31];
      if (i % 16 === 0) {
        voice(out, { type: 'sawtooth', freq: mtof(roots[bar] - 12), t, len: 9.5, a: 3, s: 0.9, r: 3, peak: 0.08, cutoff: 150, q: 6, wet: 0.3 });
        voice(out, { type: 'square', freq: mtof(roots[bar] - 5), t, len: 9.5, a: 4, s: 0.8, r: 3, peak: 0.02, cutoff: 260, detune: 18, wet: 0.6 });
      }
      if (i % 8 === 0) { anvil(out, t, 0.06); tom(out, t + 0.02, 45, 0.3); }
      if (i % 8 === 5) noise(out, { t, len: 0.08, a: 0.002, d: 0.06, s: 0.2, r: 0.2, peak: 0.08, type: 'bandpass', freq: 900, q: 6, wet: 0.5 });
      if (i % 32 === 20) voice(out, { type: 'sine', freq: 520, sweep: 380, t, len: 3, a: 1, d: 0.5, s: 0.7, r: 2, peak: 0.025, cutoff: 1200, wet: 0.9 });
      if (i % 32 === 8) noise(out, { t, len: 3, a: 1.2, d: 0.5, s: 0.6, r: 2, peak: 0.04, type: 'bandpass', freq: 2400, q: 3, sweep: 1600, wet: 0.8 });
    },
  },
  battle: {
    // war drums and a driving low brass ostinato, ~140 bpm
    step: 0.15,
    play(out, i, t) {
      const s = i % 16, bar = Math.floor(i / 16) % 8, roots = [38, 38, 41, 36, 38, 38, 34, 36], r = roots[bar];
      if (s === 0 || s === 6 || s === 10) kick(out, t, 0.7);
      if (s === 4 || s === 12) { tom(out, t, 110, 0.4); noise(out, { t, len: 0.08, peak: 0.12, freq: 1800, q: 0.6, wet: 0.3 }); }
      if (s === 14 && bar % 2) tom(out, t, 85, 0.35);
      
      const riff = [0, 0, 12, 0, 3, 0, 7, 5];
      if (s % 2 === 0) voice(out, { type: 'sawtooth', freq: mtof(r - 24 + riff[s / 2]), t, len: 0.26, a: 0.01, d: 0.15, s: 0.5, r: 0.12, peak: 0.1, cutoff: 420, q: 4, wet: 0.2 });
      if (s === 0) pad(out, t, [r, r + 3, r + 7], 2.4, { type: 'sawtooth', peak: 0.025, cutoff: 700, wet: 0.6 });
      if (s === 0 && bar === 0) anvil(out, t, 0.1);
    },
  },
  siege: null,
};
TRACKS.siege = { step: 0.17, play(out, i, t) { TRACKS.battle.play(out, i, t); if (i % 32 === 0) choir(out, t, 50, 4.5, 0.04); } };

// map themes are ambient but should sit at a similar loudness to the battle drums
const TRACK_GAIN = { menu: 1.6, concord: 1.5, hollow: 2.0, rustbound: 2.2, battle: 0.6, siege: 0.6 };
let nextT = 0, stepI = 0;
function tick() {
  if (!ctx || !current) return;
  if (current.file) return;
  const tr = TRACKS[current.name] || TRACKS.concord;
  while (nextT < ctx.currentTime + 0.25) { tr.play(current.out, stepI++, nextT); nextT += tr.step; }
}
// Switch music with a crossfade. Names: menu, concord, hollow, battle, siege.
// Recorded loops (assets/audio/<name>.mp3) replace the synthesised theme of the same name when present.
const FILE_TRACKS = new Set(['adventure', 'menu', 'concord', 'hollow', 'rustbound', 'scrapjaw', 'deathless', 'palefang']);
const FILE_GAIN = 0.55, buffers = {};
function loadTrack(name) {
  if (!buffers[name]) buffers[name] = fetch(`assets/audio/${name}.mp3`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => ctx.decodeAudioData(b)).then(trimSilence).catch(() => null);
  return buffers[name];
}
// mp3 encoders pad the start and end with silence: cut it so the loop point stays seamless
function trimSilence(buf) {
  const d = buf.getChannelData(0); let a = 0, b = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < 1e-4) a++;
  while (b > a && Math.abs(d[b]) < 1e-4) b--;
  if (a === 0 && b === d.length - 1) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, b - a + 1, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(a, b + 1));
  return out;
}
A.music = (name, force = false) => {
  wanted = name;
  if (!ctx || (!force && current && current.name === name)) return;
  const t = ctx.currentTime;
  if (current) { const old = current; old.out.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { try { old.src?.stop(); } catch { /* not started */ } old.out.disconnect(); }, 4000); }
  const file = FILE_TRACKS.has(name);
  const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.setTargetAtTime(file ? FILE_GAIN : TRACK_GAIN[name] || 1, t + 0.1, 0.8); out.connect(musicBus);
  const cur = { name, out, file }; current = cur; stepI = 0; nextT = t + 0.15;
  if (file) loadTrack(name).then(buf => {
    if (current !== cur) return;
    if (!buf) { cur.file = false; out.gain.setTargetAtTime(TRACK_GAIN[name] || 1, ctx.currentTime, 0.5); nextT = ctx.currentTime + 0.1; return; }   // fall back to the synth theme
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(out); src.start(); cur.src = src;
  });
};

// ---------------------------------------------------------------- effects
const FX = {
  click: t => voice(sfxBus, { type: 'square', freq: 1400, sweep: 900, t, len: 0.02, a: 0.001, d: 0.02, s: 0.1, r: 0.03, peak: 0.05, cutoff: 3000, wet: 0 }),
  open: t => { noise(sfxBus, { t, len: 0.18, a: 0.02, peak: 0.08, type: 'bandpass', freq: 400, sweep: 1600, q: 2, wet: 0.2 }); },
  move: t => { noise(sfxBus, { t, len: 0.16, a: 0.02, d: 0.1, s: 0.5, r: 0.1, peak: 0.05, type: 'lowpass', freq: 260, wet: 0 }); voice(sfxBus, { type: 'square', freq: 48, t, len: 0.12, a: 0.01, peak: 0.025, cutoff: 200, wet: 0 }); },
  step: t => noise(sfxBus, { t, len: 0.05, a: 0.002, d: 0.04, s: 0.2, r: 0.05, peak: 0.07, type: 'lowpass', freq: 500, wet: 0.05 }),
  las: t => { voice(sfxBus, { type: 'sawtooth', freq: 2600, sweep: 500, t, len: 0.14, a: 0.002, d: 0.1, s: 0.3, r: 0.1, peak: 0.08, cutoff: 5000, wet: 0.3 }); voice(sfxBus, { type: 'sine', freq: 1300, sweep: 300, t, len: 0.12, a: 0.002, peak: 0.06, cutoff: 4000, wet: 0.2 }); },
  bullet: t => { for (let i = 0; i < 3; i++) noise(sfxBus, { t: t + i * 0.07, len: 0.03, a: 0.001, d: 0.04, s: 0.2, r: 0.08, peak: 0.25, type: 'bandpass', freq: 1800, q: 0.7, sweep: 600, wet: 0.25 }); },
  storm: t => { for (let i = 0; i < 9; i++) noise(sfxBus, { t: t + i * 0.045, len: 0.025, a: 0.001, d: 0.035, s: 0.2, r: 0.06, peak: 0.22, type: 'bandpass', freq: 1300, q: 0.7, sweep: 500, wet: 0.2 }); voice(sfxBus, { type: 'sawtooth', freq: 70, t, len: 0.45, a: 0.05, d: 0.2, s: 0.6, r: 0.2, peak: 0.05, cutoff: 300, wet: 0.1 }); },
  cannon: t => { kick(sfxBus, t, 0.9); noise(sfxBus, { t, len: 0.25, a: 0.002, d: 0.2, s: 0.4, r: 0.6, peak: 0.35, type: 'lowpass', freq: 1200, sweep: 200, wet: 0.5 }); },
  hellfire: t => { kick(sfxBus, t, 0.7); noise(sfxBus, { t, len: 0.5, a: 0.01, d: 0.2, s: 0.6, r: 0.4, peak: 0.25, type: 'bandpass', freq: 900, q: 0.8, sweep: 300, wet: 0.5 }); },
  explosion: t => { kick(sfxBus, t, 1); noise(sfxBus, { t, len: 0.4, a: 0.003, d: 0.3, s: 0.4, r: 1.0, peak: 0.45, type: 'lowpass', freq: 2200, sweep: 150, wet: 0.6 }); },
  slash: t => noise(sfxBus, { t, len: 0.08, a: 0.01, d: 0.06, s: 0.3, r: 0.08, peak: 0.25, type: 'bandpass', freq: 2400, q: 1.2, sweep: 5000, wet: 0.2 }),
  claw: t => { FX.slash(t); FX.slash(t + 0.07); },
  bite: t => { noise(sfxBus, { t, len: 0.05, peak: 0.22, type: 'bandpass', freq: 900, q: 1.5, wet: 0.1 }); },
  blunt: t => { tom(sfxBus, t, 120, 0.5); noise(sfxBus, { t, len: 0.04, peak: 0.2, freq: 700, wet: 0.2 }); },
  smash: t => { kick(sfxBus, t, 0.8); anvil(sfxBus, t, 0.12); noise(sfxBus, { t, len: 0.12, peak: 0.3, type: 'lowpass', freq: 1400, sweep: 300, wet: 0.4 }); },
  fire: t => { FX.hellfire(t); },
  hit: t => { noise(sfxBus, { t, len: 0.04, a: 0.001, peak: 0.18, type: 'bandpass', freq: 600, q: 1, wet: 0.1 }); voice(sfxBus, { type: 'triangle', freq: 160, sweep: 70, t, len: 0.08, a: 0.002, peak: 0.25, cutoff: 800, wet: 0.1 }); },
  death: t => { voice(sfxBus, { type: 'sawtooth', freq: 220, sweep: 60, t, len: 0.6, a: 0.01, d: 0.3, s: 0.5, r: 0.4, peak: 0.07, cutoff: 600, wet: 0.5 }); noise(sfxBus, { t: t + 0.1, len: 0.3, peak: 0.12, type: 'lowpass', freq: 400, wet: 0.3 }); },
  spell_fire: t => { FX.explosion(t); },
  spell_water: t => { for (let i = 0; i < 6; i++) voice(sfxBus, { type: 'sine', freq: 900 + i * 260, t: t + i * 0.04, len: 0.05, a: 0.002, d: 0.2, s: 0.2, r: 0.6, peak: 0.06, cutoff: 6000, wet: 0.8 }); noise(sfxBus, { t, len: 0.4, peak: 0.08, type: 'highpass', freq: 3000, wet: 0.5 }); },
  spell_air: t => { noise(sfxBus, { t, len: 0.05, a: 0.001, peak: 0.4, type: 'highpass', freq: 1500, wet: 0.4 }); kick(sfxBus, t + 0.04, 0.8); noise(sfxBus, { t: t + 0.05, len: 0.8, a: 0.05, d: 0.5, s: 0.3, r: 1.2, peak: 0.2, type: 'lowpass', freq: 600, sweep: 120, wet: 0.7 }); },
  spell_earth: t => { voice(sfxBus, { type: 'sawtooth', freq: 55, t, len: 0.8, a: 0.05, d: 0.4, s: 0.6, r: 0.6, peak: 0.18, cutoff: 180, q: 4, wet: 0.4 }); noise(sfxBus, { t, len: 0.6, peak: 0.2, type: 'lowpass', freq: 300, wet: 0.5 }); },
  buff: t => { for (const [i, m] of [74, 78, 81, 86].entries()) voice(sfxBus, { type: 'sine', freq: mtof(m), t: t + i * 0.06, len: 0.1, a: 0.01, d: 0.3, s: 0.3, r: 0.8, peak: 0.05, cutoff: 6000, wet: 0.8 }); },
  debuff: t => { for (const [i, m] of [62, 61, 58].entries()) voice(sfxBus, { type: 'sawtooth', freq: mtof(m), t: t + i * 0.08, len: 0.15, a: 0.01, peak: 0.04, cutoff: 1200, wet: 0.6 }); },
  build: t => { for (let i = 0; i < 3; i++) anvil(sfxBus, t + i * 0.18, 0.14); tom(sfxBus, t + 0.6, 80, 0.4); },
  recruit: t => { tom(sfxBus, t, 90, 0.4); tom(sfxBus, t + 0.15, 90, 0.35); voice(sfxBus, { type: 'square', freq: mtof(62), t: t + 0.3, len: 0.4, a: 0.02, peak: 0.04, cutoff: 1500, wet: 0.5 }); },
  gold: t => { for (let i = 0; i < 4; i++) voice(sfxBus, { type: 'sine', freq: 1800 + Math.random() * 1600, t: t + i * 0.05, len: 0.02, a: 0.001, d: 0.15, s: 0.1, r: 0.3, peak: 0.06, cutoff: 9000, wet: 0.4 }); },
  levelup: t => { for (const [i, m] of [62, 66, 69, 74].entries()) voice(sfxBus, { type: 'sawtooth', freq: mtof(m), t: t + i * 0.12, len: 0.5 - i * 0.05, a: 0.02, d: 0.2, s: 0.6, r: 0.6, peak: 0.05, cutoff: 2400, wet: 0.7 }); bell(sfxBus, t + 0.5, 86, 0.08); },
  victory: t => { for (const [i, m] of [62, 69, 74, 78].entries()) pad(sfxBus, t + i * 0.25, [m], 0.6 + (i === 3 ? 1.5 : 0), { type: 'sawtooth', peak: 0.04, cutoff: 2500, wet: 0.6 }); kick(sfxBus, t, 0.6); kick(sfxBus, t + 0.75, 0.8); },
  defeat: t => { for (const [i, m] of [62, 61, 58, 50].entries()) pad(sfxBus, t + i * 0.35, [m], 0.8 + (i === 3 ? 1.5 : 0), { type: 'sawtooth', peak: 0.04, cutoff: 900, wet: 0.7 }); },
  turn: t => { bell(sfxBus, t, 57, 0.1); bell(sfxBus, t + 0.4, 50, 0.08); },
  gate: t => { noise(sfxBus, { t, len: 0.7, a: 0.05, d: 0.3, s: 0.7, r: 0.3, peak: 0.09, type: 'bandpass', freq: 260, q: 3, wet: 0.4 }); tom(sfxBus, t + 0.7, 60, 0.5); },
  deny: t => voice(sfxBus, { type: 'square', freq: 180, t, len: 0.12, a: 0.005, peak: 0.02, cutoff: 900, wet: 0 }),
};
const last = {};
// Play an effect by name; repeats of the same effect within 40 ms are merged so volleys do not clip.
A.sfx = (name, delayMs = 0) => {
  if (!ctx || !FX[name] || sfxVol <= 0) return;
  const now = performance.now(); if (last[name] && now - last[name] < 40) return; last[name] = now;
  FX[name](ctx.currentTime + 0.01 + delayMs / 1000);
};
A.has = name => !!FX[name];
// current output level (RMS), for checks
A.level = () => { if (!meter) return 0; const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); let q = 0; for (const v of d) q += v * v; return Math.sqrt(q / d.length); };
