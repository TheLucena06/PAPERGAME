/* bosses.js
   BOSS_TYPES (data) + BossManager (runs the boss fight).

   Boss 1 — The Bookworm (a top-down Eater of Worlds):
   - A long worm made of segments. Each segment has its own HP.
   - It burrows under the floor and inside the walls (invisible, can't be hit,
     you only see the dirt moving), shows a warning where it will burst out,
     lunges across the arena, then dives back into the floor or a wall.
   - Killing a body segment SPLITS the worm: the part behind it becomes a new
     worm with its own head. Killing a head makes the next segment the head.
   - Surfaced body segments sometimes drop slow ink spit.
   - The fight ends when every segment is dead.

   How the worm moves: the head leaves a trail of points (a "path") behind
   it, one every sampleStep pixels, each remembering if it was above or
   below ground. Segment i sits i*spacing pixels back along that trail, so
   the body follows the head exactly and comes out of the same hole. */

const BOSS_TYPES = {
  bookworm: {
    name: 'The Bookworm', title: 'Devourer of Pages', kind: 'worm',
    segments: 28,               // total length (head + body + tail)
    spacing: 19,                // pixels between segments
    sampleStep: 3,              // path point every 3 px
    sizes: { head: 36, body: 28, tail: 20 },
    hp: { head: 160, body: 100, tail: 80 },        // per segment, at level 1
    contact: { head: 22, body: 12, tail: 8 },       // contact damage, at level 1
    underSpeed: 300, surfSpeed: 345,
    shortWormBonus: 0.35,       // short worms move up to +35% faster
    turnUnder: 3.4, turnSurf: 2.1,                  // radians per second
    underMs: [1100, 2000],      // time spent underground before the next attack
    warnMs: 750,                // warning before bursting out
    lungeMs: [1200, 1700],      // time chasing the player above ground
    straightMs: 500,            // then flies straight for this long and dives
    minSurfMs: 700,             // won't dive into a wall sooner than this
    wallChance: 0.4,            // 40% of attacks come out of a wall
    spit: { everyMs: 2400, speed: 110, damage: 9, lifetimeMs: 3600 },
    coinsPerSegment: 1,
    defeatCoins: 40,
    coopHpMul: 0.6,             // +60% HP per extra player
    tex: 'worm'                 // textures: worm_head, worm_body, worm_body2, worm_tail
  },

  // Not a boss: a much weaker, shorter worm that shows up in normal rooms after boss 1.
  smallWorm: {
    name: 'Small Worm', kind: 'worm', minor: true,
    segments: 7, spacing: 14, sampleStep: 3,
    sizes: { head: 22, body: 17, tail: 13 },
    hp: { head: 35, body: 25, tail: 20 },
    contact: { head: 12, body: 7, tail: 5 },
    underSpeed: 240, surfSpeed: 270, shortWormBonus: 0.2,
    turnUnder: 3.8, turnSurf: 2.6,
    underMs: [1300, 2300], warnMs: 650, lungeMs: [900, 1300], straightMs: 400, minSurfMs: 600,
    wallChance: 0.25,
    spit: null,
    coinsPerSegment: 0.5,
    coopHpMul: 0.3,
    tex: 'sworm'
  }
};

const BOSS_MAX_HOLES = 14;

