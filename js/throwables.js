/* throwables.js
   ThrowManager: tomahawks. Pooled sprites.
   An axe flies out, hits every enemy it passes once (knockback; enemies
   slammed into a wall get stunned), drops when it reaches its range or a
   wall, waits a moment, then flies back to its owner (hitting enemies on the
   way back too). Walking over a dropped axe picks it up right away.
   The axe's "ammo" belongs to the weapon that threw it. */

class ThrowManager {
  constructor(scene, size) {
    this.scene = scene;
    this.rooms = null;   // set by the scene
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push({ active: false, state: '', x: 0, y: 0, vx: 0, vy: 0, travelled: 0, ms: 0,
                       owner: null, weapon: null, def: null, hit: [], spin: 0,
                       sprite: scene.add.image(-100, -100, 'axe').setDepth(9).setVisible(false) });
    }
  }

  // Returns true if an axe was thrown.
  throwAxe(p, w, dirX, dirY) {
    let a = null;
    for (let i = 0; i < this.pool.length; i++) if (!this.pool[i].active) { a = this.pool[i]; break; }
    if (!a) return false;
    const d = w.def;
    a.active = true; a.state = 'fly';
    a.x = p.sprite.x + dirX * 18; a.y = p.sprite.y + dirY * 18;
    if (this.rooms.solidAt(a.x, a.y)) { a.x = p.sprite.x; a.y = p.sprite.y; }   // hugging a wall: start from your hands
    a.vx = dirX * d.speed; a.vy = dirY * d.speed;
    a.travelled = 0; a.ms = 0; a.owner = p; a.weapon = w; a.def = d; a.hit.length = 0;
    a.sprite.setTexture(d.flyTexture || 'axe').setVisible(true).setAlpha(1);
    return true;
  }

  catchAxe(a) {
    a.active = false;
    a.sprite.setVisible(false);
    if (a.weapon && a.weapon.ammo < a.weapon.def.ammo) a.weapon.ammo++;
  }

  // Room change / death: every axe goes straight back to its weapon.
  recallAll() {
    for (let i = 0; i < this.pool.length; i++) if (this.pool[i].active) this.catchAxe(this.pool[i]);
  }

  update(dt, ctx) {
    const sec = dt / 1000;
    for (let i = 0; i < this.pool.length; i++) {
      const a = this.pool[i];
      if (!a.active) continue;
      const d = a.def, p = a.owner;
      const fast = p && p.stats && p.stats.axeReturn > 0;
      if (!p || !p.alive) { this.catchAxe(a); continue; }

      if (a.state === 'fly' || a.state === 'back') {
        if (a.state === 'back') {
          const dx = p.sprite.x - a.x, dy = p.sprite.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const sp = d.returnSpeed * (fast ? 1.8 : 1);
          a.vx = dx / dist * sp; a.vy = dy / dist * sp;
          if (dist < 22) { this.catchAxe(a); continue; }
        }
        const nx = a.x + a.vx * sec, ny = a.y + a.vy * sec;
        if (a.state === 'fly' && this.rooms.solidAt(nx, ny)) {
          this.hitEnemies(a, ctx);              // an enemy pinned against the wall still gets hit
          this.drop(a, fast); continue;
        }
        a.x = nx; a.y = ny;
        a.travelled += Math.sqrt(a.vx * a.vx + a.vy * a.vy) * sec;
        if (a.state === 'fly' && a.travelled >= d.range) { this.drop(a, fast); continue; }
        this.hitEnemies(a, ctx);
        a.spin += sec * 18;
      } else if (a.state === 'stuck') {
        a.ms -= dt;
        const dx = p.sprite.x - a.x, dy = p.sprite.y - a.y;
        a.stuckFor += dt;
        if (a.stuckFor > 250 && dx * dx + dy * dy < 30 * 30) { this.catchAxe(a); continue; }   // picked up (not the same instant it lands)
        if (a.ms <= 0) { a.state = 'back'; a.hit.length = 0; }
      }
      a.sprite.setPosition(a.x, a.y).setRotation(a.spin);
    }
  }

  drop(a, fast) {
    a.state = 'stuck';
    a.stuckFor = 0;
    a.ms = a.def.stuckMs * (fast ? 0.08 : 1);
  }

  hitEnemies(a, ctx) {
    const d = a.def, p = a.owner;
    const list = ctx.enemies.targets();
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!e.active || a.hit.indexOf(e) !== -1) continue;
      const dx = e.x - a.x, dy = e.y - a.y;
      const r = 14 + e.def.size / 2;
      if (dx * dx + dy * dy > r * r) continue;
      a.hit.push(e);
      const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1;
      ctx.hitEnemy(e, Math.round(d.damage * p.stats.damageMul), a.vx / sp, a.vy / sp, d.knockback, d.knockbackMs, p);
      if (e.active) ctx.wallStun(e, d.knockbackMs + 120, d.wallStunMs);
      if (d.injure && e.active && !e.isBossPart && Math.random() < d.injure.chance) {
        ctx.enemies.bleed(e, d.injure.bleedMs, Math.max(1, Math.round(d.injure.bleedTick * p.stats.damageMul)), p);
        ctx.enemies.slow(e, d.injure.slowMs, d.injure.slowPct);
      }
    }
  }
}
