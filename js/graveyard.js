/* graveyard.js
   SECTIONS: some rooms of a level can belong to a "section" with its own look
   and rules. A section is a little cluster of connected rooms.

   The Necrotery has a GRAVEYARD section: 2-4 connected rooms outside, still
   dark, in heavy rain with lightning. Rows of tombstones you can break (3 hits)
   for a few coins, or rarely (5%) a weapon. Gargoyles live there: fast stone
   beasts that dash while they move, and hex you when they hit (hexed: you take
   25% more damage for a few seconds).

   The DEMONIC GARGOYLE (mini-boss, at most twice per Necrotery): a statue in a
   graveyard room. Walk up to it and lightning strikes it, it wakes up and locks
   the room. Lightning storms (several strikes, one after another), dashes,
   slashes (parry them!), summons gargoyles; every physical hit hexes you.

   GraveMixin goes onto GameScene. */

const SECTION_TYPES = {
  graveyard: {
    name: 'Graveyard', stageStyle: 'necro', rooms: [2, 4], chance: 0.85, cols: 20, rows: 13,
    look: { style: 'graveyard', dark: true, bg: 0x18211b, line: 0x2a3a2e, wall: 0x46554b, block: 0xffffff, door: 0x5d4037 },
    gargoyles: { max: 2, chance: 0.7 },                // Demonic Gargoyle statues per Necrotery (whole stage)
    roomGargoyles: [2, 3]                              // gargoyles are the graveyard's common enemy (every graveyard fight)
  }
};

const GRAVE_RULES = {
  tombHits: 3, tombCoins: [1, 3], tombCoinChance: 0.5, tombWeaponChance: 0.05,
  hexMul: 1.25,                                        // hexed players take 25% more damage
  rainDrops: 150, lightningMs: [3800, 8500],
  statueWakeRange: 170
};

/* ---------------- enemies ---------------- */
Object.assign(ENEMY_TYPES, {
  gargoyle: {
    name: 'Gargoyle', ai: 'gargoyle',
    cost: 3, minLevel: 1, postBoss: 2, weight: 0, coins: [2, 3],          // weight 0: graveyard fights + the Demonic Gargoyle bring them
    maxHp: 40, speed: 150, speedVariance: 0.1, size: 24, color: 0x78909c, mass: 1,
    contactDamage: 7, dashDamage: 11, hitKnockback: 140, hitKnockbackMs: 70, contactPushback: 220, contactPushbackMs: 150,
    burstSpeed: 440, cycleMs: 760, burstFrac: 0.42, turnBurst: 2.6, turnCruise: 6,
    hexOnHit: { ms: 4000 }, eyeColor: 0xff1744
  },
  demonGargoyle: {
    name: 'Demonic Gargoyle', ai: 'demonGargoyle', miniBoss: true,
    cost: 0, weight: 0, coins: [30, 40],
    maxHp: 950, speed: 115, speedVariance: 0, size: 62, color: 0x607d8b, mass: 20,
    contactDamage: 12, dashDamage: 24, hitKnockback: 0, hitKnockbackMs: 0, contactPushback: 260, contactPushbackMs: 180,
    hexOnHit: { ms: 5000 }, eyeColor: 0xff1744,
    roarMs: 1100, attackCooldownMs: 950, phase2At: 0.5,
    slash: { range: 118, arcDeg: 130, damage: 20, windupMs: 540, lockMs: 150 },
    dash: { windupMs: 620, speed: 640, ms: 520 },
    lightning: { castMs: 520, count: 5, count2: 7, gapMs: 260, warnMs: 720, radius: 54, damage: 20 },
    summon: { castMs: 700, count: 2, max: 4 },
    recoverMs: 520
  }
});

function graveSummoned(m, boss) {
  let n = 0;
  const list = m.group.getChildren();
  for (let i = 0; i < list.length; i++) if (list[i].active && list[i].summonedBy === boss) n++;
  return n;
}

