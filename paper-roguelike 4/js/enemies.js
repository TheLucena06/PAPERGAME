/* enemies.js
   ENEMY_TYPES (data), ENEMY_AI (behaviours, picked by the "ai" field)
   and EnemyManager (pooled enemies, spawn markers, damage, steering,
   status effects).
   To add an enemy: add an entry to ENEMY_TYPES. Reuse an existing "ai"
   or add a new function to ENEMY_AI.

   Spawning rules: minLevel = first level it can appear on, postBoss: N =
   only after N bosses were beaten. Special spawns: pair: 'chain' (two
   chained prisoners), worm: 'smallWorm' (spawned by the worm manager).
   splitInto: { type, count } = splits into smaller enemies when killed.

   Status effects on enemies (all timers in ms):
     slowMs/slowPct   moves and attacks slower (Mercury Dip, Bear Trap, ...)
     bleedMs          "Injured": takes bleed damage every 500 ms
     markMs/markedBy  marked by a player's Crippling Crossbow
     wallStunMs       if it gets knocked into a wall during this time, it is stunned */

const ENEMY_TYPES = {
  runner: {
    name: 'Runner', ai: 'chase',
    cost: 1, minLevel: 1, weight: 3,   // cost = room budget, weight = how often picked
    coins: [1, 2],                     // coins dropped: [min, max]
    maxHp: 20, speed: 150, speedVariance: 0.15, size: 20, color: 0xd9534f, mass: 1,
    contactDamage: 8,
    hitKnockback: 140, hitKnockbackMs: 70,
    contactPushback: 220, contactPushbackMs: 180
  },
  // Tiny, fast, hits hard, runs away after every stab. Rare, from level 1.
  gnome: {
    name: 'Gnome', ai: 'gnome', unique: true,
    cost: 3, minLevel: 1, weight: 0.7,
    coins: [5, 7],
    maxHp: 55, speed: 255, speedVariance: 0.05, size: 16, color: 0xc62828, mass: 1,
    contactDamage: 12, dashDamage: 20,
    hitKnockback: 120, hitKnockbackMs: 60,
    contactPushback: 260, contactPushbackMs: 160,
    zigzag: 0.9,                       // side-to-side weaving while it runs at you
    stabRange: 95, stabMs: 220, stabSpeed: 620, fleeMs: 650, attackCooldownMs: 900, recoverMs: 0
  },
  shooter: {
    name: 'Shooter', ai: 'shooter',
    cost: 2, minLevel: 1, weight: 2,
    coins: [2, 2],
    maxHp: 35, speed: 90, speedVariance: 0.1, size: 22, color: 0x26a69a, mass: 1,
    contactDamage: 5,
    hitKnockback: 120, hitKnockbackMs: 60,
    contactPushback: 200, contactPushbackMs: 160,
    preferredMin: 200, preferredMax: 340,  // tries to stay this far away
    windupMs: 450, recoverMs: 350, attackCooldownMs: 2000,
    bulletSpeed: 230, bulletDamage: 10, bulletLifetimeMs: 2500,
    shots: 1, extraShotEvery: 3, spreadDeg: 16  // +1 bullet every 3 levels
  },
  charger: {
    name: 'Charger', ai: 'charger',
    cost: 2, minLevel: 2, weight: 2,
    coins: [2, 3],
    maxHp: 45, speed: 85, speedVariance: 0.1, size: 28, color: 0xef8f2f, mass: 2,
    contactDamage: 8,
    hitKnockback: 90, hitKnockbackMs: 50,
    contactPushback: 200, contactPushbackMs: 160,
    attackRange: 280, windupMs: 700, lockMs: 220,  // stops aiming 220 ms before dashing
    dashSpeed: 560, dashMs: 420, dashDamage: 20,
    recoverMs: 850, attackCooldownMs: 1600
  },
  tank: {
    name: 'Tank', ai: 'tank',
    cost: 3, minLevel: 2, weight: 1,
    coins: [4, 5],
    maxHp: 120, speed: 60, speedVariance: 0.05, size: 40, color: 0x7e57c2, mass: 6,
    contactDamage: 6,
    hitKnockback: 0, hitKnockbackMs: 0,
    contactPushback: 0, contactPushbackMs: 0,
    attackRange: 85, attackRadius: 95, attackDamage: 22,
    windupMs: 650, recoverMs: 700, attackCooldownMs: 1400
  },

  /* ================= after boss 1 ================= */
  bomber: {
    name: 'Bomber', ai: 'bomber',
    cost: 3, minLevel: 1, postBoss: 1, weight: 2,
    coins: [3, 3],
    maxHp: 50, speed: 80, speedVariance: 0.1, size: 26, color: 0x455a64, mass: 1.5,
    contactDamage: 6,
    hitKnockback: 110, hitKnockbackMs: 60,
    contactPushback: 200, contactPushbackMs: 160,
    preferredMin: 200, preferredMax: 360,
    windupMs: 500, recoverMs: 400, attackCooldownMs: 2600,
    bomb: { flightMs: 800, hitRadius: 26, directDamage: 16, fuseMs: 2200, radius: 80, damage: 20 }
  },
  prisoner: {
    name: 'Chained Prisoner', ai: 'prisoner',
    cost: 99, minLevel: 99, weight: 0,          // only spawned in pairs (see 'prisoners')
    coins: [2, 2],
    maxHp: 45, speed: 180, speedVariance: 0.06, size: 22, color: 0xff8a65, mass: 1.5,
    contactDamage: 6,
    hitKnockback: 110, hitKnockbackMs: 60,
    contactPushback: 200, contactPushbackMs: 160,
    // Pair attack ("clothesline"): line up side by side in front of you with the
    // chain tight, flash, then run THROUGH you so the chain sweeps across you.
    sweep: { halfWidth: 92, lineUpDist: 110, lineUpMaxMs: 1800, windupMs: 380, sweepMs: 650,
             sweepDist: 300, sweepSpeedMul: 2.3, restMs: 550 },
    flail: { range: 120, windupMs: 550, swingMs: 450, recoverMs: 700, cooldownMs: 1300, arcDeg: 200 }
  },
  prisoners: {
    name: 'Chained Prisoners', pair: 'chain', member: 'prisoner',
    cost: 4, minLevel: 1, postBoss: 1, weight: 2,
    chain: { links: 10, length: 190, damage: 12, flailDamage: 16, minSpeed: 110 }
  },
  inkdrop: {
    name: 'Ink Drop', ai: 'chase',
    cost: 99, minLevel: 99, weight: 0,
    coins: [0, 1],
    maxHp: 14, speed: 170, speedVariance: 0.15, size: 14, color: 0x37474f, mass: 0.6,
    contactDamage: 6,
    hitKnockback: 160, hitKnockbackMs: 70,
    contactPushback: 220, contactPushbackMs: 160
  },
  inkblob: {
    name: 'Inkblob', ai: 'hop',
    cost: 2, minLevel: 1, postBoss: 1, weight: 2,
    coins: [1, 2],
    maxHp: 40, speed: 105, speedVariance: 0.1, size: 26, color: 0x263238, mass: 1.5,
    contactDamage: 9,
    hitKnockback: 120, hitKnockbackMs: 60,
    contactPushback: 200, contactPushbackMs: 160,
    splitInto: { type: 'inkdrop', count: 2 }
  },
  bigInkblob: {
    name: 'Big Inkblob', ai: 'hop',
    cost: 4, minLevel: 1, postBoss: 1, weight: 1,
    coins: [2, 3],
    maxHp: 100, speed: 70, speedVariance: 0.05, size: 40, color: 0x1c262b, mass: 4,
    contactDamage: 12,
    hitKnockback: 60, hitKnockbackMs: 40,
    contactPushback: 160, contactPushbackMs: 160,
    splitInto: { type: 'inkblob', count: 2 }
  },
  gale: {
    name: 'Gale', ai: 'gale',
    cost: 3, minLevel: 1, postBoss: 1, weight: 1,
    coins: [3, 3],
    maxHp: 55, speed: 80, speedVariance: 0.1, size: 26, color: 0x80deea, mass: 2,
    contactDamage: 8,
    hitKnockback: 100, hitKnockbackMs: 60,
    contactPushback: 200, contactPushbackMs: 160,
    attackRange: 560, windupMs: 450, whirlMs: 2400, attackCooldownMs: 3200,   // starts a whirl from far away too
    pullRadius: 380, pullMin: 80, pullMax: 205,   // pull speed at the edge / center (player walks at 220)
    pullFar: 65                                    // weak pull anywhere further away it can see you
  },
  // Close-range fire caster (id kept as 'warlock' so old saves/tests still work)
  warlock: {
    name: 'Pyre Acolyte', ai: 'warlock',
    cost: 3, minLevel: 1, postBoss: 1, weight: 2,
    coins: [3, 3],
    maxHp: 50, speed: 85, speedVariance: 0.1, size: 24, color: 0xbf360c, mass: 1,
    contactDamage: 5,
    hitKnockback: 110, hitKnockbackMs: 60,
    contactPushback: 200, contactPushbackMs: 160,
    preferredMin: 95, preferredMax: 165,
    windupMs: 650, lockMs: 250, castMs: 350, recoverMs: 450, attackCooldownMs: 2600,
    fire: { arcDeg: 120, radius: 165, damage: 12, burnMs: 3000, burnTick: 3 }
  },
  // ELITE (Pyre Warlock): shoots arcs of fire from far away; up close it breathes fire like the Acolyte.
  fireWarlock: {
    name: 'Pyre Warlock', ai: 'fireWarlock', elite: true,
    cost: 6, minLevel: 1, postBoss: 1, weight: 1,
    coins: [8, 10],
    maxHp: 170, speed: 80, speedVariance: 0.05, size: 32, color: 0x8e1b0c, mass: 3,
    contactDamage: 8,
    hitKnockback: 50, hitKnockbackMs: 40,
    contactPushback: 200, contactPushbackMs: 160,
    preferredMin: 230, preferredMax: 420, closeRange: 150,
    windupMs: 750, lockMs: 250, castMs: 380, recoverMs: 550, attackCooldownMs: 2300,
    // ranged: a wide arc of fire bolts that flies at you (dash through the gaps or through it)
    arc: { count: 9, spreadDeg: 80, speed: 250, damage: 14, lifetimeMs: 2600, burnMs: 3000, burnTick: 4, volleys: 2, volleyGapMs: 420 },
    // close: same fire breath as the Acolyte, stronger
    fire: { arcDeg: 120, radius: 185, damage: 18, burnMs: 3500, burnTick: 4 }
  },
  smallWorm: {
    name: 'Small Worm', worm: 'smallWorm',
    cost: 4, minLevel: 1, postBoss: 1, weight: 1
  }
};

