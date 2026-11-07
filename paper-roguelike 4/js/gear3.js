/* gear3.js  (Phase 3a)
   Shared mechanics for the new gear, used by arcane.js and the melee/precision fills:
   - WeaponSystem.castShot: fires a "shot" definition (count, spread, pierce, homing,
     ignite, chill, chain, stun, aoe, knockback) in one call.
   - Bullet effects on hit (GearFx.onBulletHit, called from GameScene.onBulletHitsEnemy).
   - New weapon kinds: orbit (orbs circle you while you hold attack, released as shots)
     and tome (each cast turns the page to the next spell).
   - New skill kinds: shot, burst, blink, zone, storm, freezeAll (mega spells use these).
   - ZoneManager: areas that stay for a while (Hurricane, fire pillars, storms...).
   - SET_BONUSES: wear 2 / 4 / 6 items of one sub class for stronger bonuses.
   - Melee vs bosses: melee weapons deal more to bosses (bossMul, swords more).
   Loaded after skills.js; it only ADDS to the tables there. */

/* ---------------- shots ---------------- */
// sh: { damage, speed, lifetimeMs, texture, count, spreadDeg, pierce, homing, aoe, knockback,
//       ignite:{ms,tick}, chill:{ms,pct}, chain:{n,range,dmgMul}, stunMs, split }
WeaponSystem.castShot = function (p, ctx, sh, angle, dmgMul) {
  const n = sh.count || 1, total = n > 1 ? (sh.spreadDeg || 0) : 0;
  const step = n > 1 ? total / (n - 1) : 0, start = angle - (total / 2) * Math.PI / 180;
  const dmg = Math.round(sh.damage * p.stats.damageMul * (dmgMul || 1));
  let last = null;
  for (let i = 0; i < n; i++) {
    let a = start + i * step * Math.PI / 180;
    if (sh.jitterDeg) a += (Math.random() - 0.5) * sh.jitterDeg * Math.PI / 180;
    const b = this.shoot(p, ctx, Math.cos(a), Math.sin(a), sh.speed, dmg, sh.lifetimeMs, sh.texture);
    if (!b) continue;
    GearFx.applyShot(b, sh);
    last = b;
  }
  return last;
};