Object.assign(ENEMY_AI, {
  // dashes WHILE it moves: speed surges in waves, turning slower when fast
  gargoyle(m, e, t, dt, ctx) {
    const d = e.def;
    e.gT = (e.gT === undefined ? Math.random() * d.cycleMs : e.gT) + dt;
    const ph = (e.gT % d.cycleMs) / d.cycleMs, burst = ph < d.burstFrac;
    const want = Math.atan2(e.tdy, e.tdx);
    if (e.gAng === undefined) e.gAng = want;
    if (burst && !e.gBurst) e.gAng = want + (Math.random() - 0.5) * 0.8;      // each surge swoops in from a slightly different angle
    e.gBurst = burst;
    if (!e.hasLos) { e.state = 'move'; m.steer(e, t, e.spd * 1.2, ctx.rooms); return; }
    let da = want - e.gAng;
    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const turn = (burst ? d.turnBurst : d.turnCruise) * dt / 1000;
    e.gAng += Math.max(-turn, Math.min(turn, da));
    const sp = burst ? d.burstSpeed * (e.spd / d.speed) : e.spd;
    e.setVelocity(Math.cos(e.gAng) * sp, Math.sin(e.gAng) * sp);
    e.state = burst ? 'dash' : 'move';                                            // dash = contact hits harder
  },

  demonGargoyle(m, e, t, dt, ctx) {
    const d = e.def, sc = m.scene, phase2 = e.hp < e.maxHp * d.phase2At, quick = phase2 ? 0.8 : 1;
    if (phase2 && !e.gPhase2) { e.gPhase2 = true; if (sc.hud) sc.hud.showBanner('The Gargoyle is furious!'); sc.cameras.main.shake(300, 0.01); }
    if (e.state === 'roar') {
      e.setVelocity(0, 0);
      if (e.stateMs <= 0) m.setState(e, 'move', 0);
      return;
    }
    if (e.state === 'move') {
      m.steer(e, t, e.spd, ctx.rooms);
      if (e.attackCdMs > 0) return;
      const near = e.tdist < 150, summons = graveSummoned(m, e) < d.summon.max;
      const r = Math.random();
      let pick;
      if (near) pick = r < 0.5 ? 'slash' : r < 0.7 ? 'dash' : r < 0.88 ? 'lightning' : (summons ? 'summon' : 'slash');
      else pick = r < 0.38 ? 'dash' : r < 0.76 ? 'lightning' : (summons ? 'summon' : 'dash');
      e.setVelocity(0, 0);
      e.gAim = Math.atan2(e.tdy, e.tdx);
      if (pick === 'slash') m.setState(e, 'slashWind', d.slash.windupMs * quick);
      else if (pick === 'dash') { m.setState(e, 'dashWind', d.dash.windupMs * quick); e.gDashes = phase2 ? 2 : 1; }
      else if (pick === 'lightning') m.setState(e, 'cast', d.lightning.castMs * quick);
      else m.setState(e, 'summon', d.summon.castMs);
      return;
    }
    if (e.state === 'slashWind') {
      e.setVelocity(0, 0);
      if (e.stateMs > d.slash.lockMs) e.gAim = Math.atan2(e.tdy, e.tdx);
      if (e.stateMs <= 0) {
        necroHitArc(m, e, e.gAim, d.slash.range, d.slash.arcDeg, d.slash.damage, ctx);     // can be parried (stuns it)
        if (e.stunnedMs > 0) return;
        e.fxMs = 180;
        m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * quick;
      }
      return;
    }
    if (e.state === 'dashWind') {
      e.setVelocity(0, 0);
      if (e.stateMs > 160) e.gAim = Math.atan2(e.tdy, e.tdx);
      if (e.stateMs <= 0) m.setState(e, 'dash', d.dash.ms);
      return;
    }
    if (e.state === 'dash') {
      e.setVelocity(Math.cos(e.gAim) * d.dash.speed, Math.sin(e.gAim) * d.dash.speed);
      const wall = ctx.rooms.solidAt(e.x + Math.cos(e.gAim) * 40, e.y + Math.sin(e.gAim) * 40);
      if (e.stateMs <= 0 || wall) {
        e.setVelocity(0, 0);
        if (wall) sc.cameras.main.shake(140, 0.006);
        e.gDashes--;
        if (e.gDashes > 0) { e.gAim = Math.atan2(e.tdy, e.tdx); m.setState(e, 'dashWind', 380); }
        else { m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * quick; }
      }
      return;
    }
    if (e.state === 'cast') {
      e.setVelocity(0, 0);
      if (e.stateMs <= 0) {
        const L = d.lightning, n = phase2 ? L.count2 : L.count;
        if (sc.graveStorm) sc.graveStorm(e, ctx.players, n, L);
        m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * quick + n * L.gapMs * 0.5;
      }
      return;
    }
    if (e.state === 'summon') {
      e.setVelocity(0, 0);
      if (e.stateMs <= 0) {
        for (let k = 0; k < d.summon.count; k++) {
          const a = Math.random() * Math.PI * 2;
          const x = e.x + Math.cos(a) * 80, y = e.y + Math.sin(a) * 80;
          if (ctx.rooms.solidAt(x, y)) continue;
          const g = m.spawn('gargoyle', x, y);
          if (g) { g.summonedBy = e; g.dmgMul = e.dmgMul; }
          if (sc.hud) sc.hud.addFx(x, y, 30, 0x90a4ae, 260);
        }
        m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs;
      }
      return;
    }
    if (e.state === 'recover') { e.setVelocity(0, 0); if (e.stateMs <= 0) m.setState(e, 'move', 0); return; }
    m.setState(e, 'move', 0);
  }
});

/* ---------------- Demonic Gargoyle loot ---------------- */
// The Gargoyle Eye: only the Demonic Gargoyle drops it.
Object.assign(EFFECT_TYPES, { gargoyleEye: { name: 'Gargoyle Eye', durationMs: 90000, mods: { lightBonus: 1.6 } } });
Object.assign(STAT_DEFAULTS, { lightBonus: 0 });
CONSUMABLE_TYPES.gargoyleEye = EFFECT_ITEM('Gargoyle Eye', 'EYE', 30, null, null, 'gargoyleEye',
  '90 s: you see far in the dark\n(your light is 2.6x bigger).', { bossItem: 'demonGargoyle' });