const ENEMY_LOS_INTERVAL_MS = 200; // how often each enemy re-checks line of sight
const BLEED_TICK_MS = 500;

/* ---------- Behaviours ----------
   Each gets (manager, enemy, target player, dt, ctx).
   e.tdx / e.tdy / e.tdist = vector and distance to target (precomputed).
   e.stateMs and e.attackCdMs are counted down by the manager.
   e.spd = current move speed (includes slows). */
const ENEMY_AI = {
  chase(m, e, t, dt, ctx) {
    m.steer(e, t, e.spd, ctx.rooms);
  },

  // Inkblobs move in little hops
  hop(m, e, t, dt, ctx) {
    e.hopMs = (e.hopMs || 0) + dt;
    const k = 0.45 + 0.85 * Math.max(0, Math.sin(e.hopMs / 160));
    m.steer(e, t, e.spd * k, ctx.rooms);
  },

  tank(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'move') {
      if (e.tdist < d.attackRange && e.attackCdMs <= 0) {
        m.setState(e, 'windup', d.windupMs);
        e.setVelocity(0, 0);
        return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup' && e.stateMs <= 0) {
      m.damagePlayersInRadius(ctx.players, e.x, e.y, d.attackRadius, d.attackDamage * e.dmgMul, e);
      if (e.stunnedMs > 0) return; // parried: the stun already cancelled the attack
      e.fxMs = 180;
      m.setState(e, 'recover', d.recoverMs);
      e.attackCdMs = d.attackCooldownMs;
    } else if (e.state === 'recover' && e.stateMs <= 0) {
      m.setState(e, 'move', 0);
    }
  },

  // Keeps its distance and strafes (used by the Shooter and the Bomber)
  keepDistance(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.hasLos && e.tdist <= d.preferredMax) {
      e.strafeMs -= dt;
      if (e.strafeMs <= 0 || !e.body.blocked.none) {
        e.strafeSign = -e.strafeSign;
        e.strafeMs = 1000 + Math.random() * 1000;
      }
      const nx = e.tdx / e.tdist, ny = e.tdy / e.tdist;
      let vx = -ny * e.strafeSign, vy = nx * e.strafeSign;
      if (e.tdist < d.preferredMin) { vx -= nx * 1.5; vy -= ny * 1.5; }
      const len = Math.sqrt(vx * vx + vy * vy) || 1;
      e.setVelocity((vx / len) * e.spd * 0.6, (vy / len) * e.spd * 0.6);
      return true;
    }
    m.steer(e, t, e.spd, ctx.rooms);
    return false;
  },

  shooter(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'move') {
      const inRange = ENEMY_AI.keepDistance(m, e, t, dt, ctx);
      if (inRange && e.attackCdMs <= 0) { m.setState(e, 'windup', d.windupMs); e.setVelocity(0, 0); }
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup' && e.stateMs <= 0) {
      m.shoot(e, ctx.enemyBullets);
      m.setState(e, 'recover', d.recoverMs);
      e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4);
    } else if (e.state === 'recover' && e.stateMs <= 0) {
      m.setState(e, 'move', 0);
    }
  },

  // Bomber: lobs a bomb at where you stand. Missed bombs sit on the floor and explode.
  bomber(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'move') {
      const inRange = ENEMY_AI.keepDistance(m, e, t, dt, ctx);
      if (inRange && e.attackCdMs <= 0) { m.setState(e, 'windup', d.windupMs); e.setVelocity(0, 0); }
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup' && e.stateMs <= 0) {
      if (ctx.hazards) ctx.hazards.lobBomb(e.x, e.y, t.sprite.x, t.sprite.y, d.bomb, e.dmgMul, e);
      m.setState(e, 'recover', d.recoverMs);
      e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4);
    } else if (e.state === 'recover' && e.stateMs <= 0) {
      m.setState(e, 'move', 0);
    }
  },

  charger(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'move') {
      if (e.hasLos && e.tdist < d.attackRange && e.attackCdMs <= 0) {
        m.setState(e, 'windup', d.windupMs);
        e.setVelocity(0, 0);
        m.aimDash(e);
        return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    if (e.state === 'windup') {
      e.setVelocity(0, 0);
      if (e.stateMs > d.lockMs) m.aimDash(e);
      if (e.stateMs <= 0) m.setState(e, 'dash', d.dashMs);
      return;
    }
    if (e.state === 'dash') {
      const sp = d.dashSpeed * e.slowMul;
      e.setVelocity(e.dashX * sp, e.dashY * sp);
      const hitWall = e.stateMs < d.dashMs - 60 && !e.body.blocked.none;
      if (e.stateMs <= 0 || hitWall) m.endDash(e);
      return;
    }
    if (e.state === 'recover') {
      e.setVelocity(0, 0);
      if (e.stateMs <= 0) m.setState(e, 'move', 0);
    }
  },

  // Gnome: weaves at you, stabs (a short fast dash), then runs away.
  gnome(m, e, t, dt, ctx) {
    const d = e.def;
    e.wiggle = (e.wiggle || Math.random() * 6) + dt / 1000 * 9;
    if (e.state === 'move') {
      if (e.hasLos && e.tdist < d.stabRange && e.attackCdMs <= 0) {
        m.aimDash(e);
        m.setState(e, 'dash', d.stabMs);
        return;
      }
      if (e.hasLos) {
        const nx = e.tdx / e.tdist, ny = e.tdy / e.tdist, w = Math.sin(e.wiggle) * d.zigzag;
        const vx = nx - ny * w, vy = ny + nx * w, l = Math.sqrt(vx * vx + vy * vy) || 1;
        e.setVelocity(vx / l * e.spd, vy / l * e.spd);
      } else m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    if (e.state === 'dash') {
      const sp = d.stabSpeed * e.slowMul;
      e.setVelocity(e.dashX * sp, e.dashY * sp);
      if (e.stateMs <= 0 || (e.stateMs < d.stabMs - 50 && !e.body.blocked.none)) {
        m.setState(e, 'flee', d.fleeMs);
        e.attackCdMs = d.attackCooldownMs;
      }
      return;
    }
    if (e.state === 'recover') {                 // its stab just hit someone: run!
      m.setState(e, 'flee', d.fleeMs);
      e.attackCdMs = d.attackCooldownMs;
    }
    if (e.state === 'flee') {
      const l = e.tdist || 1;
      e.setVelocity(-e.tdx / l * e.spd, -e.tdy / l * e.spd);
      if (e.stateMs <= 0) m.setState(e, 'move', 0);
      return;
    }
    m.setState(e, 'move', 0);
  },

  // Chained prisoner: with a partner, runs to one side of you so the chain
  // between them sweeps through you. Alone, it swings the chain like a flail.
  prisoner(m, e, t, dt, ctx) {
    const d = e.def;
    const ch = e.chain;
    const partner = ch ? (ch.a === e ? ch.b : ch.a) : null;
    if (partner && partner.active && partner.chain === ch) {
      if (!e.hasLos) { e.state = 'move'; m.steer(e, t, e.spd, ctx.rooms); return; }
      const sw = d.sweep;
      const lead = ch.a === e;                 // the 'a' prisoner runs the pair's plan
      const side = lead ? 1 : -1;
      const px = t.sprite.x, py = t.sprite.y;
      if (lead) {
        ch.modeMs -= dt * e.slowMul;
        if (ch.mode === 'line') {
          // direction from the pair's middle to the player
          const mx = (e.x + partner.x) / 2, my = (e.y + partner.y) / 2;
          let dx = px - mx, dy = py - my;
          const l = Math.sqrt(dx * dx + dy * dy) || 1;
          ch.dirX = dx / l; ch.dirY = dy / l;
          ch.cx = px - ch.dirX * sw.lineUpDist; ch.cy = py - ch.dirY * sw.lineUpDist;
          const ready = ch.readyA && ch.readyB;
          if (ready || ch.modeMs <= -sw.lineUpMaxMs) { ch.mode = 'windup'; ch.modeMs = sw.windupMs; }
        } else if (ch.mode === 'windup' && ch.modeMs <= 0) {
          ch.mode = 'sweep'; ch.modeMs = sw.sweepMs; ch.prog = 0;
        } else if (ch.mode === 'sweep') {
          ch.prog = Math.min(1, 1 - ch.modeMs / sw.sweepMs);
          if (ch.modeMs <= 0) { ch.mode = 'rest'; ch.modeMs = sw.restMs; }
        } else if (ch.mode === 'rest' && ch.modeMs <= 0) {
          ch.mode = 'line'; ch.modeMs = 0; ch.readyA = false; ch.readyB = false;
        }
      }
      const perpX = -ch.dirY, perpY = ch.dirX;
      let gx = ch.cx + perpX * sw.halfWidth * side, gy = ch.cy + perpY * sw.halfWidth * side;
      let speed = e.spd;
      if (ch.mode === 'sweep') {
        gx += ch.dirX * sw.sweepDist * Math.min(1, ch.prog + 0.25);
        gy += ch.dirY * sw.sweepDist * Math.min(1, ch.prog + 0.25);
        speed = e.spd * sw.sweepSpeedMul;
      }
      e.state = ch.mode === 'windup' ? 'windup' : (ch.mode === 'rest' ? 'recover' : 'move');
      if (ch.mode === 'windup' || ch.mode === 'rest') { e.setVelocity(0, 0); return; }
      const dx = gx - e.x, dy = gy - e.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (ch.mode === 'line') { if (lead) ch.readyA = len < 28; else ch.readyB = len < 28; }
      if (len > 4) { const v = Math.min(speed, len * 8); e.setVelocity(dx / len * v, dy / len * v); }
      else e.setVelocity(0, 0);
      return;
    }
    // alone: flail
    const f = d.flail;
    if (e.state === 'move') {
      if (e.hasLos && e.tdist < f.range && e.attackCdMs <= 0) {
        m.setState(e, 'windup', f.windupMs);
        e.swingAng = Math.atan2(e.tdy, e.tdx);
        e.setVelocity(0, 0);
        return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup') {
      if (e.stateMs > f.windupMs * 0.4) e.swingAng = Math.atan2(e.tdy, e.tdx);
      if (e.stateMs <= 0) m.setState(e, 'swing', f.swingMs);
    } else if (e.state === 'swing') {
      if (e.stateMs <= 0) { m.setState(e, 'recover', f.recoverMs); e.attackCdMs = f.cooldownMs; }
    } else if (e.state === 'recover' && e.stateMs <= 0) {
      m.setState(e, 'move', 0);
    }
  },

  // Gale: stands still and makes a whirlwind that pulls you in (dash out of it).
  gale(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'move') {
      if (e.tdist < d.attackRange && e.attackCdMs <= 0) {
        m.setState(e, 'windup', d.windupMs);
        e.setVelocity(0, 0);
        return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup' && e.stateMs <= 0) m.setState(e, 'whirl', d.whirlMs);
    else if (e.state === 'whirl') {
      // pull every player in range toward the gale
      for (let i = 0; i < ctx.players.length; i++) {
        const p = ctx.players[i];
        if (!p.alive) continue;
        const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 8) continue;
        let pull;
        if (dist > d.pullRadius) {
          if (!e.hasLos) continue;                       // far away: weak pull, only in plain sight
          pull = d.pullFar * e.slowMul;
        } else {
          const k = 1 - dist / d.pullRadius;
          pull = (d.pullMin + (d.pullMax - d.pullMin) * k) * e.slowMul;
        }
        p.pullX += dx / dist * pull;
        p.pullY += dy / dist * pull;
      }
      if (e.stateMs <= 0) { m.setState(e, 'recover', 400); e.attackCdMs = d.attackCooldownMs; }
    } else if (e.state === 'recover' && e.stateMs <= 0) {
      m.setState(e, 'move', 0);
    }
  },

  // Pyre Acolyte: gets close, shows a cone, then breathes a 120° arc of fire.
  warlock(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'move') {
      const inRange = e.hasLos && e.tdist <= d.preferredMax;
      if (inRange && e.attackCdMs <= 0) {
        m.setState(e, 'windup', d.windupMs);
        e.fireAng = Math.atan2(e.tdy, e.tdx);
        e.setVelocity(0, 0);
        return;
      }
      if (inRange && e.tdist < d.preferredMin) {
        const nx = e.tdx / e.tdist, ny = e.tdy / e.tdist;
        e.setVelocity(-nx * e.spd * 0.7, -ny * e.spd * 0.7);
        return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup') {
      if (e.stateMs > d.lockMs) e.fireAng = Math.atan2(e.tdy, e.tdx);
      if (e.stateMs <= 0) { m.setState(e, 'cast', d.castMs); e.fireHit = 0; }
    } else if (e.state === 'cast') {
      m.fireArc(e, ctx.players);
      if (e.stateMs <= 0) { m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4); }
    } else if (e.state === 'recover' && e.stateMs <= 0) {
      m.setState(e, 'move', 0);
    }
  },

  // Pyre Warlock (elite): far = arcs of fire bolts, close = fire breath.
  fireWarlock(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.state === 'move') {
      const close = e.hasLos && e.tdist <= d.closeRange;
      const far = e.hasLos && e.tdist <= d.preferredMax + 80;
      if ((close || far) && e.attackCdMs <= 0) {
        e.castClose = close;
        e.fireAng = Math.atan2(e.tdy, e.tdx);
        m.setState(e, 'windup', d.windupMs * (close ? 0.85 : 1));
        e.setVelocity(0, 0);
        return;
      }
      ENEMY_AI.keepDistance(m, e, t, dt, ctx);
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup') {
      if (e.stateMs > d.lockMs) e.fireAng = Math.atan2(e.tdy, e.tdx);
      if (e.stateMs <= 0) {
        if (e.castClose) { m.setState(e, 'cast', d.castMs); e.fireHit = 0; }
        else { m.setState(e, 'volley', d.arc.volleyGapMs * (d.arc.volleys - 1) + 120); e.volleysLeft = d.arc.volleys; e.volleyMs = 0; }
      }
    } else if (e.state === 'cast') {
      m.fireArc(e, ctx.players);
      if (e.stateMs <= 0) { m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4); }
    } else if (e.state === 'volley') {
      e.volleyMs -= dt * e.slowMul;
      if (e.volleysLeft > 0 && e.volleyMs <= 0) {
        // 2nd volley is offset by half a gap, so the holes move
        m.shootArc(e, ctx.enemyBullets, (d.arc.volleys - e.volleysLeft) % 2 ? 0.5 : 0);
        e.volleysLeft--; e.volleyMs = d.arc.volleyGapMs;
      }
      if (e.volleysLeft <= 0 && e.stateMs <= 0) { m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4); }
    } else if (e.state === 'recover' && e.stateMs <= 0) {
      m.setState(e, 'move', 0);
    }
  },

  // No target (out of range / hidden by a Camo Cloak): wander around slowly.
  idle(m, e, dt, ctx) {
    e.wanderMs -= dt;
    if (e.wanderMs <= 0 || !e.body.blocked.none) {
      e.wanderMs = 1200 + Math.random() * 1600;
      if (Math.random() < 0.35) { e.wanderX = 0; e.wanderY = 0; }        // stand a moment
      else { const a = Math.random() * Math.PI * 2; e.wanderX = Math.cos(a); e.wanderY = Math.sin(a); }
    }
    const sp = e.speed * 0.4 * e.slowMul;
    e.setVelocity(e.wanderX * sp, e.wanderY * sp);
  }
};

