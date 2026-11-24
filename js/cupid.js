/* cupid.js
   Cupid (Arcane subclass, designed by Nicolas).

   Lovestruck ("Apaixonado"): a charmed enemy can't hurt you and follows you
   around for 5-10 s. Ranged and odd-moving enemies stop their attack
   patterns too. When it wears off, Heartbreak ("Decepção Amorosa") hits it
   hard. Bosses (and mini-bosses / champions) get a shorter, reduced version:
   they aim their attacks at random other enemies (hurting them), or at a
   spot far away from you if they're alone. Worm bosses are immune.

   Love bar: some hits fill a pink bar over the enemy; full = Lovestruck.

   Weapons (weakest to strongest): Harp ★, Heart Wand ★★,
   Cupid's Bow "My Pretty Valentine" ★★★ (counts as an Archer bow too, and
   gets much stronger with every other Cupid item you have).
   Skills: Wing Flap ★, Cupid's Flight ★★, Cupid's Book ★★★.

   CupidMixin goes onto GameScene: setupCupid / updateCupid / cupidRoom. */

const LOVE_RULES = {
  minMs: 5000, maxMs: 10000, bossMul: 0.5,           // bosses: half as long
  heartbreakFlat: 30, heartbreakPct: 0.20,           // Heartbreak = 30 + 20% of max HP
  bossHeartbreakPct: 0.04,                           // bosses: 4% of max HP
  barDecayPerSec: 0.25,                              // the love bar drains slowly if you stop
  barHoldMs: 3000,                                   // ...after 3 s without a new hit
  followDist: 56,
  decoyMs: 1500,                                     // a lovestruck boss picks a new target this often
  bossSplashMul: 2                                   // a lovestruck boss's hits on other enemies
};

Object.assign(STAT_DEFAULTS, { loveTime: 0, heartbreak: 0, loveCharge: 0 });

/* ---------------- gear ---------------- */
Object.assign(WEAPON_TYPES, {
  harp: {
    name: 'Harp', short: 'HARP', kind: 'harp', class: 'arcane', sub: 'Cupid', type: 'harp', price: 35,
    desc: 'Strum a wide wave of sound right in\nfront of you: hits everything in the\narc hard (34). Slow to play. Uses mana.',
    damage: 34, range: 96, arcDeg: 150, cooldownMs: 680, manaCost: 5, knockback: 260, knockbackMs: 130, swingFxMs: 260,
    visual: { style: 'harp', color: 0xffca28, string: 0xfff8e1 }
  },
  heartWand: {
    name: 'Heart Wand', short: 'LOVE', kind: 'projectile', class: 'arcane', sub: 'Cupid', type: 'wand', price: 85, postBoss: POST_BOSS_1,
    desc: 'Shoots little hearts (9), slowly.\n12% chance: Lovestruck for 5-10 s\n(can\'t hurt you, follows you), then\nHeartbreak hits it hard.',
    damage: 9, speed: 520, lifetimeMs: 760, fireDelayMs: 460, manaCost: 3, texture: 'heart', love: { chance: 0.12 },
    visual: { style: 'stick', length: 18, color: 0xf48fb1, orb: 0xec407a, orbSize: 5 }
  },
  cupidBow: {
    name: "Cupid's Bow", short: 'CUPD', kind: 'charge', class: 'arcane', sub: 'Cupid', type: 'bow', price: 150, postBoss: POST_BOSS_2,
    hybrid: { class: 'precision', sub: 'Archer' },
    desc: '"My Pretty Valentine". Archer AND mage\nbow: charged arrows hit hard (85) and fill\nthe love bar (3 hits = Lovestruck).\nEvery other Cupid item: +15% damage,\n+10% charge speed, love fills faster.',
    fullChargeMs: 900, pierceChargeMs: 1800,
    minDamage: 8, maxDamage: 40, minSpeed: 420, maxSpeed: 720,
    fullDamage: 85, fullSpeed: 1000, pierceCount: 3,
    cooldownMs: 300, lifetimeMs: 1700, texture: 'loveArrow',
    love: { charge: 0.34 },
    cupidScale: { damageMul: 0.15, chargeSpeedMul: 0.10, loveCharge: 0.10 },
    visual: { style: 'bow', color: 0xec407a, size: 16 }
  }
});