// Blueprints it can drop (60%): then they are in the shops in every future run.
WEAPON_TYPES.gargoyleClaw = {
  name: 'Gargoyle Claw', short: 'CLAW', kind: 'melee', class: 'melee', sub: 'Knight', type: 'sword', price: 95, postBoss: POST_BOSS_1, blueprint: 'gargoyleClaw',
  desc: 'A stone claw blade: quick, short\nslashes (24) that HEX every enemy they\nhit (hexed enemies take +25% damage).',
  damage: 24, range: 70, arcDeg: 110, cooldownMs: 340, knockback: 200, knockbackMs: 90, swingFxMs: 120,
  hex: { ms: 3000 },
  visual: { style: 'blade', length: 24, width: 6, color: 0x78909c, guard: 0x37474f, swing: 0xb388ff }
};
SKILL_TYPES.hexLightning = {
  name: 'Hex Lightning', short: 'HEXL', kind: 'hexLightning', class: 'arcane', sub: 'Witch', price: 140, postBoss: POST_BOSS_2, blueprint: 'hexLightning',
  desc: 'Call hexed lightning where you aim (50,\nhexes). From every enemy it hits, it\njumps to enemies standing close by for\na little less damage, and on (each\nenemy is hit only once).',
  manaCost: 35, cooldownMs: 7000, range: 420, radius: 60, damage: 50,
  jumpRange: 95, jumpMul: 0.8, maxHits: 14, minDamage: 8, hex: { ms: 4000 }
};
SKILL_BEHAVIORS.hexLightning = function (p, d, ctx) {
  const sc = ctx.scene, pt = SkillAim.point(p, ctx, d.range), list = ctx.enemies.targets();
  const hit = [], queue = [];
  sc.bolts.push({ x: pt.x, y: pt.y, at: sc.time.now, warn: 1, r: 0, dmg: 0, hit: true, fade: 260, seed: Math.random() * 100 });
  sc.cameras.main.shake(90, 0.004);
  if (sc.lighting) sc.lighting.lightNear(pt.x, pt.y, d.radius + 30);
  const strike = (e, dmg, from) => {
    hit.push(e);
    ctx.hitEnemy(e, Math.round(dmg), 0, 0, 0, 0, p, 'aoe');
    if (e.active) GearFx.hex(ctx.enemies, e, d.hex, p);
    if (from) sc.arcs.push({ x1: from.x, y1: from.y, x2: e.x, y2: e.y, fade: 280, seed: Math.random() * 10 });
    queue.push({ e: e, x: e.x, y: e.y, dmg: dmg });
  };
  const base = d.damage * p.stats.damageMul;
  for (let i = 0; i < list.length && hit.length < d.maxHits; i++) {        // the strike itself
    const e = list[i];
    if (!e.active || e.state === 'bones' || e.state === 'dust') continue;
    const dx = e.x - pt.x, dy = e.y - pt.y, r = d.radius + e.def.size / 2;
    if (dx * dx + dy * dy <= r * r) strike(e, base, null);
  }
  // the chain: every struck enemy passes it on to close enemies that weren't hit yet (each enemy once, capped)
  for (let q = 0; q < queue.length && hit.length < d.maxHits; q++) {
    const src = queue[q], next = src.dmg * d.jumpMul;
    if (next < d.minDamage) continue;
    for (let i = 0; i < list.length && hit.length < d.maxHits; i++) {
      const e = list[i];
      if (!e.active || hit.indexOf(e) !== -1 || e.state === 'bones' || e.state === 'dust') continue;
      const dx = e.x - src.x, dy = e.y - src.y;
      if (dx * dx + dy * dy <= d.jumpRange * d.jumpRange) strike(e, next, src);
    }
  }
  return true;
};