/* ---------- Manager ---------- */
class EnemyManager {
  constructor(scene, maxEnemies) {
    this.scene = scene;
    this.maxEnemies = maxEnemies;
    this.group = scene.physics.add.group({ maxSize: maxEnemies });
    this.level = 1;
    this.bossesBeaten = 0;
    this.onParry = null;     // set by the scene: (player, enemy) when a shield parries
    this.onPlayerHit = null; // set by the scene: (player, result, enemy) after any hit attempt
    this.onSpecialSpawn = null; // set by the scene: (def, x, y) for pairs and worms
    this.onSplit = null;     // set by the scene: (enemy) after an enemy split into smaller ones
    this.onDot = null;       // set by the scene: (enemy, damage, owner) for bleed damage
    this.onSpawned = null;   // set by the scene: (enemy) after every spawn (bestiary)
    this.allies = null;      // set by the scene: AllyManager.alive (wormlings enemies can target)
    this.hpMul = 1;
    this.dmgMul = 1;
    this._step = { x: 0, y: 0 };
    // stand-in target at the last seen position (used to finish an attack)
    this._ghost = { alive: true, sprite: { x: 0, y: 0 }, stats: { size: 20 }, isGhost: true };

    // Pre-create every enemy once (pool). Never destroyed during play.
    const firstType = Object.keys(ENEMY_TYPES)[0];
    for (let i = 0; i < maxEnemies; i++) {
      const e = this.group.create(-100, -100, 'enemy_' + firstType);
      e.isEnemy = true;
      e.setCollideWorldBounds(true);
      e.setDepth(5);
      e.disableBody(true, true);
    }

    // Pending spawns (the marker shown before an enemy appears)
    this.pending = [];
    for (let i = 0; i < maxEnemies; i++) {
      this.pending.push({ active: false, typeId: null, x: 0, y: 0, ms: 0, totalMs: 1 });
    }
    this.pendingCount = 0;
  }

