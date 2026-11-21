/* titan.js  (Alpha 3)
   THE DEAD TITAN: boss of the Necrotery. A giant skeleton buried in the arena:
   only its HUGE skull sticks out of the front (top) wall. The skull is the
   enemy you hit; it slides along the wall. Its arms are drawn by code.

   Attacks (every one has a warning first):
     PUNCH      a side wall cracks and glows -> a huge fist bursts out and flies across
                the arena at that height. The fist gets stuck for a moment: the Titan is
                dazed and takes +50% damage (melee: this is your window).
     SLAM       a fist rises over you (shadow on the floor) -> slams down -> a fast
                shockwave ring rolls out. DASH THROUGH THE RING (dashing = can't be hit).
     RIBCAGE    a bone circle appears under you -> a ribcage bursts out of the floor and
                slams shut: lots of damage + you're stuck for a second. Walk out of the circle.
     LASER      the skull leaves the wall, rolls to the middle and spins, firing beams.
                Keep moving around ahead of them. The skull is exposed while it spins (+25%).
     SUMMON     skeletons climb out of the floor.
     ROAR       a gust that blows out every torch in the arena (light them again!).
   Phase 2 (half HP): faster, combos (punch -> slam), 3 beams, more cages, darker roar.

   Boss loot: Titan's Wrath (MEGA SPELL) and the Titan Ribcage (armor). */

ENEMY_TYPES.deadTitan = {
  name: 'The Dead Titan', ai: 'deadTitan', immovable: true, noIdle: true,
  boss: { arena: [15, 10], defeatCoins: 80 },
  cost: 0, weight: 0, coins: [0, 0],
  maxHp: 3800, speed: 110, speedVariance: 0, size: 104, color: 0xd7cfbf, mass: 100,
  contactDamage: 10,
  hitKnockback: 0, hitKnockbackMs: 0, contactPushback: 0, contactPushbackMs: 0,
  phase2At: 0.5,
  punch: { windupMs: 800, enragedWindupMs: 560, speed: 1500, radius: 62, damage: 26, stuckMs: 1000, enragedStuckMs: 700, vuln: 1.5, backMs: 380 },
  slam: { windupMs: 1150, enragedWindupMs: 880, lockPct: 0.5, radius: 80, damage: 28, ring: { speed: 420, enragedSpeed: 510, width: 26, max: 1000, damage: 20 } },
  ribs: { windupMs: 720, enragedWindupMs: 520, followPct: 0.55, upMs: 240, radius: 62, damage: 30, rootMs: 1000, extra: 2 },
  laser: { moveMs: 800, windupMs: 800, ms: 3200, enragedMs: 3800, beams: 2, enragedBeams: 3, turn: 1.45, enragedTurn: 1.9, length: 1100, width: 26, damage: 16, hitCdMs: 500, vuln: 1.25 },
  summon: { windupMs: 900, count: 2, enragedCount: 3, maxMinions: 5, cdMs: 11000 },
  roar: { ms: 1000, cdMs: 16000 }
};

// Look: "Shattered Sentinel" (picked from 4 designs): a skull of broken bone plates held together by
// glowing cracks (purple; red in phase 2). The glow is drawn live in drawTitan (TITAN_SEAMS).
const TITAN_PLATES = [
  [[-84, -10], [-70, -60], [-30, -82], [-14, -40], [-40, -14]],
  [[-30, -82], [30, -82], [14, -40], [-14, -40]],
  [[30, -82], [70, -60], [84, -10], [40, -14], [14, -40]],
  [[-84, -10], [-40, -14], [-30, 40], [-70, 30]],
  [[84, -10], [40, -14], [30, 40], [70, 30]],
  [[-40, -14], [-14, -40], [14, -40], [40, -14], [30, 40], [-30, 40]]
];
const TITAN_SEAMS = [[-30, -82, -14, -40], [30, -82, 14, -40], [-14, -40, 14, -40], [-40, -14, -14, -40], [40, -14, 14, -40],
  [-84, -10, -40, -14], [84, -10, 40, -14], [-40, -14, -30, 40], [40, -14, 30, 40], [0, 44, 0, 78], [-14, -40, -4, -60]];
const TITAN_HEAD = { w: 200, h: 180, cx: 100, cy: 96 };      // skull centre inside the texture (sprite centre is 100, 90)

const TitanTextures = {
  make(scene, id, def) {
    if (id !== 'deadTitan') return false;
    const H = TITAN_HEAD;
    TextureFactory.withGraphics(scene, 'enemy_deadTitan', H.w, H.h, (g) => {
      const BONE = 0xd7cfbf, SHADE = 0xa89f8e, DARK = 0x0b0710, LINE = 0x2e2822;
      const P = (pts) => pts.map(([x, y]) => ({ x: H.cx + x, y: H.cy + y }));
      TITAN_PLATES.forEach((p, i) => {
        const q = P(p).map((pt) => ({ x: pt.x + (i % 2 ? 2 : -2), y: pt.y }));
        g.fillStyle(i === 5 ? SHADE : BONE, 1); g.fillPoints(q, true);
        g.lineStyle(3, LINE, 1); g.strokePoints(q, true);
      });
      g.fillStyle(DARK, 1);
      g.fillPoints(P([[-52, -26], [-22, -34], [-20, -4], [-46, 2]]), true);        // eye sockets
      g.fillPoints(P([[52, -26], [22, -34], [20, -4], [46, 2]]), true);
      g.fillPoints(P([[-8, 22], [8, 22], [0, 4]]), true);                           // nose
      const jaw = (pts) => { g.fillStyle(BONE, 1); g.fillPoints(P(pts), true); g.lineStyle(3, LINE, 1); g.strokePoints(P(pts), true); };
      jaw([[-46, 44], [-4, 44], [-8, 78], [-40, 72]]); jaw([[4, 44], [46, 44], [40, 72], [8, 78]]);
      for (let k = 0; k < 8; k++) {                                                  // shard teeth
        const a = -44 + k * 11;
        g.fillStyle(0xf5f0e4, 1); g.fillTriangle(H.cx + a, H.cy + 44, H.cx + a + 11, H.cy + 44, H.cx + a + 5.5, H.cy + 44 + 9 + (k % 3) * 2);
        g.lineStyle(1.5, LINE, 1); g.strokeTriangle(H.cx + a, H.cy + 44, H.cx + a + 11, H.cy + 44, H.cx + a + 5.5, H.cy + 44 + 9 + (k % 3) * 2);
      }
    });
    return true;
  }
};