const GearFx = {
  applyShot(b, sh) {
    b.pierceLeft = sh.pierce || 0;
    b.homing = sh.homing || 0;
    if (sh.aoe) b.aoeRadius = sh.aoe;
    if (sh.knockback) b.knockback = sh.knockback;
    if (sh.split) b.split = sh.split;
    b.ignite = sh.ignite || null;
    b.chill = sh.chill || null;
    b.chain = sh.chain || null;
    if (b.chain && b.owner && b.owner.stats && b.owner.stats.chainBonus) b.chain = { n: b.chain.n + b.owner.stats.chainBonus, range: b.chain.range, dmgMul: b.chain.dmgMul };
    b.stunHit = sh.stunMs || 0;
    b.hex = sh.hex || null;
    b.poison = sh.poison || null;
    b.wind = !!sh.wind;
  },
  // Archmage Staff: its bolts copy the magic of your OTHER weapon (burn, slow, chains, hex, poison, wind).
  borrowed(p, w) {
    const other = p.weaponStates[1 - p.activeWeapon];
    const out = { ignite: null, chill: null, chain: null, hex: null, poison: null, wind: false };
    if (!other) return out;
    const d = other.def, src = [d, d.release, d.projectile].concat(d.pages || []);
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      if (!s) continue;
      for (const k of ['ignite', 'chill', 'chain', 'hex', 'poison']) if (s[k] && !out[k]) out[k] = s[k];
      if (s.wind) out.wind = true;
      if (s.injure && !out.poison) out.poison = { ms: s.injure.bleedMs, tick: s.injure.bleedTick };
    }
    return out;
  },
  // Elements of a shot / area: what it can react with (see react()).
  tagsOf(o) {
    const t = this._tags || (this._tags = {});
    t.fire = !!o.ignite; t.ice = !!o.chill; t.shock = !!(o.chain || o.shock); t.wind = !!o.wind;
    return t;
  },
  /* Hidden element reactions: a hit reacts with what the enemy ALREADY has on it.
     fire on a chilled enemy = thermal shock (extra hit) · ice on a burning enemy = steam (blast around it)
     shock on a chilled enemy = conducted (stun) · shock on a burning enemy = the fire jumps to 2 neighbours
     wind on a burning enemy = firestorm (fire spreads to everything close) */
  react(scene, e, t, owner, dmg) {
    if (!e.active || !e.def) return;
    const now = scene.time.now;
    if (e.reactAt && now - e.reactAt < 250) return;
    const burning = e.burnUntil > now, chilled = e.chillUntil > now;
    if (!burning && !chilled) return;
    let name = null;
    if (t.fire && chilled) {
      name = 'Thermal shock!';
      e.chillUntil = 0; e.slowMs = 0;
      scene.hitEnemy(e, Math.max(4, Math.round(dmg * 0.8)), 0, 0, 0, 0, owner, 'react');
      scene.hud.addFx(e.x, e.y, 34, 0xffccbc, 260);
    } else if (t.ice && burning) {
      name = 'Steam!';
      e.burnUntil = 0; e.bleedMs = 0;
      GearFx.burst(scene, null, e.x, e.y, 75, { damage: Math.max(6, Math.round(dmg * 0.7)), color: 0xeceff1, knockback: 220, owner: owner });
    } else if (t.shock && chilled) {
      name = 'Conducted!';
      scene.enemies.stun(e, 700);
      scene.hud.addFx(e.x, e.y, 30, 0x80deea, 240);
    } else if ((t.shock || t.wind) && burning) {
      name = t.wind ? 'Firestorm!' : 'Wildfire!';
      const list = scene.enemies.targets(), r = t.wind ? 120 : 150;
      let n = 0;
      for (let i = 0; i < list.length && (t.wind || n < 2); i++) {
        const o = list[i];
        if (!o.active || o === e || o.burnUntil > now) continue;
        const dx = o.x - e.x, dy = o.y - e.y;
        if (dx * dx + dy * dy > r * r) continue;
        GearFx.ignite(scene.enemies, o, { ms: 3000, tick: 4 }, owner);
        scene.hud.lineFx(e.x, e.y, o.x, o.y, 0xff7043);
        n++;
      }
      if (!n) name = null;
    }
    if (!name) return;
    e.reactAt = now;
    // a short word the first times you find it (once per 2 s per kind)
    const seen = this._seen || (this._seen = {});
    if (!seen[name] || now - seen[name] > 2000) { seen[name] = now; scene.hud.floatText(e.x, e.y - 30, name, '#6d4c41'); }
  },
  chill(em, e, ch) {
    em.slow(e, ch.ms, ch.pct);
    if (!e.isBossPart) e.chillUntil = Math.max(e.chillUntil || 0, em.scene.time.now + ch.ms);
  },
  // Hex (Witch): the enemy takes +25% damage from everything while it lasts.
  hex(em, e, hx, owner) {
    if (e.isBossPart) return;
    const ms = hx.ms * (1 + (owner && owner.stats ? owner.stats.hexTime : 0));
    e.hexUntil = Math.max(e.hexUntil || 0, em.scene.time.now + ms);
  },
  // Poison: damage over time, no element.
  poison(em, e, ps, owner) {
    const st = owner && owner.stats ? owner.stats : null;
    em.bleed(e, ps.ms, Math.max(1, Math.round(ps.tick * (st ? st.damageMul : 1))), owner);
  },
  // everything a shot / area does to one enemy it touched (statuses after the reaction check)
  applyAll(scene, e, o, owner, dmg) {
    if (o.ignite || o.chill || o.chain || o.shock || o.wind) this.react(scene, e, this.tagsOf(o), owner, dmg);
    if (!e.active) return;
    if (o.ignite) GearFx.ignite(scene.enemies, e, o.ignite, owner);
    if (o.chill) GearFx.chill(scene.enemies, e, o.chill);
    if (o.hex) GearFx.hex(scene.enemies, e, o.hex, owner);
    if (o.poison) GearFx.poison(scene.enemies, e, o.poison, owner);
    const st = o.stunHit || o.stunMs;
    if (st) scene.enemies.stun(e, st);
  },
  // After a player bullet hit `e` (still alive or not).
  onBulletHit(scene, b, e, owner) {
    // (b may be re-used by the pool for the next shot, so copy what we need first)
    const ch = b.chain, chill = b.chill, ign = b.ignite, dmgB = b.damage;
    GearFx.applyAll(scene, e, b, owner, dmgB);
    if (ch && ch.n > 0) {
      // jump to the nearest other enemy
      const list = scene.enemies.targets();
      let best = null, bd = ch.range * ch.range;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (!o.active || o === e || (b.hitList && b.hitList.indexOf(o) !== -1)) continue;
        const dx = o.x - e.x, dy = o.y - e.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        const dx = best.x - e.x, dy = best.y - e.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nb = scene.playerBullets.fire(e.x, e.y, dx / len, dy / len, 900, Math.max(1, Math.round(dmgB * ch.dmgMul)), 400, owner, 'spark');
        if (nb) {
          nb.chain = { n: ch.n - 1, range: ch.range, dmgMul: ch.dmgMul };
          nb.chill = chill; nb.ignite = ign;
          if (e.active) nb.hitList.push(e);
          scene.hud.lineFx && scene.hud.lineFx(e.x, e.y, best.x, best.y, 0xb39ddb);
        }
      }
    }
  },
  // Hit everything in a circle (skills, tome novas, mega spells). o: { damage, stunMs, chill, ignite, knockback (neg = pull), color }
  burst(scene, p, x, y, r, o) {
    const list = scene.enemies.targets();
    const dmg = Math.round((o.damage || 0) * (p ? p.stats.damageMul : 1));
    if (o.heal && p) {           // druid pages: heal yourself
      p.hp = Math.min(p.stats.maxHp, p.hp + o.heal);
      scene.hud.addFx(p.sprite.x, p.sprite.y, 26, 0x81c784, 260);
    }
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.def.size / 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const kb = o.knockback || 0;
      if (dmg > 0) scene.hitEnemy(e, dmg, dx / len, dy / len, kb > 0 ? kb : 0, kb > 0 ? 160 : 0, p);
      if (!e.active) continue;
      if (kb < 0) scene.combatContext.knockEnemy(e, -dx / len, -dy / len, -kb, 160);
      GearFx.applyAll(scene, e, o, p || o.owner || null, dmg);
      if (o.drain && p && p.alive && dmg > 0) p.hp = Math.min(p.stats.maxHp, p.hp + Math.max(1, Math.round(dmg * o.drain)));
    }
    if (o.color !== null) scene.hud.addFx(x, y, r, o.color || 0x9575cd, o.fxMs || 300);
  },
  // Set on fire (burn = damage over time). burnDamage / burnTime stats make it stronger / longer (fire builds).
  ignite(em, e, ig, owner) {
    const st = owner && owner.stats ? owner.stats : null;
    const ms = ig.ms * (1 + (st ? st.burnTime : 0));
    const tick = Math.max(1, Math.round(ig.tick * (st ? st.damageMul * (1 + st.burnDamage) : 1)));
    em.bleed(e, ms, tick, owner);
    if (!e.isBossPart) e.burnUntil = Math.max(e.burnUntil || 0, em.scene.time.now + ms);
  },
  isBoss(e) {
    return !!(e.isBossPart || e.champion || (e.def && (e.def.boss || e.def.bossPart || e.def.miniBoss)));
  }
};

