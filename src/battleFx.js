// Battle visual effects: particles, weapon trails, impacts and screen shake.
// Positions are in grid units (nx, ny); the view converts them with px() and the hex radius.

// How each unit attacks. Upgraded units (id_u) share their base unit's style.
const STYLE = {
  levy: { ranged: 'bullet', melee: 'blunt' }, warden: { melee: 'smash' }, knight: { melee: 'smash' },
  walker: { ranged: 'cannon', melee: 'smash' }, stormhammer: { melee: 'smash' },
  zealot: { melee: 'smash' }, turncoat: { ranged: 'bullet', melee: 'smash' }, flayer: { melee: 'smash' },
  hellforge: { ranged: 'bullet', melee: 'blunt' }, mawprince: { melee: 'slash' }, desecrator: { ranged: 'hellfire', melee: 'smash' },
  scuttler: { melee: 'bite' }, raider: { ranged: 'bullet', melee: 'blunt' }, stalker: { melee: 'claw' }, hulk: { melee: 'smash' }, servitor: { melee: 'smash' }, brute: { melee: 'smash' }, wraith: { melee: 'claw' }, drake: { melee: 'fire' }, mawspawn: { melee: 'claw' }, kite: { melee: 'claw' }, basilisk: { melee: 'bite' },
  scrapling: { melee: 'slash' }, blastgob: { ranged: 'bullet', melee: 'blunt' }, choppa: { melee: 'slash' }, rokkit: { ranged: 'cannon', melee: 'smash' }, junkgod: { melee: 'smash' },
  thrall: { melee: 'slash' }, fangreaver: { melee: 'slash' }, harpooner: { ranged: 'cannon', melee: 'blunt' }, striker: { melee: 'smash' }, drowned: { melee: 'smash' },
  husk: { melee: 'claw' }, dwarrior: { ranged: 'las', melee: 'blunt' }, scarab: { melee: 'bite' }, ark: { ranged: 'las', melee: 'smash' }, shard: { melee: 'smash' },
};
export function styleOf(type, ranged) {
  const s = STYLE[type.replace(/_[ue]$/, '')] || {};
  return ranged ? (s.ranged || 'bullet') : (s.melee || 'slash');
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);

export class BattleFx {
  constructor() { this.parts = []; this.fx = []; this.shake = 0; }

  addShake(n) { if (!reduced() && !this.noShake) this.shake = Math.max(this.shake, n); }