Object.assign(SKILL_TYPES, {
  wingFlap: {
    name: 'Wing Flap', short: 'FLAP', kind: 'flap', class: 'arcane', sub: 'Cupid', price: 35,
    desc: 'Beat your wings: pushes everything\nnearby away (6 damage). Enemies that\nhit a wall take 22 more and are\nstunned for 1.2 s.',
    manaCost: 15, cooldownMs: 5000, radius: 120, damage: 6, knockback: 540, knockbackMs: 220, wallStun: 1200, wallDamage: 22
  },
  cupidsFlight: {
    name: "Cupid's Flight", short: 'FLY', kind: 'flight', class: 'arcane', sub: 'Cupid', price: 85, postBoss: POST_BOSS_1,
    desc: 'A long dash that flies through walls\nand enemies. Leaves a pink trail for\n4 s: enemies on it fill their love bar.',
    manaCost: 20, cooldownMs: 6000, distance: 300, flyMs: 240, trailMs: 4000, trailCharge: 0.25, trailTickMs: 400
  },
  cupidsBook: {
    name: "Cupid's Book", short: 'BOOK', kind: 'loveAll', class: 'arcane', sub: 'Cupid', price: 145, postBoss: POST_BOSS_2,
    desc: 'Read a love poem out loud: every enemy\nnearby is Lovestruck at once (12\ndamage). Bosses: the reduced version.',
    manaCost: 75, cooldownMs: 16000, radius: 240, damage: 12
  }
});

// Cupid set (only weapons and skills so far, so it tops out at 4)
SET_BONUSES.Cupid = [[2, '+20 max mana, love fills 15% faster', { maxMana: 20, loveCharge: 0.15 }],
                     [4, 'Lovestruck lasts 25% longer, Heartbreak +50%', { loveTime: 0.25, heartbreak: 0.5 }]];

// Hybrid weapons (Cupid's Bow) also count as their hybrid class / sub class for item bonuses.
(function () {
  const matches = Stats.matches;
  Stats.matches = function (cond, w) {
    if (matches.call(this, cond, w)) return true;
    return !!(w && w.hybrid && matches.call(this, cond, Object.assign({}, w, w.hybrid)));
  };
  // Cupid's Bow: stronger for every OTHER Cupid item you have equipped
  const build = Stats.build;
  Stats.build = function (player) {
    const s = build.call(Stats, player);
    const wd = player.weapon ? player.weapon.def : null;
    if (wd && wd.cupidScale) {
      const n = Math.max(0, Stats.countSub(player, wd.sub) - 1);
      for (const k in wd.cupidScale) s[k] = (s[k] || 0) + wd.cupidScale[k] * n;
    }
    return s;
  };
  // love travels on bullets and arrows
  const applyShot = GearFx.applyShot;
  GearFx.applyShot = function (b, sh) { applyShot.call(this, b, sh); b.love = sh.love || null; };
  const applyAll = GearFx.applyAll;
  GearFx.applyAll = function (scene, e, o, owner, dmg) {
    applyAll.call(this, scene, e, o, owner, dmg);
    if (o.love && e.active) LoveFx.onHit(scene, e, o.love, owner);
  };
  const fireArrow = WeaponSystem.fireArrow;
  WeaponSystem.fireArrow = function (p) {
    const b = fireArrow.apply(this, arguments);
    if (b) b.love = (p.weapon && p.weapon.def.love) || null;
    return b;
  };
  const fire = ProjectileManager.prototype.fire;
  ProjectileManager.prototype.fire = function () {
    const b = fire.apply(this, arguments);
    if (b) b.love = null;
    return b;
  };
  // textures
  const make = Arcane3bTextures.make;
  Arcane3bTextures.make = function (scene) { make.call(this, scene); CupidTextures.make(scene); };
})();

