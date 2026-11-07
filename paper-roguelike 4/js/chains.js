/* chains.js
   ChainManager: the chains between Chained Prisoners.
   A chain is a rope of points (verlet physics). Its ends are attached to
   the prisoners. Every point is pushed out of walls and blocks, so the
   chain wraps around them instead of passing through. A moving chain hurts
   players it sweeps through. When one prisoner dies, the other keeps the
   chain and swings its free end like a flail.
   Drawing is done by the HUD (drawChains). */

const CHAIN_POOL = 8;

class ChainManager {
  constructor(scene) {
    this.scene = scene;
    this.rooms = null;   // set by the scene (for wall collision)
    this.list = [];
    for (let i = 0; i < CHAIN_POOL; i++) {
      const n = 12;
      this.list.push({ active: false, a: null, b: null, def: null, n: n, rest: 10, dmgMul: 1,
                       x: new Float32Array(n), y: new Float32Array(n), px: new Float32Array(n), py: new Float32Array(n),
                       speed: new Float32Array(n), hitCdMs: 0 });
    }
    this.onPlayerHit = null;  // (player, result, attacker)
    this.onParry = null;
  }

  clear() {
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (c.a) c.a.chain = null;
      if (c.b) c.b.chain = null;
      c.active = false; c.a = null; c.b = null;
    }
  }

  create(a, b, def, dmgMul) {
    let c = null;
    for (let i = 0; i < this.list.length; i++) if (!this.list[i].active) { c = this.list[i]; break; }
    if (!c) return null;
    c.active = true; c.a = a; c.b = b; c.def = def; c.dmgMul = dmgMul;
    c.n = Math.min(def.links, c.x.length);
    c.rest = def.length / (c.n - 1);
    for (let i = 0; i < c.n; i++) {
      const k = i / (c.n - 1);
      c.x[i] = c.px[i] = a.x + (b.x - a.x) * k;
      c.y[i] = c.py[i] = a.y + (b.y - a.y) * k;
      c.speed[i] = 0;
    }
    c.hitCdMs = 0;
    // pair attack plan (run by the prisoner AI)
    c.mode = 'line'; c.modeMs = 0; c.prog = 0; c.readyA = false; c.readyB = false;
    c.dirX = 1; c.dirY = 0; c.cx = (a.x + b.x) / 2; c.cy = (a.y + b.y) / 2;
    a.chain = c; b.chain = c;
    return c;
  }

  // Pushes a point out of solid tiles (walls / blocks).
  collide(c, i) {
    const rooms = this.rooms;
    if (!rooms.solidAt(c.x[i], c.y[i])) return;
    const T = rooms.T;
    const tx = Math.floor(c.x[i] / T), ty = Math.floor(c.y[i] / T);
    const lx = c.x[i] - tx * T, ly = c.y[i] - ty * T;
    // move to the closest free edge
    const dl = lx, dr = T - lx, du = ly, dd = T - ly;
    const m = Math.min(dl, dr, du, dd);
    if (m === dl && !rooms.solidAt(tx * T - 1, c.y[i])) c.x[i] = tx * T - 1;
    else if (m === dr && !rooms.solidAt((tx + 1) * T + 1, c.y[i])) c.x[i] = (tx + 1) * T + 1;
    else if (m === du && !rooms.solidAt(c.x[i], ty * T - 1)) c.y[i] = ty * T - 1;
    else if (!rooms.solidAt(c.x[i], (ty + 1) * T + 1)) c.y[i] = (ty + 1) * T + 1;
    else { c.x[i] = c.px[i]; c.y[i] = c.py[i]; }
  }

  update(dt, players) {
    const sec = Math.max(0.001, dt / 1000);
    for (let ci = 0; ci < this.list.length; ci++) {
      const c = this.list[ci];
      if (!c.active) continue;
      // (enemies are pooled: a dead prisoner's object may come back as another enemy,
      //  so "alive" also means it still points at this chain)
      const aAlive = this.alive(c, c.a), bAlive = this.alive(c, c.b);
      if (!aAlive && !bAlive) { this.free(c); continue; }
      // keep the living holder at index 0
      if (!aAlive && bAlive) { this.flip(c); }
      const n = c.n;
      const holder = c.a, other = this.alive(c, c.b) ? c.b : null;

      // verlet step (with friction)
      for (let i = 0; i < n; i++) {
        const vx = (c.x[i] - c.px[i]) * 0.86, vy = (c.y[i] - c.py[i]) * 0.86;
        c.px[i] = c.x[i]; c.py[i] = c.y[i];
        c.x[i] += vx; c.y[i] += vy;
      }
      // pin ends
      c.x[0] = holder.x; c.y[0] = holder.y;
      if (other) { c.x[n - 1] = other.x; c.y[n - 1] = other.y; }
      else if (holder.state === 'swing' && holder.def.flail) {
        // flail: drive the free end around the holder along the swing arc
        const f = holder.def.flail;
        const k = 1 - Math.max(0, holder.stateMs) / f.swingMs;
        const half = (f.arcDeg / 2) * Math.PI / 180;
        const a = holder.swingAng - half + 2 * half * k;
        const r = c.rest * (n - 1) * 0.92;
        c.x[n - 1] = holder.x + Math.cos(a) * r;
        c.y[n - 1] = holder.y + Math.sin(a) * r;
      }
      // constraints (a few passes) + wall collision
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < n - 1; i++) {
          const dx = c.x[i + 1] - c.x[i], dy = c.y[i + 1] - c.y[i];
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist <= c.rest) continue;          // a chain can go slack, never stretch
          const diff = (dist - c.rest) / dist;
          const w0 = i === 0 ? 0 : 0.5;
          const w1 = (i + 1 === n - 1 && (other || holder.state === 'swing')) ? 0 : 0.5;
          const tw = (w0 + w1) || 1;
          c.x[i] += dx * diff * (w0 / tw); c.y[i] += dy * diff * (w0 / tw);
          c.x[i + 1] -= dx * diff * (w1 / tw); c.y[i + 1] -= dy * diff * (w1 / tw);
        }
        for (let i = 1; i < n - (other ? 1 : 0); i++) this.collide(c, i);
      }

      // the two prisoners can't run further apart than the chain allows
      if (other) {
        const dx = other.x - holder.x, dy = other.y - holder.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const max = c.rest * (n - 1);
        if (dist > max) {
          const pull = Math.min(300, (dist - max) * 8);
          holder.body.velocity.x += dx / dist * pull; holder.body.velocity.y += dy / dist * pull;
          other.body.velocity.x -= dx / dist * pull; other.body.velocity.y -= dy / dist * pull;
        }
      }

      // speed of each link (a still chain lying on the floor does no damage)
      for (let i = 0; i < n; i++) {
        const vx = c.x[i] - c.px[i], vy = c.y[i] - c.py[i];
        c.speed[i] = Math.sqrt(vx * vx + vy * vy) / sec;
      }

      // damage players the moving chain touches
      if (c.hitCdMs > 0) { c.hitCdMs -= dt; continue; }
      const flailing = !other && holder.state === 'swing';
      const dmg = Math.round((flailing ? c.def.flailDamage : c.def.damage) * c.dmgMul);
      for (let p = 0; p < players.length; p++) {
        const pl = players[p];
        if (!pl.alive) continue;
        const r = pl.stats.size / 2 + 5;
        for (let i = 1; i < n; i++) {
          if (!flailing && c.speed[i] < c.def.minSpeed && c.speed[i - 1] < c.def.minSpeed) continue;
          if (this.segDist2(pl.sprite.x, pl.sprite.y, c.x[i - 1], c.y[i - 1], c.x[i], c.y[i]) > r * r) continue;
          const res = pl.takeHit(dmg, c.x[i], c.y[i]);
          if (res === 'parry') { if (this.onParry) this.onParry(pl, holder); }
          else if (this.onPlayerHit) this.onPlayerHit(pl, res, holder);
          if (res !== 'none') c.hitCdMs = 250;
          break;
        }
      }
    }
  }

  alive(c, e) {
    return !!e && e.active && e.chain === c;
  }

  segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const cx = ax + dx * t - px, cy = ay + dy * t - py;
    return cx * cx + cy * cy;
  }

  flip(c) {
    const t = c.a; c.a = c.b; c.b = t;
    const n = c.n;
    for (let i = 0; i < n / 2; i++) {
      const j = n - 1 - i;
      let v = c.x[i]; c.x[i] = c.x[j]; c.x[j] = v;
      v = c.y[i]; c.y[i] = c.y[j]; c.y[j] = v;
      v = c.px[i]; c.px[i] = c.px[j]; c.px[j] = v;
      v = c.py[i]; c.py[i] = c.py[j]; c.py[j] = v;
    }
  }

  free(c) {
    if (c.a && c.a.chain === c) c.a.chain = null;
    if (c.b && c.b.chain === c) c.b.chain = null;
    c.active = false; c.a = null; c.b = null;
  }
}
