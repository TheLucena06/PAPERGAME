/* boulder.js
   The Boulder (★★ Berserker weapon) and the rolling boulder it becomes.

   Held: very slow, huge smashes at short range; every hit slows enemies.
   Dash-attack (attack during a dash): the boulder rolls off toward your aim,
   piercing every enemy it rolls through (bounces off walls, slows down,
   stops). Until you walk over it and pick it back up you are in
   "weight off" mode: fast, wide, low-damage punches with big knockback,
   and you move faster.

   The boulder on the floor always has a faint ring (drawn above the
   darkness) and, when it's off screen, a small arrow at the screen edge
   points to it. Both are kept quiet on purpose.

   BoulderMixin goes onto GameScene: setupBoulder / updateBoulder /
   boulderRoom (new room = the boulder comes back to your hands). */

WEAPON_TYPES.boulder = {
  name: 'Boulder', short: 'BLDR', kind: 'boulder', class: 'melee', sub: 'Berserker', type: 'boulder', price: 90, postBoss: POST_BOSS_1,
  desc: 'Very slow, huge smashes (95) at short\nrange. Every hit slows enemies (40%).\nDash-attack: it rolls off, piercing\nenemies (70). Until you pick it back up:\nfast, wide punches (14, big knockback)\nand +25% speed. Heavy: -10% speed.',
  damage: 95, range: 66, arcDeg: 120, cooldownMs: 1250, knockback: 280, knockbackMs: 150, swingFxMs: 220, bossMul: 1.3,
  slowHit: { ms: 1500, pct: 0.4 },
  mods: { moveSpeedMul: -0.10 },
  weightOff: { moveSpeedMul: 0.35 },          // cancels the -10% and adds +25% while the boulder is away
  roll: { damage: 70, speed: 580, friction: 330, radius: 15, knockback: 360, knockbackMs: 170, wallStun: 700, bounce: 0.6, minHitSpeed: 110 },
  punch: { damage: 14, range: 58, arcDeg: 170, cooldownMs: 230, knockback: 470, knockbackMs: 170, swingFxMs: 90, wallStun: 600 },
  visual: { style: 'boulder', color: 0x9e9e9e, dark: 0x616161, light: 0xe0e0e0, swing: 0xbdbdbd },
  punchVisual: { style: 'fist', color: 0xffcc80, outline: 0x6d4c41, wrap: 0x8d6e63, swing: 0xffe0b2 }
};

WEAPON_BEHAVIORS.boulder = function (p, w, dt, ctx) {
  const d = w.def;
  // weight off: punches until the boulder is back
  if (w.thrown) {
    if (w.cooldownMs > 0) w.cooldownMs -= dt;
    if (!p.input.attack || w.cooldownMs > 0) return;
    const h = d.punch;
    w.cooldownMs = h.cooldownMs / p.stats.attackSpeedMul;
    w.swingAngle = Math.atan2(p.input.aimY, p.input.aimX);
    w.swingKind = 'normal'; w.swingRange = h.range; w.swingArc = h.arcDeg; w.swingFxMs = h.swingFxMs;
    WeaponSystem.meleeArc(p, h, ctx, false, null);
    if (ctx.lightArc) ctx.lightArc(p, h.range);
    return;
  }
  // dash-attack: let it roll
  if (p.input.attack && p.reflectMs > 0 && ctx.boulders && ctx.boulders.roll(p, w, p.input.aimX, p.input.aimY)) {
    w.thrown = true;
    w.cooldownMs = 200;
    w.swingAngle = Math.atan2(p.input.aimY, p.input.aimX);
    w.swingFxMs = 0;
    p.recalcStats();
    if (ctx.shake) ctx.shake(90, 0.004);
    return;
  }
  WEAPON_BEHAVIORS.melee(p, w, dt, ctx);
};

class BoulderManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];                                        // { owner, weapon, x, y, vx, vy, rot, hit[], restMs }
    this.g = scene.add.graphics().setDepth(9);             // the rock itself
    this.mark = scene.add.graphics().setDepth(82);         // faint ring (above the darkness)
    this.ui = scene.add.graphics().setDepth(99).setScrollFactor(0);   // off-screen arrow
  }

  roll(p, w, dx, dy) {
    const d = w.def.roll, rooms = this.scene.rooms;
    let x = p.sprite.x + dx * 20, y = p.sprite.y + dy * 20;
    if (rooms.solidAt(x, y)) { x = p.sprite.x; y = p.sprite.y; }
    this.list.push({ owner: p, weapon: w, x: x, y: y, vx: dx * d.speed, vy: dy * d.speed, rot: 0, hit: [], restMs: 0 });
    return true;
  }

  pickUp(b) {
    const i = this.list.indexOf(b);
    if (i !== -1) this.list.splice(i, 1);
    const w = b.weapon, p = b.owner;
    w.thrown = false;
    w.cooldownMs = 250;
    if (p) {
      p.recalcStats();
      if (p.alive) this.scene.hud.addFx(p.sprite.x, p.sprite.y, 26, 0x9e9e9e, 220);
    }
  }

  // New room / death / restart: every boulder is back in its owner's hands.
  recallAll() {
    while (this.list.length) this.pickUp(this.list[0]);
  }

  update(dt, ctx) {
    const sec = dt / 1000, rooms = this.scene.rooms;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i], d = b.weapon.def.roll, p = b.owner;
      if (!p || !p.alive) { this.pickUp(b); continue; }
      let sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > 0) {
        const nsp = Math.max(0, sp - d.friction * sec);
        b.vx *= nsp / sp; b.vy *= nsp / sp; sp = nsp;
        if (sp < 12) { b.vx = 0; b.vy = 0; sp = 0; }
      }
      if (sp > 0) {
        // two half steps so it can't skip through thin walls
        for (let k = 0; k < 2; k++) {
          const nx = b.x + b.vx * sec / 2, ny = b.y + b.vy * sec / 2;
          const r = d.radius, sx = Math.sign(b.vx), sy = Math.sign(b.vy);
          const hitX = rooms.solidAt(nx + sx * r, b.y), hitY = rooms.solidAt(b.x, ny + sy * r);
          if (hitX || hitY) {
            if (hitX) b.vx = -b.vx * d.bounce;
            if (hitY) b.vy = -b.vy * d.bounce;
            b.hit.length = 0;                       // after a bounce it can hit the same enemies again
            this.scene.hud.addFx(b.x + sx * r, b.y + sy * r, 14, 0x757575, 160);
            break;
          }
          b.x = nx; b.y = ny;
        }
        b.rot += sp * sec / d.radius;
        if (sp >= d.minHitSpeed) this.hitEnemies(b, d, ctx, sp);
        b.restMs = 0;
      } else b.restMs += dt;
      // walk over it to pick it up (once it has slowed down)
      const ddx = p.sprite.x - b.x, ddy = p.sprite.y - b.y;
      if ((sp < 160) && ddx * ddx + ddy * ddy < 32 * 32) this.pickUp(b);
    }
  }

  hitEnemies(b, d, ctx, sp) {
    const p = b.owner, list = ctx.enemies.targets(), slow = b.weapon.def.slowHit;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.active || e.state === 'bones' || e.state === 'dust' || b.hit.indexOf(e) !== -1) continue;
      const dx = e.x - b.x, dy = e.y - b.y, r = d.radius + e.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      b.hit.push(e);
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), b.vx / sp, b.vy / sp, d.knockback, d.knockbackMs, p);
      if (e.active) {
        ctx.wallStun(e, d.knockbackMs + 120, d.wallStun);
        if (slow) ctx.enemies.slow(e, slow.ms, slow.pct);
      }
    }
  }

  draw(now) {
    const g = this.g, m = this.mark, ui = this.ui;
    g.clear(); m.clear(); ui.clear();
    if (!this.list.length) return;
    const cam = this.scene.cameras.main, view = cam.worldView;
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i], v = b.weapon.def.visual, r = b.weapon.def.roll.radius;
      // the rock: shadow, body, a few cracks that turn as it rolls
      g.fillStyle(0x000000, 0.18); g.fillEllipse(b.x + 2, b.y + r * 0.7, r * 2, r * 0.8);
      g.fillStyle(v.color, 1); g.fillCircle(b.x, b.y, r);
      g.fillStyle(v.light, 0.6); g.fillCircle(b.x - r * 0.35, b.y - r * 0.35, r * 0.35);
      g.lineStyle(2, v.dark, 1); g.strokeCircle(b.x, b.y, r);
      for (let k = 0; k < 3; k++) {
        const a = b.rot + k * 2.1;
        g.lineBetween(b.x + Math.cos(a) * r * 0.2, b.y + Math.sin(a) * r * 0.2, b.x + Math.cos(a + 0.4) * r * 0.85, b.y + Math.sin(a + 0.4) * r * 0.85);
      }
      // faint pulsing ring, readable in the dark but quiet
      const pulse = 0.5 + 0.5 * Math.sin(now / 320);
      m.lineStyle(2, 0xe0e0e0, 0.14 + 0.10 * pulse); m.strokeCircle(b.x, b.y, r + 7 + pulse * 3);
      // off screen: a small arrow at the edge of the screen
      const pad = 8;
      if (b.x < view.x - pad || b.x > view.right + pad || b.y < view.y - pad || b.y > view.bottom + pad) {
        // the arrow lives inside a box that keeps clear of the HUD panel (top) and the screen edges
        const W = cam.width, H = cam.height, top = 130, inset = 24;
        const cx = W / 2, cy = (top + H - inset) / 2, hw = W / 2 - inset, hh = (H - inset - top) / 2;
        const tx = b.x - view.x, ty = b.y - view.y;
        const dx = tx - cx, dy = ty - cy;
        const k = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
        const ax = cx + dx * k, ay = cy + dy * k;
        const a = Math.atan2(dy, dx), ca = Math.cos(a), sa = Math.sin(a);
        ui.fillStyle(v.light, 0.6); ui.fillCircle(ax - ca * 9, ay - sa * 9, 5);
        ui.lineStyle(1.5, 0x263238, 0.6); ui.strokeCircle(ax - ca * 9, ay - sa * 9, 5);
        ui.fillStyle(v.light, 0.6); ui.lineStyle(1.5, 0x263238, 0.6);
        ui.fillTriangle(ax + ca * 6, ay + sa * 6, ax - sa * 5, ay + ca * 5, ax + sa * 5, ay - ca * 5);
        ui.strokeTriangle(ax + ca * 6, ay + sa * 6, ax - sa * 5, ay + ca * 5, ax + sa * 5, ay - ca * 5);
      }
    }
  }
}

const BoulderMixin = {
  setupBoulder() {
    this.boulders = new BoulderManager(this);
    if (this.combatContext) this.combatContext.boulders = this.boulders;
  },
  boulderRoom() { if (this.boulders) this.boulders.recallAll(); },
  updateBoulder(dt) {
    if (!this.boulders) return;
    if (this.mode === 'play') this.boulders.update(dt, this.combatContext);
    this.boulders.draw(this.time.now);
  }
};