/* ---------------- textures ---------------- */
const GraveTextures = {
  gargoyle(g, w, h, s, eye, stone, dark) {
    const cx = w / 2, cy = h / 2 + s * 0.06;
    // wings
    g.fillStyle(dark, 1);
    g.fillTriangle(cx - s * 0.25, cy - s * 0.1, cx - s * 1.05, cy - s * 0.55, cx - s * 0.85, cy + s * 0.3);
    g.fillTriangle(cx + s * 0.25, cy - s * 0.1, cx + s * 1.05, cy - s * 0.55, cx + s * 0.85, cy + s * 0.3);
    g.lineStyle(Math.max(1, s * 0.05), stone, 0.8);
    for (let k = -1; k <= 1; k += 2) {
      g.lineBetween(cx + k * s * 0.3, cy - s * 0.08, cx + k * s * 0.95, cy - s * 0.48);
      g.lineBetween(cx + k * s * 0.3, cy - s * 0.04, cx + k * s * 0.9, cy - s * 0.05);
      g.lineBetween(cx + k * s * 0.3, cy, cx + k * s * 0.8, cy + s * 0.25);
    }
    // body + head
    g.fillStyle(stone, 1); g.fillEllipse(cx, cy + s * 0.12, s * 0.75, s * 0.8);
    g.fillStyle(stone, 1); g.fillCircle(cx, cy - s * 0.3, s * 0.3);
    g.lineStyle(Math.max(1.5, s * 0.06), dark, 1); g.strokeCircle(cx, cy - s * 0.3, s * 0.3); g.strokeEllipse(cx, cy + s * 0.12, s * 0.75, s * 0.8);
    // horns
    g.fillStyle(dark, 1);
    g.fillTriangle(cx - s * 0.22, cy - s * 0.48, cx - s * 0.08, cy - s * 0.52, cx - s * 0.32, cy - s * 0.8);
    g.fillTriangle(cx + s * 0.22, cy - s * 0.48, cx + s * 0.08, cy - s * 0.52, cx + s * 0.32, cy - s * 0.8);
    // eyes + fangs
    g.fillStyle(eye, 1); g.fillCircle(cx - s * 0.11, cy - s * 0.32, s * 0.065); g.fillCircle(cx + s * 0.11, cy - s * 0.32, s * 0.065);
    g.fillStyle(0xeceff1, 1); g.fillTriangle(cx - s * 0.08, cy - s * 0.17, cx - s * 0.02, cy - s * 0.17, cx - s * 0.05, cy - s * 0.08);
    g.fillTriangle(cx + s * 0.02, cy - s * 0.17, cx + s * 0.08, cy - s * 0.17, cx + s * 0.05, cy - s * 0.08);
    // cracks
    g.lineStyle(1, dark, 0.8); g.lineBetween(cx - s * 0.1, cy + s * 0.05, cx + s * 0.05, cy + s * 0.25); g.lineBetween(cx + s * 0.05, cy + s * 0.25, cx - s * 0.04, cy + s * 0.4);
  },
  tomb(g, kind, moss) {
    // 64 x 64 tile: earth mound + a stone
    g.fillStyle(0x2b2320, 1); g.fillEllipse(32, 50, 56, 22);
    if (kind === 0) {               // rounded headstone
      g.fillStyle(0x8a8f96, 1); g.fillRoundedRect(14, 8, 36, 44, { tl: 16, tr: 16, bl: 3, br: 3 });
      g.lineStyle(3, 0x4a4f56, 1); g.strokeRoundedRect(14, 8, 36, 44, { tl: 16, tr: 16, bl: 3, br: 3 });
      g.lineStyle(3, 0x5f656c, 1); g.lineBetween(32, 16, 32, 34); g.lineBetween(25, 22, 39, 22);
      g.lineStyle(1.5, 0x5f656c, 1); g.lineBetween(20, 40, 44, 40); g.lineBetween(22, 45, 42, 45);
    } else {                        // stone cross
      g.fillStyle(0x8a8f96, 1); g.fillRect(27, 6, 10, 48); g.fillRect(15, 16, 34, 10);
      g.lineStyle(3, 0x4a4f56, 1); g.strokeRect(27, 6, 10, 48); g.strokeRect(15, 16, 34, 10);
      g.fillStyle(0x8a8f96, 1); g.fillRect(28.5, 17.5, 7, 7);
    }
    if (moss) { g.fillStyle(0x4f6b3a, 0.85); g.fillCircle(18, 48, 5); g.fillCircle(45, 46, 4); g.fillCircle(40, 12 + kind * 6, 3); }
    g.lineStyle(1.5, 0x3a3f46, 0.9); g.lineBetween(40, 26, 36, 34); g.lineBetween(36, 34, 39, 40);
  },
  make(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    W('tombA', 64, 64, (g) => this.tomb(g, 0, true));
    W('tombB', 64, 64, (g) => this.tomb(g, 1, false));
    W('tombC', 64, 64, (g) => this.tomb(g, 0, false));
    W('gargoyleStatue', 136, 112, (g) => this.gargoyle(g, 136, 112, 66, 0x37474f, 0x9e9e9e, 0x616161));
  }
};

/* ---------------- graveyard rooms ---------------- */
const Graveyard = {
  // Rows of tombstones with paths between them; door lanes and the middle stay clear.
  layout(room, sec) {
    const cols = sec.cols, rows = sec.rows, iw = cols - 2, ih = rows - 2, g = [];
    const mc = Math.floor(cols / 2) - 1, mr = Math.floor(rows / 2) - 1;
    for (let r = 0; r < ih; r++) {
      const row = [];
      for (let c = 0; c < iw; c++) {
        let t = '.';
        const inLaneV = Math.abs(c - mc) <= 2, inLaneH = Math.abs(r - mr) <= 1, middle = Math.abs(c - mc) <= 3 && Math.abs(r - mr) <= 2;
        if (!inLaneV && !inLaneH && !middle && r % 3 === 1 && c % 3 === 1 && c > 0 && c < iw - 1 && Math.random() < 0.75) t = '#';
        row.push(t);
      }
      g.push(row.join(''));
    }
    room.cols = cols; room.rows = rows; room.layoutRows = g; room.shape = null;
  },

  // Some connected normal rooms of the level become a section.
  assign(map, scene, st) {
    for (const id in SECTION_TYPES) {
      const sec = SECTION_TYPES[id];
      if (!st.look || st.look.style !== sec.stageStyle || Math.random() >= sec.chance) continue;
      const cand = map.rooms.filter((r) => r.type === 'normal' && !r.section);
      if (!cand.length) continue;
      const seed = cand[Math.floor(Math.random() * cand.length)];
      const want = sec.rooms[0] + Math.floor(Math.random() * (sec.rooms[1] - sec.rooms[0] + 1));
      const list = [seed], seen = {};
      seen[seed.gx + ',' + seed.gy] = true;
      for (let i = 0; i < list.length && list.length < want; i++) {
        const r = list[i];
        for (let k = 0; k < DIR_NAMES.length && list.length < want; k++) {
          const dn = DIR_NAMES[k];
          if (!r.doors[dn]) continue;
          const n = LevelGenerator.neighbor(map, r, dn);
          if (!n || seen[n.gx + ',' + n.gy] || n.type !== 'normal' || n.section) continue;
          seen[n.gx + ',' + n.gy] = true;
          list.push(n);
        }
      }
      for (let i = 0; i < list.length; i++) { list[i].section = id; this.layout(list[i], sec); }
      // the Demonic Gargoyle: at most twice per Necrotery (counted over the whole stage)
      const run = scene.run;
      if (id === 'graveyard' && run && (run.gargoyles || 0) < sec.gargoyles.max && Math.random() < sec.gargoyles.chance) {
        const r = list[list.length - 1];
        r.gargoyle = 'statue'; r.cleared = true;                // no normal fight: just the statue
        run.gargoyles = (run.gargoyles || 0) + 1;
      }
    }
  }
};

