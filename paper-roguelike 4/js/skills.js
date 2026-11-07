/* skills.js
   SKILL_TYPES (data), SKILL_BEHAVIORS (what each "kind" does) and
   SkillSystem. Players have 2 skill slots (Q and E). Skills cost mana
   (affected by manaCostMul) and have a cooldown.

   Dash skills (Lunge, Onslaught, Kaan Sai) move the player for a moment:
   the player is invulnerable and passes through enemies, hitting each one
   once. The movement is handled by SkillSystem.updateDash(). */

const SKILL_TYPES = {
  /* ---- Knight ---- */
  minecart: {
    name: 'Minecart', short: 'CART', kind: 'minecart', class: 'melee', sub: 'Miner', price: 45, blueprint: 'gnome',
    desc: 'Ride a minecart where you aim for 1.4 s:\nrams enemies (22, big knockback), bounces off\nwalls twice and smashes blocks. Can\'t be hit.',
    manaCost: 30, cooldownMs: 9000,
    speed: 520, durationMs: 1400, damage: 22, knockback: 420, knockbackMs: 160, bounces: 2, rehitMs: 350
  },
  lunge: {
    name: 'Lunge', short: 'LUNG', kind: 'homingDash', class: 'melee', sub: 'Knight', price: 40, minLevel: 3,
    desc: 'Home through 2 + (your Knight items)\nenemies, piercing them. 2.5x your weapon\nhit with a Knight weapon, else 15.',
    manaCost: 25, cooldownMs: 5000,
    baseTargets: 2, maxTargets: 6, range: 380, speed: 950,
    knightMul: 2.5, fallbackDamage: 15, knockback: 200, knockbackMs: 100
  },
  onslaught: {
    name: 'Onslaught', short: 'ONSL', kind: 'flurry', class: 'melee', sub: 'Knight', price: 40, minLevel: 2,
    desc: 'Plant your feet: 5 rapid slashes in front\n(0.6x your sword hit each), the last one with\nbig knockback. Take 30% less damage meanwhile.',
    manaCost: 20, cooldownMs: 5000,
    hits: 5, intervalMs: 160, swordMul: 0.6, fallbackDamage: 6,
    range: 90, arcDeg: 130, knockback: 90, knockbackMs: 60, finalKnockback: 480, finalKnockbackMs: 200,
    guardEffect: 'flurryGuard'
  },
  /* ---- Monk ---- */
  kaanSai: {
    name: 'Kaan Sai', short: 'KAAN', italic: true, kind: 'homingDash', class: 'melee', sub: 'Monk', price: 40, minLevel: 3,
    desc: 'Auto-dash kick into every stunned enemy\nnearby (max 6), 30 damage each. Nothing\nstunned? Kicks the nearest enemy.',
    manaCost: 30, cooldownMs: 6000,
    stunnedOnly: true, maxTargets: 6, range: 400, speed: 1000,
    damage: 30, knockback: 260, knockbackMs: 120
  },
  auraPush: {
    name: 'Aura Push', short: 'PUSH', kind: 'push', class: 'melee', sub: 'Monk', price: 30, minLevel: 2,
    desc: 'Aura force field: stuns everything\nnearby for 1 s, very high knockback,\nlow damage (8).',
    manaCost: 25, cooldownMs: 6000,
    radius: 130, damage: 8, stunMs: 1000, knockback: 560, knockbackMs: 220
  },
  /* ---- Precision · Archer ---- */
  extraLoaded: {
    name: 'Extra Loaded', short: 'XLOD', kind: 'effect', class: 'precision', sub: 'Archer', price: 40, minLevel: 2,
    desc: 'For 10 s, every shot fires 3 arrows\n(one right after the other).\nCosts most of your mana.',
    manaCost: 70, cooldownMs: 18000, effect: 'extraLoaded'
  },
  propTarget: {
    name: 'Prop Target', short: 'PROP', kind: 'summon', class: 'precision', sub: 'Archer', price: 45, postBoss: POST_BOSS_1,
    desc: 'Set up a training target where you aim.\nEnemies go for it instead of you until\nit breaks (90 HP, 8 s).',
    manaCost: 35, cooldownMs: 12000, ally: 'decoy', count: 1, placeAtAim: 140
  },
  /* ---- Precision · Hunter ---- */
  hogCall: {
    name: 'Hog Call', short: 'HOGS', kind: 'summon', class: 'precision', sub: 'Hunter', price: 50, postBoss: POST_BOSS_1,
    desc: 'Call hogs that charge your enemies for 12 s:\n1 hog for every Hunter item you have\nequipped (max 5).',
    manaCost: 50, cooldownMs: 20000, ally: 'hog', countSub: 'Hunter', maxCount: 5
  },

  /* ---- BOSS LOOT · The Bookworm ---- */
  lockdown: {
    name: 'Lockdown', short: 'LOCK', kind: 'lockdown', class: 'boss', sub: 'Warden', price: 90, bossItem: 'warden',
    desc: 'Slam the cell doors: every enemy within\n230 px takes 12 and is locked in place for\n1.8 s (bosses only flinch).',
    manaCost: 45, cooldownMs: 11000,
    radius: 230, damage: 12, stunMs: 1800
  },
  burrow: {
    name: 'Burrow', short: 'BRRW', kind: 'burrow', class: 'boss', sub: 'Bookworm', price: 90, bossItem: 'bookworm',
    desc: 'Dig underground for 2 s: move freely, can\'t\nbe hit. Bursting back up hits everything\nnearby (35) with big knockback. Press again\nto come up early.',
    manaCost: 45, cooldownMs: 9000,
    durationMs: 2000, speedMul: 1.3,
    radius: 100, damage: 35, knockback: 480, knockbackMs: 220
  },

  /* ---- placeholders (to be remade) ---- */
  fireball: {
    name: 'Fireball', short: 'FIRE', kind: 'aoeShot', class: 'arcane', sub: 'Mage', price: 35,
    desc: 'Slow fireball that explodes for\n30 damage in an area.',
    manaCost: 25, cooldownMs: 3000,
    damage: 30, radius: 80, speed: 420, lifetimeMs: 1300, texture: 'fireball'
  },
  whirlwind: {
    name: 'Whirlwind', short: 'SPIN', kind: 'spin', class: 'melee', sub: 'Berserker', price: 35,
    desc: 'Spin attack that hits every\nenemy around you for 26.',
    manaCost: 20, cooldownMs: 4000,
    damage: 26, range: 100, arcDeg: 360, knockback: 320, knockbackMs: 140
  }
};

