/* miner.js
   More Miner gear (the secret class, gnome blueprint) + the ★★★★ tier.

   - Coal Lump ★★ / Hot Coal Lump ★★★★: thrown lumps that make enemies
     COAL DIRTY: slowed, their shots go wild (worse aim), and fire hurts
     them twice as much (burns tick double, fire hits deal double).
     The hot one also sets them on fire.
   - Cafézin ★★: a strong coffee. Attack speed, damage and speed up.
   - Torch ★★: throw a torch; the enemy it hits catches fire and the fire
     jumps to every enemy standing close to another burning one.
   - Mine Train ★★★ (MEGA, 100 mana): tracks get laid across the room
     (always straight: left-right or up-down, the one closest to where you
     aim), tunnels open at both walls, then a huge mine train thunders
     through the lane and smashes everything in it.

   Miner items are rare in shops and chests unless someone already uses
   Miner gear (ShopLogic.rareMul / rollLoot below).

   MinerMixin goes onto GameScene: setupMiner / updateMiner / minerRoom. */

const POST_BOSS_3 = 3;          // ★★★★: after the 3rd boss (more stages are coming)

const COAL_RULES = { aimJitterDeg: 28, fireMul: 2 };

Object.assign(WEAPON_TYPES, {
  coalLump: {
    name: 'Coal Lump', short: 'COAL', kind: 'projectile', class: 'melee', sub: 'Miner', type: 'throw', price: 80, postBoss: POST_BOSS_1, blueprint: 'gnome',
    desc: 'Throw lumps of coal (14). Hit enemies\nget coal dirty for 4 s: slowed 30%,\ntheir shots go wild, and fire hurts\nthem twice as much.',
    damage: 14, speed: 520, lifetimeMs: 650, fireDelayMs: 520, manaCost: 0, texture: 'coal',
    coal: { ms: 4000, slow: 0.3 },
    visual: { style: 'lump', color: 0x263238, glow: 0 }
  },
  hotCoalLump: {
    name: 'Hot Coal Lump', short: 'HOTC', kind: 'projectile', class: 'melee', sub: 'Miner', type: 'throw', price: 210, postBoss: POST_BOSS_3, blueprint: 'gnome',
    desc: 'Red-hot coal (26): coal dirty for 5 s\n(slowed 35%, wild shots, fire x2) AND\nset on fire, so the burn hits double.',
    damage: 26, speed: 560, lifetimeMs: 650, fireDelayMs: 480, manaCost: 0, texture: 'hotcoal',
    coal: { ms: 5000, slow: 0.35 }, ignite: { ms: 3000, tick: 4 },
    visual: { style: 'lump', color: 0x3e2723, glow: 0xff6d00 }
  }
});

Object.assign(EFFECT_TYPES, {
  cafezin: { name: 'Cafézin', durationMs: 10000, mods: { attackSpeedMul: 0.25, damageMul: 0.20, moveSpeedMul: 0.20 } }
});

Object.assign(SKILL_TYPES, {
  cafezin: {
    name: 'Cafézin', short: 'CAFE', kind: 'effect', class: 'melee', sub: 'Miner', price: 80, postBoss: POST_BOSS_1, blueprint: 'gnome',
    desc: 'A strong little coffee. For 10 s:\n+25% attack speed, +20% damage,\n+20% speed. Long recharge.',
    manaCost: 50, cooldownMs: 32000, effect: 'cafezin'
  },
  torchThrow: {
    name: 'Torch', short: 'TRCH', kind: 'shot', class: 'melee', sub: 'Miner', price: 75, postBoss: POST_BOSS_1, blueprint: 'gnome',
    desc: 'Throw a torch (30). The enemy it hits\ncatches fire, and the fire jumps to\nevery enemy standing close to another\nburning one.',
    manaCost: 25, cooldownMs: 7000,
    shot: { damage: 30, speed: 500, lifetimeMs: 700, texture: 'torchShot', ignite: { ms: 3500, tick: 4 }, spreadFire: { radius: 85, max: 12 } }
  },
  mineTrain: {
    name: 'Mine Train', short: 'TRAIN', kind: 'mineTrain', mega: true, megaColor: 0xff8f00, class: 'melee', sub: 'Miner', price: 150, postBoss: POST_BOSS_2, blueprint: 'gnome',
    desc: 'MEGA SPELL (100 mana). Tracks get laid\nacross the room (straight, the way you\naim), then a huge mine train smashes\nthrough: 170 to everything in its lane.',
    manaCost: 100, cooldownMs: 26000,
    damage: 170, laneHalf: 42, buildMs: 900, rumbleMs: 350, speed: 1500, fadeMs: 500,
    knockback: 620, knockbackMs: 240, stunMs: 900
  }
});