  setLevel(level, levelCfg) {
    this.level = level;
    const dbg = GAME_CONFIG.debug;
    this.hpMul = (1 + (level - 1) * levelCfg.hpPerLevel) * (dbg.enemyHpPct || 100) / 100;
    this.dmgMul = (1 + (level - 1) * levelCfg.damagePerLevel) * (dbg.enemyDmgPct || 100) / 100;
  }

  canAppear(def, level) {
    if (!def.weight) return false;
    if (def.postBoss && this.bossesBeaten < def.postBoss) return false;
    return (def.minLevel || 1) <= level;
  }

  // Picks enemy types for a room. Only runs once per room, so arrays are fine here.
  buildWave(level, budget, maxCount) {
    const ids = [];
    for (const id in ENEMY_TYPES) {
      if (this.pool && this.pool.indexOf(id) < 0) continue;     // only this stage's enemies
      if (this.canAppear(ENEMY_TYPES[id], level)) ids.push(id);
    }
    const wave = [];
    let left = budget, elite = false;   // at most one elite per room
    let uniques = '';
    const ok = (def) => def.cost <= left && !(def.elite && elite) && !(def.unique && uniques.indexOf('|' + def.name) >= 0);
    while (wave.length < maxCount) {
      let total = 0;
      for (let i = 0; i < ids.length; i++) if (ok(ENEMY_TYPES[ids[i]])) total += ENEMY_TYPES[ids[i]].weight;
      if (total <= 0) break;
      let roll = Math.random() * total;
      for (let i = 0; i < ids.length; i++) {
        const def = ENEMY_TYPES[ids[i]];
        if (!ok(def)) continue;
        roll -= def.weight;
        if (roll <= 0) { wave.push(ids[i]); left -= def.cost; if (def.elite) elite = true; if (def.unique) uniques += '|' + def.name; break; }
      }
    }
    if (wave.length === 0 && ids.length > 0) wave.push(ids[0]);
    return wave;
  }