// Returns false if the skill could not be used (then no mana/cooldown is spent).
const SKILL_BEHAVIORS = {
  aoeShot(p, d, ctx) {
    const b = WeaponSystem.shoot(p, ctx, p.input.aimX, p.input.aimY, d.speed,
      Math.round(d.damage * p.stats.damageMul), d.lifetimeMs, d.texture);
    if (b) b.aoeRadius = d.radius;
    return true;
  },
  spin(p, d, ctx) {
    WeaponSystem.meleeArc(p, d, ctx, false, null);
    p.spinFxMs = 220;
    p.spinRange = d.range;
    return true;
  },
  fan(p, d, ctx) {
    const base = Math.atan2(p.input.aimY, p.input.aimX);
    const step = d.spreadDeg * Math.PI / 180;
    const dmg = Math.round(d.damage * p.stats.damageMul);
    for (let i = 0; i < d.count; i++) {
      const a = base + (i - (d.count - 1) / 2) * step;
      WeaponSystem.shoot(p, ctx, Math.cos(a), Math.sin(a), d.speed, dmg, d.lifetimeMs, d.texture);
    }
    return true;
  },
  barrier(p, d, ctx) {
    p.barrierHp = d.absorb;
    p.barrierMs = d.durationMs;
    return true;
  },

  push(p, d, ctx) {
    const list = ctx.enemies.targets();
    const r = d.radius;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y;
      const rr = r + e.def.size / 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), dx / len, dy / len, 0, 0, p);
      if (!e.active) continue;
      ctx.stunEnemy(e, d.stunMs);
      ctx.knockEnemy(e, dx / len, dy / len, d.knockback, d.knockbackMs);
    }
    ctx.fx(p.sprite.x, p.sprite.y, r, 0xffd54f, 300);
    return true;
  },

  // Lunge / Kaan Sai: dash from enemy to enemy.
  homingDash(p, d, ctx) {
    const targets = [];
    const list = ctx.enemies.targets();
    let count = d.maxTargets;
    if (d.baseTargets !== undefined) count = Math.min(d.maxTargets, d.baseTargets + Stats.countSub(p, 'Knight'));

    // Candidates in range (stunned only for Kaan Sai)
    const cands = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      if (d.stunnedOnly && !(e.stunnedMs > 0)) continue;
      const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y;
      if (dx * dx + dy * dy <= d.range * d.range) cands.push(e);
    }
    if (d.stunnedOnly && cands.length === 0) {
      // Nothing stunned: kick the nearest enemy
      let best = null, bd = d.range * d.range;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.active) continue;
        const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y;
        const dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = e; }
      }
      if (best) cands.push(best);
      count = 1;
    }
    if (cands.length === 0) return false;

    // Greedy path: always go to the closest remaining target
    let cx = p.sprite.x, cy = p.sprite.y;
    while (targets.length < count && cands.length > 0) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < cands.length; i++) {
        const dx = cands[i].x - cx, dy = cands[i].y - cy;
        const dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; bi = i; }
      }
      const e = cands.splice(bi, 1)[0];
      targets.push(e);
      cx = e.x; cy = e.y;
    }

    let dmg;
    if (d.knightMul) {
      const wd = p.weapon ? p.weapon.def : null;
      dmg = (wd && wd.sub === 'Knight' && wd.damage) ? wd.damage * d.knightMul : d.fallbackDamage;
    } else {
      dmg = d.damage;
    }
    SkillSystem.startDash(p, { mode: 'targets', targets: targets, index: 0, speed: d.speed,
      damage: Math.round(dmg * p.stats.damageMul), knockback: d.knockback, knockbackMs: d.knockbackMs,
      msLeft: 400, totalMs: 2500, hit: [] });
    return true;
  },

  // Timed buff on yourself (Extra Loaded)
  effect(p, d, ctx) {
    p.addEffect(d.effect);
    ctx.fx(p.sprite.x, p.sprite.y, 30, 0x43a047, 250);
    return true;
  },

  // Summons allies (Prop Target, Hog Call)
  summon(p, d, ctx) {
    let n = d.count || 1;
    if (d.countSub) n = Math.max(1, Math.min(d.maxCount, Stats.countSub(p, d.countSub)));
    let x = p.sprite.x, y = p.sprite.y;
    if (d.placeAtAim) {
      // as far toward the aim as possible without going into a wall
      for (let r = d.placeAtAim; r >= 0; r -= 20) {
        const tx = p.sprite.x + p.input.aimX * r, ty = p.sprite.y + p.input.aimY * r;
        if (!ctx.rooms.solidAt(tx, ty)) { x = tx; y = ty; break; }
      }
    }
    let made = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (ctx.allies.spawn(d.ally, x + (d.placeAtAim ? 0 : Math.cos(a) * 24), y + (d.placeAtAim ? 0 : Math.sin(a) * 24), p)) made++;
    }
    if (made) ctx.fx(x, y, 28, 0x8d6e63, 260);
    return made > 0;
  },

  // Burrow: go underground (handled in Player.update), burst up at the end.
  burrow(p, d, ctx) {
    p.burrow = { def: d, ms: d.durationMs };
    ctx.fx(p.sprite.x, p.sprite.y, 30, 0x6d4c41, 250);
    return true;
  },

  // Onslaught: stand still and slash rapidly in front (handled in updateFlurry).
  flurry(p, d, ctx) {
    const wd = p.weapon ? p.weapon.def : null;
    const isSword = wd && wd.type === 'sword';
    const per = isSword ? wd.damage * d.swordMul : d.fallbackDamage;
    p.flurry = {
      def: d, left: d.hits, timerMs: 0, side: 1,
      damage: Math.round(per * p.stats.damageMul),
      range: isSword ? Math.max(d.range, wd.range) : d.range,
      arcDeg: isSword ? Math.max(d.arcDeg, wd.arcDeg) : d.arcDeg
    };
    if (d.guardEffect) p.addEffect(d.guardEffect);
    return true;
  },

  // Straight dash through enemies (unused for now; kept for future skills).
  lockdown(p, d, ctx) {
    const list = ctx.enemies.targets();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y, r = d.radius + e.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), 0, 0, 0, 0, p);
      if (e.active) { ctx.stunEnemy(e, d.stunMs); ctx.fx(e.x, e.y, e.def.size / 2 + 10, 0x455a64, 500); }
    }
    ctx.fx(p.sprite.x, p.sprite.y, d.radius, 0x455a64, 350);
    if (ctx.shake) ctx.shake(160, 0.006);
    return true;
  },

  minecart(p, d, ctx) {
    SkillSystem.startDash(p, { mode: 'cart', def: d, dirX: p.input.aimX, dirY: p.input.aimY, speed: d.speed,
      msLeft: d.durationMs, totalMs: d.durationMs + 200, bounces: d.bounces, hitRadius: 26,
      damage: Math.round(d.damage * p.stats.damageMul), knockback: d.knockback, knockbackMs: d.knockbackMs,
      hit: [], hitAt: [], vulnerable: false });
    return true;
  },

  lineDash(p, d, ctx) {
    const wd = p.weapon ? p.weapon.def : null;
    const dmg = (wd && wd.type === 'sword') ? wd.damage * d.swordMul : d.fallbackDamage;
    SkillSystem.startDash(p, { mode: 'line', dirX: p.input.aimX, dirY: p.input.aimY, speed: d.speed,
      msLeft: d.distance / d.speed * 1000, totalMs: 1000, hitRadius: d.hitRadius,
      damage: Math.round(dmg * p.stats.damageMul), knockback: d.knockback, knockbackMs: d.knockbackMs, hit: [] });
    return true;
  }
};