/* ---------------- coal dirty ---------------- */
const CoalFx = {
  apply(scene, e, c) {
    if (!e.active || e.isBossPart || e.state === 'bones') return;
    const now = scene.time.now;
    e.coalUntil = Math.max(e.coalUntil || 0, now + c.ms);
    scene.enemies.slow(e, c.ms, c.slow);
  },
  dirty(e, now) { return e && e.coalUntil > now; }
};

// Spread fire: everything standing close to a burning enemy catches fire too (chain).
const FireSpread = {
  from(scene, e, sf, ig, owner) {
    const list = scene.enemies.targets(), lit = [e], r2 = sf.radius * sf.radius;
    for (let i = 0; i < lit.length && lit.length < sf.max; i++) {
      const a = lit[i];
      for (let k = 0; k < list.length && lit.length < sf.max; k++) {
        const o = list[k];
        if (!o.active || lit.indexOf(o) !== -1 || o.state === 'bones' || o.state === 'dust') continue;
        const dx = o.x - a.x, dy = o.y - a.y;
        if (dx * dx + dy * dy > r2) continue;
        lit.push(o);
        GearFx.ignite(scene.enemies, o, ig, owner);
        if (scene.hud) scene.hud.addFx(o.x, o.y, o.def.size / 2 + 10, 0xff7043, 240);
      }
    }
  }
};

(function () {
  // bullets carry coal / spreadFire
  const applyShot = GearFx.applyShot;
  GearFx.applyShot = function (b, sh) { applyShot.call(this, b, sh); b.coal = sh.coal || null; b.spreadFire = sh.spreadFire || null; };
  const fire = ProjectileManager.prototype.fire;
  ProjectileManager.prototype.fire = function (x, y, dirX, dirY, speed, damage, lifetimeMs, owner, textureKey) {
    // a coal-dirty enemy can't aim: its shots go wild
    if (owner && owner.isEnemy && owner.coalUntil > this.scene.time.now) {
      const a = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 2 * COAL_RULES.aimJitterDeg * Math.PI / 180;
      dirX = Math.cos(a); dirY = Math.sin(a);
    }
    const b = fire.call(this, x, y, dirX, dirY, speed, damage, lifetimeMs, owner, textureKey);
    if (b) { b.coal = null; b.spreadFire = null; }
    return b;
  };
  const applyAll = GearFx.applyAll;
  GearFx.applyAll = function (scene, e, o, owner, dmg) {
    const now = scene.time.now;
    // fire on a coal-dirty enemy: the hit lands twice as hard
    if (o.ignite && CoalFx.dirty(e, now) && e.active && dmg > 0) scene.hitEnemy(e, Math.round(dmg * (COAL_RULES.fireMul - 1)), 0, 0, 0, 0, owner, 'fire');
    if (o.coal && e.active) CoalFx.apply(scene, e, o.coal);
    applyAll.call(this, scene, e, o, owner, dmg);
    if (o.spreadFire && o.ignite && e.active) FireSpread.from(scene, e, o.spreadFire, o.ignite, owner);
  };
  // burns tick double on coal-dirty enemies
  const ignite = GearFx.ignite;
  GearFx.ignite = function (em, e, ig, owner) {
    if (CoalFx.dirty(e, em.scene.time.now)) ig = { ms: ig.ms, tick: ig.tick * COAL_RULES.fireMul };
    return ignite.call(this, em, e, ig, owner);
  };
  // Miner gear is rare unless someone uses it already
  const tierWeight = ShopLogic.tierWeight;
  ShopLogic.tierWeight = function (def, bossesBeaten) {
    const w = tierWeight.call(this, def, bossesBeaten);
    return def && def.sub === 'Miner' && !this.minerActive ? w * MINER_RARE.shopMul : w;
  };
  const generate = ShopLogic.generate;
  ShopLogic.generate = function (playerCount, level, bossesBeaten, classes, players) {
    this.minerActive = MINER_RARE.active(players);
    try { return generate.call(this, playerCount, level, bossesBeaten, classes); } finally { this.minerActive = true; }
  };
  // textures
  const make = Arcane3bTextures.make;
  Arcane3bTextures.make = function (scene) { make.call(this, scene); MinerTextures.make(scene); };
})();