/* ---------------- AI ---------------- */
ENEMY_AI.deadTitan = function (m, e, t, dt, ctx) {
  const d = e.def, sc = m.scene, R = ctx.rooms, T = R.T, sec = dt / 1000;
  if (!e.titan) {
    e.titan = { homeY: T + 54, rings: [], cages: [], holes: [], fistX: 0, fistY: 0, beams: 0, beamAng: 0, beamDir: 1,
                hitCd: [0, 0, 0, 0], hitMask: 0, intro: 1400, attacks: 0, last: '', summonCd: 5000, roarCd: 9000, enraged: false, mouth: 0 };
    e.body.reset(R.W / 2, e.titan.homeY);
    m.setState(e, 'intro', 1400); e.attackCdMs = 1600;
    e.setAlpha(0.2);
  }
  const ti = e.titan, enr = ti.enraged;
  for (let i = 0; i < ti.hitCd.length; i++) if (ti.hitCd[i] > 0) ti.hitCd[i] -= dt;
  if (ti.summonCd > 0) ti.summonCd -= dt;
  if (ti.roarCd > 0) ti.roarCd -= dt;
  TitanAttacks.updateRings(m, e, dt, ctx);
  e.vulnMul = 0;
  e.setVelocity(0, 0);
  if (sc.lighting) sc.lighting.add(e.x, e.y + 6, enr ? 190 : 165);       // its eyes glow

  // phase 2
  if (!enr && e.hp < e.maxHp * d.phase2At && (e.state === 'move' || e.state === 'intro')) {
    ti.enraged = true;
    if (sc.hud) sc.hud.showBanner('The Dead Titan rages!');
    m.setState(e, 'roar', d.roar.ms); ti.roared = false; ti.roarCd = d.roar.cdMs;
    return;
  }

  switch (e.state) {
    case 'intro':
      e.setAlpha(Math.min(1, e.alpha + dt / 900));
      if (e.stateMs <= 0) { e.setAlpha(1); m.setState(e, 'move', 0); }
      return;
    case 'move': {
      const tx = Phaser.Math.Clamp(t.sprite.x, T * 3, R.W - T * 3), dx = tx - e.x;
      const step = Math.sign(dx) * Math.min(Math.abs(dx), d.speed * (enr ? 1.4 : 1) * sec);
      e.body.reset(e.x + step, ti.homeY);
      if (e.attackCdMs > 0) return;
      TitanAttacks.pick(m, e, t, ctx);
      return;
    }
    case 'punchWind': {
      const p = d.punch, total = enr ? p.enragedWindupMs : p.windupMs;
      if (e.stateMs > 220) ti.punchY = Phaser.Math.Clamp(t.sprite.y, T * 2, R.H - T * 1.4);
      ti.windK = 1 - Math.max(0, e.stateMs) / total;
      if (e.stateMs <= 0) {
        ti.fistX = ti.side > 0 ? R.W - T * 0.5 : T * 0.5; ti.fistY = ti.punchY;
        ti.fistEnd = ti.fistX - ti.side * R.W * 0.78; ti.hitMask = 0;
        if (sc.cameras) sc.cameras.main.shake(140, 0.008);
        if (ti.holes.length < 8) ti.holes.push({ side: ti.side, y: ti.punchY });
        m.setState(e, 'punch', 2000);
      }
      return;
    }
    case 'punch': {
      const p = d.punch, st = p.speed * sec;
      ti.fistX -= ti.side * st;
      TitanAttacks.fistHits(m, e, ti.fistX, ti.fistY, p.radius, p.damage, ctx);
      if (sc.lighting) sc.lighting.add(ti.fistX, ti.fistY, 90);
      if ((ti.side > 0 && ti.fistX <= ti.fistEnd) || (ti.side < 0 && ti.fistX >= ti.fistEnd)) {
        ti.fistX = ti.fistEnd;
        if (sc.cameras) sc.cameras.main.shake(180, 0.01);
        if (sc.hud) sc.hud.addFx(ti.fistX, ti.fistY, 60, 0xd7cfbf, 300);
        m.setState(e, 'punchStuck', enr ? p.enragedStuckMs : p.stuckMs);
      }
      return;
    }
    case 'punchStuck':
      e.vulnMul = d.punch.vuln;
      if (e.stateMs <= 0) m.setState(e, 'punchBack', d.punch.backMs);
      return;
    case 'punchBack': {
      const k = Math.max(0, e.stateMs) / d.punch.backMs;
      const start = ti.side > 0 ? R.W - T * 0.5 : T * 0.5;
      ti.fistX = start + (ti.fistEnd - start) * k;
      if (e.stateMs <= 0) {
        if (enr && Math.random() < 0.5) { TitanAttacks.start(m, e, t, ctx, 'slam'); return; }   // combo
        m.setState(e, 'move', 0); e.attackCdMs = enr ? 500 : 800;
      }
      return;
    }
    case 'slamWind': {
      const s = d.slam, total = enr ? s.enragedWindupMs : s.windupMs;
      if (e.stateMs > total * s.lockPct) { ti.slamX = Phaser.Math.Clamp(t.sprite.x, T * 1.5, R.W - T * 1.5); ti.slamY = Phaser.Math.Clamp(t.sprite.y, T * 2.2, R.H - T * 1.5); }
      ti.windK = 1 - Math.max(0, e.stateMs) / total;
      if (e.stateMs <= 0) {
        TitanAttacks.areaHit(m, e, ti.slamX, ti.slamY, s.radius, s.damage, ctx, 0);
        if (sc.cameras) sc.cameras.main.shake(260, 0.016);
        if (sc.hud) sc.hud.addFx(ti.slamX, ti.slamY, s.radius + 20, 0xd7cfbf, 360);
        TitanAttacks.ring(e, ti.slamX, ti.slamY, enr ? s.ring.enragedSpeed : s.ring.speed);
        if (enr) ti.ring2 = 380;
        m.setState(e, 'slamRecover', 650);
      }
      return;
    }
    case 'slamRecover':
      if (ti.ring2 > 0) { ti.ring2 -= dt; if (ti.ring2 <= 0) TitanAttacks.ring(e, ti.slamX, ti.slamY, d.slam.ring.enragedSpeed * 1.15); }
      if (e.stateMs <= 0) { m.setState(e, 'move', 0); e.attackCdMs = enr ? 450 : 750; }
      return;
    case 'ribWind': {
      const r = d.ribs, total = enr ? r.enragedWindupMs : r.windupMs;
      const follow = e.stateMs > total * (1 - r.followPct);
      for (let i = 0; i < ti.cages.length; i++) {
        const c = ti.cages[i];
        if (follow && c.player) { c.x = c.player.sprite.x + c.ox; c.y = c.player.sprite.y + c.oy; }
      }
      ti.windK = 1 - Math.max(0, e.stateMs) / total;
      if (e.stateMs <= 0) m.setState(e, 'ribUp', r.upMs);
      return;
    }
    case 'ribUp':
      if (e.stateMs <= 0) {
        const r = d.ribs;
        for (let i = 0; i < ti.cages.length; i++) TitanAttacks.areaHit(m, e, ti.cages[i].x, ti.cages[i].y, r.radius, r.damage, ctx, r.rootMs);
        if (sc.cameras) sc.cameras.main.shake(200, 0.012);
        m.setState(e, 'ribShut', 480);
      }
      return;
    case 'ribShut':
      if (e.stateMs <= 0) { ti.cages.length = 0; m.setState(e, 'move', 0); e.attackCdMs = enr ? 450 : 750; }
      return;
    case 'toCenter': case 'toWall': {
      const L = d.laser, k = 1 - Math.max(0, e.stateMs) / L.moveMs, e3 = k * k * (3 - 2 * k);
      const cx = R.W / 2, cy = R.H / 2 + 10;
      if (e.state === 'toCenter') e.body.reset(ti.fromX + (cx - ti.fromX) * e3, ti.homeY + (cy - ti.homeY) * e3);
      else e.body.reset(cx + (ti.fromX - cx) * e3, cy + (ti.homeY - cy) * e3);
      if (e.stateMs <= 0) {
        if (e.state === 'toCenter') { ti.beams = enr ? L.enragedBeams : L.beams; ti.beamAng = Math.random() * Math.PI * 2; ti.beamDir = Math.random() < 0.5 ? 1 : -1; m.setState(e, 'laserWind', L.windupMs); }
        else { m.setState(e, 'move', 0); e.attackCdMs = 900; }
      }
      return;
    }
    case 'laserWind':
      ti.beamAng += ti.beamDir * 0.35 * sec;
      e.vulnMul = d.laser.vuln;
      if (e.stateMs <= 0) m.setState(e, 'laser', enr ? d.laser.enragedMs : d.laser.ms);
      return;
    case 'laser': {
      const L = d.laser, k = Math.min(1, (Math.max(0, (enr ? L.enragedMs : L.ms) - e.stateMs)) / 600);   // spins up
      ti.beamAng += ti.beamDir * (enr ? L.enragedTurn : L.turn) * sec * (0.4 + 0.6 * k);
      e.vulnMul = L.vuln;
      TitanAttacks.beamHits(m, e, ctx);
      if (e.stateMs <= 0) { ti.beams = 0; ti.fromX = Phaser.Math.Clamp(t.sprite.x, T * 3, R.W - T * 3); m.setState(e, 'toWall', L.moveMs); }
      return;
    }
    case 'summon':
      if (e.stateMs <= 0) {
        const n = enr ? d.summon.enragedCount : d.summon.count;
        for (let i = 0; i < n; i++) {
          if (R.randomSpawnPoint(ctx.players, 200, m._tp || (m._tp = { x: 0, y: 0 }))) {
            const type = enr && Math.random() < 0.4 ? 'darkSkeleton' : 'skeleton';
            m.queueSpawn(type, m._tp.x, Math.max(T * 2.5, m._tp.y), 500 + i * 200);
          }
        }
        ti.summonCd = d.summon.cdMs;
        m.setState(e, 'move', 0); e.attackCdMs = 500;
      }
      return;
    case 'roar':
      ti.mouth = Math.min(1, ti.mouth + dt / 200);
      if (!ti.roared && e.stateMs < d.roar.ms - 300) {
        ti.roared = true;
        const n = sc.lighting ? sc.lighting.blowOut(e.x, e.y, Infinity) : 0;
        if (sc.cameras) { sc.cameras.main.shake(500, 0.012); }
        if (sc.hud) { sc.hud.addFx(e.x, e.y + 40, 140, 0xb39ddb, 500); if (n) sc.hud.floatText(R.W / 2, R.H / 2 - 40, 'The torches went out!', '#b39ddb'); }
        for (let i = 0; i < ctx.players.length; i++) {           // the gust shoves you away from the skull
          const p = ctx.players[i];
          if (!p.alive) continue;
          const dx = p.sprite.x - e.x, dy = p.sprite.y - e.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = Phaser.Math.Clamp(p.sprite.x + dx / len * 90, T * 1.2, R.W - T * 1.2), ny = Phaser.Math.Clamp(p.sprite.y + dy / len * 90, T * 1.2, R.H - T * 1.2);
          if (!R.solidAt(nx, ny)) p.sprite.body.reset(nx, ny);
        }
      }
      if (e.stateMs <= 0) { ti.mouth = 0; m.setState(e, 'move', 0); e.attackCdMs = 700; }
      return;
    default:
      if (e.stateMs <= 0) m.setState(e, 'move', 0);
  }
};

