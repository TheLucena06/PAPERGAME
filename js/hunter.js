/* hunter.js
   More Hunter skills (precision · Hunter):
     ★    Bear Trap        set a trap where you aim: the first enemy to step in is snapped shut (stuck + hurt)
     ★    Tomahawk Volley  throw a fan of 5 tomahawks
     ★★   Hawk Strike      a hawk dives at enemies near your aim 4 times and MARKS them (+25% damage taken)
     ★★★  Apex Predator    8 s: +25% damage, +20% speed, +15% crit; your hits mark enemies
   MARKED enemies take +25% damage from everyone for 5 s (hitEnemy in main.js). */

const HUNTER_RULES = { markMul: 1.25, markMs: 5000 };

Object.assign(EFFECT_TYPES, {
  apexPredator: { name: 'Apex Predator', durationMs: 8000, mods: { damageMul: 0.25, moveSpeedMul: 0.20, critChance: 0.15 }, markOnHit: true }
});

Object.assign(SKILL_TYPES, {
  bearTrap: {
    name: 'Bear Trap', short: 'TRAP', kind: 'bearTrap', class: 'precision', sub: 'Hunter', price: 35,
    desc: 'Set a trap where you aim (2 at most).\nThe first enemy to step in is snapped:\n35 damage and stuck 2.5 s (bosses: slowed).',
    manaCost: 18, cooldownMs: 5000, range: 150, damage: 35, stuckMs: 2500, max: 2, lifeMs: 30000, radius: 22
  },
  tomahawkVolley: {
    name: 'Tomahawk Volley', short: 'VOLY', kind: 'fan', class: 'precision', sub: 'Hunter', price: 45,
    desc: 'Throw a fan of 5 tomahawks (22 each).',
    manaCost: 25, cooldownMs: 7000, count: 5, spreadDeg: 14, damage: 22, speed: 540, lifetimeMs: 600, texture: 'axe'
  },
  hawkStrike: {
    name: 'Hawk Strike', short: 'HAWK', kind: 'hawkStrike', class: 'precision', sub: 'Hunter', price: 80, postBoss: POST_BOSS_1,
    desc: 'A hawk dives at enemies near your aim\n4 times (26 each) and MARKS them:\nmarked enemies take +25% damage for 5 s.',
    manaCost: 35, cooldownMs: 11000, range: 260, seek: 260, dives: 4, damage: 26, diveMs: 380
  },
  apexPredator: {
    name: 'Apex Predator', short: 'APEX', kind: 'effect', class: 'precision', sub: 'Hunter', price: 120, postBoss: POST_BOSS_2,
    desc: '8 s: +25% damage, +20% speed, +15% crit,\nand every hit MARKS the enemy\n(+25% damage taken for 5 s).',
    manaCost: 45, cooldownMs: 22000, effect: 'apexPredator'
  }
});

Object.assign(SKILL_BEHAVIORS, {
  bearTrap(p, d, ctx) {
    const sc = ctx.scene;
    if (!sc || !sc.hunterTraps) return false;
    let x = p.sprite.x, y = p.sprite.y;
    for (let r = d.range; r >= 0; r -= 15) {
      const tx = p.sprite.x + p.input.aimX * r, ty = p.sprite.y + p.input.aimY * r;
      if (!ctx.rooms.solidAt(tx, ty)) { x = tx; y = ty; break; }
    }
    const mine = sc.hunterTraps.filter((t) => t.owner === p);
    if (mine.length >= d.max) sc.hunterTraps.splice(sc.hunterTraps.indexOf(mine[0]), 1);   // oldest one goes
    sc.hunterTraps.push({ x: x, y: y, owner: p, d: d, ms: d.lifeMs, shutMs: 0 });
    ctx.fx(x, y, 22, 0x8d6e63, 200);
    return true;
  },
  hawkStrike(p, d, ctx) {
    const sc = ctx.scene;
    if (!sc || !sc.hawks) return false;
    const tx = p.sprite.x + p.input.aimX * d.range, ty = p.sprite.y + p.input.aimY * d.range;
    sc.hawks.push({ owner: p, d: d, x: p.sprite.x, y: p.sprite.y - 40, tx: tx, ty: ty, dives: d.dives, ms: 0, target: null, fromX: p.sprite.x, fromY: p.sprite.y - 40 });
    return true;
  }
});