const MINER_RARE = {
  shopMul: 0.2,          // Miner cards show up 5x less often...
  chestKeep: 0.25,       // ...and a chest only keeps Miner loot in its pool 25% of the time
  active(players) {
    if (!players || !players.length) return true;
    for (let i = 0; i < players.length; i++) if (Stats.countSub(players[i], 'Miner') > 0) return true;
    return false;
  }
};
ShopLogic.minerActive = true;

const MinerTextures = {
  make(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    W('coal', 14, 14, (g) => {
      g.fillStyle(0x212121, 1); g.fillPoints([{ x: 2, y: 6 }, { x: 6, y: 1 }, { x: 12, y: 3 }, { x: 13, y: 9 }, { x: 8, y: 13 }, { x: 2, y: 11 }], true);
      g.fillStyle(0x546e7a, 1); g.fillCircle(6, 5, 1.5); g.fillCircle(10, 8, 1);
    });
    W('hotcoal', 16, 16, (g) => {
      g.fillStyle(0xff6d00, 0.35); g.fillCircle(8, 8, 8);
      g.fillStyle(0x3e2723, 1); g.fillPoints([{ x: 3, y: 7 }, { x: 7, y: 2 }, { x: 13, y: 4 }, { x: 14, y: 10 }, { x: 9, y: 14 }, { x: 3, y: 12 }], true);
      g.lineStyle(1.5, 0xff9100, 1); g.lineBetween(5, 8, 9, 6); g.lineBetween(9, 6, 11, 10);
      g.fillStyle(0xffd180, 1); g.fillCircle(9, 6, 1.2);
    });
    W('torchShot', 22, 12, (g) => {
      g.fillStyle(0x6d4c41, 1); g.fillRect(0, 4, 14, 4);
      g.fillStyle(0xff6d00, 1); g.fillCircle(16, 6, 5);
      g.fillStyle(0xffd54f, 1); g.fillCircle(17, 6, 2.6);
    });
  }
};

/* ---------------- Mine Train ---------------- */
SKILL_BEHAVIORS.mineTrain = function (p, d, ctx) {
  const sc = ctx.scene;
  if (!sc.miner) return false;
  const ax = p.input.aimX, ay = p.input.aimY;
  const horiz = Math.abs(ax) >= Math.abs(ay);              // only straight lines: no diagonals
  const dir = horiz ? (ax >= 0 ? 1 : -1) : (ay >= 0 ? 1 : -1);
  const R = ctx.rooms;
  const len = horiz ? R.W : R.H;
  const lane = Math.max(d.laneHalf + 20, Math.min((horiz ? R.H : R.W) - d.laneHalf - 20, horiz ? p.sprite.y : p.sprite.x));
  sc.miner.trains.push({ owner: p, d: d, horiz: horiz, dir: dir, lane: lane, len: len, ms: 0, front: null, hit: [] });
  SkillFx.mega(ctx, p, d);
  return true;
};

class MinerManager {
  constructor(scene) {
    this.scene = scene;
    this.trains = [];
    this.floor = scene.add.graphics().setDepth(3);       // tracks
    this.top = scene.add.graphics().setDepth(84);        // the train (big moment: above the darkness)
    this.dirt = scene.add.graphics().setDepth(9);        // coal smudges on dirty enemies
  }
  clear() { this.trains.length = 0; this.floor.clear(); this.top.clear(); this.dirt.clear(); }