const TitanAttacks = {
  minions(m) { let n = m.pendingCount || 0; const l = m.group.getChildren(); for (let i = 0; i < l.length; i++) if (l[i].active && !l[i].def.boss) n++; return n; },
  pick(m, e, t, ctx) {
    const d = e.def, ti = e.titan, sc = m.scene;
    ti.attacks++;
    let lit = 0;
    if (sc.lighting) for (let i = 0; i < sc.lighting.torches.length; i++) if (sc.lighting.torches[i].lit) lit++;
    if (ti.roarCd <= 0 && lit >= 3) { ti.roarCd = d.roar.cdMs; this.start(m, e, t, ctx, 'roar'); return; }
    if (ti.summonCd <= 0 && TitanAttacks.minions(m) < d.summon.maxMinions) { this.start(m, e, t, ctx, 'summon'); return; }
    const w = { punch: 3, slam: 2.6, ribs: 2.6, laser: ti.attacks >= 3 ? 1.6 : 0 };
    if (ti.last && w[ti.last] !== undefined) w[ti.last] *= 0.25;      // rarely the same twice
    let sum = 0; for (const k in w) sum += w[k];
    let r = Math.random() * sum, pick = 'punch';
    for (const k in w) { r -= w[k]; if (r <= 0) { pick = k; break; } }
    this.start(m, e, t, ctx, pick);
  },
  start(m, e, t, ctx, kind) {
    const d = e.def, ti = e.titan, enr = ti.enraged, R = ctx.rooms;
    ti.last = kind; ti.windK = 0;
    if (kind === 'punch') { ti.side = t.sprite.x < R.W / 2 ? 1 : -1; ti.punchY = t.sprite.y; m.setState(e, 'punchWind', enr ? d.punch.enragedWindupMs : d.punch.windupMs); }
    else if (kind === 'slam') { ti.slamX = t.sprite.x; ti.slamY = t.sprite.y; m.setState(e, 'slamWind', enr ? d.slam.enragedWindupMs : d.slam.windupMs); }
    else if (kind === 'ribs') {
      ti.cages.length = 0;
      for (let i = 0; i < ctx.players.length; i++) {
        const p = ctx.players[i];
        if (!p.alive) continue;
        ti.cages.push({ player: p, ox: 0, oy: 0, x: p.sprite.x, y: p.sprite.y });
        if (enr) {
          const a0 = Math.random() * Math.PI * 2;
          for (let k = 0; k < d.ribs.extra; k++) {
            const a = a0 + k * Math.PI * 2 / d.ribs.extra;
            ti.cages.push({ player: p, ox: Math.cos(a) * d.ribs.radius * 2.1, oy: Math.sin(a) * d.ribs.radius * 2.1, x: p.sprite.x, y: p.sprite.y });
          }
        }
      }
      m.setState(e, 'ribWind', enr ? d.ribs.enragedWindupMs : d.ribs.windupMs);
    }
    else if (kind === 'laser') { ti.fromX = e.x; m.setState(e, 'toCenter', d.laser.moveMs); }
    else if (kind === 'summon') m.setState(e, 'summon', d.summon.windupMs);
    else if (kind === 'roar') { ti.roared = false; m.setState(e, 'roar', d.roar.ms); }
  },
  hurt(m, e, p, dmg, rootMs) {
    const res = p.takeHit(Math.round(dmg * e.dmgMul), e.x, e.y);
    if (res === 'parry') { if (m.onParry) m.onParry(p, e); return; }
    if (res === 'hit' || res === 'block') { if (rootMs) { p.rootMs = Math.max(p.rootMs || 0, rootMs); if (m.scene.hud) m.scene.hud.floatText(p.sprite.x, p.sprite.y - 30, 'Trapped!', '#d7cfbf'); } }
    if (m.onPlayerHit) m.onPlayerHit(p, res, e);
  },
  areaHit(m, e, x, y, r, dmg, ctx, rootMs) {
    for (let i = 0; i < ctx.players.length; i++) {
      const p = ctx.players[i];
      if (!p.alive) continue;
      const dx = p.sprite.x - x, dy = p.sprite.y - y, rr = r + p.stats.size / 2;
      if (dx * dx + dy * dy <= rr * rr) this.hurt(m, e, p, dmg, rootMs);
    }
  },
  fistHits(m, e, x, y, r, dmg, ctx) {
    const ti = e.titan;
    for (let i = 0; i < ctx.players.length; i++) {
      const p = ctx.players[i];
      if (!p.alive || (ti.hitMask & (1 << i))) continue;
      const dx = p.sprite.x - x, dy = p.sprite.y - y, rr = r + p.stats.size / 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (p.isDashing()) continue;                                 // dashed through it
      ti.hitMask |= (1 << i);
      this.hurt(m, e, p, dmg, 0);
    }
  },
  ring(e, x, y, speed) { e.titan.rings.push({ x: x, y: y, r: 40, speed: speed, mask: 0 }); },
  updateRings(m, e, dt, ctx) {
    const ti = e.titan, rd = e.def.slam.ring, sc = m.scene;
    for (let k = ti.rings.length - 1; k >= 0; k--) {
      const g = ti.rings[k];
      g.r += g.speed * dt / 1000;
      if (g.r > rd.max) { ti.rings.splice(k, 1); continue; }
      for (let i = 0; i < ctx.players.length; i++) {
        const p = ctx.players[i];
        if (!p.alive || (g.mask & (1 << i))) continue;
        const dx = p.sprite.x - g.x, dy = p.sprite.y - g.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - g.r) > rd.width / 2 + p.stats.size / 2) continue;
        g.mask |= (1 << i);                                        // one chance per ring: dash through it!
        if (p.isDashing()) { if (sc.hud) sc.hud.floatText(p.sprite.x, p.sprite.y - 30, 'Dodged!', '#80deea'); continue; }
        this.hurt(m, e, p, rd.damage, 0);
      }
      if (sc.lighting) for (let a = 0; a < 8; a++) sc.lighting.add(g.x + Math.cos(a * 0.785) * g.r, g.y + Math.sin(a * 0.785) * g.r, 50);
    }
  },
  beamHits(m, e, ctx) {
    const ti = e.titan, L = e.def.laser, sc = m.scene;
    for (let b = 0; b < ti.beams; b++) {
      const a = ti.beamAng + b * Math.PI * 2 / ti.beams, cx = Math.cos(a), cy = Math.sin(a);
      if (sc.lighting) for (let s = 80; s < 900; s += 110) sc.lighting.add(e.x + cx * s, e.y + cy * s, 70);
      for (let i = 0; i < ctx.players.length; i++) {
        const p = ctx.players[i];
        if (!p.alive || ti.hitCd[i] > 0) continue;
        const px = p.sprite.x - e.x, py = p.sprite.y - e.y;
        const along = px * cx + py * cy, side = Math.abs(px * -cy + py * cx);
        if (along < 30 || along > L.length || side > L.width / 2 + p.stats.size / 2) continue;
        ti.hitCd[i] = L.hitCdMs;
        this.hurt(m, e, p, L.damage, 0);
      }
    }
  }
};