const SkillSystem = {
  // Tries to use the skill in slot 0 or 1. Returns true if it was used.
  tryUse(p, slot, ctx) {
    const d = Catalog.get('skill', p.skills[slot]);
    if (p.burrow) {   // pressing Burrow again while underground = come up now
      if (d && d.kind === 'burrow') p.burrow.ms = 0;
      return false;
    }
    if (!d || p.skillCdMs[slot] > 0 || p.skillDash || p.flurry) return false;
    const cost = d.manaCost * p.stats.manaCostMul;
    if (p.mana < cost) return false;
    const fn = SKILL_BEHAVIORS[d.kind];
    if (!fn || !fn(p, d, ctx)) return false;
    p.spendMana(cost);
    p.skillCdTotal[slot] = d.cooldownMs * p.stats.skillCooldownMul;
    p.skillCdMs[slot] = p.skillCdTotal[slot];
    return true;
  },

  startDash(p, dash) {
    p.skillDash = dash;
  },

  // Onslaught flurry: one slash every intervalMs. Returns true while active.
  updateFlurry(p, dt, ctx) {
    const f = p.flurry;
    if (!f) return false;
    p.sprite.setVelocity(0, 0);
    f.timerMs -= dt;
    if (f.timerMs > 0) return true;
    const d = f.def;
    const last = f.left === 1;
    const h = { damage: f.damage, range: f.range, arcDeg: f.arcDeg,
                knockback: last ? d.finalKnockback : d.knockback, knockbackMs: last ? d.finalKnockbackMs : d.knockbackMs };
    WeaponSystem.meleeArc(p, h, ctx, false, null);
    p.flurryFxMs = last ? 200 : 130;
    p.flurryAngle = Math.atan2(p.input.aimY, p.input.aimX) + f.side * 0.35;
    p.flurryRange = f.range; p.flurryArc = f.arcDeg; p.flurryLast = last;
    f.side = -f.side;
    f.left--;
    f.timerMs = d.intervalMs;
    if (f.left <= 0) p.flurry = null;
    return true;
  },

  // Moves the player during a dash skill. Returns true while dashing.
  updateDash(p, dt, ctx) {
    const s = p.skillDash;
    if (!s) return false;
    s.totalMs -= dt;
    const px = p.sprite.x, py = p.sprite.y;

    if (s.mode === 'targets') {
      // Skip dead targets
      while (s.index < s.targets.length && !s.targets[s.index].active) { s.index++; s.msLeft = 400; }
      if (s.index >= s.targets.length || s.totalMs <= 0) { this.endDash(p); return false; }
      const e = s.targets[s.index];
      const dx = e.x - px, dy = e.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      s.msLeft -= dt;
      if (dist < 26 + e.def.size / 2 || s.msLeft <= 0) {
        if (dist < 60 + e.def.size / 2) {
          ctx.hitEnemy(e, s.damage, dx / dist, dy / dist, s.knockback, s.knockbackMs, p);
          SkillSystem.tryExecute(p, e, s, ctx);
          ctx.fx(e.x, e.y, 26, 0xffffff, 160);
        }
        s.index++;
        s.msLeft = 400;
        return true;
      }
      p.sprite.setVelocity(dx / dist * s.speed, dy / dist * s.speed);
      p.dashTrailMs = 120;
      return true;
    }

    // minecart: rolls straight, bounces off walls (breaking blocks), rams enemies
    if (s.mode === 'cart') {
      s.msLeft -= dt;
      if (s.msLeft <= 0) { this.endDash(p); return false; }
      const b = p.sprite.body.blocked;
      if (!b.none && s.msLeft < s.def.durationMs - 60) {
        if (ctx.mineAt) ctx.mineAt(p, s.dirX, s.dirY, 46);
        if (s.bounces-- <= 0) { this.endDash(p); return false; }
        if (b.left || b.right) s.dirX = -s.dirX;
        if (b.up || b.down) s.dirY = -s.dirY;
        if (ctx.shake) ctx.shake(80, 0.004);
      }
      p.sprite.setVelocity(s.dirX * s.speed, s.dirY * s.speed);
      p.dashTrailMs = 120;
      const now = s.def.durationMs - s.msLeft;
      const list = ctx.enemies.targets();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.active || (e.isBossPart && !e.surfaced)) continue;
        const dx = e.x - px, dy = e.y - py, r = s.hitRadius + e.def.size / 2;
        if (dx * dx + dy * dy > r * r) continue;
        const k = s.hit.indexOf(e);
        if (k !== -1 && now - s.hitAt[k] < s.def.rehitMs) continue;
        if (k === -1) { s.hit.push(e); s.hitAt.push(now); } else s.hitAt[k] = now;
        const l = Math.sqrt(dx * dx + dy * dy) || 1;
        ctx.hitEnemy(e, s.damage, dx / l, dy / l, s.knockback, s.knockbackMs, p);
      }
      return true;
    }

    // line
    s.msLeft -= dt;
    if (s.msLeft <= 0 || s.totalMs <= 0) { this.endDash(p); return false; }
    p.sprite.setVelocity(s.dirX * s.speed, s.dirY * s.speed);
    p.dashTrailMs = 120;
    const list = ctx.enemies.targets();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || s.hit.indexOf(e) !== -1) continue;
      const dx = e.x - px, dy = e.y - py;
      const r = s.hitRadius + e.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      s.hit.push(e);
      // Knock sideways-forward away from the path
      const side = (dx * s.dirY - dy * s.dirX) >= 0 ? 1 : -1;
      const kx = s.dirX * 0.6 + s.dirY * side * 0.8, ky = s.dirY * 0.6 - s.dirX * side * 0.8;
      const kl = Math.sqrt(kx * kx + ky * ky) || 1;
      ctx.hitEnemy(e, s.damage, kx / kl, ky / kl, s.knockback, s.knockbackMs, p);
      SkillSystem.tryExecute(p, e, s, ctx);
    }
    return true;
  },

  // Execute (finish off a normal enemy that is low enough). Returns true if it did.
  tryExecute(p, e, s, ctx) {
    if (!s.execute || !e.active || e.isBossPart) return false;
    if (e.hp <= e.maxHp * s.execute) {
      ctx.hitEnemy(e, e.hp + 1, 0, 0, 0, 0, p);
      ctx.fx(e.x, e.y, 30, 0xc62828, 220);
      return true;
    }
    return false;
  },

  // Comes back up from Burrow: damage + knockback around the player.
  emerge(p, ctx) {
    const d = p.burrow.def;
    p.burrow = null;
    const list = ctx.enemies.targets();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y;
      const r = d.radius + e.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), dx / len, dy / len, d.knockback, d.knockbackMs, p);
    }
    ctx.fx(p.sprite.x, p.sprite.y, d.radius, 0x8d6e63, 320);
    if (ctx.shake) ctx.shake(160, 0.006);
    if (ctx.hole) ctx.hole(p.sprite.x, p.sprite.y);
    p.invulnMs = Math.max(p.invulnMs, 250);
  },

  endDash(p) {
    p.skillDash = null;
    p.sprite.setVelocity(0, 0);
    p.invulnMs = Math.max(p.invulnMs, 150);
  }
};