class BossManager {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.group = scene.physics.add.group();
    this.active = false;
    this.def = null;
    this.worms = [];
    this.totalMaxHp = 1;
    this.callbacks = null;
    this.holes = [];
    for (let i = 0; i < BOSS_MAX_HOLES; i++) this.holes.push({ active: false, x: 0, y: 0, ms: 0, wall: false });
    this._segDefs = null;
  }

  /* ---------------- start / end ---------------- */
  // callbacks: { onSegmentKilled(seg, owner), onDefeated(x, y), getPlayers() }
  start(bossId, level, playerCount, enemyHpMul, enemyDmgMul, callbacks) {
    this.clear();
    const d = BOSS_TYPES[bossId];
    this.def = d;
    this.minor = false;
    this.callbacks = callbacks;
    this.active = true;
    this.defeated = false;
    const hpMul = enemyHpMul * (1 + (playerCount - 1) * d.coopHpMul);
    this.dmgMul = enemyDmgMul;

    // One shared def object per segment role (enemy-like, so weapons can hit them)
    this.makeSegDefs(d, hpMul, enemyDmgMul);

    // Build the first worm underground, below the arena, heading up
    const W = this.scene.rooms.W, H = this.scene.rooms.H;
    const segs = this.makeSegments(d.segments);
    this.totalMaxHp = 0;
    const worm = this.makeWorm(segs, W / 2, H + 40, -Math.PI / 2);
    // Pre-fill its trail straight down (underground) so the body has somewhere to be
    const cap = worm.path.cap;
    for (let i = cap - 1; i >= 0; i--) this.pathPush(worm, W / 2, H + 40 + i * d.sampleStep, 0);
    worm.sx = W / 2; worm.sy = H + 40;
    this.assignRoles(worm, true);
    for (let i = 0; i < segs.length; i++) this.totalMaxHp += segs[i].maxHp;
    worm.state = 'under';
    worm.stateMs = 900;
    this.pickGoal(worm);
    this.worms.push(worm);
  }

  makeSegDefs(d, hpMul, dmgMul) {
    const mk = (role) => ({ name: d.name, ai: 'boss', size: d.sizes[role], hitKnockbackMs: 0, coins: [d.coinsPerSegment, d.coinsPerSegment],
                            maxHp: Math.round(d.hp[role] * hpMul), contact: Math.round(d.contact[role] * dmgMul), role: role });
    this._segDefs = { head: mk('head'), body: mk('body'), tail: mk('tail') };
  }

  makeSegments(n) {
    const segs = [];
    for (let i = 0; i < n; i++) {
      const s = this.group.create(-200, -200, this.def.tex + '_body');
      s.isBossPart = true;
      s.isEnemy = true;
      s.mgr = this;
      s.setDepth(9);
      s.hp = 0; s.maxHp = 0;
      s.state = 'move';
      s.stunnedMs = 0; s.flashMs = 0;
      s.surfaced = false;
      s.body.enable = false;
      s.setVisible(false);
      segs.push(s);
    }
    return segs;
  }

  /* ---- minor mode: small worms that show up in normal rooms ---- */
  startMinor(defId, enemyHpMul, enemyDmgMul, playerCount, callbacks) {
    this.clear();
    const d = BOSS_TYPES[defId];
    this.def = d;
    this.minor = true;
    this.callbacks = callbacks;
    this.active = true;
    this.defeated = false;
    this.dmgMul = enemyDmgMul;
    this.makeSegDefs(d, enemyHpMul * (1 + (playerCount - 1) * d.coopHpMul), enemyDmgMul);
  }

  // A new worm digging up from (x, y)
  spawnWorm(x, y) {
    if (!this.active) return;
    const d = this.def;
    const segs = this.makeSegments(d.segments);
    const w = this.makeWorm(segs, x, y, Math.random() * Math.PI * 2);
    for (let i = w.path.cap - 1; i >= 0; i--) this.pathPush(w, x, y, 0);
    w.sx = x; w.sy = y;
    this.assignRoles(w, true);
    for (let i = 0; i < segs.length; i++) this.totalMaxHp += segs[i].maxHp;
    w.state = 'under';
    w.stateMs = 300;
    this.pickGoal(w);
    this.worms.push(w);
  }

  // Removes all worms but stays ready for more (minor mode, on room change).
  clearWorms() {
    this.group.clear(true, true);
    this.worms.length = 0;
    this.totalMaxHp = 0;
    for (let i = 0; i < this.holes.length; i++) this.holes[i].active = false;
  }

  clear() {
    this.group.clear(true, true);
    this.worms.length = 0;
    this.active = false;
    for (let i = 0; i < this.holes.length; i++) this.holes[i].active = false;
  }

  makeWorm(segs, x, y, ang) {
    const d = this.def;
    const cap = Math.ceil(segs.length * d.spacing / d.sampleStep) + 8;
    const w = {
      segs: segs,
      path: { x: new Float32Array(cap), y: new Float32Array(cap), s: new Uint8Array(cap), cap: cap, head: -1, count: 0 },
      hx: x, hy: y, ang: ang, sx: x, sy: y,
      surfaced: false, state: 'under', stateMs: 0, mode: 'floor',
      goalX: x, goalY: y, warnX: x, warnY: y, orbit: 0, retargetMs: 0,
      spitMs: d.spit ? d.spit.everyMs * (0.5 + Math.random()) : 1e9
    };
    for (let i = 0; i < segs.length; i++) segs[i].worm = w;
    return w;
  }

  // Head / body / tail textures and stats. full = also reset HP (new segments).
  assignRoles(w, full) {
    const n = w.segs.length;
    for (let i = 0; i < n; i++) {
      const s = w.segs[i];
      const role = i === 0 ? 'head' : (i === n - 1 && n > 1 ? 'tail' : 'body');
      const def = this._segDefs[role];
      s.def = def;
      s.role = role;
      if (full) { s.maxHp = def.maxHp; s.hp = def.maxHp; }
      const tx = this.def.tex;
      const key = role === 'head' ? tx + '_head' : (role === 'tail' ? tx + '_tail' : (i % 2 ? tx + '_body2' : tx + '_body'));
      if (s.texture.key !== key) s.setTexture(key);
      const r = def.size / 2;
      s.body.setCircle(r, s.width / 2 - r, s.height / 2 - r);
    }
  }

  /* ---------------- path ---------------- */
  pathPush(w, x, y, surf) {
    const p = w.path;
    p.head = (p.head + 1) % p.cap;
    p.x[p.head] = x; p.y[p.head] = y; p.s[p.head] = surf;
    if (p.count < p.cap) p.count++;
  }

  // index of the point `back` samples behind the newest one
  pathIndex(w, back) {
    const p = w.path;
    if (back > p.count - 1) back = p.count - 1;
    let i = p.head - back;
    if (i < 0) i += p.cap;
    return i;
  }

  /* ---------------- AI ---------------- */
  nearestPlayer(x, y) {
    const players = this.callbacks.getPlayers();
    let best = null, bd = Infinity;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const dx = p.sprite.x - x, dy = p.sprite.y - y;
      const dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = p; }
    }
    this.allies = this.callbacks.getAllies ? this.callbacks.getAllies() : null;
    // allies (wormlings) are targets too
    const al = this.allies;
    if (al) for (let i = 0; i < al.length; i++) {
      const a = al[i];
      if (!a.alive) continue;
      const dx = a.x - x, dy = a.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  // Where to burst out next: under the floor near the player, or out of a wall.
  pickGoal(w) {
    const T = this.cfg.tile, W = this.scene.rooms.W, H = this.scene.rooms.H;
    const p = this.nearestPlayer(w.hx, w.hy);
    const px = p ? p.sprite.x : W / 2, py = p ? p.sprite.y : H / 2;
    w.mode = Math.random() < this.def.wallChance ? 'wall' : 'floor';
    if (w.mode === 'wall') {
      // the wall side closest to the player's position, at the player's level
      const dl = px, dr = W - px, du = py, dd = H - py;
      const m = Math.min(dl, dr, du, dd);
      const jitter = (Math.random() - 0.5) * 220;
      if (m === dl)      { w.goalX = T * 0.5;     w.goalY = Phaser.Math.Clamp(py + jitter, T * 1.5, H - T * 1.5); }
      else if (m === dr) { w.goalX = W - T * 0.5; w.goalY = Phaser.Math.Clamp(py + jitter, T * 1.5, H - T * 1.5); }
      else if (m === du) { w.goalY = T * 0.5;     w.goalX = Phaser.Math.Clamp(px + jitter, T * 1.5, W - T * 1.5); }
      else               { w.goalY = H - T * 0.5; w.goalX = Phaser.Math.Clamp(px + jitter, T * 1.5, W - T * 1.5); }
    } else {
      const a = Math.random() * Math.PI * 2, r = 140 + Math.random() * 90;
      w.goalX = Phaser.Math.Clamp(px + Math.cos(a) * r, T + 40, W - T - 40);
      w.goalY = Phaser.Math.Clamp(py + Math.sin(a) * r, T + 40, H - T - 40);
    }
    w.retargetMs = 500;
  }

  inWall(x, y) {
    const T = this.cfg.tile;
    return x < T || y < T || x > this.scene.rooms.W - T || y > this.scene.rooms.H - T;
  }

  addHole(x, y) {
    let h = null;
    for (let i = 0; i < this.holes.length; i++) if (!this.holes[i].active) { h = this.holes[i]; break; }
    if (!h) { h = this.holes[0]; for (let i = 1; i < this.holes.length; i++) if (this.holes[i].ms < h.ms) h = this.holes[i]; }
    h.active = true; h.x = x; h.y = y; h.ms = 4000; h.wall = this.inWall(x, y);
  }

  update(dt, enemyBullets) {
    if (!this.active) return;
    const d = this.def;
    const sec = dt / 1000;
    for (let i = 0; i < this.holes.length; i++) {
      const h = this.holes[i];
      if (h.active) { h.ms -= dt; if (h.ms <= 0) h.active = false; }
    }

    for (let wi = 0; wi < this.worms.length; wi++) {
      const w = this.worms[wi];
      const p = this.nearestPlayer(w.hx, w.hy);
      w.stateMs -= dt;

      // --- state machine ---
      if (w.state === 'under') {
        w.retargetMs -= dt;
        if (w.mode === 'floor' && w.retargetMs <= 0 && p) {
          // keep the floor target near the player while travelling
          const dx = w.goalX - p.sprite.x, dy = w.goalY - p.sprite.y;
          if (dx * dx + dy * dy > 260 * 260) this.pickGoal(w);
          w.retargetMs = 500;
        }
        const gdx = w.goalX - w.hx, gdy = w.goalY - w.hy;
        const close = gdx * gdx + gdy * gdy < 50 * 50;
        if ((w.stateMs <= 0 && close) || w.stateMs < -2500) {
          w.state = 'warn'; w.stateMs = d.warnMs;
          w.warnX = w.hx; w.warnY = w.hy; w.orbit = w.ang;
        }
      } else if (w.state === 'warn') {
        // waits right under the warning spot, then bursts out exactly there
        if (w.stateMs <= 0) {
          // Burst out toward the player
          w.surfaced = true;
          w.state = 'surf';
          w.stateMs = d.lungeMs[0] + Math.random() * (d.lungeMs[1] - d.lungeMs[0]);
          w.surfMs = 0;
          if (p) w.ang = Math.atan2(p.sprite.y - w.hy, p.sprite.x - w.hx);
          this.addHole(w.hx, w.hy);
          this.scene.cameras.main.shake(140, 0.004);
        }
      } else if (w.state === 'surf') {
        w.surfMs += dt;
        if (p) { w.goalX = p.sprite.x; w.goalY = p.sprite.y; }
        if (w.stateMs <= 0) { w.state = 'straight'; w.stateMs = d.straightMs; }
      } else if (w.state === 'straight') {
        w.surfMs += dt;
        w.goalX = w.hx + Math.cos(w.ang) * 100; w.goalY = w.hy + Math.sin(w.ang) * 100;
        if (w.stateMs <= 0) this.dive(w);
      }
      // Surfaced heads that hit a wall dig into it
      if (w.surfaced && w.surfMs > d.minSurfMs && this.inWall(w.hx, w.hy)) this.dive(w);

      // --- steering + movement ---
      const n = w.segs.length;
      const speedMul = 1 + d.shortWormBonus * (1 - n / d.segments);
      const speed = w.state === 'warn' ? 0 : (w.surfaced ? d.surfSpeed : d.underSpeed) * speedMul;
      const turn = w.surfaced ? d.turnSurf : d.turnUnder;
      // never leave the screen (even underground)
      const W = this.scene.rooms.W, H = this.scene.rooms.H;
      if (w.hx < 12 || w.hy < 12 || w.hx > W - 12 || w.hy > H - 12) { w.goalX = W / 2; w.goalY = H / 2; }
      const want = Math.atan2(w.goalY - w.hy, w.goalX - w.hx);
      let diff = want - w.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = turn * sec * (w.surfaced ? 1 : 1.5);
      w.ang += Math.max(-maxTurn, Math.min(maxTurn, diff));
      w.hx += Math.cos(w.ang) * speed * sec;
      w.hy += Math.sin(w.ang) * speed * sec;

      // record trail points every sampleStep pixels
      let dx = w.hx - w.sx, dy = w.hy - w.sy;
      let dist = Math.sqrt(dx * dx + dy * dy);
      while (dist >= d.sampleStep) {
        w.sx += dx / dist * d.sampleStep; w.sy += dy / dist * d.sampleStep;
        this.pathPush(w, w.sx, w.sy, w.surfaced ? 1 : 0);
        dx = w.hx - w.sx; dy = w.hy - w.sy;
        dist = Math.sqrt(dx * dx + dy * dy);
      }

      // --- place segments along the trail ---
      const per = d.spacing / d.sampleStep;
      const pa = w.path;
      for (let i = 0; i < n; i++) {
        const s = w.segs[i];
        const idx = this.pathIndex(w, Math.round(i * per));
        const idx2 = this.pathIndex(w, Math.round(i * per) + 2);
        const x = i === 0 ? w.hx : pa.x[idx], y = i === 0 ? w.hy : pa.y[idx];
        const surf = i === 0 ? w.surfaced : pa.s[idx] === 1;
        s.rotation = i === 0 ? w.ang : Math.atan2(y - pa.y[idx2], x - pa.x[idx2]);
        if (surf !== s.surfaced) {
          s.surfaced = surf;
          s.body.enable = surf;
          s.setVisible(surf);
        }
        s.body.reset(x, y);
        s.state = (i === 0 && w.surfaced) ? 'dash' : 'move';   // sword dash-parry does 2x to a lunging head
        if (s.stunnedMs > 0) s.stunnedMs -= dt;
        if (s.flashMs > 0) { s.flashMs -= dt; if (s.flashMs > 0) s.setTintFill(0xffffff); else s.clearTint(); }
      }

      // --- ink spit from surfaced body segments ---
      w.spitMs -= dt;
      if (d.spit && w.spitMs <= 0 && p && n > 1) {
        w.spitMs = d.spit.everyMs * (0.8 + Math.random() * 0.4);
        const s = w.segs[1 + Math.floor(Math.random() * (n - 1))];
        if (s.surfaced) {
          const ax = p.sprite.x - s.x, ay = p.sprite.y - s.y;
          const len = Math.sqrt(ax * ax + ay * ay) || 1;
          enemyBullets.fire(s.x, s.y, ax / len, ay / len, d.spit.speed, Math.round(d.spit.damage * this.dmgMul), d.spit.lifetimeMs, s, 'spit');
        }
      }
    }
  }

  dive(w) {
    if (!w.surfaced) return;
    w.surfaced = false;
    w.state = 'under';
    w.stateMs = this.def.underMs[0] + Math.random() * (this.def.underMs[1] - this.def.underMs[0]);
    this.addHole(w.hx, w.hy);
    this.pickGoal(w);
  }

  /* ---------------- damage + splitting ---------------- */
  // Called by GameScene.hitEnemy for boss parts. Returns true if the segment died.
  damage(seg, amount, owner, source) {
    if (!seg.active || !seg.surfaced || seg.hp <= 0) return false;
    seg.hp -= amount;
    seg.flashMs = 70;
    if (seg.hp > 0) return false;
    this.killSegment(seg, owner, source);
    return true;
  }

  killSegment(seg, owner, source) {
    const w = seg.worm;
    const k = w.segs.indexOf(seg);
    if (k < 0) return;
    const x = seg.x, y = seg.y;
    const front = w.segs.slice(0, k);
    const back = w.segs.slice(k + 1);
    seg.worm = null;
    seg.destroy();
    this.scene.cameras.main.shake(60, 0.003);
    this.callbacks.onSegmentKilled(x, y, seg, owner, source);

    const wi = this.worms.indexOf(w);
    if (wi >= 0) this.worms.splice(wi, 1);
    // a worm that was only this one segment is gone for good
    if (k === 0 && back.length === 0 && this.callbacks.onWormDead) this.callbacks.onWormDead();

    // Front part keeps the head and the path
    if (front.length > 0) {
      w.segs = front;
      this.assignRoles(w, false);
      this.worms.push(w);
    }
    // Back part becomes a new worm whose head is the first segment behind the cut
    if (back.length > 0) {
      const d = this.def;
      const per = d.spacing / d.sampleStep;
      const startBack = Math.round((k + 1) * per);
      const endBack = Math.round((w.path.count - 1));
      const nw = this.makeWorm(back, 0, 0, 0);
      // copy the old trail from oldest to the new head's point
      for (let b = Math.min(endBack, startBack + nw.path.cap - 1); b >= startBack; b--) {
        const i = this.pathIndex(w, b);
        this.pathPush(nw, w.path.x[i], w.path.y[i], w.path.s[i]);
      }
      const hi = nw.path.head, hi2 = this.pathIndex(nw, 2);
      nw.hx = nw.path.x[hi]; nw.hy = nw.path.y[hi];
      nw.sx = nw.hx; nw.sy = nw.hy;
      nw.ang = Math.atan2(nw.hy - nw.path.y[hi2], nw.hx - nw.path.x[hi2]);
      nw.surfaced = nw.path.s[hi] === 1;
      if (nw.surfaced) {
        // the new head peels off and goes for the player
        nw.state = 'surf'; nw.stateMs = 700 + Math.random() * 500; nw.surfMs = this.def.minSurfMs;
        nw.ang += (Math.random() < 0.5 ? -1 : 1) * 0.6;
      } else {
        nw.state = 'under'; nw.stateMs = 400 + Math.random() * 800;
        this.pickGoal(nw);
      }
      this.assignRoles(nw, false);
      this.worms.push(nw);
    }

    if (this.worms.length === 0 && !this.defeated && !this.minor) {
      this.defeated = true;
      this.active = false;
      this.callbacks.onDefeated(x, y);
    }
  }

  // Adds every hittable (surfaced, alive) segment to arr — used by weapons/skills.
  pushTargets(arr) {
    if (!this.active) return;
    for (let wi = 0; wi < this.worms.length; wi++) {
      const segs = this.worms[wi].segs;
      for (let i = 0; i < segs.length; i++) if (segs[i].surfaced && segs[i].active) arr.push(segs[i]);
    }
  }

  totalHp() {
    let t = 0;
    for (let wi = 0; wi < this.worms.length; wi++) {
      const segs = this.worms[wi].segs;
      for (let i = 0; i < segs.length; i++) t += Math.max(0, segs[i].hp);
    }
    return t;
  }

  segmentCount() {
    let n = 0;
    for (let wi = 0; wi < this.worms.length; wi++) n += this.worms[wi].segs.length;
    return n;
  }
}