/* ---------------- drawing (GameScene.titanView, called from necroView) ---------------- */
const TitanDraw = {
  // Skeletal arm: two thin forearm bones side by side with knobby joints.
  arm(g, x1, y1, x2, y2, w) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len, o = w * 0.32;
    for (let s = -1; s <= 1; s += 2) {
      const ax = x1 + nx * o * s, ay = y1 + ny * o * s, bx = x2 + nx * o * 0.7 * s, by = y2 + ny * o * 0.7 * s;
      g.lineStyle(w * 0.36 + 3, 0x2e2822, 1); g.lineBetween(ax, ay, bx, by);
      g.lineStyle(w * 0.36, s < 0 ? 0xe8e1d1 : 0xcfc6b4, 1); g.lineBetween(ax, ay, bx, by);
    }
    const knob = (x, y, r) => { g.fillStyle(0xd7cfbf, 1); g.fillCircle(x, y, r); g.lineStyle(2, 0x2e2822, 1); g.strokeCircle(x, y, r); };
    knob(x1, y1, w * 0.62);                                         // elbow / shoulder
    knob(x2 - dx / len * w * 0.2, y2 - dy / len * w * 0.2, w * 0.45); // wrist
  },
  // Bony fist: angular palm plate, four curled finger bones with knuckles and sharp tips. Faces (fx, fy).
  fist(g, x, y, r, open, fx, fy) {
    if (fx === undefined) { fx = 0; fy = 1; }
    const nx = -fy, ny = fx, P = (a, b) => ({ x: x + fx * a + nx * b, y: y + fy * a + ny * b });
    const palm = [P(-r * 0.7, -r * 0.75), P(r * 0.1, -r * 0.85), P(r * 0.25, 0), P(r * 0.1, r * 0.85), P(-r * 0.7, r * 0.75), P(-r * 0.85, 0)];
    g.fillStyle(0xd7cfbf, 1); g.fillPoints(palm, true); g.lineStyle(3, 0x2e2822, 1); g.strokePoints(palm, true);
    g.lineStyle(2, 0x7c4dff, 0.7); g.lineBetween(P(-r * 0.6, 0).x, P(-r * 0.6, 0).y, P(r * 0.15, 0).x, P(r * 0.15, 0).y);   // glowing crack
    for (let k = 0; k < 4; k++) {
      const b = (-0.66 + k * 0.44) * r, k1 = P(r * 0.3, b), k2 = P(r * (open ? 0.95 : 0.62), b), tip = P(r * (open ? 1.25 : 0.35), b + (open ? 0 : r * 0.05));
      g.lineStyle(r * 0.2 + 3, 0x2e2822, 1); g.lineBetween(k1.x, k1.y, k2.x, k2.y); g.lineBetween(k2.x, k2.y, tip.x, tip.y);
      g.lineStyle(r * 0.2, 0xe8e1d1, 1); g.lineBetween(k1.x, k1.y, k2.x, k2.y); g.lineBetween(k2.x, k2.y, tip.x, tip.y);
      g.fillStyle(0xf5f0e4, 1); g.fillCircle(k2.x, k2.y, r * 0.15); g.lineStyle(1.5, 0x2e2822, 1); g.strokeCircle(k2.x, k2.y, r * 0.15);
    }
  },
  ribs(g, x, y, r, k, shut) {           // k 0..1 = how far up
    g.lineStyle(5, 0xe8e1d1, 1);
    for (let i = 0; i < 4; i++) {
      for (let s = -1; s <= 1; s += 2) {
        const yy = y - r * 0.55 + i * r * 0.36, bx = x + s * r;
        const tipX = shut ? x + s * 6 : x + s * r * (1.05 - 0.15 * k), tipY = yy - r * 0.7 * k;
        g.beginPath(); g.moveTo(bx, yy + r * 0.2); g.lineTo(bx + (tipX - bx) * 0.5, yy - r * 0.35 * k); g.lineTo(tipX, tipY); g.strokePath();
      }
    }
    g.lineStyle(7, 0xd7cfbf, 1); g.lineBetween(x, y - r * 0.8, x, y + r * 0.8);   // spine
  }
};