const CupidTextures = {
  heartPts(g, cx, cy, r) {
    g.fillCircle(cx - r * 0.5, cy - r * 0.2, r * 0.55);
    g.fillCircle(cx + r * 0.5, cy - r * 0.2, r * 0.55);
    g.fillTriangle(cx - r * 1.02, cy, cx + r * 1.02, cy, cx, cy + r * 1.05);
  },
  make(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    W('heart', 14, 14, (g) => {
      g.fillStyle(0xad1457, 1); CupidTextures.heartPts(g, 7, 6, 6.5);
      g.fillStyle(0xf06292, 1); CupidTextures.heartPts(g, 7, 6, 5);
      g.fillStyle(0xfce4ec, 1); g.fillCircle(4.5, 4.5, 1.4);
    });
    W('soundwave', 22, 22, (g) => {
      g.lineStyle(3, 0xffca28, 1); g.beginPath(); g.arc(4, 11, 12, -0.9, 0.9); g.strokePath();
      g.lineStyle(2, 0xfff8e1, 0.9); g.beginPath(); g.arc(4, 11, 7, -0.8, 0.8); g.strokePath();
    });
    W('loveArrow', 26, 8, (g) => {
      g.lineStyle(2, 0xf8bbd0, 1); g.lineBetween(2, 4, 19, 4);
      g.fillStyle(0xec407a, 1); g.fillTriangle(16, 0, 26, 4, 16, 8);
      g.fillStyle(0xffffff, 1); g.fillTriangle(0, 0, 6, 4, 0, 4); g.fillTriangle(0, 8, 6, 4, 0, 4);
    });
  }
};

// Harp: a close-range strum. A wide arc of sound right in front of you (see HUD.drawHarpSwing for the look).
WEAPON_BEHAVIORS.harp = function (p, w, dt, ctx) {
  const d = w.def, s = p.stats;
  if (w.cooldownMs > 0) w.cooldownMs -= dt;
  if (!p.input.attack || w.cooldownMs > 0) return;
  if (!p.spendMana(d.manaCost * s.manaCostMul)) return;
  w.cooldownMs = d.cooldownMs / s.attackSpeedMul;
  w.swingAngle = Math.atan2(p.input.aimY, p.input.aimX);
  w.swingKind = 'normal'; w.swingRange = d.range; w.swingArc = d.arcDeg; w.swingFxMs = d.swingFxMs;
  w.harpSeed = Math.random() * 10;
  WeaponSystem.meleeArc(p, d, ctx, false, w);
  if (ctx.lightArc) ctx.lightArc(p, d.range);
};