/* ---------------- new weapon kinds ---------------- */
// ORBIT (orb weapons): hold attack = orbs circle you and hit what they touch (drains mana).
// Let go after charging = the orbs fly toward your aim as shots.
WEAPON_BEHAVIORS.orbit = function (p, w, dt, ctx) {
  const d = w.def, s = p.stats;
  if (w.cooldownMs > 0) w.cooldownMs -= dt;
  w.orbAng = (w.orbAng || 0) + dt / 1000 * d.spinSpeed * (w.channel ? 1 : 0.35);
  const cost = d.manaPerSec * s.manaCostMul * dt / 1000;
  if (p.input.attack && w.cooldownMs <= 0 && p.mana >= cost) {
    p.spendMana(cost);
    w.channel = true;
    w.channelMs = (w.channelMs || 0) + dt;
    const now = performance.now();
    const list = ctx.enemies.targets();
    for (let k = 0; k < d.orbs; k++) {
      const a = w.orbAng + k * Math.PI * 2 / d.orbs;
      const ox = p.sprite.x + Math.cos(a) * d.radius, oy = p.sprite.y + Math.sin(a) * d.radius;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.active) continue;
        const dx = e.x - ox, dy = e.y - oy, rr = d.orbSize + e.def.size / 2;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (e.orbHitAt && now - e.orbHitAt < d.hitCdMs) continue;
        e.orbHitAt = now;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const od = Math.round(d.orbDamage * s.damageMul);
        ctx.hitEnemy(e, od, dx / len, dy / len, d.knockback || 80, 80, p);
        GearFx.applyAll(ctx.scene, e, d, p, od);
      }
    }
  } else if (w.channel) {
    // released: throw the orbs
    if (w.channelMs >= (d.releaseAfterMs || 400) && d.release) {
      WeaponSystem.castShot(p, ctx, Object.assign({ count: d.orbs }, d.release), Math.atan2(p.input.aimY, p.input.aimX));
      w.cooldownMs = d.releaseCdMs || 500;
      w.swingFxMs = 120; w.swingKind = 'release';
    }
    w.channel = false; w.channelMs = 0;
  }
};