const TitanMixin = {
  titanView(dt, g) {
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || e.def.ai !== 'deadTitan' || !e.titan) continue;
      this.drawTitan(e, g);
    }
    this.updateNfx(dt, g);
  },

  drawTitan(e, g) {
    const ti = e.titan, d = e.def, R = this.rooms, T = R.T, now = this.time.now, enr = ti.enraged;
    // wall damage where fists burst through
    for (let i = 0; i < ti.holes.length; i++) {
      const h = ti.holes[i], x = h.side > 0 ? R.W - T * 0.5 : T * 0.5;
      g.fillStyle(0x0b0710, 0.9); g.fillEllipse(x, h.y, 40, 70);
      g.lineStyle(2, 0x7e7488, 1); for (let k = 0; k < 4; k++) g.lineBetween(x, h.y, x + Math.cos(k * 1.6) * 34, h.y + Math.sin(k * 1.6) * 44);
    }
    // glowing cracks between the bone plates + eyes (purple; red in phase 2)
    const eyeCol = enr ? 0xff1744 : 0x7c4dff, pulse = 0.7 + 0.3 * Math.sin(now / 150);
    const hx = e.x, hy = e.y + (TITAN_HEAD.cy - TITAN_HEAD.h / 2), a = e.alpha;
    g.lineStyle(7, eyeCol, 0.22 * pulse * a);
    for (let k = 0; k < TITAN_SEAMS.length; k++) { const s2 = TITAN_SEAMS[k]; g.lineBetween(hx + s2[0], hy + s2[1], hx + s2[2], hy + s2[3]); }
    g.lineStyle(2.5, eyeCol, 0.9 * a);
    for (let k = 0; k < TITAN_SEAMS.length; k++) { const s2 = TITAN_SEAMS[k]; g.lineBetween(hx + s2[0], hy + s2[1], hx + s2[2], hy + s2[3]); }
    for (let s = -1; s <= 1; s += 2) {
      g.fillStyle(eyeCol, 0.25 * pulse * a); g.fillCircle(hx + s * 36, hy - 15, 24);
      g.fillStyle(eyeCol, 0.95 * a); g.fillCircle(hx + s * 36, hy - 15, 8 + 2 * pulse);
    }
    if (ti.mouth > 0) { g.fillStyle(0x0b0710, 0.9); g.fillRect(hx - 40, hy + 46, 80, 26 * ti.mouth + 2); g.lineStyle(2, eyeCol, 0.8); g.strokeRect(hx - 40, hy + 46, 80, 26 * ti.mouth + 2); }
    if (e.state === 'punchStuck' || e.state === 'laserWind' || e.state === 'laser') {   // dazed / exposed
      g.fillStyle(0xffeb3b, 0.9);
      for (let k = 0; k < 3; k++) g.fillCircle(e.x + Math.cos(now / 160 + k * 2.1) * 70, e.y - 60 + Math.sin(now / 160 + k * 2.1) * 10, 5);
    }
    // PUNCH
    if (e.state === 'punchWind') {
      const k = ti.windK, x = ti.side > 0 ? R.W - T * 0.5 : T * 0.5;
      g.fillStyle(0xff1744, 0.08 + 0.14 * k); g.fillRect(0, ti.punchY - d.punch.radius, R.W, d.punch.radius * 2);
      g.lineStyle(2, 0xff1744, 0.4 + 0.4 * k); g.strokeRect(0, ti.punchY - d.punch.radius, R.W, d.punch.radius * 2);
      g.lineStyle(3, 0xffab40, 0.5 + 0.5 * k);                     // the wall cracks
      for (let c = 0; c < 5; c++) { const a = c * 1.25 + 0.3; g.lineBetween(x, ti.punchY, x + Math.cos(a) * 30 * (0.5 + k), ti.punchY + Math.sin(a) * 50 * (0.5 + k)); }
      g.fillStyle(0xffab40, 0.3 * k); g.fillCircle(x, ti.punchY, 30 * k);
    }
    if (e.state === 'punch' || e.state === 'punchStuck' || e.state === 'punchBack') {
      const wx = ti.side > 0 ? R.W - T * 0.3 : T * 0.3;
      TitanDraw.arm(g, wx, ti.fistY, ti.fistX + ti.side * d.punch.radius * 0.7, ti.fistY, 34);
      TitanDraw.fist(g, ti.fistX, ti.fistY, d.punch.radius, false, -ti.side, 0);
      if (e.state === 'punchStuck') { g.lineStyle(3, 0xffeb3b, 0.6 + 0.3 * Math.sin(now / 60)); g.strokeCircle(ti.fistX, ti.fistY, d.punch.radius + 10); }
    }
    // SLAM
    if (e.state === 'slamWind') {
      const k = ti.windK, r = d.slam.radius;
      g.fillStyle(0x000000, 0.25 + 0.3 * k); g.fillEllipse(ti.slamX, ti.slamY, r * 2 * (0.5 + 0.5 * k), r * 1.2 * (0.5 + 0.5 * k));
      g.lineStyle(3, 0xff1744, 0.5 + 0.4 * k); g.strokeCircle(ti.slamX, ti.slamY, r);
      const fy = ti.slamY - 60 - 260 * (1 - k);
      TitanDraw.arm(g, e.x + 60, e.y + 30, ti.slamX, fy - 40, 30);
      TitanDraw.fist(g, ti.slamX, fy, 52, false);
    }
    if (e.state === 'slamRecover') {
      TitanDraw.arm(g, e.x + 60, e.y + 30, ti.slamX, ti.slamY - 40, 30);
      TitanDraw.fist(g, ti.slamX, ti.slamY, 52, false);
    }
    for (let i = 0; i < ti.rings.length; i++) {
      const rg = ti.rings[i];
      g.lineStyle(d.slam.ring.width, 0xe8e1d1, 0.35); g.strokeCircle(rg.x, rg.y, rg.r);
      g.lineStyle(4, 0xffffff, 0.9); g.strokeCircle(rg.x, rg.y, rg.r);
    }
    // RIBCAGE
    if (e.state === 'ribWind' || e.state === 'ribUp' || e.state === 'ribShut') {
      const r = d.ribs.radius;
      for (let i = 0; i < ti.cages.length; i++) {
        const c = ti.cages[i];
        if (e.state === 'ribWind') {
          const k = ti.windK;
          g.fillStyle(0xff1744, 0.1 + 0.2 * k); g.fillCircle(c.x, c.y, r);
          g.lineStyle(3, 0xff1744, 0.5 + 0.5 * k); g.strokeCircle(c.x, c.y, r);
          g.lineStyle(2, 0xe8e1d1, 0.8);
          for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; g.lineBetween(c.x + Math.cos(an) * r, c.y + Math.sin(an) * r, c.x + Math.cos(an) * (r - 10), c.y + Math.sin(an) * (r - 10)); }
        } else if (e.state === 'ribUp') {
          const k = 1 - Math.max(0, e.stateMs) / d.ribs.upMs;
          TitanDraw.ribs(g, c.x, c.y, r, Math.min(1, k * 1.4), false);
        } else {
          g.fillStyle(0xffffff, Math.max(0, e.stateMs / 480) * 0.35); g.fillCircle(c.x, c.y, r);
          TitanDraw.ribs(g, c.x, c.y, r, 1, true);
        }
      }
    }
    // LASER
    if (ti.beams > 0 && (e.state === 'laserWind' || e.state === 'laser')) {
      for (let b = 0; b < ti.beams; b++) {
        const a = ti.beamAng + b * Math.PI * 2 / ti.beams, ex = e.x + Math.cos(a) * d.laser.length, ey = e.y + Math.sin(a) * d.laser.length;
        if (e.state === 'laserWind') { g.lineStyle(2, 0xff1744, 0.4 + 0.4 * Math.sin(now / 50)); g.lineBetween(e.x, e.y, ex, ey); }
        else {
          g.lineStyle(d.laser.width + 14, enr ? 0xff1744 : 0x7c4dff, 0.25); g.lineBetween(e.x, e.y, ex, ey);
          g.lineStyle(d.laser.width, enr ? 0xff8a80 : 0xb388ff, 0.8); g.lineBetween(e.x, e.y, ex, ey);
          g.lineStyle(6, 0xffffff, 1); g.lineBetween(e.x, e.y, ex, ey);
        }
      }
    }
    if (e.state === 'summon') {
      g.lineStyle(3, 0x76ff03, 0.6); g.strokeCircle(e.x, e.y, 70 + 20 * Math.sin(now / 80));
    }
  },

  /* ---- Titan's Wrath (player mega spell) ---- */
  updateNfx(dt, g) {
    const playing = this.mode === 'play';
    for (let i = this.nfx.length - 1; i >= 0; i--) {
      const f = this.nfx[i];
      if (playing) f.ms -= dt;
      if (f.type === 'fist') {
        const k = 1 - Math.max(0, f.ms) / f.total;
        g.fillStyle(0x000000, 0.3 * k); g.fillEllipse(f.x, f.y, 160 * k, 90 * k);
        g.lineStyle(3, 0xffd54f, 0.7); g.strokeCircle(f.x, f.y, f.d.radius);
        TitanDraw.fist(g, f.x, f.y - 40 - 300 * (1 - k), 50, false);
        if (f.ms <= 0) { this.titanWrathImpact(f); this.nfx.splice(i, 1); }
      } else if (f.type === 'ring') {
        if (playing) f.r += f.speed * dt / 1000;
        g.lineStyle(18, 0xffd54f, 0.3); g.strokeCircle(f.x, f.y, f.r);
        g.lineStyle(4, 0xfff8e1, 0.9); g.strokeCircle(f.x, f.y, f.r);
        if (this.lighting) for (let a = 0; a < 8; a++) this.lighting.add(f.x + Math.cos(a * 0.785) * f.r, f.y + Math.sin(a * 0.785) * f.r, 50);
        if (playing) {
          const list = this.enemies.targets();
          for (let k = 0; k < list.length; k++) {
            const e = list[k];
            if (!e.active || f.hit.indexOf(e) >= 0) continue;
            const dx = e.x - f.x, dy = e.y - f.y, dist = Math.sqrt(dx * dx + dy * dy);
            if (Math.abs(dist - f.r) > 16 + (e.def.size || 20) / 2) continue;
            f.hit.push(e);
            this.hitEnemy(e, Math.round(f.d.ringDamage * f.p.stats.damageMul), dx / (dist || 1), dy / (dist || 1), 300, 140, f.p);
          }
        }
        if (f.r > f.d.ringMax) this.nfx.splice(i, 1);
      } else if (f.type === 'cage') {
        const e = f.e, x = e && e.active ? e.x : f.x, y = e && e.active ? e.y : f.y;
        f.x = x; f.y = y;
        const r = Math.max(36, ((e && e.def && e.def.size) || 30) * 0.8);
        if (f.ms > 260) { g.lineStyle(3, 0xffd54f, 0.8); g.strokeCircle(x, y, r); }
        else TitanDraw.ribs(g, x, y, r, f.shut ? 1 : 1 - Math.max(0, f.ms - 120) / 140, f.shut);
        if (!f.shut && f.ms <= 120) {
          f.shut = true;
          if (e && e.active) { this.hitEnemy(e, Math.round(f.d.cageDamage * f.p.stats.damageMul), 0, 0, 0, 0, f.p); if (e.active) this.enemies.stun(e, f.d.cageStunMs); }
        }
        if (f.ms <= -300) this.nfx.splice(i, 1);
      }
    }
  },

  titanWrathImpact(f) {
    const d = f.d, p = f.p;
    GearFx.burst(this, p, f.x, f.y, d.radius, { damage: d.damage, stunMs: d.stunMs, knockback: 320, color: 0xffd54f });
    this.cameras.main.shake(320, 0.016);
    this.nfx.push({ type: 'ring', x: f.x, y: f.y, r: 40, speed: 560, ms: 9e9, d: d, p: p, hit: [] });
    // ribcages burst under the nearest enemies
    const list = this.enemies.targets().filter((e) => e.active && !e.isBossPart && e.state !== 'bones');
    list.sort((a, b) => ((a.x - f.x) ** 2 + (a.y - f.y) ** 2) - ((b.x - f.x) ** 2 + (b.y - f.y) ** 2));
    for (let i = 0; i < Math.min(d.cages, list.length); i++) {
      const e = list[i];
      if ((e.x - f.x) ** 2 + (e.y - f.y) ** 2 > 480 * 480) break;
      this.nfx.push({ type: 'cage', e: e, x: e.x, y: e.y, ms: 520 + i * 120, total: 520, d: d, p: p, shut: false });
    }
    if (this.lighting) this.lighting.lightNear(f.x, f.y, d.radius + 60);
  },

  // Titan Ribcage armor: whoever hits you may get caught in a ribcage.
  ribTrapCheck(p, res, attacker) {
    if (res !== 'hit' && res !== 'block') return;
    const a = Catalog.get('armor', p.armor);
    if (!a || !a.ribTrap || !attacker || !attacker.active || !attacker.isEnemy || attacker.isBossPart) return;
    if (Math.random() >= a.ribTrap.chance) return;
    this.nfx.push({ type: 'cage', e: attacker, x: attacker.x, y: attacker.y, ms: 380, total: 380, d: { cageDamage: a.ribTrap.damage, cageStunMs: a.ribTrap.stunMs }, p: p, shut: false });
  }
};