/* ---------------- Lovestruck ---------------- */
const LoveFx = {
  immune(e) {
    return !e || !e.active || e.isBossPart || e.state === 'bones' || e.state === 'dust' || (e.def && e.def.noLove);
  },
  onHit(scene, e, love, owner) {
    if (love.chance && Math.random() < love.chance) this.apply(scene, e, owner);
    if (love.charge) this.charge(scene, e, love.charge * (1 + ((owner && owner.stats && owner.stats.loveCharge) || 0)), owner);
  },
  charge(scene, e, amount, owner) {
    if (this.immune(e) || e.loveUntil > 0) return;
    e.loveBar = (e.loveBar || 0) + amount;
    e.loveBarMs = LOVE_RULES.barHoldMs;
    if (e.loveBar >= 1) { e.loveBar = 0; this.apply(scene, e, owner); }
  },
  apply(scene, e, owner) {
    if (this.immune(e)) return;
    const boss = GearFx.isBoss(e), now = scene.time.now;
    let ms = LOVE_RULES.minMs + Math.random() * (LOVE_RULES.maxMs - LOVE_RULES.minMs);
    ms *= 1 + ((owner && owner.stats && owner.stats.loveTime) || 0);
    if (boss) ms *= LOVE_RULES.bossMul;
    if (e.loveUntil > 0) { e.loveUntil = Math.max(e.loveUntil, now + ms); return; }
    e.loveUntil = now + ms; e.loveBoss = boss; e.loveOwner = owner || null; e.loveBar = 0; e.loveDecoyAt = 0;
    if (!boss) { e.state = 'move'; e.stateMs = 0; if (e.chain) e.chain = null; }   // drops whatever it was doing
    if (scene.hud) {
      scene.hud.floatText(e.x, e.y - e.def.size / 2 - 12, 'Lovestruck!', '#ec407a');
      scene.hud.addFx(e.x, e.y, e.def.size / 2 + 14, 0xf06292, 260);
    }
  },
  // Called from the enemy update loop. Returns true when it handled the enemy this frame (skip its AI).
  step(m, e, dt, ctx) {
    const scene = m.scene;
    // fell into a pile of bones (Necrotery skeletons): the love is over, no Heartbreak; the bones get up as normal
    if (e.state === 'bones' || e.state === 'dust') { e.loveUntil = 0; e.loveBoss = false; e.loveOwner = null; e.loveDecoy = null; return false; }
    if (scene.time.now >= e.loveUntil) { this.heartbreak(scene, e); return !e.active; }
    if (e.loveBoss) return false;
    const t = m.findNearestAlive(ctx.players, e.x, e.y, e);
    e.state = 'move';
    if (!t) { e.setVelocity(0, 0); return true; }
    const dx = t.sprite.x - e.x, dy = t.sprite.y - e.y;
    // steer() reads these: keep them fresh, or it walks toward where you were when it got charmed
    e.tdx = dx; e.tdy = dy; e.tdist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    e.losMs -= dt;
    if (e.losMs <= 0) { e.losMs = ENEMY_LOS_INTERVAL_MS; e.hasLos = ctx.rooms.hasLineOfSight(e.x, e.y, t.sprite.x, t.sprite.y); }
    if (dx * dx + dy * dy > LOVE_RULES.followDist * LOVE_RULES.followDist) m.steer(e, t, Math.max(60, e.spd) * 0.9, ctx.rooms);
    else e.setVelocity(0, 0);
    return true;
  },
  heartbreak(scene, e) {
    const owner = e.loveOwner, boss = e.loveBoss;
    e.loveUntil = 0; e.loveBoss = false; e.loveOwner = null; e.loveDecoy = null;
    if (!e.active) return;
    const base = boss ? e.maxHp * LOVE_RULES.bossHeartbreakPct : LOVE_RULES.heartbreakFlat + e.maxHp * LOVE_RULES.heartbreakPct;
    const mul = owner && owner.stats ? owner.stats.damageMul * (1 + (owner.stats.heartbreak || 0)) : 1;
    if (scene.hud) {
      scene.hud.floatText(e.x, e.y - e.def.size / 2 - 12, 'Heartbreak', '#ad1457');
      scene.hud.addFx(e.x, e.y, e.def.size / 2 + 18, 0xad1457, 300);
    }
    scene.hitEnemy(e, Math.round(base * mul), 0, 0, 0, 0, owner, 'love');
  },
  // A lovestruck boss chases and attacks a decoy: a random other enemy, or a spot far from the players.
  decoy(m, e, ctx) {
    const now = m.scene.time.now;
    if (!e.loveDecoy) e.loveDecoy = { alive: true, sprite: { x: 0, y: 0 }, stats: { size: 20 }, isGhost: true, foe: null };
    const d = e.loveDecoy;
    if (!e.loveDecoyAt || now >= e.loveDecoyAt || (d.foe && !d.foe.active)) {
      e.loveDecoyAt = now + LOVE_RULES.decoyMs;
      const list = m.targets(), pool = [];
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (o !== e && o.active && !o.isBossPart && o.state !== 'bones' && o.state !== 'dust') pool.push(o);
      }
      d.foe = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (!d.foe) {
        // alone: aim at the far side of the room from the players
        const R = ctx.rooms, p = m.findNearestAlive(ctx.players, e.x, e.y, e);
        const px = p ? p.sprite.x : R.W / 2, py = p ? p.sprite.y : R.H / 2;
        d.sprite.x = Math.max(60, Math.min(R.W - 60, R.W - px));
        d.sprite.y = Math.max(60, Math.min(R.H - 60, R.H - py));
      }
    }
    if (d.foe) { d.sprite.x = d.foe.x; d.sprite.y = d.foe.y; }
    return d;
  },
  // area blows of a lovestruck boss land on the other enemies
  splash(m, x, y, radius, amount, attacker) {
    const list = m.targets();
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === attacker || !o.active || o.state === 'bones') continue;
      const dx = o.x - x, dy = o.y - y, r = radius + o.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      m.scene.hitEnemy(o, Math.round(amount * LOVE_RULES.bossSplashMul), dx / len, dy / len, 200, 110, attacker.loveOwner, 'love');
    }
  }
};