/* ---------------- hex on players + hooks ---------------- */
(function () {
  // hexed players take more damage
  const takeHit = Player.prototype.takeHit;
  Player.prototype.takeHit = function (amount, srcX, srcY) {
    if (this.hexMs > 0 && amount > 0) amount = Math.round(amount * GRAVE_RULES.hexMul);
    return takeHit.call(this, amount, srcX, srcY);
  };
  // tombs: textures
  const make = Arcane3bTextures.make;
  Arcane3bTextures.make = function (scene) { make.call(this, scene); GraveTextures.make(scene); };
  const foe = FoeTextures.make;
  FoeTextures.make = function (scene, id, def) {
    if (id === 'gargoyle') {
      TextureFactory.withGraphics(scene, 'enemy_gargoyle', 52, 42, (g) => GraveTextures.gargoyle(g, 52, 42, 26, 0xff1744, 0x78909c, 0x455a64));
      return true;
    }
    if (id === 'demonGargoyle') {
      TextureFactory.withGraphics(scene, 'enemy_demonGargoyle', 136, 112, (g) => GraveTextures.gargoyle(g, 136, 112, 66, 0xff1744, 0x607d8b, 0x37474f));
      return true;
    }
    return foe.call(this, scene, id, def);
  };
  // pickaxes, minecarts, anything that breaks a block: a tomb still gives its loot
  const brk = RoomManager.prototype.breakBlockAt;
  RoomManager.prototype.breakBlockAt = function (x, y) {
    const i = this.tileIndex(x, y), b = i >= 0 ? this.blockAt[i] : null;
    const tomb = b && b.tomb;
    const res = brk.call(this, x, y);
    if (res && tomb && this.scene.tombLoot) this.scene.tombLoot(res.x, res.y);
    return res;
  };
  // melee swings chip tombs
  const arc = WeaponSystem.meleeArc;
  WeaponSystem.meleeArc = function (p, h, ctx) {
    const r = arc.apply(this, arguments);
    if (ctx && ctx.scene && ctx.scene.tombsInRoom) ctx.scene.tombSwing(p, h);
    return r;
  };
})();