/* ---------------- boss loot ---------------- */
SKILL_TYPES.titanWrath = {
  name: "Titan's Wrath", short: 'WRTH', kind: 'titanWrath', mega: true, megaColor: 0xffd54f, class: 'boss', sub: 'Dead Titan', price: 110, bossItem: 'deadTitan',
  desc: "MEGA SPELL (110 mana). The Titan's fist slams\nwhere you aim (80, stuns), a shockwave rolls\nout (35) and ribcages trap up to 4 enemies (40).",
  manaCost: 110, cooldownMs: 18000, range: 300,
  radius: 130, damage: 80, stunMs: 1500, ringDamage: 35, ringMax: 560, cages: 4, cageDamage: 40, cageStunMs: 2000, fallMs: 420
};
SKILL_BEHAVIORS.titanWrath = function (p, d, ctx) {
  const sc = ctx.scene;
  if (!sc || !sc.nfx) return false;
  const R = sc.rooms;
  let x = p.sprite.x + p.input.aimX * d.range, y = p.sprite.y + p.input.aimY * d.range;
  x = Phaser.Math.Clamp(x, R.T * 1.5, R.W - R.T * 1.5); y = Phaser.Math.Clamp(y, R.T * 1.5, R.H - R.T * 1.5);
  sc.nfx.push({ type: 'fist', x: x, y: y, ms: d.fallMs, total: d.fallMs, d: d, p: p });
  return true;
};
ARMOR_TYPES.titanRibcage = {
  name: 'Titan Ribcage', short: 'RIBS', class: 'boss', sub: 'Dead Titan', price: 95, bossItem: 'deadTitan',
  desc: '+30 max HP. Defense 12%. Enemies that hit\nyou have a 30% chance to get caught in a\nribcage (25 damage, stunned 1.5 s).',
  mods: { maxHp: 30, defense: 0.12 }, ribTrap: { chance: 0.3, damage: 25, stunMs: 1500 }
};