/* ---------------- skills ---------------- */
Object.assign(SKILL_BEHAVIORS, {
  flap(p, d, ctx) {
    const list = ctx.enemies.targets(), r = d.radius;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || e.state === 'bones' || e.state === 'dust') continue;
      const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y, rr = r + e.def.size / 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), dx / len, dy / len, d.knockback, d.knockbackMs, p);
      if (!e.active) continue;
      ctx.wallStun(e, d.knockbackMs + 120, d.wallStun);
      e.wallDmg = Math.round(d.wallDamage * p.stats.damageMul); e.wallDmgOwner = p;
    }
    ctx.fx(p.sprite.x, p.sprite.y, r, 0xfce4ec, 300);
    ctx.fx(p.sprite.x, p.sprite.y, r * 0.6, 0xf8bbd0, 220);
    return true;
  },
  flight(p, d, ctx) {
    // fly the full distance through anything; land on the farthest free spot
    const R = ctx.rooms;
    let tx = p.sprite.x, ty = p.sprite.y;
    for (let dist = d.distance; dist >= 0; dist -= 12) {
      const x = p.sprite.x + p.input.aimX * dist, y = p.sprite.y + p.input.aimY * dist;
      if (!R.solidAt(x, y) && !R.solidAt(x + 10, y) && !R.solidAt(x - 10, y) && !R.solidAt(x, y + 10) && !R.solidAt(x, y - 10)) { tx = x; ty = y; break; }
    }
    p.cupidFlight = { sx: p.sprite.x, sy: p.sprite.y, tx: tx, ty: ty, ms: 0, total: d.flyMs, d: d, lastX: p.sprite.x, lastY: p.sprite.y };
    p.invulnMs = Math.max(p.invulnMs, d.flyMs + 100);
    ctx.fx(p.sprite.x, p.sprite.y, 24, 0xf8bbd0, 220);
    return true;
  },
  loveAll(p, d, ctx) {
    const list = ctx.enemies.targets(), r = d.radius, scene = ctx.scene;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const dx = e.x - p.sprite.x, dy = e.y - p.sprite.y, rr = r + e.def.size / 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), 0, 0, 0, 0, p);
      if (e.active) LoveFx.apply(scene, e, p);
    }
    ctx.fx(p.sprite.x, p.sprite.y, r, 0xf06292, 420);
    ctx.fx(p.sprite.x, p.sprite.y, r * 0.55, 0xfce4ec, 320);
    if (ctx.shake) ctx.shake(100, 0.004);
    return true;
  }
});

/* ---------------- scene system: flights, trails, enemy hearts ---------------- */
class CupidManager {
  constructor(scene) {
    this.scene = scene;
    this.trails = [];                                   // { x, y, until, owner, d }
    this.g = scene.add.graphics().setDepth(7);          // trail on the floor
    this.top = scene.add.graphics().setDepth(83);       // hearts / love bars (above the darkness)
  }
  clear() { this.trails.length = 0; this.g.clear(); this.top.clear(); }