  queueSpawn(typeId, x, y, delayMs) {
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (p.active) continue;
      p.active = true; p.typeId = typeId; p.x = x; p.y = y;
      p.ms = delayMs; p.totalMs = Math.max(1, delayMs);
      this.pendingCount++;
      return true;
    }
    return false;
  }

  spawn(typeId, x, y) {
    const def = ENEMY_TYPES[typeId];
    if (!def) return null;
    if (def.pair || def.worm) { if (this.onSpecialSpawn) this.onSpecialSpawn(def, x, y); return null; }
    const e = this.group.getFirstDead(false);
    if (!e) return null; // pool full = enemy cap reached

    e.setTexture('enemy_' + typeId);
    e.enableBody(true, x, y, true, true);
    e.body.setSize(def.size, def.size, true);
    e.body.setMass(def.mass || 1);
    e.clearTint();
    e.setAlpha(1);
    e.def = def;
    e.typeId = typeId;
    e.maxHp = Math.round(def.maxHp * this.hpMul);
    e.hp = e.maxHp;
    e.dmgMul = this.dmgMul;
    e.speed = def.speed * (1 + (Math.random() * 2 - 1) * def.speedVariance);
    e.spd = e.speed;
    e.state = 'move';
    e.stateMs = 0;
    e.attackCdMs = 400 + Math.random() * (def.attackCooldownMs || 800);
    e.stunMs = 0;        // short knockback pause
    e.stunnedMs = 0;     // real stun (from parries): does nothing
    e.flashMs = 0;
    e.fxMs = 0;
    e.losMs = Math.random() * ENEMY_LOS_INTERVAL_MS;
    e.hasLos = false;
    e.strafeSign = Math.random() < 0.5 ? 1 : -1;
    e.strafeMs = 1000;
    e.dashX = 1; e.dashY = 0;
    e.dashGraceMs = 0;   // counts as "dashing" a bit after a dash ends (for melee parry)
    e.tdx = 0; e.tdy = 0; e.tdist = 1;
    // status effects
    e.slowMs = 0; e.slowPct = 0; e.slowMul = 1;
    e.bleedMs = 0; e.bleedTickMs = 0; e.bleedDmg = 0; e.bleedOwner = null;
    e.markMs = 0; e.markedBy = null;
    e.wallStunMs = 0; e.wallStunDur = 0;
    e.chain = null; e.swingAng = 0; e.fireAng = 0; e.fireHit = 0; e.hopMs = Math.random() * 1000;
    e.wanderMs = 0; e.wanderX = 0; e.wanderY = 0; e.seen = false; e.lastTX = x; e.lastTY = y;
    e.castClose = false; e.volleysLeft = 0; e.volleyMs = 0;
    // Phase 1 enemies (foes2.js) + champions / boss bars
    e.setScale(1); e.champion = false; e.barTag = 0;
    e.latchP = null; e.faceAng = Math.random() * Math.PI * 2; e.hops = 0; e.ballX = undefined; e.throwsLeft = 0; e.awareOf = null; e.awareMs = 0; e.frozenMs = 0; e.burnUntil = 0; e.chillUntil = 0; e.hexUntil = 0; e.reactAt = 0; e.cellsShownMs = 0; e.cells = null;
    e.tongueHit = 0; e.summoned = false; e.split = false; e.airTotal = 1;
    if (this.onSpawned) this.onSpawned(e);   // bestiary
    return e;
  }

  // Everything weapons and skills can hit: active enemies + surfaced boss
  // segments. Rebuilt into one reused array (no allocations).
  targets() {
    const out = this._targetList || (this._targetList = []);
    out.length = 0;
    const list = this.group.getChildren();
    for (let i = 0; i < list.length; i++) if (list[i].active) out.push(list[i]);
    if (this.extraTargets) this.extraTargets(out);
    return out;
  }

  countActive() {
    return this.group.countActive(true);
  }

  isEmpty() {
    return this.pendingCount === 0 && this.countActive() === 0;
  }

  clearAll() {
    const list = this.group.getChildren();
    for (let i = 0; i < list.length; i++) if (list[i].active) this.kill(list[i]);
    for (let i = 0; i < this.pending.length; i++) this.pending[i].active = false;
    this.pendingCount = 0;
  }

  /* ---------- status effects ---------- */
  slow(e, ms, pct) {
    if (e.isBossPart) return;
    if (ms > e.slowMs) e.slowMs = ms;
    if (pct > e.slowPct) e.slowPct = pct;
  }

  bleed(e, ms, tickDamage, owner) {
    if (e.isBossPart) return;
    e.bleedMs = Math.max(e.bleedMs, ms);
    e.bleedDmg = Math.max(e.bleedDmg, tickDamage);
    e.bleedOwner = owner;
    if (e.bleedTickMs <= 0) e.bleedTickMs = BLEED_TICK_MS;
  }

  mark(e, ms, owner) {
    e.markMs = ms;
    e.markedBy = owner;
  }

  // If knocked into a wall in the next `ms`, get stunned for `stunMs`
  wallStun(e, ms, stunMs) {
    if (e.isBossPart) return;
    e.wallStunMs = ms;
    e.wallStunDur = stunMs;
  }

  // ---- LOGIC ----
  update(dt, ctx) {
    this.updatePending(dt);

    const list = this.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;

      // statuses
      if (e.slowMs > 0) { e.slowMs -= dt; if (e.slowMs <= 0) e.slowPct = 0; }
      e.slowMul = 1 - e.slowPct;
      e.spd = e.speed * e.slowMul;
      if (e.markMs > 0) e.markMs -= dt;
      if (e.bleedMs > 0) {
        e.bleedMs -= dt;
        e.bleedTickMs -= dt;
        if (e.bleedTickMs <= 0) {
          e.bleedTickMs += BLEED_TICK_MS;
          if (this.onDot) this.onDot(e, e.bleedDmg, e.bleedOwner);
          if (!e.active) continue;
        }
      }
      if (e.wallStunMs > 0) {
        e.wallStunMs -= dt;
        if (e.stunMs > 0 && !e.body.blocked.none) {   // slammed into a wall while knocked back
          e.wallStunMs = 0;
          this.stun(e, e.wallStunDur);
          if (this.scene.hud) this.scene.hud.addFx(e.x, e.y, 22, 0xffffff, 200);
        }
      }

      if (e.stunnedMs > 0) {
        e.stunnedMs -= dt;
        if (e.stunMs > 0) e.stunMs -= dt;   // still sliding from a knockback
        else e.setVelocity(0, 0);
        continue;
      }
      // slowed enemies also attack slower
      e.stateMs -= dt * e.slowMul;
      if (e.attackCdMs > 0) e.attackCdMs -= dt * e.slowMul;
      if (e.dashGraceMs > 0) e.dashGraceMs -= dt;
      if (e.stunMs > 0) {
        e.stunMs -= dt;
        if (e.state === 'move') continue; // being knocked back
      }

      if (e.awareMs > 0) e.awareMs -= dt;
      let t = this.findNearestAlive(ctx.players, e.x, e.y, e);
      if (t) { e.lastTX = t.sprite.x; e.lastTY = t.sprite.y; e.seen = true; }
      else {
        // Nobody to chase. An attack that already started still finishes
        // (aimed at the last place it saw you), then it wanders around.
        if (e.chain && e.state !== 'move') { e.state = 'move'; e.stateMs = 0; }
        if (e.state === 'move' || !e.seen) { ENEMY_AI.idle(this, e, dt, ctx); continue; }
        const g = this._ghost;
        g.sprite.x = e.lastTX; g.sprite.y = e.lastTY;
        t = g;
      }

      e.tdx = t.sprite.x - e.x;
      e.tdy = t.sprite.y - e.y;
      e.tdist = Math.max(0.001, Math.sqrt(e.tdx * e.tdx + e.tdy * e.tdy));

      e.losMs -= dt;
      if (e.losMs <= 0) {
        e.losMs = ENEMY_LOS_INTERVAL_MS;
        e.hasLos = ctx.rooms.hasLineOfSight(e.x, e.y, t.sprite.x, t.sprite.y);
      }

      const ai = ENEMY_AI[e.def.ai] || ENEMY_AI.chase;
      ai(this, e, t, dt, ctx);
    }
  }

  updatePending(dt) {
    if (this.pendingCount === 0) return;
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (!p.active) continue;
      p.ms -= dt;
      if (p.ms <= 0) {
        p.active = false;
        this.pendingCount--;
        this.spawn(p.typeId, p.x, p.y);
      }
    }
  }

  setState(e, state, ms) {
    e.state = state;
    e.stateMs = ms;
  }

  // Walk toward the target: straight line if visible, else follow the path map.
  steer(e, t, speed, rooms) {
    let dx, dy;
    if (!e.hasLos && rooms.getFlowStep(e.x, e.y, this._step)) {
      dx = this._step.x - e.x; dy = this._step.y - e.y;
    } else {
      dx = e.tdx; dy = e.tdy;
    }
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) e.setVelocity((dx / len) * speed, (dy / len) * speed);
    else e.setVelocity(0, 0);
  }

  aimDash(e) {
    e.dashX = e.tdx / e.tdist;
    e.dashY = e.tdy / e.tdist;
  }

  endDash(e) {
    e.dashGraceMs = 300;
    e.setVelocity(0, 0);
    this.setState(e, 'recover', e.def.recoverMs);
    e.attackCdMs = e.def.attackCooldownMs;
  }

  shoot(e, bullets) {
    const d = e.def;
    const n = d.shots + Math.floor((this.level - 1) / d.extraShotEvery);
    const base = Math.atan2(e.tdy, e.tdx);
    const spread = d.spreadDeg * Math.PI / 180;
    const dmg = Math.round(d.bulletDamage * e.dmgMul);
    const off = d.size * 0.6;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const cx = Math.cos(a), cy = Math.sin(a);
      bullets.fire(e.x + cx * off, e.y + cy * off, cx, cy, d.bulletSpeed, dmg, d.bulletLifetimeMs, e);
    }
  }

  // Pyre Warlock: a wide arc of fire bolts (they set you on fire).
  shootArc(e, bullets, shift) {
    const a = e.def.arc;
    const spread = a.spreadDeg * Math.PI / 180;
    const step = spread / (a.count - 1);
    const dmg = Math.round(a.damage * e.dmgMul);
    const off = e.def.size * 0.6;
    for (let i = 0; i < a.count; i++) {
      const ang = e.fireAng - spread / 2 + (i + shift - (shift ? 0.5 : 0)) * step;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      const b = bullets.fire(e.x + cx * off, e.y + cy * off, cx, cy, a.speed, dmg, a.lifetimeMs, e, 'firebolt');
      if (b) { b.burnMs = a.burnMs; b.burnTick = Math.max(1, Math.round(a.burnTick * e.dmgMul)); }
    }
  }

  // Warlock fire arc: hits each player in the cone once per cast.
  fireArc(e, players) {
    const f = e.def.fire;
    const cosHalf = Math.cos((f.arcDeg / 2) * Math.PI / 180);
    const ax = Math.cos(e.fireAng), ay = Math.sin(e.fireAng);
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive || (e.fireHit & (1 << i))) continue;
      const dx = p.sprite.x - e.x, dy = p.sprite.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist > f.radius + p.stats.size / 2) continue;
      if ((dx * ax + dy * ay) / dist < cosHalf && dist > p.stats.size) continue;
      e.fireHit |= (1 << i);
      const res = p.takeHit(Math.round(f.damage * e.dmgMul), e.x, e.y);
      if (res === 'parry') { if (this.onParry) this.onParry(p, e); continue; }
      if (res === 'hit' || res === 'block') p.applyBurn(f.burnMs, Math.max(1, Math.round(f.burnTick * e.dmgMul)));
      if (this.onPlayerHit) this.onPlayerHit(p, res, e);
    }
  }

  damagePlayersInRadius(players, x, y, radius, amount, attacker) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const r = radius + p.stats.size / 2;
      const dx = p.sprite.x - x, dy = p.sprite.y - y;
      if (dx * dx + dy * dy > r * r) continue;
      const res = p.takeHit(Math.round(amount), x, y);
      if (res === 'parry' && this.onParry) this.onParry(p, attacker);
      else if (this.onPlayerHit) this.onPlayerHit(p, res, attacker);
    }
  }

  // Stops an enemy completely for ms (cancels any attack in progress).
  stun(e, ms) {
    if (e.isBossPart) { e.stunnedMs = Math.max(e.stunnedMs || 0, Math.min(ms, 600)); return; } // bosses only "count" as stunned
    if (e.def.boss || e.def.bossPart || e.def.miniBoss) ms = Math.min(ms, 250);   // big ones barely flinch
    else if (e.champion) ms = Math.min(ms, 600);
    if (e.state === 'latched') this.unlatch(e);
    if (ms > e.stunnedMs) e.stunnedMs = ms;
    e.state = 'move';
    e.stateMs = 0;
    if (!(e.stunMs > 0)) e.setVelocity(0, 0);
    if (e.attackCdMs < 500) e.attackCdMs = 500;
  }

  // Called when an enemy body touches a player body.
  handlePlayerContact(e, player) {
    if (e.stunnedMs > 0 || e.state === 'air' || e.state === 'latched') return;   // jumping bosses, leeches
    const d = e.def;
    const dashing = e.state === 'dash';
    if (!dashing && !d.contactDamage) return;
    const res = player.takeHit(Math.round((dashing ? d.dashDamage : d.contactDamage) * e.dmgMul), e.x, e.y);
    if (res === 'parry') { if (this.onParry) this.onParry(player, e); return; }
    if (this.onPlayerHit) this.onPlayerHit(player, res, e);
    if (e.stunnedMs > 0) return; // stunned by the hit (Amulet Robe)
    if (dashing) { this.endDash(e); return; }
    if (d.contactPushbackMs > 0 && e.state === 'move') {
      const dx = e.x - player.sprite.x, dy = e.y - player.sprite.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.push(e, dx / len, dy / len, d.contactPushback, d.contactPushbackMs);
    }
  }

  // Nearest target: players (unless hidden by a Camo Cloak) and allies.
  // e (optional): an enemy that was hit by a player knows where that player is for a while (no Camo cheese).
  findNearestAlive(players, x, y, e) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      const dx = p.sprite.x - x, dy = p.sprite.y - y;
      const d = dx * dx + dy * dy;
      if (p.stats.stealthRange > 0 && d > p.stats.stealthRange * p.stats.stealthRange && !(e && e.awareOf === p && e.awareMs > 0)) continue;
      if (d < bestD) { bestD = d; best = p; }
    }
    // allies (wormlings, hogs, the Prop Target) are targets too
    const al = this.allies;
    if (al) for (let i = 0; i < al.length; i++) {
      const a = al[i];
      if (!a.alive) continue;
      const dx = a.x - x, dy = a.y - y;
      let d = dx * dx + dy * dy;
      if (a.def.taunt) d *= 0.15;   // decoys are much more attractive
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  // Returns true if the enemy died. knockback/knockbackMs are optional
  // (the weapon's own values); enemies with hitKnockbackMs 0 never get pushed.
  damage(e, amount, dirX, dirY, knockback, knockbackMs) {
    e.hp -= amount;
    e.flashMs = 70;
    if (e.hp <= 0) { this.die(e); return true; }
    if (e.state === 'latched') this.unlatch(e);           // a leech lets go when hit
    if (e.champion) knockback = (knockback !== undefined ? knockback : e.def.hitKnockback) * 0.3;
    if (e.def.hitKnockbackMs > 0 && e.state === 'move') {
      const kb = knockback !== undefined ? knockback : e.def.hitKnockback;
      const ms = knockbackMs !== undefined ? knockbackMs : e.def.hitKnockbackMs;
      if (kb > 0) this.push(e, dirX, dirY, kb, ms);
    }
    return false;
  }

  // Killed (not just removed): splitting enemies make smaller ones.
  die(e) {
    const s = e.def.splitInto;
    const x = e.x, y = e.y;
    this.kill(e);
    if (!s) return;
    for (let i = 0; i < s.count; i++) {
      const a = (i / s.count) * Math.PI * 2 + Math.random();
      const c = this.spawn(s.type, x + Math.cos(a) * 10, y + Math.sin(a) * 10);
      if (c) this.push(c, Math.cos(a), Math.sin(a), 220, 200);
    }
    if (this.onSplit) this.onSplit(x, y);
  }

  coinsFor(e) {
    const c = e.def.coins || [0, 0];
    return c[0] + Math.floor(Math.random() * (c[1] - c[0] + 1));
  }

  push(e, dirX, dirY, speed, ms) {
    e.setVelocity(dirX * speed, dirY * speed);
    e.stunMs = ms;
  }

  kill(e) {
    e.disableBody(true, true);
  }

  // ---- VIEW ----
  updateView(dt) {
    const list = this.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      if (e.flashMs > 0) e.flashMs -= dt;
      if (e.fxMs > 0) e.fxMs -= dt;

      if (e.frozenMs > 0) e.frozenMs -= dt;
      if (e.flashMs > 0) e.setTintFill(0xffffff);
      else if (e.frozenMs > 0 && e.stunnedMs > 0) e.setTintFill(0xb3e5fc);   // Snowgrave: frozen solid
      else if (e.stunnedMs > 0) e.setTint(0x90a4ae);
      else if (e.hexUntil > this.scene.time.now) e.setTint(0xce93d8);          // hexed (Witch)
      else if (e.state === 'windup' && Math.floor(e.stateMs / 90) % 2 === 0) e.setTintFill(0xffd54f);
      else if (e.slowMs > 0) e.setTint(0xb0bec5);
      else if (e.bleedMs > 0) e.setTint(0xef9a9a);
      else e.clearTint();

      e.setAlpha(e.state === 'recover' && e.def.ai !== 'shooter' && e.def.ai !== 'bomber' ? 0.7 : 1);
    }
  }
}