  update(dt, ctx) {
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const T = this.trains[i], d = T.d;
      T.ms += dt;
      const runAt = d.buildMs + d.rumbleMs;
      if (T.ms >= d.buildMs && T.ms < runAt && this.scene.cameras) this.scene.cameras.main.shake(60, 0.003);
      if (T.ms >= runAt) {
        // the train front, in "along the lane" coordinates (u), starting behind the start wall
        const travel = (T.ms - runAt) / 1000 * d.speed;
        const u = T.dir > 0 ? -60 + travel : T.len + 60 - travel;
        T.front = u;
        this.smash(T, u, ctx);
        if (travel > T.len + TRAIN_LEN + 120 + d.speed * d.fadeMs / 1000) { this.trains.splice(i, 1); continue; }
      }
    }
  }

  smash(T, u, ctx) {
    const d = T.d, list = ctx.enemies.targets(), p = T.owner;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.active || T.hit.indexOf(e) !== -1 || e.state === 'bones' || e.state === 'dust') continue;
      const eu = T.horiz ? e.x : e.y, ev = T.horiz ? e.y : e.x, half = e.def.size / 2;
      if (Math.abs(ev - T.lane) > d.laneHalf + half) continue;
      // inside the train's body?
      const tail = u - T.dir * TRAIN_LEN;
      const lo = Math.min(u, tail) - half, hi = Math.max(u, tail) + half;
      if (eu < lo || eu > hi) continue;
      T.hit.push(e);
      const side = ev >= T.lane ? 1 : -1;                   // thrown out of the lane, sideways
      const kx = T.horiz ? T.dir * 0.35 : side, ky = T.horiz ? side : T.dir * 0.35, kl = Math.sqrt(kx * kx + ky * ky);
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), kx / kl, ky / kl, d.knockback, d.knockbackMs, p, 'aoe');
      if (e.active) ctx.stunEnemy(e, d.stunMs);
    }
  }

  draw(now) {
    const f = this.floor, top = this.top, dirt = this.dirt;
    f.clear(); top.clear(); dirt.clear();
    // coal smudges
    const list = this.scene.enemies.targets();
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.active || !(e.coalUntil > now)) continue;
      const s = e.def.size / 2;
      dirt.fillStyle(0x212121, 0.55);
      dirt.fillCircle(e.x - s * 0.4, e.y - s * 0.2, s * 0.28); dirt.fillCircle(e.x + s * 0.35, e.y + s * 0.3, s * 0.22); dirt.fillCircle(e.x + s * 0.1, e.y - s * 0.5, s * 0.15);
    }
    for (let i = 0; i < this.trains.length; i++) this.drawTrain(this.trains[i], now);
  }

  // u = along the lane, v = across it (0 = lane center). Everything is axis-aligned.
  drawTrain(T, now) {
    const d = T.d, f = this.floor, top = this.top, L = this.scene.lighting;
    const X = (u, v) => T.horiz ? u : T.lane + v, Y = (u, v) => T.horiz ? T.lane + v : u;
    const rect = (g, u0, v0, du, dv) => {   // rectangle in lane coords (du along, dv across)
      const uu = Math.min(u0, u0 + du), vv = Math.min(v0, v0 + dv), w = Math.abs(du), h = Math.abs(dv);
      if (T.horiz) g.fillRect(uu, T.lane + vv, w, h); else g.fillRect(T.lane + vv, uu, h, w);
    };
    const runAt = d.buildMs + d.rumbleMs, end = T.len + TRAIN_LEN + 120;
    let alpha = 1;
    if (T.front !== null) {
      const travel = T.dir > 0 ? T.front + 60 : T.len + 60 - T.front;
      if (travel > end) alpha = Math.max(0, 1 - (travel - end) / (d.speed * d.fadeMs / 1000));
    }
    // tracks: sleepers + 2 rails, laid from the start wall toward the far wall
    const laid = Math.min(1, T.ms / d.buildMs) * T.len;
    const start = T.dir > 0 ? 0 : T.len;
    for (let s = 0; s <= laid; s += 26) {
      const u = start + T.dir * s;
      f.fillStyle(0x6d4c41, alpha); rect(f, u - 5, -30, 10, 60);
    }
    f.fillStyle(0x90a4ae, alpha);
    const u0 = start, u1 = start + T.dir * laid;
    rect(f, Math.min(u0, u1), -20, Math.abs(u1 - u0), 4); rect(f, Math.min(u0, u1), 16, Math.abs(u1 - u0), 4);
    if (L) for (let s = 0; s <= laid; s += 110) L.add(X(start + T.dir * s, 0), Y(start + T.dir * s, 0), 70 * alpha);
    // tunnels at both walls
    for (let k = 0; k < 2; k++) {
      const u = k === 0 ? 0 : T.len, inward = k === 0 ? 1 : -1;
      top.fillStyle(0x4e342e, alpha); rect(top, u, -52, inward * 26, 104);
      top.fillStyle(0x0d0d0d, alpha); rect(top, u, -40, inward * 20, 80);
      top.fillStyle(0x8d6e63, alpha); rect(top, u + inward * 20, -54, inward * 6, 108);
    }
    if (T.front === null) {
      // rumbling: dust puffs at the start tunnel
      if (T.ms >= d.buildMs) {
        const su = T.dir > 0 ? 0 : T.len, k = (T.ms - d.buildMs) / d.rumbleMs;
        top.fillStyle(0xbcaaa4, 0.5 * k); top.fillCircle(X(su + T.dir * 30, -20), Y(su + T.dir * 30, -20), 10 + 8 * k); top.fillCircle(X(su + T.dir * 34, 22), Y(su + T.dir * 34, 22), 8 + 8 * k);
      }
      return;
    }
    // the train: locomotive + 3 ore cars behind it
    const fu = T.front, dir = T.dir;
    const car = (frontU, body, trim) => {
      top.fillStyle(0x000000, 0.25 * alpha); rect(top, frontU - dir * 4, -32, -dir * 64, 66);           // shadow
      top.fillStyle(body, alpha); rect(top, frontU, -28, -dir * 62, 56);
      top.fillStyle(trim, alpha); rect(top, frontU - dir * 4, -24, -dir * 54, 6); rect(top, frontU - dir * 4, 18, -dir * 54, 6);
      top.fillStyle(0x212121, alpha);
      for (let w = 0; w < 2; w++) { const wu = frontU - dir * (14 + w * 34); top.fillCircle(X(wu, -30), Y(wu, -30), 6); top.fillCircle(X(wu, 30), Y(wu, 30), 6); }
    };
    // ore cars
    for (let c = 3; c >= 1; c--) {
      const cu = fu - dir * (96 + (c - 1) * 70);
      car(cu, 0x607d8b, 0x37474f);
      top.fillStyle(0x263238, alpha);
      for (let k = 0; k < 4; k++) { const ou = cu - dir * (12 + k * 12); top.fillCircle(X(ou, (k % 2 ? -8 : 8)), Y(ou, (k % 2 ? -8 : 8)), 7); }
      top.fillStyle(0x5d4037, alpha); rect(top, cu, -4, dir * 8, 8);                                       // coupler
    }
    // locomotive
    car(fu - dir * 6, 0xb71c1c, 0xffb300);
    top.fillStyle(0x212121, alpha); rect(top, fu - dir * 46, -22, -dir * 28, 44);                            // cabin
    top.fillStyle(0xffe082, alpha); rect(top, fu - dir * 52, -14, -dir * 14, 28);                             // window
    top.fillStyle(0x424242, alpha); top.fillCircle(X(fu - dir * 26, 0), Y(fu - dir * 26, 0), 9);              // chimney
    const tip = [X(fu + dir * 14, 0), Y(fu + dir * 14, 0)], a1 = [X(fu - dir * 6, -26), Y(fu - dir * 6, -26)], a2 = [X(fu - dir * 6, 26), Y(fu - dir * 6, 26)];
    top.fillStyle(0x9e9e9e, alpha); top.fillTriangle(tip[0], tip[1], a1[0], a1[1], a2[0], a2[1]);           // cow catcher
    top.fillStyle(0xfff59d, alpha); top.fillCircle(X(fu - dir * 4, 0), Y(fu - dir * 4, 0), 6);                // headlight
    // smoke puffs trailing behind the chimney
    for (let k = 0; k < 4; k++) {
      const su = fu - dir * (26 + 30 * k + (now / 6) % 30), sv = Math.sin(now / 90 + k) * 8;
      top.fillStyle(0xeeeeee, (0.55 - k * 0.12) * alpha); top.fillCircle(X(su, sv), Y(su, sv), 9 + k * 3);
    }
    if (L) { L.add(X(fu + dir * 60, 0), Y(fu + dir * 60, 0), 120 * alpha); L.add(X(fu - dir * 120, 0), Y(fu - dir * 120, 0), 110 * alpha); }
  }
}
const TRAIN_LEN = 96 + 3 * 70;      // locomotive + 3 cars

const MinerMixin = {
  setupMiner() { this.miner = new MinerManager(this); },
  minerRoom() { if (this.miner) this.miner.clear(); },
  updateMiner(dt) {
    if (!this.miner) return;
    if (this.mode === 'play') this.miner.update(dt, this.combatContext);
    this.miner.draw(this.time.now);
  }
};