// TOME: hold attack to keep casting; every cast is the next page (spell) of the book.
WEAPON_BEHAVIORS.tome = function (p, w, dt, ctx) {
  const d = w.def, s = p.stats;
  w.cooldownMs = (w.cooldownMs || 0) - dt;
  if (w.page === undefined) w.page = 0;
  if (p.input.attack && w.cooldownMs <= 0) {
    const pg = d.pages[w.page];
    const cost = (pg.manaCost !== undefined ? pg.manaCost : d.manaCost) * s.manaCostMul;
    if (p.spendMana(cost)) {
      const ang = Math.atan2(p.input.aimY, p.input.aimX);
      if (pg.type === 'nova') GearFx.burst(ctx.scene, p, p.sprite.x, p.sprite.y, pg.radius, pg);
      else if (pg.type === 'summon') { if (ctx.allies.spawn(pg.ally, p.sprite.x + p.input.aimX * 30, p.sprite.y + p.input.aimY * 30, p)) ctx.fx(p.sprite.x + p.input.aimX * 30, p.sprite.y + p.input.aimY * 30, 22, pg.color || 0xeceff1, 240); }
      else if (pg.type === 'point') {
        const dist = pg.range || 220;
        let tx = p.sprite.x + p.input.aimX * dist, ty = p.sprite.y + p.input.aimY * dist;
        if (ctx.rooms.solidAt(tx, ty)) { tx = p.sprite.x + p.input.aimX * dist * 0.5; ty = p.sprite.y + p.input.aimY * dist * 0.5; }
        GearFx.burst(ctx.scene, p, tx, ty, pg.radius, pg);
      } else WeaponSystem.castShot(p, ctx, pg, ang);
      w.cooldownMs = (pg.delayMs || d.fireDelayMs) / s.attackSpeedMul;
      w.page = (w.page + 1) % d.pages.length;
      w.swingFxMs = 140; w.swingKind = 'cast';
    }
  }
  if (w.cooldownMs < 0) w.cooldownMs = 0;
};

