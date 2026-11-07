/* hazards.js
   HazardManager: things lying on (or flying over) the floor. Pooled.
   - Enemy bombs (Bomber): lobbed over walls to where you stood. If you are
     there when it lands, it explodes right away; otherwise it stays on the
     floor, blinks, and explodes after its fuse.
   - Bear traps (player item): placed at your feet. The first enemy that
     steps on one takes big damage, is stunned, then slowed.
   Drawing is done by the HUD (drawHazards). */

const HAZARD_POOL = 24;

class HazardManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    for (let i = 0; i < HAZARD_POOL; i++) {
      this.list.push({ active: false, kind: '', x: 0, y: 0, x0: 0, y0: 0, x1: 0, y1: 0, ms: 0, total: 1,
                       def: null, dmgMul: 1, owner: null, armMs: 0 });
    }
    // set by the scene
    this.players = null;
    this.ctx = null;           // combat context (targets, hitEnemy, stunEnemy, slowEnemy, fx)
    this.onPlayerHit = null;   // (player, result, attacker)
  }

  get() {
    for (let i = 0; i < this.list.length; i++) if (!this.list[i].active) return this.list[i];
    return null;
  }

  clear() {
    for (let i = 0; i < this.list.length; i++) this.list[i].active = false;
  }

  lobBomb(x0, y0, x1, y1, bombDef, dmgMul, owner) {
    const h = this.get();
    if (!h) return;
    h.active = true; h.kind = 'lob';
    h.x0 = x0; h.y0 = y0; h.x1 = x1; h.y1 = y1; h.x = x0; h.y = y0;
    h.ms = bombDef.flightMs; h.total = bombDef.flightMs;
    h.def = bombDef; h.dmgMul = dmgMul; h.owner = owner;
  }

  placeTrap(x, y, trapDef, owner) {
    const h = this.get();
    if (!h) return false;
    h.active = true; h.kind = 'trap';
    h.x = x; h.y = y; h.def = trapDef; h.owner = owner;
    h.armMs = 500; h.ms = 0;
    return true;
  }

  explode(h) {
    const d = h.def;
    this.damagePlayers(h.x, h.y, d.radius, Math.round(d.damage * h.dmgMul), h.owner);
    this.ctx.fx(h.x, h.y, d.radius, 0xff7043, 320);
    this.scene.cameras.main.shake(120, 0.004);
    h.active = false;
  }

  damagePlayers(x, y, radius, dmg, attacker) {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;
      const r = radius + p.stats.size / 2;
      const dx = p.sprite.x - x, dy = p.sprite.y - y;
      if (dx * dx + dy * dy > r * r) continue;
      const res = p.takeHit(dmg, x, y);
      if (this.onPlayerHit) this.onPlayerHit(p, res, attacker);
    }
  }

  update(dt) {
    for (let i = 0; i < this.list.length; i++) {
      const h = this.list[i];
      if (!h.active) continue;

      if (h.kind === 'lob') {
        h.ms -= dt;
        const k = 1 - Math.max(0, h.ms) / h.total;
        h.x = h.x0 + (h.x1 - h.x0) * k;
        h.y = h.y0 + (h.y1 - h.y0) * k;
        if (h.ms <= 0) {
          // landed: direct hit on a player = boom now
          let direct = false;
          for (let p = 0; p < this.players.length; p++) {
            const pl = this.players[p];
            if (!pl.alive) continue;
            const dx = pl.sprite.x - h.x, dy = pl.sprite.y - h.y;
            const r = h.def.hitRadius + pl.stats.size / 2;
            if (dx * dx + dy * dy <= r * r) { direct = true; break; }
          }
          if (direct) {
            this.damagePlayers(h.x, h.y, h.def.hitRadius, Math.round(h.def.directDamage * h.dmgMul), h.owner);
            this.explode(h);
          } else {
            h.kind = 'bomb'; h.ms = h.def.fuseMs; h.total = h.def.fuseMs;
          }
        }
      } else if (h.kind === 'bomb') {
        h.ms -= dt;
        if (h.ms <= 0) this.explode(h);
      } else if (h.kind === 'trap') {
        if (h.armMs > 0) { h.armMs -= dt; continue; }
        const list = this.ctx.enemies.targets();
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (!e.active) continue;
          const dx = e.x - h.x, dy = e.y - h.y;
          const r = 16 + e.def.size / 2;
          if (dx * dx + dy * dy > r * r) continue;
          // SNAP
          const d = h.def;
          const mul = h.owner && h.owner.stats ? h.owner.stats.damageMul : 1;
          this.ctx.hitEnemy(e, Math.round(d.damage * mul), 0, 0, 0, 0, h.owner);
          if (e.active) {
            this.ctx.stunEnemy(e, d.stunMs);
            this.ctx.slowEnemy(e, d.stunMs + d.slowMs, d.slowPct);
          }
          this.ctx.fx(h.x, h.y, 30, 0x9e9e9e, 260);
          h.active = false;
          break;
        }
      }
    }
  }
}