  burst(at, o) {
    const n = reduced() ? Math.ceil(o.n / 3) : o.n;
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + rand(-1, 1) * (o.spread ?? Math.PI), sp = rand(0.4, 1) * (o.speed ?? 3);
      const life = rand(0.6, 1) * (o.life ?? 0.5);
      this.parts.push({
        x: at.nx + rand(-1, 1) * (o.jitter ?? 0.1), y: at.ny + rand(-1, 1) * (o.jitter ?? 0.1),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color: o.colors[Math.floor(Math.random() * o.colors.length)],
        size: rand(0.6, 1.2) * (o.size ?? 0.06), grav: o.grav ?? 4, drag: o.drag ?? 1.5, kind: o.kind || 'dot', grow: o.grow ?? 0,
      });
    }
  }

  add(kind, props, dur) { this.fx.push({ kind, t0: performance.now() + (props.delay || 0), dur, ...props }); }

  // ---- impact recipes ----
  sparks(at, colors, n = 14) { this.burst(at, { n, colors, speed: 4, life: 0.35, size: 0.05, grav: 6, kind: 'spark', spread: Math.PI }); }
  dust(at, n = 10, big = false) {
    this.burst({ nx: at.nx, ny: at.ny + 0.45 }, { n, colors: ['#8a7a62', '#6e604c', '#a39478'], speed: big ? 1.6 : 1, life: 0.9, size: big ? 0.2 : 0.13, grav: -0.3, drag: 2.5, kind: 'smoke', grow: 0.25, spread: Math.PI * 0.6 });
  }
  blood(at, dir, n = 10) { this.burst(at, { n, colors: ['#8a1c14', '#b02a1e', '#5e100c'], speed: 3, life: 0.45, size: 0.045, grav: 7, angle: Math.atan2(0, dir), spread: 0.9 }); }

  impact(style, at, dir, heavy) {
    switch (style) {
      case 'slash': this.add('arc', { at, dir, color: '#f4efe2' }, 220); this.sparks(at, ['#fff4d0', '#ffd27a'], 8); break;
      case 'claw': this.add('claws', { at, dir, color: '#ffd0c4' }, 240); this.blood(at, dir, 12); break;
      case 'bite': this.add('jaws', { at, color: '#f0e2c8' }, 220); this.blood(at, dir, 8); break;
      case 'smash':
        this.add('ring', { at: { nx: at.nx, ny: at.ny + 0.45 }, color: '#f0dca8' }, 380);
        this.add('star', { at, color: '#fff2c0', size: 0.9 }, 160);
        this.sparks(at, ['#ffe6a0', '#ffffff', '#ffb050'], 16); this.dust(at, 14, true);
        this.burst({ nx: at.nx, ny: at.ny + 0.4 }, { n: 10, colors: ['#5a4c3c', '#3e342a'], speed: 3.5, life: 0.6, size: 0.06, grav: 9, spread: 1.2 });
        this.addShake(heavy ? 9 : 6); break;
      case 'fire':
        this.burst(at, { n: 26, colors: ['#ffdf70', '#ff9a30', '#ff5a1a', '#c02a10'], speed: 1.6, life: 0.6, size: 0.12, grav: -2.5, drag: 2, kind: 'flame', grow: 0.1, jitter: 0.25 });
        this.burst(at, { n: 8, colors: ['#3a322c', '#4a403a'], speed: 0.8, life: 1.1, size: 0.16, grav: -1.2, drag: 2, kind: 'smoke', grow: 0.35, jitter: 0.2 });
        this.add('star', { at, color: '#ffb060', size: 0.8 }, 180); this.addShake(4); break;
      case 'blunt': default:
        this.add('star', { at, color: '#fff2d0', size: 0.6 }, 140); this.sparks(at, ['#fff4d0', '#cfc6b0'], 6); this.addShake(2);
    }
  }
  explosion(at) {
    this.add('flash', { at, color: '#ffe8a0' }, 200);
    this.add('ring', { at: { nx: at.nx, ny: at.ny + 0.45 }, color: '#ffcf80' }, 420);
    this.burst(at, { n: 26, colors: ['#ffef9a', '#ffae40', '#ff6a20'], speed: 4.5, life: 0.45, size: 0.07, grav: 5, kind: 'spark' });
    this.burst(at, { n: 12, colors: ['#3a322c', '#55493e', '#2a2420'], speed: 1.2, life: 1.3, size: 0.2, grav: -0.8, drag: 2, kind: 'smoke', grow: 0.4, jitter: 0.2 });
    this.burst({ nx: at.nx, ny: at.ny + 0.4 }, { n: 12, colors: ['#5a4c3c', '#3e342a'], speed: 4, life: 0.7, size: 0.06, grav: 10, spread: 1.1 });
    this.addShake(10);
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 30);
    for (const p of this.parts) {
      p.life -= dt; p.vy += p.grav * dt;
      const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.size += p.grow * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    const now = performance.now();
    this.fx = this.fx.filter(f => now - f.t0 < f.dur);
  }

  shakeOffset() {
    if (!this.shake) return [0, 0];
    return [rand(-1, 1) * this.shake, rand(-1, 1) * this.shake];
  }

  draw(g, px, R, now) {
    // effects
    for (const f of this.fx) {
      const t = (now - f.t0) / f.dur; if (t < 0) continue;
      g.save();
      switch (f.kind) {
        case 'arc': {
          const p = px(f.at); const s = f.dir;
          g.translate(p.x, p.y); g.scale(s, 1);
          const a0 = -2.2 + t * 1.6, a1 = a0 + 1.6;
          g.strokeStyle = f.color; g.lineCap = 'round'; g.shadowColor = '#ffffff'; g.shadowBlur = 12;
          g.globalAlpha = 1 - t; g.lineWidth = R * 0.16 * (1 - t * 0.5);
          g.beginPath(); g.arc(-R * 0.15, 0, R * 0.75, a0, a1); g.stroke();
          g.lineWidth = R * 0.05; g.globalAlpha = (1 - t) * 0.7; g.beginPath(); g.arc(-R * 0.15, 0, R * 0.95, a0 + 0.2, a1 - 0.1); g.stroke();
          break;
        }
        case 'claws': {
          const p = px(f.at); g.translate(p.x, p.y); g.scale(f.dir, 1);
          g.strokeStyle = f.color; g.lineCap = 'round'; g.shadowColor = '#ff6040'; g.shadowBlur = 8; g.globalAlpha = 1 - t;
          g.lineWidth = R * 0.07;
          const len = Math.min(1, t * 3);
          for (let i = -1; i <= 1; i++) {
            g.beginPath(); g.moveTo(-R * 0.5 + i * R * 0.22, -R * 0.6); g.lineTo(-R * 0.5 + i * R * 0.22 + R * 0.9 * len, -R * 0.6 + R * 1.0 * len); g.stroke();
          }
          break;
        }
        case 'jaws': {
          const p = px(f.at); const c = Math.min(1, t * 2.5);
          g.strokeStyle = f.color; g.lineWidth = R * 0.08; g.globalAlpha = 1 - t; g.lineCap = 'round';
          g.beginPath(); g.arc(p.x, p.y - R * 0.5 * (1 - c), R * 0.45, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
          g.beginPath(); g.arc(p.x, p.y + R * 0.5 * (1 - c), R * 0.45, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
          break;
        }
        case 'ring': {
          const p = px(f.at); g.strokeStyle = f.color; g.globalAlpha = 0.8 * (1 - t); g.lineWidth = R * 0.12 * (1 - t) + 1;
          g.beginPath(); g.ellipse(p.x, p.y, R * (0.3 + t * 1.4), R * (0.1 + t * 0.45), 0, 0, Math.PI * 2); g.stroke();
          break;
        }
        case 'star': case 'flash': {
          const p = px(f.at); const s = R * (f.size || 1) * (f.kind === 'flash' ? 1.6 : 1) * (0.6 + t * 0.6);
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
          gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, f.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = 1 - t; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, s, 0, Math.PI * 2); g.fill();
          if (f.kind === 'star') {
            g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath();
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4 + 0.3; g.moveTo(p.x - Math.cos(a) * s, p.y - Math.sin(a) * s); g.lineTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s); }
            g.stroke();
          }
          break;
        }
        case 'muzzle': {
          const p = px(f.at); const s = R * 0.35 * (1 - t * 0.5);
          g.globalAlpha = 1 - t; g.fillStyle = f.color; g.shadowColor = f.color; g.shadowBlur = 14;
          g.beginPath(); g.moveTo(p.x, p.y - s * 0.4); g.lineTo(p.x + f.dir * s * 1.8, p.y); g.lineTo(p.x, p.y + s * 0.4); g.closePath(); g.fill();
          g.beginPath(); g.arc(p.x, p.y, s * 0.55, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'beam': {
          const a = px(f.from), c = px(f.to); const w = R * 0.14 * (1 - t);
          g.lineCap = 'round'; g.shadowColor = f.color; g.shadowBlur = 16; g.globalAlpha = 1 - t * 0.8;
          g.strokeStyle = f.color; g.lineWidth = w * 2.2; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke();
          g.strokeStyle = '#ffffff'; g.lineWidth = w * 0.8; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke();
          break;
        }
        case 'tracer': {
          const a = px(f.from), c = px(f.to); const e = Math.min(1, t * 1.15), b2 = Math.max(0, e - 0.25);
          g.lineCap = 'round'; g.strokeStyle = f.color; g.shadowColor = f.color; g.shadowBlur = 8; g.lineWidth = Math.max(1.5, R * 0.05);
          g.beginPath(); g.moveTo(a.x + (c.x - a.x) * b2, a.y + (c.y - a.y) * b2); g.lineTo(a.x + (c.x - a.x) * e, a.y + (c.y - a.y) * e); g.stroke();
          break;
        }
        case 'shell': {
          const a = px(f.from), c = px(f.to);
          const x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t - Math.sin(t * Math.PI) * R * 2.2;
          g.fillStyle = '#2a2622'; g.strokeStyle = '#ffcf80'; g.lineWidth = 1.5;
          g.beginPath(); g.arc(x, y, R * 0.1, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = 'rgba(200,190,170,0.35)'; g.beginPath(); g.arc(x - (c.x - a.x) * 0.03, y + R * 0.05, R * 0.08, 0, Math.PI * 2); g.fill();
          break;
        }
      }
      g.restore();
    }
    // particles
    for (const p of this.parts) {
      const q = px({ nx: p.x, ny: p.y }); const a = Math.max(0, p.life / p.max);
      const s = Math.max(0.8, p.size * R);
      g.globalAlpha = p.kind === 'smoke' ? a * 0.45 : a;
      if (p.kind === 'spark') {
        g.strokeStyle = p.color; g.lineWidth = Math.max(1, s * 0.6); g.lineCap = 'round';
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - p.vx * R * 0.04, q.y - p.vy * R * 0.04); g.stroke();
      } else {
        g.fillStyle = p.color; g.beginPath(); g.arc(q.x, q.y, s, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}
