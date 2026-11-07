/* allies.js
   ALLY_TYPES (data) + AllyManager: small helpers on the players' side.
   Wormling (from the Devourer Sword): a little worm that hunts the nearest
   enemy and bites it. Enemies target wormlings too (they count as a target
   like a player), touch damage and enemy bullets hurt them, and they vanish
   after their lifetime. Pooled: never created during play. */

const ALLY_TYPES = {
  wormling: {
    tex: 'wormling_head',
    hp: 40, speed: 250, turn: 7, size: 16,
    segments: 3, spacing: 9,
    biteDamage: 8, biteCdMs: 400, biteKnockback: 70,   // ~20 damage per second each
    lifeMs: 10000, max: 3,                              // at most 3 alive at once
    seekRange: 520, invulnMs: 450
  },
  // Inkblot Crown: a little ink drop that bites
  inkling: {
    tex: 'enemy_inkdrop',
    hp: 30, speed: 240, turn: 7, size: 16, segments: 0,
    biteDamage: 9, biteCdMs: 450, biteKnockback: 90,
    lifeMs: 9000, max: 4, seekRange: 520, invulnMs: 400
  },
  // Hog Call: charges into enemies
  hog: {
    tex: 'hog',
    hp: 70, speed: 225, turn: 5, size: 24, segments: 0,
    biteDamage: 14, biteCdMs: 600, biteKnockback: 260,
    lifeMs: 12000, max: 5, seekRange: 650, invulnMs: 400
  },
  // Prop Target: doesn't move or attack; enemies prefer it over you
  decoy: {
    tex: 'decoy',
    hp: 90, speed: 0, turn: 0, size: 26, segments: 0, still: true, taunt: true,
    biteDamage: 0, biteCdMs: 1e9, biteKnockback: 0,
    lifeMs: 8000, max: 2, seekRange: 0, invulnMs: 250
  }
};

class AllyManager {
  constructor(scene, poolSize) {
    this.scene = scene;
    this.pool = [];
    this.alive = [];   // active allies (rebuilt each frame; enemies read this)
    for (let i = 0; i < poolSize; i++) {
      const a = {
        active: false, alive: false, type: null, def: null, owner: null,
        x: 0, y: 0, ang: 0, hp: 0, maxHp: 0, lifeMs: 0, biteCdMs: 0, invulnMs: 0,
        target: null, retargetMs: 0, orbit: Math.random() * 6.28, flashMs: 0,
        head: scene.add.image(-100, -100, 'wormling_head').setDepth(9).setVisible(false),
        tail: [], trailX: new Float32Array(32), trailY: new Float32Array(32), trailHead: 0
      };
      for (let k = 0; k < 3; k++) a.tail.push(scene.add.image(-100, -100, 'wormling_body').setDepth(9).setVisible(false));
      a.sprite = a.head;          // enemies use target.sprite.x / .y
      this.pool.push(a);
    }
  }

  count(type) {
    let n = 0;
    for (let i = 0; i < this.pool.length; i++) if (this.pool[i].active && this.pool[i].type === type) n++;
    return n;
  }

  spawn(type, x, y, owner) {
    const d = ALLY_TYPES[type];
    if (!d || this.count(type) >= d.max) return null;
    let a = null;
    for (let i = 0; i < this.pool.length; i++) if (!this.pool[i].active) { a = this.pool[i]; break; }
    if (!a) return null;
    a.active = true; a.alive = true; a.type = type; a.def = d; a.owner = owner;
    a.x = x; a.y = y; a.ang = Math.random() * 6.28;
    a.hp = d.hp; a.maxHp = d.hp; a.lifeMs = d.lifeMs; a.biteCdMs = 300; a.invulnMs = 300;
    a.target = null; a.retargetMs = 0;
    for (let i = 0; i < a.trailX.length; i++) { a.trailX[i] = x; a.trailY[i] = y; }
    a.head.setTexture(d.tex).setPosition(x, y).setVisible(true).setAlpha(1).setRotation(0).setScale(d.scale || 1);
    for (let k = 0; k < a.tail.length; k++) a.tail[k].setTexture(d.tailTex || 'wormling_body').setScale(d.scale || 1).setPosition(x, y).setVisible(k < d.segments).setAlpha(1);
    return a;
  }

  kill(a) {
    a.active = false; a.alive = false; a.target = null;
    a.head.setVisible(false);
    for (let k = 0; k < a.tail.length; k++) a.tail[k].setVisible(false);
  }

  killAll() {
    for (let i = 0; i < this.pool.length; i++) if (this.pool[i].active) this.kill(this.pool[i]);
    this.alive.length = 0;
  }