BESTIARY_ENTRIES.push(
  { id: 'skeleton', enemy: 'skeleton', tag: 'The Necrotery',
    desc: 'Rattles in the dark. Its sword doesn\'t.',
    abilities: (d) => ['Slash in front of it: ' + d.slash.damage + '. The red slice shows where.'] },
  { id: 'skeletonArcher', enemy: 'skeletonArcher', tag: 'The Necrotery',
    desc: 'Keeps its distance. Aims for a long time, then doesn\'t miss.',
    abilities: (d) => ['Arrows: ' + d.arrow.damage + '. The aim line locks just before it shoots.'] },
  { id: 'skeletonGuard', enemy: 'skeletonGuard', tag: 'The Necrotery',
    desc: 'A shield older than the castle.',
    abilities: (d) => ['Hits from the front deal only ' + Math.round(d.shield.blockMul * 100) + '%. Get behind it.', 'Shield bash: ' + d.dashDamage + '. Then its shield is stuck for a moment.', 'Blasts get around the shield. A melee dash-attack knocks it aside.'] },
  { id: 'darkSkeleton', enemy: 'darkSkeleton', tag: 'The Necrotery',
    desc: 'Purple bones that never learned to stay down.',
    abilities: (d) => ['Falls into a pile of bones and gets back up ' + d.revives[0] + '-' + d.revives[1] + ' times.', 'Burn the pile and it stays down.'] },
  { id: 'darkSkeletonArcher', enemy: 'darkSkeletonArcher', tag: 'The Necrotery',
    desc: 'Same aim. Same stubbornness.', abilities: (d) => ['Gets back up like the Dark Skeleton.'] },
  { id: 'darkSkeletonGuard', enemy: 'darkSkeletonGuard', tag: 'The Necrotery',
    desc: 'You knocked it down. It noticed.', abilities: (d) => ['Shield in front, and it gets back up.'] },
  { id: 'necroMage', enemy: 'necroMage', tag: 'The Necrotery',
    desc: 'The one who keeps waking everybody up. Hit it first.',
    abilities: (d) => ['Raises skeletons, wakes bone piles at once, shoots shadow bolts (' + d.bolt.damage + ').'] },
  { id: 'wisp', enemy: 'wisp', tag: 'The Necrotery',
    desc: 'Hates the light. Flies through walls to blow out your torches.',
    abilities: (d) => ['Blows out lit torches. With no torch lit, it pesters you (' + d.contactDamage + ').'] },
  { id: 'phantom', enemy: 'phantom', tag: 'The Necrotery',
    desc: 'Drifts through walls, see-through, then suddenly isn\'t.',
    abilities: (d) => ['See-through: takes half damage and passes through you.', 'Turns solid and lunges: ' + d.dashDamage + '.'] },
  { id: 'deadTitan', enemy: 'deadTitan', tag: 'BOSS · The Necrotery',
    desc: 'Buried under the crypt. Not all the way.',
    abilities: (d) => ['Punch: the wall cracks first. The stuck fist leaves him dazed (+50% damage).',
                       'Slam: dash through the shockwave ring.', 'Ribcage: walk out of the bone circle before it shuts.',
                       'Spinning beams from the middle of the room.', 'Roar: blows out every torch. Light them again!'] }
);