const HunterMixin = {
  setupHunter() { this.hunterTraps = []; this.hawks = []; this.hunterG = this.add.graphics().setDepth(4); this.hawkG = this.add.graphics().setDepth(83); },

  // New room: traps and hawks stay behind.
  hunterRoom() { this.hunterTraps.length = 0; this.hawks.length = 0; },

  markEnemy(e) { if (e && e.active) e.markUntil = this.time.now + HUNTER_RULES.markMs; },

  updateHunter(dt) {
    const g = this.hunterG, hg = this.hawkG, now = this.time.now, playing = this.mode === 'play';
    g.clear(); hg.clear();
    // ---- traps
    for (let i = this.hunterTraps.length - 1; i >= 0; i--) {
      const t = this.hunterTraps[i], d = t.d;
      if (playing) t.ms -= dt;
      if (t.shutMs > 0) { if (playing) t.shutMs -= dt; if (t.shutMs <= 0 || t.ms <= 0) { this.hunterTraps.splice(i, 1); continue; } }
      else if (t.ms <= 0) { this.hunterTraps.splice(i, 1); continue; }
      else if (playing) {
        const list = this.enemies.targets();
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (!e.active || e.state === 'bones' || (e.def && e.def.ghost)) continue;
          const dx = e.x - t.x, dy = e.y - t.y, rr = d.radius + ((e.def && e.def.size) || 20) / 2;
          if (dx * dx + dy * dy > rr * rr) continue;
          t.shutMs = 600;
          this.hitEnemy(e, Math.round(d.damage * t.owner.stats.damageMul), 0, 0, 0, 0, t.owner);
          if (e.active) { if (GearFx.isBoss(e)) GearFx.chill(this.enemies, e, { ms: d.stuckMs, pct: 0.5 }); else this.enemies.stun(e, d.stuckMs); }
          this.hud.addFx(t.x, t.y, 26, 0xbcaaa4, 200);
          break;
        }
      }
      // drawing: open jaws / snapped shut
      const shut = t.shutMs > 0;
      g.lineStyle(3, 0x5d4037, 1); g.strokeCircle(t.x, t.y, 14);
      g.lineStyle(2, 0x9e9e9e, 1);
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, r1 = shut ? 6 : 14, r2 = shut ? 2 : 20;
        g.lineBetween(t.x + Math.cos(a) * r1, t.y + Math.sin(a) * r1, t.x + Math.cos(a) * r2, t.y + Math.sin(a) * r2);
      }
      if (!shut) { g.fillStyle(0x8d6e63, 1); g.fillCircle(t.x, t.y, 4); }
      if (this.lighting) this.lighting.add(t.x, t.y, 40);
    }
    // ---- hawks: fly to an enemy near the aim, dive, mark it, come back up, repeat
    for (let i = this.hawks.length - 1; i >= 0; i--) {
      const h = this.hawks[i], d = h.d;
      if (playing) h.ms -= dt;
      if (h.ms <= 0) {
        if (h.target && h.target.active && h.diving) {
          this.hitEnemy(h.target, Math.round(d.damage * h.owner.stats.damageMul), 0, 0, 0, 0, h.owner);
          this.markEnemy(h.target);
          this.hud.addFx(h.target.x, h.target.y, 20, 0xffb300, 180);
          h.dives--;
        }
        if (h.dives <= 0) { this.hawks.splice(i, 1); continue; }
        // next target: nearest enemy to the aim point
        let best = null, bd = d.seek * d.seek;
        const list = this.enemies.targets();
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (!e.active || e.state === 'bones') continue;
          const dd = (e.x - h.tx) * (e.x - h.tx) + (e.y - h.ty) * (e.y - h.ty);
          if (dd < bd) { bd = dd; best = e; }
        }
        if (!best) {                                   // nobody near the aim: look around the owner
          bd = 400 * 400;
          for (let k = 0; k < list.length; k++) { const e = list[k]; if (!e.active || e.state === 'bones') continue; const dd = (e.x - h.owner.sprite.x) ** 2 + (e.y - h.owner.sprite.y) ** 2; if (dd < bd) { bd = dd; best = e; } }
        }
        if (!best) { h.dives--; h.diving = false; h.ms = d.diveMs; h.target = null; if (h.dives <= 0) { this.hawks.splice(i, 1); } continue; }
        h.target = best; h.diving = true; h.fromX = h.x; h.fromY = h.y; h.ms = d.diveMs;
      }
      const k = 1 - Math.max(0, h.ms) / d.diveMs;
      const ex = h.target && h.target.active ? h.target.x : h.tx, ey = h.target && h.target.active ? h.target.y : h.ty;
      h.x = h.fromX + (ex - h.fromX) * k; h.y = h.fromY + (ey - h.fromY) * k - Math.sin(k * Math.PI) * 60;
      // the hawk
      const flap = Math.sin(now / 50) * 6, ang = Math.atan2(ey - h.fromY, ex - h.fromX);
      hg.fillStyle(0x6d4c41, 1);
      hg.fillTriangle(h.x - 12, h.y - flap, h.x + 12, h.y - flap, h.x, h.y + 4);
      hg.fillStyle(0x8d6e63, 1); hg.fillCircle(h.x, h.y, 5);
      hg.fillStyle(0xffb300, 1); hg.fillTriangle(h.x + Math.cos(ang) * 5, h.y + Math.sin(ang) * 5, h.x + Math.cos(ang) * 11, h.y + Math.sin(ang) * 11, h.x + Math.cos(ang + 0.5) * 5, h.y + Math.sin(ang + 0.5) * 5);
      if (this.lighting) this.lighting.add(h.x, h.y, 50);
    }
    // marked enemies: a little orange target over their head
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || !(e.markUntil > now)) continue;
      const s = (e.def && e.def.size) || 24, y = e.y - s * 0.7 - 10;
      hg.lineStyle(2, 0xff9800, 0.9); hg.strokeCircle(e.x, y, 6); hg.lineBetween(e.x - 9, y, e.x + 9, y); hg.lineBetween(e.x, y - 9, e.x, y + 9);
    }
  }
};