  // ctx: the scene's combat context (targets, hitEnemy, enemyBullets, fx)
  update(dt, ctx) {
    this.alive.length = 0;
    const sec = dt / 1000;
    for (let i = 0; i < this.pool.length; i++) {
      const a = this.pool[i];
      if (!a.active) continue;
      const d = a.def;
      a.lifeMs -= dt;
      if (a.lifeMs <= 0 || a.hp <= 0) { ctx.fx(a.x, a.y, 14, 0x8d6e63, 200); this.kill(a); continue; }
      if (a.biteCdMs > 0) a.biteCdMs -= dt;
      if (a.invulnMs > 0) a.invulnMs -= dt;
      if (a.flashMs > 0) a.flashMs -= dt;

      // pick the nearest enemy (or boss part)
      a.retargetMs -= dt;
      const list = ctx.enemies.targets();
      if (d.still) a.target = null;
      else if (a.retargetMs <= 0 || !a.target || !a.target.active || (a.target.isBossPart && !a.target.surfaced)) {
        a.retargetMs = 300;
        a.target = null;
        let bd = d.seekRange * d.seekRange;
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (!e.active) continue;
          const dx = e.x - a.x, dy = e.y - a.y;
          const dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; a.target = e; }
        }
      }

      // move: toward the target, or circle the owner
      let gx, gy;
      if (d.still) { gx = a.x; gy = a.y; }
      else if (a.target) { gx = a.target.x; gy = a.target.y; }
      else if (a.owner && a.owner.alive) {
        a.orbit += sec * 2.5;
        gx = a.owner.sprite.x + Math.cos(a.orbit) * 50; gy = a.owner.sprite.y + Math.sin(a.orbit) * 50;
      } else { gx = a.x; gy = a.y; }
      const want = Math.atan2(gy - a.y, gx - a.x);
      let diff = want - a.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const mt = d.turn * sec;
      a.ang += Math.max(-mt, Math.min(mt, diff));
      a.x = Phaser.Math.Clamp(a.x + Math.cos(a.ang) * d.speed * sec, 70, ctx.rooms.W - 70);
      a.y = Phaser.Math.Clamp(a.y + Math.sin(a.ang) * d.speed * sec, 70, ctx.rooms.H - 70);

      // bite
      if (a.target && a.biteCdMs <= 0) {
        const dx = a.target.x - a.x, dy = a.target.y - a.y;
        const reach = d.size / 2 + a.target.def.size / 2 + 6;
        if (dx * dx + dy * dy <= reach * reach) {
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const mul = a.owner && a.owner.stats ? a.owner.stats.damageMul * (1 + (a.owner.stats.allyDamage || 0)) : 1;
          ctx.hitEnemy(a.target, Math.round(d.biteDamage * mul), dx / len, dy / len, d.biteKnockback, 60, a.owner, 'ally');
          a.biteCdMs = d.biteCdMs;
        }
      }

      // enemies touching it / enemy bullets hurt it
      if (a.invulnMs <= 0) {
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (!e.active || e.stunnedMs > 0) continue;
          const dx = e.x - a.x, dy = e.y - a.y;
          const r = d.size / 2 + e.def.size / 2;
          if (dx * dx + dy * dy > r * r) continue;
          const dmg = e.def.contact || Math.round(((e.state === 'dash' ? e.def.dashDamage : e.def.contactDamage) || 8) * (e.dmgMul || 1));
          this.hurt(a, dmg);
          break;
        }
      }
      if (a.invulnMs <= 0) {
        const bl = ctx.enemyBullets.group.getChildren();
        for (let k = 0; k < bl.length; k++) {
          const b = bl[k];
          if (!b.active) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          if (dx * dx + dy * dy > 14 * 14) continue;
          this.hurt(a, b.damage);
          ctx.enemyBullets.kill(b);
          break;
        }
      }

      // trail for the body segments (a point every 4 px moved)
      const lx = a.trailX[a.trailHead], ly = a.trailY[a.trailHead];
      if ((a.x - lx) * (a.x - lx) + (a.y - ly) * (a.y - ly) >= 16) {
        a.trailHead = (a.trailHead + 1) % a.trailX.length;
        a.trailX[a.trailHead] = a.x; a.trailY[a.trailHead] = a.y;
      }
      a.head.setPosition(a.x, a.y);
      if (!d.still) a.head.rotation = a.ang;
      const fade = a.lifeMs < 1200 && Math.floor(a.lifeMs / 100) % 2 === 0 ? 0.4 : 1;
      a.head.setAlpha(fade);
      if (a.flashMs > 0) a.head.setTintFill(0xffffff); else a.head.clearTint();
      for (let k = 0; k < d.segments; k++) {
        const back = (k + 1) * 2 + 1;
        let idx = a.trailHead - back; if (idx < 0) idx += a.trailX.length;
        a.tail[k].setPosition(a.trailX[idx], a.trailY[idx]).setAlpha(fade);
      }
      this.alive.push(a);
    }
  }

  hurt(a, dmg) {
    a.hp -= dmg;
    a.invulnMs = a.def.invulnMs;
    a.flashMs = 80;
  }
}