  update(dt, ctx) {
    const scene = this.scene, now = scene.time.now;
    // flights in progress
    const players = scene.players;
    for (let i = 0; i < players.length; i++) {
      const p = players[i], f = p.cupidFlight;
      if (!f) continue;
      if (!p.alive) { p.cupidFlight = null; continue; }
      f.ms += dt;
      const k = Math.min(1, f.ms / f.total), e = 1 - (1 - k) * (1 - k);
      const x = f.sx + (f.tx - f.sx) * e, y = f.sy + (f.ty - f.sy) * e;
      p.sprite.body.reset(x, y);
      // drop a trail point every ~16 px
      // (fills the gaps on slow frames so the trail has no holes)
      let ddx = x - f.lastX, ddy = y - f.lastY, len = Math.sqrt(ddx * ddx + ddy * ddy);
      while (len >= 16) {
        f.lastX += ddx / len * 16; f.lastY += ddy / len * 16;
        this.trails.push({ x: f.lastX, y: f.lastY, until: now + f.d.trailMs, owner: p, d: f.d });
        ddx = x - f.lastX; ddy = y - f.lastY; len = Math.sqrt(ddx * ddx + ddy * ddy);
      }
      if (k >= 1) p.cupidFlight = null;
    }
    // trails fill the love bar of enemies walking on them
    for (let i = this.trails.length - 1; i >= 0; i--) if (this.trails[i].until <= now) this.trails.splice(i, 1);
    const list = ctx.enemies.targets();
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.active) continue;
      // the love bar drains if nothing refills it for a while
      if (e.loveBar > 0) {
        if (e.loveBarMs > 0) e.loveBarMs -= dt;
        else e.loveBar = Math.max(0, e.loveBar - LOVE_RULES.barDecayPerSec * dt / 1000);
      }
      if (!this.trails.length || e.loveUntil > 0 || (e.loveTrailAt && now < e.loveTrailAt)) continue;
      for (let i = 0; i < this.trails.length; i++) {
        const t = this.trails[i], dx = e.x - t.x, dy = e.y - t.y, r = 18 + e.def.size / 2;
        if (dx * dx + dy * dy > r * r) continue;
        e.loveTrailAt = now + t.d.trailTickMs;
        LoveFx.charge(scene, e, t.d.trailCharge * (1 + ((t.owner.stats && t.owner.stats.loveCharge) || 0)), t.owner);
        break;
      }
    }
    // a lovestruck boss's bullets hit the other enemies
    this.charmedBullets(ctx);
  }

  charmedBullets(ctx) {
    const pool = this.scene.enemyBullets;
    if (!pool) return;
    const bl = pool.group.getChildren(), list = ctx.enemies.targets();
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i];
      if (!b.active || !b.owner || !(b.owner.loveUntil > 0)) continue;
      for (let k = 0; k < list.length; k++) {
        const o = list[k];
        if (o === b.owner || !o.active || o.state === 'bones') continue;
        const dx = o.x - b.x, dy = o.y - b.y, r = 6 + o.def.size / 2;
        if (dx * dx + dy * dy > r * r) continue;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        this.scene.hitEnemy(o, Math.round((b.damage || 8) * LOVE_RULES.bossSplashMul), dx / len, dy / len, 160, 90, b.owner.loveOwner, 'love');
        pool.kill(b);
        break;
      }
    }
  }

  draw(now) {
    const g = this.g, top = this.top;
    g.clear(); top.clear();
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i], a = Math.min(1, (t.until - now) / 800);
      g.fillStyle(0xf48fb1, 0.35 * a); g.fillCircle(t.x, t.y, 9);
      if (i % 3 === 0 && this.scene.lighting) this.scene.lighting.add(t.x, t.y, 34 * a);   // visible in the dark
      if (i % 2 === 0) { g.fillStyle(0xec407a, 0.55 * a); CupidTextures.heartPts(g, t.x, t.y - 1, 4); }
    }
    const list = this.scene.enemies.targets();
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.active) continue;
      const hy = e.y - e.def.size / 2 - 12;
      if (e.loveUntil > 0) {
        const bob = Math.sin(now / 180 + k) * 2;
        top.fillStyle(0xad1457, 0.9); CupidTextures.heartPts(top, e.x, hy + bob, 6.5);
        top.fillStyle(e.loveBoss ? 0xce93d8 : 0xf06292, 1); CupidTextures.heartPts(top, e.x, hy + bob, 5);
      } else if (e.loveBar > 0) {
        top.fillStyle(0x000000, 0.25); top.fillRect(e.x - 13, hy, 26, 4);
        top.fillStyle(0xec407a, 0.9); top.fillRect(e.x - 13, hy, 26 * Math.min(1, e.loveBar), 4);
      }
    }
  }
}

const CupidMixin = {
  setupCupid() { this.cupid = new CupidManager(this); },
  cupidRoom() {
    if (!this.cupid) return;
    this.cupid.clear();
    for (let i = 0; i < this.players.length; i++) this.players[i].cupidFlight = null;
  },
  updateCupid(dt) {
    if (!this.cupid) return;
    if (this.mode === 'play') this.cupid.update(dt, this.combatContext);
    this.cupid.draw(this.time.now);
  }
};
