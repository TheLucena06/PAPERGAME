/* foes2.js
   Stage enemies and bosses added with the run structure (Phase 1).
   Same system as enemies.js: data goes into ENEMY_TYPES, behaviour into
   ENEMY_AI, textures are drawn by FoeTextures at boot.
   Bosses here are big enemies: def.boss = { ... } (boss bar, stun/knockback
   resistant). Mini-bosses (mimic) use def.miniBoss. */

Object.assign(ENEMY_TYPES, {
  // Sewers: latches on, drains HP + mana and slows you. Any hit knocks it off.
  leech: {
    name: 'Ink Leech', ai: 'leech',
    cost: 1, minLevel: 1, postBoss: 1, weight: 2,
    coins: [1, 2],
    maxHp: 26, speed: 180, speedVariance: 0.1, size: 14, color: 0x37474f, mass: 0.6,
    contactDamage: 0,
    hitKnockback: 160, hitKnockbackMs: 80,
    contactPushback: 0, contactPushbackMs: 0,
    latchMs: 3500, latchTickMs: 500, latchDamage: 3, manaDrain: 4, latchSlow: 0.3, relatchMs: 1400
  },
  // Castle: shield in front blocks most damage from the front. Flank it!
  guard: {
    name: 'Shield Guard', ai: 'guard',
    cost: 3, minLevel: 1, postBoss: 1, weight: 2,
    coins: [3, 4],
    maxHp: 80, speed: 90, speedVariance: 0.05, size: 26, color: 0x78909c, mass: 4,
    contactDamage: 9, dashDamage: 16,
    hitKnockback: 60, hitKnockbackMs: 40,
    contactPushback: 200, contactPushbackMs: 160,
    shield: { arcDeg: 120, blockMul: 0.15 },   // hits from the front deal only 15%
    turnSpeed: 2.6,                             // radians per second: circle around it
    attackRange: 80, windupMs: 380, dashMs: 240, dashSpeed: 430, recoverMs: 600, attackCooldownMs: 1400
  },
  // Treasure rooms: the chest bites back.
  mimic: {
    name: 'Mimic', ai: 'mimic', miniBoss: true,
    cost: 0, weight: 0,
    coins: [20, 26],
    maxHp: 420, speed: 150, speedVariance: 0, size: 40, color: 0x8d6e63, mass: 8,
    contactDamage: 14,
    hitKnockback: 0, hitKnockbackMs: 0,
    contactPushback: 0, contactPushbackMs: 0,
    hop: { windupMs: 420, airMs: 520, radius: 80, damage: 18 },
    tongue: { windupMs: 480, length: 210, width: 26, damage: 16, activeMs: 180 },
    spit: { count: 5, spreadDeg: 50, speed: 260, damage: 9 },
    recoverMs: 450
  },
  // ---- Bosses ----
  kingInkblot: {
    name: 'King Inkblot', ai: 'kingInkblot',
    boss: { arena: [15, 10], defeatCoins: 60 },
    cost: 0, weight: 0, coins: [0, 0],
    maxHp: 2900, speed: 0, speedVariance: 0, size: 92, color: 0x263238, mass: 50,
    contactDamage: 18,
    hitKnockback: 0, hitKnockbackMs: 0, contactPushback: 0, contactPushbackMs: 0,
    hop: { windupMs: 520, airMs: 620, radius: 120, damage: 26, minions: 2, maxMinions: 8 },
    slam: { every: 3, bullets: 16, bulletSpeed: 240, bulletDamage: 13 },
    recoverMs: 380, splitAt: 0.5, prince: 'inkPrince',
    reflectWeak: 4                       // its own ink shots, reflected (melee dash-attack / parry), deal x4
  },
  inkPrince: {
    name: 'Inkblot Prince', ai: 'kingInkblot', bossPart: true,
    cost: 0, weight: 0, coins: [6, 8],
    maxHp: 800, speed: 0, speedVariance: 0, size: 62, color: 0x37474f, mass: 30,
    contactDamage: 14,
    hitKnockback: 0, hitKnockbackMs: 0, contactPushback: 0, contactPushbackMs: 0,
    hop: { windupMs: 430, airMs: 520, radius: 90, damage: 20, minions: 1, maxMinions: 8 },
    slam: { every: 4, bullets: 10, bulletSpeed: 260, bulletDamage: 11 },
    recoverMs: 280, reflectWeak: 4
  },
  warden: {
    name: 'The Warden', ai: 'warden',
    boss: { arena: [15, 10], defeatCoins: 60 },
    cost: 0, weight: 0, coins: [0, 0],
    maxHp: 3000, speed: 105, speedVariance: 0, size: 58, color: 0x546e7a, mass: 40,
    contactDamage: 18,
    hitKnockback: 0, hitKnockbackMs: 0, contactPushback: 0, contactPushbackMs: 0,
    ball: { radius: 18, damage: 24, hitCdMs: 550 },
    spin: { ms: 3200, radius: 175, turnSpeed: 5.2, walkSpeed: 100 },
    throwB: { windupMs: 460, speed: 820, maxDist: 560, impactRadius: 95, impactDamage: 26, reelMs: 420, enragedThrows: 3 },
    cells: { windupMs: 720, size: 96, rootMs: 1300, damage: 12, extra: 2 },
    reflect: { hpPct: 0.07, stunMs: 2200, backMs: 260 },   // dash-attack the ball back into him (melee)
    summonAt: 0.5
  }
});