const GraveMixin = {
  setupGrave() {
    this.graveG = this.add.graphics().setDepth(84);                     // bolts, warnings, eyes, hex marks
    this.rainG = this.add.graphics().setDepth(86).setScrollFactor(0);   // rain over everything
    this.bolts = [];
    this.arcs = [];                                                     // Hex Lightning jumps
    this.rain = [];
    for (let i = 0; i < GRAVE_RULES.rainDrops; i++) this.rain.push({ x: Math.random() * GAME_CONFIG.width, y: Math.random() * GAME_CONFIG.height, s: 0.7 + Math.random() * 0.6 });
    this.thunderMs = 3000;
    this.statue = null;
    this.tombsInRoom = false;
  },

  // assign sections after the level is generated
  assignSections(map, st) { Graveyard.assign(map, this, st); },

  // the room's look (called before the room is built)
  sectionLook(room) {
    if (!this.rooms.look || !this.rooms.look.sectionOf) this.baseLook = this.rooms.look;
    const sec = room && room.section && SECTION_TYPES[room.section];
    this.rooms.look = sec ? Object.assign({}, this.baseLook, sec.look, { sectionOf: room.section }) : this.baseLook;
    if (this.rooms.look) this.cameras.main.setBackgroundColor(this.rooms.look.bg);
  },

  // after the room is built
  graveRoom(room) {
    this.bolts.length = 0; this.arcs.length = 0;
    if (this.statue) { this.statue.destroy(); this.statue = null; }
    this.tombsInRoom = false;
    if (!room || room.section !== 'graveyard') return;
    const list = this.rooms.blocks.getChildren();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.texture.key === 'wall') continue;
      const tc = Math.floor(b.x / this.rooms.T), tr = Math.floor(b.y / this.rooms.T), k = (tc * 7 + tr * 3) % 3;
      b.setTexture(k === 0 ? 'tombA' : k === 1 ? 'tombB' : 'tombC'); b.clearTint();
      b.tomb = true; b.tombHp = GRAVE_RULES.tombHits;
      this.tombsInRoom = true;
    }
    if (room.gargoyle === 'statue') {
      const sy = room.type === 'test' ? this.rooms.T * 2.6 : this.rooms.H / 2;     // Test Dungeon: you start in the middle
      this.statue = this.add.image(this.rooms.W / 2, sy, 'gargoyleStatue').setDepth(5);
    }
    this.thunderMs = 1200 + Math.random() * 2000;
  },

  // graveyard fights: a few gargoyles join
  graveFight(room) {
    if (room.section !== 'graveyard') return;
    const sec = SECTION_TYPES.graveyard, n = sec.roomGargoyles[0] + Math.floor(Math.random() * (sec.roomGargoyles[1] - sec.roomGargoyles[0] + 1));
    for (let i = 0; i < n; i++) {
      if (this.rooms.randomSpawnPoint(this.players, GAME_CONFIG.spawnMinDistance, this._pt)) this.enemies.queueSpawn('gargoyle', this._pt.x, this._pt.y, 900 + i * 400);
    }
  },

  /* ---- tombs ---- */
  tombHit(b, by) {
    if (!b || !b.tomb || !b.active) return;
    b.tombHp--;
    b.setTint(0xbdbdbd); this.time.delayedCall(80, () => { if (b.active) b.clearTint(); });
    this.hud.addFx(b.x, b.y, 20, 0x9e9e9e, 140);
    if (b.tombHp <= 0) {
      this.rooms.breakBlockAt(b.x, b.y);
      this.cameras.main.shake(70, 0.003);
    }
  },
  tombSwing(p, h) {
    if (!this.tombsInRoom) return;
    const range = (h.range || 60) + 26, half = ((h.arcDeg || 90) * Math.PI / 360), a0 = Math.atan2(p.input.aimY, p.input.aimX);
    const list = this.rooms.blocks.getChildren().slice();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.tomb || !b.active) continue;
      const dx = b.x - p.sprite.x, dy = b.y - p.sprite.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > range) continue;
      let da = Math.atan2(dy, dx) - a0;
      while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > half + 0.25 && d > 40) continue;
      this.tombHit(b, p);
    }
  },
  tombLoot(x, y) {
    this.hud.addFx(x, y, 40, 0x8d6e63, 260);
    if (this.testMode && !this.room) return;
    const R = GRAVE_RULES;
    if (Math.random() < R.tombCoinChance) {
      const n = R.tombCoins[0] + Math.floor(Math.random() * (R.tombCoins[1] - R.tombCoins[0] + 1));
      this.coins.drop(x, y, Math.max(1, Math.round(n * this.coinMul())), this.team);
    }
    if (Math.random() < R.tombWeaponChance) {
      const t = WEAPON_TYPES;
      let ids = Object.keys(t).filter((id) => ShopLogic.unlocked(t[id], this.level + 1, this.bossesBeaten) && !t[id].boss);
      if (!ids.length) ids = Object.keys(t).filter((id) => ShopLogic.unlocked(t[id], 0, this.bossesBeaten));
      const p = this.players.find((q) => q.alive) || this.players[0];
      if (ids.length) { this.giveLoot(p, { cat: 'weapon', id: ids[Math.floor(Math.random() * ids.length)] }, x, y); this.hud.floatText(x, y - 60, 'Grave goods!', '#8d6e63'); }
    }
  },

  /* ---- lightning ---- */
  // A storm: n strikes, one after another, on and around the players.
  graveStorm(owner, players, n, L) {
    const now = this.time.now, alive = players.filter((p) => p.alive);
    if (!alive.length) return;
    for (let i = 0; i < n; i++) {
      const p = alive[i % alive.length];
      let x = p.sprite.x, y = p.sprite.y;
      if (i > 0) { const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 160; x += Math.cos(a) * r; y += Math.sin(a) * r; }
      x = Math.max(80, Math.min(this.rooms.W - 80, x)); y = Math.max(80, Math.min(this.rooms.H - 80, y));
      this.bolts.push({ x: x, y: y, at: now + L.warnMs + i * L.gapMs, warn: L.warnMs, r: L.radius, dmg: Math.round(L.damage * (owner ? owner.dmgMul : 1)), hit: false, fade: 0, seed: Math.random() * 100 });
    }
  },
  strike(b) {
    b.hit = true; b.fade = 260;
    this.enemies.damagePlayersInRadius(this.players, b.x, b.y, b.r, b.dmg, null);   // magic: no hex
    this.cameras.main.shake(90, 0.005);
    this.hud.addFx(b.x, b.y, b.r, 0xb388ff, 240);
    if (this.lighting) this.lighting.lightNear(b.x, b.y, b.r + 30);
  },
  drawBolt(g, x, y, seed, alpha, top) {
    let px = x + Math.sin(seed) * 40, py = top;
    const steps = 9, pts = [{ x: px, y: py }];
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      pts.push({ x: x + (px - x) * (1 - k) + Math.sin(seed * 3 + i * 1.7) * 18 * (1 - k * 0.8), y: py + (y - py) * k });
    }
    g.lineStyle(9, 0x7c4dff, 0.35 * alpha); g.strokePoints(pts, false);
    g.lineStyle(3.5, 0xe1d5ff, 0.95 * alpha); g.strokePoints(pts, false);
    g.lineStyle(2, 0xb388ff, 0.8 * alpha);
    const mid = pts[4]; g.lineBetween(mid.x, mid.y, mid.x + 26, mid.y + 30);
  },

  awakenStatue(room) {
    if (!this.statue) return;
    const x = this.statue.x, y = this.statue.y;
    room.gargoyle = 'awake'; room.cleared = false; room.fightStarted = true;
    if (this.room && this.room.type !== 'test') this.rooms.closeDoors();
    this.bolts.push({ x: x, y: y - 10, at: this.time.now, warn: 1, r: 0, dmg: 0, hit: false, fade: 0, seed: 7, big: true });
    this.cameras.main.flash(160, 225, 215, 255);
    this.cameras.main.shake(400, 0.012);
    this.hud.showBanner('The Demonic Gargoyle awakens!');
    const st = this.statue;
    this.statue = null;
    this.time.delayedCall(380, () => {
      st.destroy();
      const e = this.enemies.spawn('demonGargoyle', x, y);
      if (!e) return;
      e.maxHp = Math.round(e.maxHp * (1 + 0.6 * (this.players.length - 1))); e.hp = e.maxHp;
      this.enemies.setState(e, 'roar', e.def.roarMs); e.attackCdMs = 600;
      this.startBar('gargoyle', [e], 'Demonic Gargoyle');
      this.discover('demonGargoyle', x, y);
    });
  },
  afterGraveKill(e) {
    if (e.typeId !== 'demonGargoyle') return;
    const p = this.players.find((q) => q.alive) || this.players[0];
    this.giveLoot(p, this.rollLoot(true), e.x, e.y);
    this.coins.drop(e.x, e.y, Math.round(24 * this.coinMul()), this.team);
    if (typeof SHAVINGS_EARN !== 'undefined') this.earnShavings(SHAVINGS_EARN.mimic, e.x, e.y);
    ShopLogic.give(this.team, p, 'consumable', 'gargoyleEye');                 // always: its eye
    this.hud.floatText(e.x, e.y - 70, 'Gargoyle Eye!', '#ff1744');
    this.dropBlueprint('gargoyle', e.x, e.y);                                   // 60%: Gargoyle Claw / Hex Lightning
    if (this.room && this.room.gargoyle) this.room.gargoyle = 'dead';
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) if (list[i].active && list[i].summonedBy === e) this.enemies.kill(list[i]);
  },
  hexCheck(p, res, attacker) {
    if (res !== 'hit' || !attacker || !attacker.def || !attacker.def.hexOnHit) return;
    if (!(p.hexMs > 0)) this.hud.floatText(p.sprite.x, p.sprite.y - 34, 'Hexed!', '#7c4dff');
    p.hexMs = Math.max(p.hexMs || 0, attacker.def.hexOnHit.ms);
  },

  /* ---- every frame ---- */
  updateGrave(dt) {
    const g = this.graveG, now = this.time.now, room = this.room, playing = this.mode === 'play';
    g.clear(); this.rainG.clear();
    // hexes wear off; a purple mark over hexed players
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!(p.hexMs > 0)) continue;
      if (playing) p.hexMs -= dt;
      if (!p.alive) continue;
      const x = p.sprite.x, y = p.sprite.y - 30;
      g.lineStyle(2, 0x7c4dff, 0.8); g.strokeCircle(x, y, 7);
      for (let k = 0; k < 3; k++) { const a = now / 300 + k * 2.1; g.fillStyle(0xb388ff, 0.9); g.fillCircle(x + Math.cos(a) * 10, y + Math.sin(a) * 4, 2); }
    }
    // gargoyle eyes glow through the dark; the boss's warnings
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active || (e.typeId !== 'gargoyle' && e.typeId !== 'demonGargoyle')) continue;
      const s = e.typeId === 'gargoyle' ? 26 : 66;
      g.fillStyle(0xff1744, 0.9); g.fillCircle(e.x - s * 0.11, e.y - s * 0.26, s * 0.06); g.fillCircle(e.x + s * 0.11, e.y - s * 0.26, s * 0.06);
      if (e.typeId !== 'demonGargoyle') continue;
      if (this.lighting && this.lighting.active) this.lighting.add(e.x, e.y, 80);
      const d = e.def;
      if (e.state === 'slashWind' || e.fxMs > 0) {
        const half = d.slash.arcDeg * Math.PI / 360, k = e.state === 'slashWind' ? 1 - Math.max(0, e.stateMs) / d.slash.windupMs : 1;
        g.fillStyle(0xff5252, e.state === 'slashWind' ? 0.1 + 0.2 * k : 0.45);
        g.slice(e.x, e.y, d.slash.range, e.gAim - half, e.gAim + half, false); g.fillPath();
      } else if (e.state === 'dashWind') {
        g.lineStyle(6, 0xff1744, 0.35); g.lineBetween(e.x, e.y, e.x + Math.cos(e.gAim) * d.dash.speed * d.dash.ms / 1000, e.y + Math.sin(e.gAim) * d.dash.speed * d.dash.ms / 1000);
      } else if (e.state === 'cast' || e.state === 'summon' || e.state === 'roar') {
        g.lineStyle(3, e.state === 'summon' ? 0x90a4ae : 0xb388ff, 0.5 + 0.4 * Math.sin(now / 70)); g.strokeCircle(e.x, e.y, 46 + 6 * Math.sin(now / 90));
      }
    }
    // the storm: warnings, then the strikes
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (!b.hit) {
        if (playing && now >= b.at) this.strike(b);
        else {
          const k = Math.max(0, 1 - (b.at - now) / b.warn);
          g.lineStyle(2, 0xb388ff, 0.4 + 0.5 * k); g.strokeCircle(b.x, b.y, b.r);
          g.fillStyle(0x7c4dff, 0.08 + 0.25 * k); g.fillCircle(b.x, b.y, b.r * k);
          if (this.lighting && this.lighting.active) this.lighting.add(b.x, b.y, b.r * 0.9);
          continue;
        }
      }
      b.fade -= dt;
      if (b.fade <= 0) { this.bolts.splice(i, 1); continue; }
      const a = b.fade / 260, top = this.cameras.main.worldView.y - 20;
      this.drawBolt(g, b.x, b.y, b.seed, a, top);
      if (b.big) this.drawBolt(g, b.x + 6, b.y, b.seed + 2, a, top);
      if (this.lighting && this.lighting.active) this.lighting.add(b.x, b.y, (b.big ? 260 : 150) * a);
    }
    // Hex Lightning jumping between enemies
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.fade -= dt;
      if (a.fade <= 0) { this.arcs.splice(i, 1); continue; }
      const k = a.fade / 280, pts = [];
      for (let s = 0; s <= 6; s++) { const t = s / 6, j = (s === 0 || s === 6) ? 0 : Math.sin(a.seed + s * 2.3) * 10; pts.push({ x: a.x1 + (a.x2 - a.x1) * t - (a.y2 - a.y1) / 200 * j, y: a.y1 + (a.y2 - a.y1) * t + (a.x2 - a.x1) / 200 * j }); }
      g.lineStyle(7, 0x7c4dff, 0.35 * k); g.strokePoints(pts, false);
      g.lineStyle(2.5, 0xe1d5ff, 0.95 * k); g.strokePoints(pts, false);
      if (this.lighting && this.lighting.active) this.lighting.add(a.x2, a.y2, 60 * k);
    }
    if (!room || room.section !== 'graveyard') return;
    // the statue wakes up when someone walks close
    if (this.statue && playing) {
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!p.alive) continue;
        const dx = p.sprite.x - this.statue.x, dy = p.sprite.y - this.statue.y;
        if (dx * dx + dy * dy < GRAVE_RULES.statueWakeRange * GRAVE_RULES.statueWakeRange) { this.awakenStatue(room); break; }
      }
    }
    // rain
    const W = GAME_CONFIG.width, H = GAME_CONFIG.height, sec = dt / 1000;
    this.rainG.lineStyle(1.4, 0xb0bec5, 0.38);
    for (let i = 0; i < this.rain.length; i++) {
      const r = this.rain[i];
      r.x += -160 * r.s * sec; r.y += 900 * r.s * sec;
      if (r.y > H + 20) { r.y = -20; r.x = Math.random() * (W + 200); }
      if (r.x < -20) r.x += W + 40;
      this.rainG.lineBetween(r.x, r.y, r.x + 3.5 * r.s, r.y - 18 * r.s);
    }
    // ambient lightning: the whole screen flashes, thunder a moment later
    if (playing) {
      this.thunderMs -= dt;
      if (this.thunderMs <= 0) {
        const L = GRAVE_RULES.lightningMs;
        this.thunderMs = L[0] + Math.random() * (L[1] - L[0]);
        this.cameras.main.flash(110, 170, 180, 220);
        const v = this.cameras.main.worldView;
        this.bolts.push({ x: v.x + 80 + Math.random() * (v.width - 160), y: v.y + 60 + Math.random() * (v.height - 120), at: now, warn: 1, r: 0, dmg: 0, hit: true, fade: 200, seed: Math.random() * 100 });
        this.time.delayedCall(300 + Math.random() * 400, () => { if (this.cameras && this.cameras.main) this.cameras.main.shake(260, 0.003); });
      }
    }
  },

  // Graveyard floor: wet grass, a muddy cross of paths, mounds, puddles, dead leaves.
  drawGraveFloor(g, W, H, look) {
    const rnd = this.floorRandom(W, H);
    for (let k = 0; k < Math.floor(W * H / 9000); k++) {          // grass patches
      g.fillStyle(rnd() < 0.5 ? 0x1d2a20 : 0x223125, 0.9);
      g.fillEllipse(rnd() * W, rnd() * H, 40 + rnd() * 90, 20 + rnd() * 40);
    }
    g.fillStyle(0x3a2e26, 0.85); g.fillRect(W / 2 - 70, 0, 140, H); g.fillRect(0, H / 2 - 50, W, 100);   // muddy paths
    g.fillStyle(0x2e241e, 0.6);
    for (let k = 0; k < 40; k++) g.fillEllipse(W / 2 - 70 + rnd() * 140, rnd() * H, 10 + rnd() * 20, 6 + rnd() * 8);
    for (let k = 0; k < Math.floor(W * H / 40000); k++) {        // puddles catching the light
      const x = rnd() * W, y = rnd() * H, w = 30 + rnd() * 50;
      g.fillStyle(0x24323f, 0.8); g.fillEllipse(x, y, w, w * 0.4);
      g.lineStyle(1, 0x6f8799, 0.5); g.strokeEllipse(x - 4, y - 2, w * 0.5, w * 0.15);
    }
    for (let k = 0; k < Math.floor(W * H / 6000); k++) {         // grass tufts + leaves
      const x = rnd() * W, y = rnd() * H;
      if (rnd() < 0.7) { g.lineStyle(1.5, 0x3f5a3a, 0.8); g.lineBetween(x, y, x - 2, y - 6); g.lineBetween(x, y, x + 2, y - 7); g.lineBetween(x, y, x + 4, y - 4); }
      else { g.fillStyle(rnd() < 0.5 ? 0x6d4c41 : 0x8d6e63, 0.7); g.fillEllipse(x, y, 6, 3); }
    }
    for (let k = 0; k < 3; k++) {                                 // old fresh-dug mounds
      const x = 100 + rnd() * (W - 200), y = 100 + rnd() * (H - 200);
      g.fillStyle(0x3e3029, 0.9); g.fillEllipse(x, y, 34, 56);
      g.lineStyle(2, 0x2b211c, 1); g.strokeEllipse(x, y, 34, 56);
    }
  }
};
