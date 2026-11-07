/* projectiles.js
   ProjectileManager: a fixed pool of bullets that get reused.
   Used twice: once for player shots (arrows, bolts, fireballs, bombs,
   reflected bullets), once for enemy bullets. Never created or destroyed
   during play.
   Extra bullet fields: pierceLeft (arrows), aoeRadius (explodes),
   fuse (bombs: ignore enemies, explode when time runs out),
   homing (turn speed in radians/s; steers toward the nearest enemy). */

class ProjectileManager {
  constructor(scene, maxProjectiles, worldWidth, worldHeight, textureKey) {
    this.scene = scene;
    this.worldW = worldWidth;
    this.worldH = worldHeight;
    this.defaultTexture = textureKey;
    this.onExplode = null; // set by the scene: called when an aoe bullet expires
    this.homingTargets = null; // set by the scene: enemy group for homing shots
    this.group = scene.physics.add.group({ maxSize: maxProjectiles });

    for (let i = 0; i < maxProjectiles; i++) {
      const b = this.group.create(-100, -100, textureKey);
      b.isBullet = true;
      b.manager = this;   // so collision code knows which pool it belongs to
      b.hitList = [];     // enemies already hit (for piercing shots)
      b.pierceLeft = 0;
      b.aoeRadius = 0;
      b.fuse = false;
      b.homing = 0; b.target = null; b.retargetMs = 0; b.speed = 0;
      b.setDepth(8);
      this.fitBody(b);
      b.disableBody(true, true);
    }
  }

  // Round hitbox centered on the sprite, whatever its texture.
  fitBody(b) {
    const r = Math.max(4, Math.min(b.width, b.height) / 2);
    b.body.setCircle(r, b.width / 2 - r, b.height / 2 - r);
  }

  // Returns the bullet, or null if the pool is empty (cap reached).
  fire(x, y, dirX, dirY, speed, damage, lifetimeMs, owner, textureKey) {
    const b = this.group.getFirstDead(false);
    if (!b) return null;
    const key = textureKey || this.defaultTexture;
    if (b.texture.key !== key) { b.setTexture(key); this.fitBody(b); }
    else if (b.customBody) this.fitBody(b);
    b.customBody = false;
    b.enableBody(true, x, y, true, true);
    b.setVelocity(dirX * speed, dirY * speed);
    b.rotation = Math.atan2(dirY, dirX);
    b.damage = damage;
    b.lifeMs = lifetimeMs;
    b.owner = owner;
    b.pierceLeft = 0;
    b.aoeRadius = 0;
    b.fuse = false;
    b.homing = 0; b.target = null; b.retargetMs = 0; b.speed = speed;
    b.flags = null; b.isArrow = false; b.knockback = 0; b.burnMs = 0; b.burnTick = 0; b.crippling = null; b.firstDamage = 0; b.split = null; b.ignite = null; b.chill = null; b.chain = null; b.stunHit = 0; b.reflected = false; b.hex = null; b.poison = null; b.wind = false;
    b.hitList.length = 0;
    return b;
  }

  // Room size changed (big arenas scroll): shots are removed only when they leave the room.
  setArea(w, h) { this.worldW = w; this.worldH = h; }

  update(dt) {
    const list = this.group.getChildren();
    const m = 20;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) continue;
      b.lifeMs -= dt;
      if (b.homing > 0 && this.homingTargets) this.steer(b, dt);
      if (b.lifeMs <= 0 || b.x < -m || b.y < -m || b.x > this.worldW + m || b.y > this.worldH + m) {
        if (b.aoeRadius > 0 && this.onExplode) this.onExplode(b);
        this.kill(b);
      }
    }
  }

  // Turns a homing shot toward the nearest enemy (target re-picked every 150 ms).
  steer(b, dt) {
    b.retargetMs -= dt;
    if (b.retargetMs <= 0 || !b.target || !b.target.active) {
      b.retargetMs = 150;
      b.target = null;
      let bd = 420 * 420;
      const list = this.homingTargets.getChildren();
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.active || b.hitList.indexOf(e) !== -1) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        const dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; b.target = e; }
      }
    }
    if (!b.target) return;
    const want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
    let cur = Math.atan2(b.body.velocity.y, b.body.velocity.x);
    let diff = want - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = b.homing * dt / 1000;
    cur += Math.max(-maxTurn, Math.min(maxTurn, diff));
    b.setVelocity(Math.cos(cur) * b.speed, Math.sin(cur) * b.speed);
    b.rotation = cur;
  }

  kill(b) {
    b.disableBody(true, true);
  }

  killAll() {
    const list = this.group.getChildren();
    for (let i = 0; i < list.length; i++) if (list[i].active) this.kill(list[i]);
  }
}