// Dash-attack (melee) into the Warden's ball while it's out: it flies back into him.
EnemyManager.prototype.reflectBall = function (p, ang, range) {
  const list = this.group.getChildren();
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.active || e.def.ai !== 'warden' || e.ballX === undefined) continue;
    if (e.state !== 'throw' && e.state !== 'spin' && e.state !== 'reel') continue;
    const dx = e.ballX - p.sprite.x, dy = e.ballY - p.sprite.y, reach = range + e.def.ball.radius + 16;
    const d2 = dx * dx + dy * dy;
    if (d2 > reach * reach) continue;
    const len = Math.sqrt(d2) || 1;
    if (len > reach * 0.6 && (dx / len) * Math.cos(ang) + (dy / len) * Math.sin(ang) < -0.2) continue;   // roughly toward it (very close: any way)
    e.backX = e.ballX; e.backY = e.ballY; e.reflectedBy = p;
    this.setState(e, 'ballBack', e.def.reflect.backMs);
    if (this.scene.hud) this.scene.hud.addFx(e.ballX, e.ballY, 36, 0xffffff, 220);
    if (this.scene.cameras) this.scene.cameras.main.shake(100, 0.006);
    return true;
  }
  return false;
};

const FOE_AI = {
  // ---- Ink Leech ----
  leech(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'latched') {
      const p = e.latchP;
      if (!p || !p.alive || e.stateMs <= 0) { m.unlatch(e); return; }
      e.body.reset(p.sprite.x + Math.cos(e.latchAng) * 13, p.sprite.y + Math.sin(e.latchAng) * 13);
      p.extraSlow += d.latchSlow;
      e.tickMs -= dt;
      if (e.tickMs <= 0) {
        e.tickMs += d.latchTickMs;
        p.dotHit(d.latchDamage * e.dmgMul);
        p.mana = Math.max(0, p.mana - d.manaDrain);
      }
      return;
    }
    m.steer(e, t, e.spd, ctx.rooms);
    if (e.attackCdMs > 0 || !t.stats || t.isGhost || !t.controller) return;   // only players, not allies
    const r = d.size / 2 + t.stats.size / 2 + 3;
    if (e.tdist <= r && !t.isDashing()) {
      e.latchP = t; e.latchAng = Math.random() * Math.PI * 2; e.tickMs = d.latchTickMs;
      m.setState(e, 'latched', d.latchMs);
    }
  },

  // ---- Shield Guard ----
  guard(m, e, t, dt, ctx) {
    const d = e.def;
    // the shield turns slowly toward you: walk around it
    const want = Math.atan2(e.tdy, e.tdx);
    let diff = want - e.faceAng;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = d.turnSpeed * dt / 1000 * e.slowMul;
    if (e.state !== 'dash') e.faceAng += Math.max(-turn, Math.min(turn, diff));
    if (e.state === 'move') {
      if (e.hasLos && e.tdist < d.attackRange && e.attackCdMs <= 0 && Math.abs(diff) < 0.6) {
        m.setState(e, 'windup', d.windupMs); e.setVelocity(0, 0); return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    if (e.state === 'windup') {
      e.setVelocity(0, 0);
      if (e.stateMs <= 0) { e.dashX = Math.cos(e.faceAng); e.dashY = Math.sin(e.faceAng); m.setState(e, 'dash', d.dashMs); }
      return;
    }
    if (e.state === 'dash') {
      e.setVelocity(e.dashX * d.dashSpeed * e.slowMul, e.dashY * d.dashSpeed * e.slowMul);
      if (e.stateMs <= 0) m.endDash(e);
      return;
    }
    e.setVelocity(0, 0);
    if (e.stateMs <= 0) m.setState(e, 'move', 0);
  },

  // ---- Mimic ----
  mimic(m, e, t, dt, ctx) {
    const d = e.def;
    const fast = e.hp < e.maxHp * 0.5 ? 0.7 : 1;
    if (e.state === 'move') {
      e.setVelocity(0, 0);
      if (e.attackCdMs > 0) return;
      const r = Math.random();
      e.aimAng = Math.atan2(e.tdy, e.tdx);
      if (e.tdist < d.tongue.length - 20 && r < 0.4) m.setState(e, 'tongueWind', d.tongue.windupMs * fast);
      else if (r < 0.75) { e.hopX0 = e.x; e.hopY0 = e.y; e.hopX1 = t.sprite.x; e.hopY1 = t.sprite.y; m.setState(e, 'hopWind', d.hop.windupMs * fast); }
      else m.setState(e, 'spitWind', 380 * fast);
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'hopWind' && e.stateMs <= 0) { m.setState(e, 'air', d.hop.airMs * fast); e.airTotal = d.hop.airMs * fast; }
    else if (e.state === 'air') {
      const k = 1 - Math.max(0, e.stateMs) / e.airTotal;
      e.body.reset(e.hopX0 + (e.hopX1 - e.hopX0) * k, e.hopY0 + (e.hopY1 - e.hopY0) * k);
      if (e.stateMs <= 0) { m.shockwave(e, d.hop.radius, d.hop.damage, ctx); m.setState(e, 'recover', d.recoverMs * fast); }
    }
    else if (e.state === 'tongueWind') {
      if (e.stateMs > 150) e.aimAng = Math.atan2(e.tdy, e.tdx);
      if (e.stateMs <= 0) { m.setState(e, 'tongue', d.tongue.activeMs); e.tongueHit = 0; }
    }
    else if (e.state === 'tongue') {
      m.lineHit(e, e.aimAng, d.tongue.length, d.tongue.width, d.tongue.damage, ctx);
      if (e.stateMs <= 0) m.setState(e, 'recover', d.recoverMs * fast);
    }
    else if (e.state === 'spitWind' && e.stateMs <= 0) {
      m.fan(e, ctx.enemyBullets, d.spit.count, d.spit.spreadDeg, d.spit.speed, d.spit.damage, 'coin');
      m.setState(e, 'recover', d.recoverMs * fast);
    }
    else if (e.state === 'recover' && e.stateMs <= 0) { m.setState(e, 'move', 0); e.attackCdMs = 250; }
  },

  // ---- King Inkblot (and his princes) ----
  kingInkblot(m, e, t, dt, ctx) {
    const d = e.def, rm = ctx.rooms;
    if (e.state === 'move') {
      e.setVelocity(0, 0);
      if (e.attackCdMs > 0) return;
      e.hops = (e.hops || 0) + 1;
      e.hopX0 = e.x; e.hopY0 = e.y;
      if (e.hops % d.slam.every === 0) { e.slamming = true; e.hopX1 = rm.W / 2; e.hopY1 = rm.H / 2; }
      else {
        e.slamming = false;
        // land a bit in front of the target, inside the room
        e.hopX1 = Phaser.Math.Clamp(t.sprite.x, 64 + d.size / 2, rm.W - 64 - d.size / 2);
        e.hopY1 = Phaser.Math.Clamp(t.sprite.y, 64 + d.size / 2, rm.H - 64 - d.size / 2);
      }
      m.setState(e, 'hopWind', d.hop.windupMs * (e.hp < e.maxHp * 0.5 ? 0.8 : 1));
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'hopWind' && e.stateMs <= 0) { m.setState(e, 'air', d.hop.airMs); e.airTotal = d.hop.airMs; }
    else if (e.state === 'air') {
      const k = 1 - Math.max(0, e.stateMs) / e.airTotal;
      e.body.reset(e.hopX0 + (e.hopX1 - e.hopX0) * k, e.hopY0 + (e.hopY1 - e.hopY0) * k);
      if (e.stateMs <= 0) {
        m.shockwave(e, d.hop.radius * (e.slamming ? 1.25 : 1), d.hop.damage, ctx);
        if (e.slamming) {
          m.ring(e, ctx.enemyBullets, d.slam.bullets, d.slam.bulletSpeed, d.slam.bulletDamage, 0);
          if (e.hp < e.maxHp * 0.5) m.ring(e, ctx.enemyBullets, d.slam.bullets, d.slam.bulletSpeed * 0.75, d.slam.bulletDamage, Math.PI / d.slam.bullets);
        }
        // little ink drops splash out
        let alive = 0;
        const list = m.group.getChildren();
        for (let i = 0; i < list.length; i++) if (list[i].active && list[i].typeId === 'inkdrop') alive++;
        for (let i = 0; i < d.hop.minions && alive < d.hop.maxMinions; i++, alive++) {
          const a = Math.random() * Math.PI * 2;
          const c = m.spawn('inkdrop', e.x + Math.cos(a) * d.size * 0.6, e.y + Math.sin(a) * d.size * 0.6);
          if (c) m.push(c, Math.cos(a), Math.sin(a), 240, 220);
        }
        m.setState(e, 'recover', d.recoverMs);
      }
    }
    else if (e.state === 'recover' && e.stateMs <= 0) { m.setState(e, 'move', 0); e.attackCdMs = 150; }
  },

  // ---- The Warden ----
  warden(m, e, t, dt, ctx) {
    const d = e.def, sec = dt / 1000;
    if (e.ballX === undefined) { e.ballX = e.x + 40; e.ballY = e.y; e.ballAng = 0; e.ballR = 40; e.ballHitMs = [0, 0]; }
    if (e.state === 'ballBack') {
      // a melee player knocked the ball back: it flies into the Warden
      e.setVelocity(0, 0);
      const k = 1 - Math.max(0, e.stateMs) / d.reflect.backMs;
      e.ballX = e.backX + (e.x - e.backX) * k; e.ballY = e.backY + (e.y - e.backY) * k;
      if (e.stateMs <= 0) {
        e.ballAng = 0; e.ballR = 10; e.throwsLeft = 0;
        m.setState(e, 'move', 0);
        e.attackCdMs = 600;
        if (m.scene.hud) { m.scene.hud.addFx(e.x, e.y, 70, 0xffd54f, 380); m.scene.hud.floatText(e.x, e.y - 50, 'STUNNED!', '#ef6c00'); }
        if (m.scene.cameras) m.scene.cameras.main.shake(220, 0.012);
        if (m.scene.hitEnemy) m.scene.hitEnemy(e, Math.round(e.maxHp * d.reflect.hpPct), 0, 0, 0, 0, e.reflectedBy, 'reflect');
        if (e.active) e.stunnedMs = d.reflect.stunMs;      // a real stun, even for a boss
      }
      return;
    }
    for (let i = 0; i < e.ballHitMs.length; i++) if (e.ballHitMs[i] > 0) e.ballHitMs[i] -= dt;
    const enraged = e.hp < e.maxHp * d.summonAt;
    if (enraged && !e.summoned) {
      e.summoned = true;
      if (m.onSpecialSpawn) m.onSpecialSpawn(ENEMY_TYPES.prisoners, e.x, e.y + 120);
    }
    // ball follows its state
    if (e.state === 'move' || e.state === 'cellsWind' || e.state === 'throwWind') {
      e.ballAng += sec * 1.6; e.ballR += (40 - e.ballR) * Math.min(1, sec * 6);
      e.ballX = e.x + Math.cos(e.ballAng) * e.ballR; e.ballY = e.y + Math.sin(e.ballAng) * e.ballR;
    }
    if (e.state === 'move') {
      m.steer(e, t, d.speed * e.slowMul, ctx.rooms);
      if (e.attackCdMs > 0) return;
      const r = Math.random();
      if (r < 0.38) { m.setState(e, 'spin', d.spin.ms); }
      else if (r < 0.75) { m.setState(e, 'throwWind', d.throwB.windupMs); e.setVelocity(0, 0); }
      else {
        m.setState(e, 'cellsWind', d.cells.windupMs); e.setVelocity(0, 0);
        e.cells = [];
        for (let i = 0; i < ctx.players.length; i++) {
          const p = ctx.players[i];
          if (!p.alive) continue;
          e.cells.push({ x: p.sprite.x, y: p.sprite.y });
          // extra cells around you (where you'd dodge to); more when enraged
          const n = d.cells.extra + (enraged ? 2 : 0), a0 = Math.random() * Math.PI * 2;
          for (let k = 0; k < n; k++) {
            const a = a0 + k * Math.PI * 2 / n;
            e.cells.push({ x: Phaser.Math.Clamp(p.sprite.x + Math.cos(a) * d.cells.size * 1.1, 70, ctx.rooms.W - 70),
                           y: Phaser.Math.Clamp(p.sprite.y + Math.sin(a) * d.cells.size * 1.1, 70, ctx.rooms.H - 70) });
          }
        }
      }
      return;
    }
    if (e.state === 'spin') {
      m.steer(e, t, d.spin.walkSpeed * e.slowMul, ctx.rooms);
      e.ballAng += sec * d.spin.turnSpeed * (enraged ? 1.3 : 1);
      e.ballR += (d.spin.radius - e.ballR) * Math.min(1, sec * 3);
      e.ballX = e.x + Math.cos(e.ballAng) * e.ballR; e.ballY = e.y + Math.sin(e.ballAng) * e.ballR;
      m.ballHits(e, ctx);
      if (e.stateMs <= 0) { m.setState(e, 'move', 0); e.attackCdMs = 700; }
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'throwWind') {
      if (e.stateMs > 160) { e.throwX = t.sprite.x; e.throwY = t.sprite.y; }
      if (e.stateMs <= 0) {
        const dx = e.throwX - e.x, dy = e.throwY - e.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
        const dist = Math.min(len, d.throwB.maxDist);
        e.throwDX = dx / len; e.throwDY = dy / len; e.throwLeft = dist;
        e.ballX = e.x; e.ballY = e.y;
        m.setState(e, 'throw', 2000);
      }
    } else if (e.state === 'throw') {
      const step = d.throwB.speed * sec;
      e.ballX += e.throwDX * step; e.ballY += e.throwDY * step; e.throwLeft -= step;
      m.ballHits(e, ctx);
      if (e.throwLeft <= 0 || ctx.rooms.solidAt(e.ballX, e.ballY)) {
        m.areaHit(e.ballX, e.ballY, d.throwB.impactRadius, d.throwB.impactDamage, e, ctx);
        if (m.scene.hud) m.scene.hud.addFx(e.ballX, e.ballY, d.throwB.impactRadius, 0x546e7a, 300);
        if (m.scene.cameras) m.scene.cameras.main.shake(140, 0.006);
        m.setState(e, 'reel', d.throwB.reelMs);
        e.reelX = e.ballX; e.reelY = e.ballY;
        if (e.throwsLeft === undefined || e.throwsLeft <= 0) e.throwsLeft = enraged ? d.throwB.enragedThrows - 1 : 0;
        else e.throwsLeft--;
      }
    } else if (e.state === 'reel') {
      const k = 1 - Math.max(0, e.stateMs) / d.throwB.reelMs;
      e.ballX = e.reelX + (e.x - e.reelX) * k; e.ballY = e.reelY + (e.y - e.reelY) * k;
      if (e.stateMs <= 0) {
        e.ballAng = 0; e.ballR = 10;
        if (e.throwsLeft > 0) m.setState(e, 'throwWind', d.throwB.windupMs * 0.6);   // enraged: throws again right away
        else { m.setState(e, 'move', 0); e.attackCdMs = enraged ? 200 : 450; }
      }
    } else if (e.state === 'cellsWind' && e.stateMs <= 0) {
      const half = d.cells.size / 2;
      for (let c = 0; c < e.cells.length; c++) {
        const cell = e.cells[c];
        for (let i = 0; i < ctx.players.length; i++) {
          const p = ctx.players[i];
          if (!p.alive || p.isDashing()) continue;
          if (Math.abs(p.sprite.x - cell.x) < half && Math.abs(p.sprite.y - cell.y) < half) {
            p.rootMs = d.cells.rootMs;
            p.dotHit(d.cells.damage * e.dmgMul);
          }
        }
      }
      e.cellsShownMs = 500;
      m.setState(e, 'move', 0); e.attackCdMs = 500;
    }
    if (e.cellsShownMs > 0) e.cellsShownMs -= dt;
  }
};
Object.assign(ENEMY_AI, FOE_AI);

/* Helpers the new AIs use (added to EnemyManager). */
Object.assign(EnemyManager.prototype, {
  unlatch(e) {
    e.latchP = null;
    this.setState(e, 'move', 0);
    e.attackCdMs = e.def.relatchMs;
  },

  // Damages every player within radius of the enemy (landings).
  shockwave(e, radius, damage, ctx) {
    this.areaHit(e.x, e.y, radius, damage, e, ctx);
    if (this.scene.hud) this.scene.hud.addFx(e.x, e.y, radius, 0x37474f, 300);
    if (this.scene.cameras) this.scene.cameras.main.shake(160, 0.006);
  },

  areaHit(x, y, radius, damage, e, ctx) {
    for (let i = 0; i < ctx.players.length; i++) {
      const p = ctx.players[i];
      if (!p.alive) continue;
      const dx = p.sprite.x - x, dy = p.sprite.y - y, r = radius + p.stats.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      const res = p.takeHit(Math.round(damage * e.dmgMul), x, y);
      if (res === 'parry') { if (this.onParry) this.onParry(p, e); }
      else if (this.onPlayerHit) this.onPlayerHit(p, res, e);
    }
  },

  // A straight line attack from the enemy (mimic tongue): each player once per attack.
  lineHit(e, ang, length, width, damage, ctx) {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    for (let i = 0; i < ctx.players.length; i++) {
      const p = ctx.players[i];
      if (!p.alive || (e.tongueHit & (1 << i))) continue;
      const px = p.sprite.x - e.x, py = p.sprite.y - e.y;
      const along = px * cx + py * cy, side = Math.abs(px * -cy + py * cx);
      if (along < 0 || along > length || side > width / 2 + p.stats.size / 2) continue;
      e.tongueHit |= (1 << i);
      const res = p.takeHit(Math.round(damage * e.dmgMul), e.x, e.y);
      if (res === 'parry') { if (this.onParry) this.onParry(p, e); }
      else if (this.onPlayerHit) this.onPlayerHit(p, res, e);
    }
  },

  // Bullets in a fan toward the target / in a full ring.
  fan(e, bullets, count, spreadDeg, speed, damage, tex) {
    const base = Math.atan2(e.tdy, e.tdx), sp = spreadDeg * Math.PI / 180;
    for (let i = 0; i < count; i++) {
      const a = base - sp / 2 + (count > 1 ? i * sp / (count - 1) : sp / 2);
      bullets.fire(e.x + Math.cos(a) * e.def.size * 0.5, e.y + Math.sin(a) * e.def.size * 0.5, Math.cos(a), Math.sin(a), speed, Math.round(damage * e.dmgMul), 2400, e, tex);
    }
  },
  ring(e, bullets, count, speed, damage, offset) {
    for (let i = 0; i < count; i++) {
      const a = offset + i * Math.PI * 2 / count;
      bullets.fire(e.x + Math.cos(a) * e.def.size * 0.5, e.y + Math.sin(a) * e.def.size * 0.5, Math.cos(a), Math.sin(a), speed, Math.round(damage * e.dmgMul), 3200, e, 'ebullet');
    }
  },

  // Warden's ball hits players it touches (each player has a short cooldown).
  ballHits(e, ctx) {
    const b = e.def.ball;
    for (let i = 0; i < ctx.players.length; i++) {
      const p = ctx.players[i];
      if (!p.alive || e.ballHitMs[i] > 0) continue;
      const dx = p.sprite.x - e.ballX, dy = p.sprite.y - e.ballY, r = b.radius + p.stats.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      e.ballHitMs[i] = b.hitCdMs;
      const res = p.takeHit(Math.round(b.damage * e.dmgMul), e.ballX, e.ballY);
      if (res === 'parry') { if (this.onParry) this.onParry(p, e); }
      else if (this.onPlayerHit) this.onPlayerHit(p, res, e);
    }
  }
});

/* ---------------- Textures ---------------- */
const FoeTextures = {
  // returns true if it made a texture for this enemy id
  make(scene, id, def) {
    const W = (k, w, h, fn) => { TextureFactory.withGraphics(scene, k, w, h, fn); return true; };
    const key = 'enemy_' + id;
    if (def.ai === 'leech') return W(key, 20, 16, (g) => {
      g.fillStyle(0x37474f, 1); g.fillEllipse(10, 8, 18, 12);
      g.fillStyle(0x546e7a, 1); g.fillEllipse(8, 7, 8, 5);
      g.fillStyle(0xc62828, 1); g.fillCircle(17, 8, 2.5);                       // mouth
    });
    if (def.ai === 'guard') return W(key, 30, 30, (g) => {
      g.fillStyle(0x78909c, 1); g.fillRoundedRect(3, 3, 24, 24, 4);
      g.fillStyle(0x455a64, 1); g.fillRect(6, 8, 18, 4);                         // visor
      g.fillStyle(0xffd54f, 1); g.fillRect(9, 9, 3, 2); g.fillRect(18, 9, 3, 2);
      g.lineStyle(2, 0x37474f, 1); g.strokeRoundedRect(3, 3, 24, 24, 4);
    });
    if (def.ai === 'mimic') return W(key, 46, 42, (g) => {
      g.fillStyle(0x8d6e63, 1); g.fillRoundedRect(2, 10, 42, 30, 4);              // box
      g.fillStyle(0x6d4c41, 1); g.fillRoundedRect(2, 2, 42, 14, 4);               // lid
      g.fillStyle(0xffca28, 1); g.fillRect(2, 14, 42, 3); g.fillRect(20, 12, 6, 8);
      g.fillStyle(0xfafafa, 1);                                                  // teeth
      for (let i = 0; i < 6; i++) g.fillTriangle(5 + i * 6.5, 17, 11 + i * 6.5, 17, 8 + i * 6.5, 23);
      g.fillStyle(0xc62828, 1); g.fillCircle(14, 8, 2.5); g.fillCircle(32, 8, 2.5);   // eyes in the lid
    });
    if (id === 'kingInkblot' || id === 'inkPrince') {
      const s = def.size;
      return W(key, s + 8, s + 14, (g) => {
        const c = s / 2 + 4, top = 12;
        g.fillStyle(def.color, 1); g.fillRoundedRect(4, top, s, s, s * 0.3);
        g.fillCircle(c - s * 0.3, top + s, s * 0.1); g.fillCircle(c + s * 0.25, top + s + 1, s * 0.08);
        g.fillStyle(0xffffff, 1); g.fillCircle(c - s * 0.18, top + s * 0.4, s * 0.1); g.fillCircle(c + s * 0.18, top + s * 0.4, s * 0.1);
        g.fillStyle(0x000000, 1); g.fillCircle(c - s * 0.16, top + s * 0.42, s * 0.05); g.fillCircle(c + s * 0.2, top + s * 0.42, s * 0.05);
        g.fillStyle(0xffc107, 1);                                                // crown
        const cw = s * (id === 'kingInkblot' ? 0.6 : 0.4), cx0 = c - cw / 2, cy = top + 4;
        g.fillRect(cx0, cy - 2, cw, 8);
        g.fillTriangle(cx0, cy - 2, cx0 + cw * 0.2, cy - 2, cx0 + cw * 0.1, cy - 12);
        g.fillTriangle(cx0 + cw * 0.4, cy - 2, cx0 + cw * 0.6, cy - 2, cx0 + cw * 0.5, cy - 14);
        g.fillTriangle(cx0 + cw * 0.8, cy - 2, cx0 + cw, cy - 2, cx0 + cw * 0.9, cy - 12);
      });
    }
    if (id === 'warden') return W(key, 66, 66, (g) => {
      g.fillStyle(0x546e7a, 1); g.fillRoundedRect(4, 8, 58, 54, 8);                 // armor
      g.fillStyle(0x37474f, 1); g.fillRoundedRect(14, 2, 38, 26, 6);                // helmet
      g.fillStyle(0x263238, 1); g.fillRect(18, 12, 30, 6);
      g.fillStyle(0xff7043, 1); g.fillRect(22, 13, 5, 3); g.fillRect(39, 13, 5, 3);   // eyes
      g.fillStyle(0xffca28, 1); g.fillCircle(33, 44, 6);                             // key ring
      g.lineStyle(2, 0xffca28, 1); g.strokeCircle(33, 44, 9);
      g.lineStyle(3, 0x263238, 1); g.strokeRoundedRect(4, 8, 58, 54, 8);
    });
    return false;
  },

  // world objects for special rooms
  makeProps(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    W('blueprint', 30, 24, (g) => {                                                  // a rolled-up blueprint
      g.fillStyle(0x1565c0, 1); g.fillRect(3, 3, 24, 18);
      g.lineStyle(1, 0xbbdefb, 0.9);
      for (let x = 7; x < 27; x += 5) g.lineBetween(x, 4, x, 20);
      for (let y = 7; y < 21; y += 5) g.lineBetween(4, y, 26, y);
      g.lineStyle(2, 0xffffff, 1); g.strokeRect(9, 8, 10, 8); g.lineBetween(9, 8, 19, 16);
      g.fillStyle(0x0d47a1, 1); g.fillRect(0, 2, 4, 20); g.fillRect(26, 2, 4, 20);
    });
    W('merchant', 40, 48, (g) => {
      g.fillStyle(0x6d4c41, 1); g.fillRoundedRect(22, 12, 16, 22, 3);               // big backpack
      g.fillStyle(0x5d4037, 1); g.fillTriangle(8, 46, 32, 46, 20, 10);               // cloak
      g.fillStyle(0x3e2723, 1); g.fillCircle(20, 12, 9);                             // hood
      g.fillStyle(0xffcc80, 1); g.fillCircle(20, 14, 5);
      g.fillStyle(0x212121, 1); g.fillRect(17, 13, 2, 2); g.fillRect(22, 13, 2, 2);
      g.fillStyle(0xffd54f, 1); g.fillCircle(6, 30, 4);                              // lantern
      g.lineStyle(1, 0x212121, 1); g.lineBetween(6, 22, 6, 26);
    });
    W('chest', 40, 32, (g) => {
      g.fillStyle(0x8d6e63, 1); g.fillRoundedRect(2, 10, 36, 20, 3);
      g.fillStyle(0x6d4c41, 1); g.fillRoundedRect(2, 2, 36, 12, 4);
      g.fillStyle(0xffca28, 1); g.fillRect(2, 12, 36, 3); g.fillRect(17, 10, 6, 8);
      g.lineStyle(2, 0x3e2723, 1); g.strokeRoundedRect(2, 2, 36, 28, 3);
    });
    W('chest_open', 40, 32, (g) => {
      g.fillStyle(0x8d6e63, 1); g.fillRoundedRect(2, 12, 36, 18, 3);
      g.fillStyle(0x3e2723, 1); g.fillRect(5, 12, 30, 5);
      g.fillStyle(0x6d4c41, 1); g.fillRoundedRect(2, 0, 36, 9, 3);
      g.lineStyle(2, 0x3e2723, 1); g.strokeRoundedRect(2, 12, 36, 18, 3);
    });
    W('shrine', 34, 56, (g) => {
      g.fillStyle(0x9e9e9e, 1); g.fillRect(4, 44, 26, 10);                          // base
      g.fillStyle(0xffd54f, 1); g.fillRect(10, 12, 14, 32);                          // a giant pencil
      g.fillStyle(0xe0c097, 1); g.fillTriangle(10, 12, 24, 12, 17, 0);
      g.fillStyle(0x37474f, 1); g.fillTriangle(15, 4, 19, 4, 17, 0);
      g.fillStyle(0xf8bbd0, 1); g.fillRect(10, 40, 14, 4);
      g.lineStyle(1, 0x8d6e00, 1); g.strokeRect(10, 12, 14, 30);
    });
  }
};