/* ---------------- new skill kinds ---------------- */
// Where a skill lands: d.atAim px toward the aim (stops before walls), else on you.
const SkillAim = {
  point(p, ctx, dist) {
    if (!dist) return { x: p.sprite.x, y: p.sprite.y };
    for (let r = dist; r >= 0; r -= 20) {
      const tx = p.sprite.x + p.input.aimX * r, ty = p.sprite.y + p.input.aimY * r;
      if (!ctx.rooms.solidAt(tx, ty)) return { x: tx, y: ty };
    }
    return { x: p.sprite.x, y: p.sprite.y };
  }
};
Object.assign(SKILL_BEHAVIORS, {
  // fires d.shot (can be several)
  shot(p, d, ctx) {
    WeaponSystem.castShot(p, ctx, d.shot, Math.atan2(p.input.aimY, p.input.aimX));
    SkillFx.mega(ctx, p, d);
    return true;
  },
  // instant circle on you or at your aim
  burst(p, d, ctx) {
    const pt = SkillAim.point(p, ctx, d.atAim);
    GearFx.burst(ctx.scene, p, pt.x, pt.y, d.radius, d);
    SkillFx.mega(ctx, p, d);
    return true;
  },
  // teleport toward your aim (not through walls); optional burst where you land
  blink(p, d, ctx) {
    const pt = SkillAim.point(p, ctx, d.distance);
    ctx.fx(p.sprite.x, p.sprite.y, 22, d.color || 0x9575cd, 220);
    p.sprite.body.reset(pt.x, pt.y);
    p.invulnMs = Math.max(p.invulnMs, d.invulnMs || 300);
    if (d.radius) GearFx.burst(ctx.scene, p, pt.x, pt.y, d.radius, d);
    else ctx.fx(pt.x, pt.y, 26, d.color || 0x9575cd, 260);
    return true;
  },
  // an area that stays (pull / damage ticks / slow / burn)
  zone(p, d, ctx) {
    const pt = SkillAim.point(p, ctx, d.atAim);
    if (!ctx.scene.zones) return false;
    ctx.scene.zones.add(p, d.zone, pt.x, pt.y);
    SkillFx.mega(ctx, p, d);
    return true;
  },
  // mega: strikes on random enemies for a while
  storm(p, d, ctx) {
    if (!ctx.scene.zones) return false;
    ctx.scene.zones.add(p, Object.assign({ storm: true }, d.zone), p.sprite.x, p.sprite.y);
    SkillFx.mega(ctx, p, d);
    return true;
  },
  // mega (Snowgrave): freeze everything on screen, then shatter it
  freezeAll(p, d, ctx) {
    if (!ctx.scene.zones) return false;
    const sc = ctx.scene, cam = sc.cameras.main, list = sc.enemies.targets();
    const frozen = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      if (e.x < cam.scrollX - 40 || e.x > cam.scrollX + cam.width + 40 || e.y < cam.scrollY - 40 || e.y > cam.scrollY + cam.height + 40) continue;
      if (e.isBossPart) e.stunnedMs = Math.max(e.stunnedMs || 0, 600);
      else if (GearFx.isBoss(e)) { e.stunnedMs = Math.max(e.stunnedMs || 0, d.bossFreezeMs); e.state = 'move'; e.stateMs = 0; e.setVelocity(0, 0); }
      else sc.enemies.stun(e, d.freezeMs);
      e.frozenMs = d.shatterDelayMs;
      frozen.push(e);
    }
    sc.zones.add(p, { freeze: true, durationMs: d.shatterDelayMs, radius: 0, color: 0xb3e5fc, targets: frozen, shatter: d }, p.sprite.x, p.sprite.y);
    SkillFx.mega(ctx, p, d);
    return true;
  }
});

Object.assign(SKILL_BEHAVIORS, {
  // mega (Necromancer): everything that died in this room rises (min 3, max 8)
  raiseArmy(p, d, ctx) {
    const n = Math.max(d.min, Math.min(d.max, ctx.scene.roomKills || 0));
    let made = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (ctx.allies.spawn(d.ally, p.sprite.x + Math.cos(a) * 60, p.sprite.y + Math.sin(a) * 60, p)) made++;
    }
    if (!made) return false;
    ctx.fx(p.sprite.x, p.sprite.y, 90, 0xeceff1, 400);
    SkillFx.mega(ctx, p, d);
    return true;
  },
  // mega (Necromancer): every enemy on screen loses life, you get some of it
  harvest(p, d, ctx) {
    const sc = ctx.scene, cam = sc.cameras.main, list = sc.enemies.targets();
    let total = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || e.x < cam.scrollX || e.x > cam.scrollX + cam.width || e.y < cam.scrollY || e.y > cam.scrollY + cam.height) continue;
      const dmg = Math.round((d.damage + (GearFx.isBoss(e) ? 0 : e.maxHp * d.pct)) * p.stats.damageMul);
      total += dmg;
      sc.hud.lineFx(e.x, e.y, p.sprite.x, p.sprite.y, 0x9c27b0);
      sc.hitEnemy(e, dmg, 0, 0, 0, 0, p);
    }
    p.hp = Math.min(p.stats.maxHp, p.hp + Math.min(Math.round(p.stats.maxHp * d.maxHealPct), Math.round(total * d.healPct)));
    SkillFx.mega(ctx, p, d);
    return true;
  }
});

const SkillFx = {
  // the big moment of a mega spell
  mega(ctx, p, d) {
    if (!d.mega) return;
    const sc = ctx.scene;
    sc.hud.showBanner(d.name + '!');
    sc.cameras.main.flash(260, (d.megaColor >> 16) & 255, (d.megaColor >> 8) & 255, d.megaColor & 255);
    sc.cameras.main.shake(260, 0.008);
  }
};

/* ---------------- zones ---------------- */
class ZoneManager {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(4);
    this.list = [];
    for (let i = 0; i < 8; i++) this.list.push({ active: false });
  }
  add(owner, z, x, y) {
    let s = this.list.find((q) => !q.active);
    if (!s) s = this.list[0];
    s.active = true; s.owner = owner; s.z = z; s.x = x; s.y = y; s.ms = z.durationMs; s.tick = 0; s.strikeMs = 0;
    return s;
  }
  clear() { for (let i = 0; i < this.list.length; i++) this.list[i].active = false; this.g.clear(); }
  update(dt) {
    const sc = this.scene, g = this.g, now = sc.time.now;
    g.clear();
    for (let i = 0; i < this.list.length; i++) {
      const s = this.list[i];
      if (!s.active) continue;
      const z = s.z;
      s.ms -= dt;
      if (z.freeze) {                                   // Snowgrave: frozen, then shatter
        g.fillStyle(0xe1f5fe, 0.12 + 0.08 * Math.sin(now / 90));
        const cam = sc.cameras.main; g.fillRect(cam.scrollX, cam.scrollY, cam.width, cam.height);
        if (s.ms <= 0) {
          const d = z.shatter, p = s.owner;
          for (let k = 0; k < z.targets.length; k++) {
            const e = z.targets[k];
            if (!e.active) continue;
            const big = GearFx.isBoss(e);
            const dmg = Math.round((d.shatterDamage + (big ? 0 : e.maxHp * d.shatterPct)) * (p ? p.stats.damageMul : 1) * (big ? d.bossMul : 1));
            sc.hitEnemy(e, dmg, 0, 0, 0, 0, p);
            sc.hud.addFx(e.x, e.y, (e.def.size || 30) / 2 + 16, 0x81d4fa, 380);
          }
          sc.cameras.main.flash(200, 225, 245, 254);
          sc.cameras.main.shake(220, 0.01);
          s.active = false;
        }
        continue;
      }
      if (z.storm) {                                    // strikes on random enemies
        s.strikeMs -= dt;
        if (s.strikeMs <= 0) {
          s.strikeMs += z.everyMs;
          const list = sc.enemies.targets(), alive = [];
          for (let k = 0; k < list.length; k++) if (list[k].active) alive.push(list[k]);
          if (alive.length) {
            const e = alive[Math.floor(Math.random() * alive.length)];
            GearFx.burst(sc, s.owner, e.x, e.y, z.radius, z);
            if (z.bolt) sc.hud.lineFx && sc.hud.lineFx(e.x, e.y - 260, e.x, e.y, z.color);
          }
        }
        if (s.ms <= 0) s.active = false;
        continue;
      }
      // standing area: ticks + pull
      const list = sc.enemies.targets(), sec = dt / 1000;
      if (z.pull) {
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (!e.active || GearFx.isBoss(e)) continue;
          const dx = s.x - e.x, dy = s.y - e.y, d2 = dx * dx + dy * dy;
          if (d2 > z.pullRadius * z.pullRadius || d2 < 16) continue;
          const len = Math.sqrt(d2);
          e.body.reset(e.x + dx / len * z.pull * sec, e.y + dy / len * z.pull * sec);
        }
      }
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick += z.tickMs;
        if (z.heal) for (let k = 0; k < sc.players.length; k++) {          // Healing Grove
          const q = sc.players[k], dx = q.sprite.x - s.x, dy = q.sprite.y - s.y;
          if (q.alive && dx * dx + dy * dy < z.radius * z.radius) { q.hp = Math.min(q.stats.maxHp, q.hp + z.heal); }
        }
        GearFx.burst(sc, s.owner, s.x, s.y, z.radius, Object.assign({}, z, { color: null, knockback: 0, heal: 0 }));
      }
      // draw
      const k = Math.max(0, s.ms) / z.durationMs;
      g.fillStyle(z.color, 0.12 + 0.1 * k); g.fillCircle(s.x, s.y, z.radius);
      g.lineStyle(2, z.color, 0.5 + 0.3 * k);
      if (z.pull) {
        for (let r = 0; r < 3; r++) { const a = now / 160 + r * 2.1; g.beginPath(); g.arc(s.x, s.y, z.radius * (0.35 + r * 0.25), a, a + 2.2); g.strokePath(); }
      } else g.strokeCircle(s.x, s.y, z.radius);
      if (s.ms <= 0) s.active = false;
    }
  }
}

/* ---------------- set bonuses ----------------
   Count = equipped items of that sub class (2 weapons, armor, 2 skills, item = up to 6). */
const SET_BONUSES = {
  Knight:      [[2, '+8% defense', { defense: 0.08 }], [4, '+15% damage to bosses', { bossDamage: 0.15 }], [6, '+25 max HP, +10% damage', { maxHp: 25, damageMul: 0.10 }]],
  Monk:        [[2, '+10% attack speed', { attackSpeedMul: 0.10 }], [4, '+10% speed, 8% dodge', { moveSpeedMul: 0.10, dodgeChance: 0.08 }], [6, '+20% damage', { damageMul: 0.20 }]],
  Berserker:   [[2, '3% life steal', { lifeSteal: 0.03 }], [4, '+15% damage', { damageMul: 0.15 }], [6, '+12% attack speed, +3% life steal', { attackSpeedMul: 0.12, lifeSteal: 0.03 }]],
  Miner:       [[2, 'blocks give +1 coin', { mineCoins: 1 }], [4, '+8% defense', { defense: 0.08 }], [6, '+15% damage', { damageMul: 0.15 }]],
  Archer:      [[2, '+12% charge speed', { chargeSpeedMul: 0.12 }], [4, '+10% damage', { damageMul: 0.10 }], [6, '+1 extra arrow per shot', { multiShot: 1 }]],
  Hunter:      [[2, '+8% speed', { moveSpeedMul: 0.08 }], [4, '+10% damage, 5% crit', { damageMul: 0.10, critChance: 0.05 }], [6, 'tomahawks return fast, +10% damage', { axeReturn: 1, damageMul: 0.10 }]],
  Mage:        [[2, '+20 max mana', { maxMana: 20 }], [4, '+20% mana regen, 5% crit', { manaRegenMul: 0.20, critChance: 0.05 }], [6, '+15% damage, -10% mana cost', { damageMul: 0.15, manaCostMul: -0.10 }]],
  'North Wizard': [[2, '+25 max mana', { maxMana: 25 }], [4, '-15% skill cooldown', { skillCooldownMul: -0.15 }], [6, '+15% damage, +8% defense', { damageMul: 0.15, defense: 0.08 }]]
};

Stats.countSub = function (player, sub) {
  let n = 0;
  for (let i = 0; i < 2; i++) { const d = Catalog.get('weapon', player.weapons[i]); if (d && d.sub === sub) n++; }
  const a = Catalog.get('armor', player.armor); if (a && a.sub === sub) n++;
  for (let i = 0; i < 2; i++) { const d = Catalog.get('skill', player.skills[i]); if (d && d.sub === sub) n++; }
  const c = Catalog.get('consumable', player.consumableId); if (c && c.sub === sub) n++;
  return n;
};
// Active set bonuses of a player: [{ sub, count, tiers: [[n, desc, on]] }]
Stats.sets = function (player) {
  const out = [];
  for (const sub in SET_BONUSES) {
    const n = Stats.countSub(player, sub);
    if (n < 2) continue;
    out.push({ sub: sub, count: n, tiers: SET_BONUSES[sub].map((t) => [t[0], t[1], n >= t[0]]) });
  }
  return out;
};
(function () {
  const build = Stats.build;
  Stats.build = function (player) {
    // set bonuses are applied like a hidden item, before the caps in build()
    const add = {};
    for (const sub in SET_BONUSES) {
      const n = Stats.countSub(player, sub);
      const tiers = SET_BONUSES[sub];
      for (let i = 0; i < tiers.length; i++) if (n >= tiers[i][0]) for (const k in tiers[i][2]) add[k] = (add[k] || 0) + tiers[i][2][k];
    }
    const keep = player.metaMods;
    const merged = Object.assign({}, keep || {});
    for (const k in add) merged[k] = (merged[k] || 0) + add[k];
    player.metaMods = merged;
    const s = build.call(Stats, player);
    player.metaMods = keep;
    return s;
  };
})();
STAT_DEFAULTS.bossDamage = 0;     // extra damage to bosses, champions and mini-bosses
STAT_DEFAULTS.lifeSteal = 0;      // part of damage dealt comes back as HP
STAT_DEFAULTS.burnDamage = 0;     // burning hurts more (fire builds)
STAT_DEFAULTS.burnTime = 0;       // burning lasts longer
STAT_DEFAULTS.chainBonus = 0;     // chain shots jump to more enemies (storm builds)
STAT_DEFAULTS.allyDamage = 0;     // your allies (skeletons, hogs...) hit harder
STAT_DEFAULTS.raiseChance = 0;    // a kill may rise as a skeleton ally
STAT_DEFAULTS.hexTime = 0;        // your hexes last longer
STAT_DEFAULTS.hexChance = 0;      // any hit may hex
