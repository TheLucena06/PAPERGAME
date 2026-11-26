/* necrotery.js  (Alpha 3)
   Stage 3: THE NECROTERY. A dark graveyard crypt (see lighting.js for the darkness).
   - STAGE_TYPES.necrotery + 3 themed rooms; RUN_PLAN gets a 3rd stage (the run ends after its boss).
   - Room shapes: long vertical halls, long galleries and cross-shaped crypts (the camera scrolls).
   - Enemies: Skeleton (sword), Skeleton Archer, Skeleton Guard (shield), and their DARK versions
     (purple bones: they fall into a pile of bones and get back up 1-2 times; burn the pile to stop it),
     the Necromancer (raises skeletons, wakes bone piles, shadow bolts), Candle Wisps (fly through walls
     and blow out your torches) and Phantoms (drift through walls, then lunge).
   The boss (the Dead Titan) is in titan.js. */

RUN_PLAN.stages.push(['necrotery']);

STAGE_TYPES.necrotery = {
  name: 'The Necrotery', tagline: 'Light the torches. Count the bones. Don\'t trust the quiet.',
  look: { style: 'necro', bg: 0x29242f, line: 0x3a3343, accent: 0x6a1b9a, wall: 0x4a4256, block: 0x5a5266, door: 0x3a2c4a, dark: true },
  enemies: ['skeleton', 'skeletonArcher', 'skeletonGuard', 'darkSkeleton', 'darkSkeletonArcher', 'darkSkeletonGuard', 'necroMage', 'wisp', 'phantom', 'gnome'],
  boss: 'deadTitan',
  themes: ['boneyard', 'seance', 'crypt'],
  champions: ['darkSkeletonGuard', 'phantom', 'skeletonGuard']
};
STAGE_TYPES.necrotery.difficulty = { hp: 1.4, dmg: 1.3, count: 1.2 };   // owner OK'd (v3.4.2): it felt too easy
Object.assign(THEMED_ROOMS, {
  boneyard: { name: 'Boneyard', layout: 1, waves: [[['skeleton', 4], ['skeletonArcher', 2]], [['darkSkeleton', 3], ['skeletonGuard', 2]]] },
  seance:   { name: 'Séance', layout: 0, waves: [[['wisp', 4], ['phantom', 1]], [['necroMage', 1], ['phantom', 2], ['wisp', 2]]] },
  crypt:    { name: 'The Crypt', layout: 6, waves: [[['skeletonGuard', 2], ['darkSkeletonArcher', 2]], [['darkSkeleton', 3], ['darkSkeletonGuard', 1], ['necroMage', 1]]] }
});

/* ---------------- enemies ---------------- */
const SKEL_BASE = { minLevel: 1, postBoss: 2, speedVariance: 0.1, mass: 1.2, hitKnockback: 120, hitKnockbackMs: 60, contactPushback: 180, contactPushbackMs: 150 };
const DARK = { revives: [1, 2], reviveMs: 2600, reviveHpPct: 0.6, eyeColor: 0xb388ff, dark: true };
const SKEL_SWORD = { ai: 'skelSword', size: 24, maxHp: 46, speed: 145, contactDamage: 6, coins: [2, 3],
  attackRange: 74, windupMs: 420, lockMs: 140, slash: { range: 80, arcDeg: 110, damage: 15 }, recoverMs: 520, attackCooldownMs: 1200, eyeColor: 0xff5252 };
const SKEL_ARCHER = { ai: 'skelArcher', size: 22, maxHp: 34, speed: 95, contactDamage: 4, coins: [2, 3],
  preferredMin: 220, preferredMax: 380, windupMs: 680, lockMs: 220, recoverMs: 420, attackCooldownMs: 1900,
  arrow: { speed: 430, damage: 13, lifetimeMs: 1800 }, eyeColor: 0xff8a65 };
const SKEL_GUARD = { ai: 'skelGuard', size: 28, maxHp: 95, speed: 100, contactDamage: 9, dashDamage: 17, coins: [3, 4], mass: 4,
  hitKnockback: 50, hitKnockbackMs: 40, contactPushback: 200, contactPushbackMs: 160,
  shield: { arcDeg: 120, blockMul: 0.15 }, turnSpeed: 2.4, attackRange: 150, windupMs: 520, dashSpeed: 460, dashMs: 300, recoverMs: 700, attackCooldownMs: 1700, eyeColor: 0xffd54f };

Object.assign(ENEMY_TYPES, {
  skeleton:          Object.assign({}, SKEL_BASE, SKEL_SWORD, { name: 'Skeleton', cost: 2, weight: 3, color: 0xe0dccf }),
  skeletonArcher:    Object.assign({}, SKEL_BASE, SKEL_ARCHER, { name: 'Skeleton Archer', cost: 2, weight: 2, color: 0xe0dccf }),
  skeletonGuard:     Object.assign({}, SKEL_BASE, SKEL_GUARD, { name: 'Skeleton Guard', cost: 3, weight: 1.6, color: 0xe0dccf }),
  darkSkeleton:      Object.assign({}, SKEL_BASE, SKEL_SWORD, DARK, { name: 'Dark Skeleton', cost: 3, weight: 2, color: 0x7e6bc4, speed: 155 }),
  darkSkeletonArcher:Object.assign({}, SKEL_BASE, SKEL_ARCHER, DARK, { name: 'Dark Skeleton Archer', cost: 3, weight: 1.4, color: 0x7e6bc4 }),
  darkSkeletonGuard: Object.assign({}, SKEL_BASE, SKEL_GUARD, DARK, { name: 'Dark Skeleton Guard', cost: 4, weight: 1, color: 0x7e6bc4 }),
  necroMage: {
    name: 'Necromancer', ai: 'necroMage', unique: true,
    cost: 4, minLevel: 1, postBoss: 2, weight: 1.2, coins: [5, 7],
    maxHp: 90, speed: 95, speedVariance: 0.05, size: 30, color: 0x4a148c, mass: 2,
    contactDamage: 6, hitKnockback: 100, hitKnockbackMs: 60, contactPushback: 200, contactPushbackMs: 160,
    preferredMin: 250, preferredMax: 400, eyeColor: 0x76ff03,
    bolt: { windupMs: 520, count: 3, spreadDeg: 15, speed: 270, damage: 11, lifetimeMs: 2600 },
    summon: { windupMs: 1100, count: 2, maxMinions: 5, cdMs: 7000 },   // was 9 s
    raise: { windupMs: 700 },
    recoverMs: 420, attackCooldownMs: 1100   // casts more often (v3.4.2: was 500 / 1500)
  },
  wisp: {
    name: 'Candle Wisp', ai: 'wisp', ghost: true,
    cost: 1, minLevel: 1, postBoss: 2, weight: 2, coins: [1, 2],
    maxHp: 18, speed: 150, speedVariance: 0.15, size: 18, color: 0x80deea, mass: 0.4,
    contactDamage: 6, hitKnockback: 160, hitKnockbackMs: 70, contactPushback: 240, contactPushbackMs: 160,
    blowMs: 800, eyeColor: 0x18ffff
  },
  phantom: {
    name: 'Phantom', ai: 'phantom', ghost: true,
    cost: 3, minLevel: 1, postBoss: 2, weight: 1.3, coins: [3, 4],
    maxHp: 64, speed: 75, speedVariance: 0.1, size: 30, color: 0xcfd8dc, mass: 1,
    contactDamage: 5, dashDamage: 18, hitKnockback: 80, hitKnockbackMs: 50, contactPushback: 200, contactPushbackMs: 160,
    attackRange: 190, windupMs: 560, dashSpeed: 560, dashMs: 380, recoverMs: 650, attackCooldownMs: 1900,
    fadeDamageMul: 0.5, eyeColor: 0x90caf9
  }
});

/* ---------------- textures ---------------- */
const NecroTextures = {
  skeleton(g, s, bone, dark, kind) {
    const c = s / 2 + 4, shade = dark ? 0x4527a0 : 0x9e9a8c, line = dark ? 0x1a0f3d : 0x3e3a33;
    // ribs / body
    g.fillStyle(bone, 1); g.fillRoundedRect(c - s * 0.28, c - s * 0.05, s * 0.56, s * 0.5, 3);
    g.lineStyle(1.5, line, 1);
    for (let i = 0; i < 3; i++) g.lineBetween(c - s * 0.24, c + s * 0.06 + i * s * 0.12, c + s * 0.24, c + s * 0.06 + i * s * 0.12);
    g.lineBetween(c, c - s * 0.05, c, c + s * 0.45);
    // skull
    g.fillStyle(bone, 1); g.fillCircle(c, c - s * 0.2, s * 0.3);
    g.fillRect(c - s * 0.16, c - s * 0.04, s * 0.32, s * 0.1);
    g.fillStyle(0x111111, 1); g.fillCircle(c - s * 0.11, c - s * 0.2, s * 0.08); g.fillCircle(c + s * 0.11, c - s * 0.2, s * 0.08);
    g.fillStyle(shade, 1); g.fillTriangle(c - 2, c - s * 0.07, c + 2, c - s * 0.07, c, c - s * 0.13);
    g.lineStyle(1.5, line, 1); g.strokeCircle(c, c - s * 0.2, s * 0.3);
    if (kind === 'sword') {
      g.lineStyle(3, 0xb0bec5, 1); g.lineBetween(c + s * 0.38, c + s * 0.3, c + s * 0.5, c - s * 0.3);
      g.lineStyle(3, 0x6d4c41, 1); g.lineBetween(c + s * 0.3, c + s * 0.22, c + s * 0.5, c + s * 0.28);
    } else if (kind === 'bow') {
      g.lineStyle(2.5, 0x6d4c41, 1); g.beginPath(); g.arc(c - s * 0.3, c + s * 0.1, s * 0.34, -1.1, 1.1); g.strokePath();
      g.lineStyle(1, 0xeeeeee, 0.9); g.lineBetween(c - s * 0.3 + Math.cos(-1.1) * s * 0.34, c + s * 0.1 + Math.sin(-1.1) * s * 0.34, c - s * 0.3 + Math.cos(1.1) * s * 0.34, c + s * 0.1 + Math.sin(1.1) * s * 0.34);
    } else if (kind === 'shield') {
      g.fillStyle(dark ? 0x311b92 : 0x5d4037, 1); g.fillRoundedRect(c - s * 0.55, c - s * 0.15, s * 0.3, s * 0.62, 4);
      g.lineStyle(2, dark ? 0xb388ff : 0xa1887f, 1); g.strokeRoundedRect(c - s * 0.55, c - s * 0.15, s * 0.3, s * 0.62, 4);
    }
  },
  make(scene, id, def) {
    const W = (k, w, h, fn) => { TextureFactory.withGraphics(scene, k, w, h, fn); return true; };
    const key = 'enemy_' + id;
    const skel = { skelSword: 'sword', skelArcher: 'bow', skelGuard: 'shield' }[def.ai];
    if (skel) return W(key, def.size + 8 + (skel === 'shield' ? 8 : 4), def.size + 8, (g) => {
      if (skel === 'shield') g.translateCanvas && g.translateCanvas(6, 0);
      NecroTextures.skeleton(g, def.size, def.dark ? 0x9b8fe0 : 0xece6d6, !!def.dark, skel);
    });
    if (def.ai === 'necroMage') return W(key, 40, 44, (g) => {
      g.fillStyle(0x2a0f45, 1); g.fillTriangle(4, 42, 30, 42, 17, 6);                 // robe
      g.fillStyle(0x4a148c, 1); g.fillTriangle(8, 42, 26, 42, 17, 12);
      g.fillStyle(0x1a0a2a, 1); g.fillCircle(17, 12, 9);                              // hood
      g.fillStyle(0x000000, 1); g.fillCircle(17, 13, 6);
      g.lineStyle(2.5, 0x8d6e63, 1); g.lineBetween(32, 6, 32, 42);                    // staff
      g.fillStyle(0xece6d6, 1); g.fillCircle(32, 6, 5);                               // skull on top
      g.fillStyle(0x76ff03, 1); g.fillCircle(30.5, 5.5, 1.3); g.fillCircle(33.5, 5.5, 1.3);
    });
    if (def.ai === 'wisp') return W(key, 24, 30, (g) => {
      g.fillStyle(0x80deea, 0.35); g.fillCircle(12, 14, 11);
      g.fillStyle(0xb2ebf2, 0.9); g.fillTriangle(5, 18, 19, 18, 12, 0);
      g.fillCircle(12, 18, 7);
      g.fillStyle(0xe0f7fa, 1); g.fillCircle(12, 19, 4);
      g.fillStyle(0xb2ebf2, 0.7); g.fillTriangle(8, 23, 16, 23, 12, 30);
    });
    if (def.ai === 'phantom') return W(key, 40, 44, (g) => {
      g.fillStyle(0xeceff1, 0.95); g.fillCircle(20, 15, 13); g.fillRect(7, 15, 26, 18);
      for (let i = 0; i < 4; i++) g.fillTriangle(7 + i * 6.5, 32, 13.5 + i * 6.5, 32, 10 + i * 6.5, 42);
      g.fillStyle(0x263238, 1); g.fillEllipse(15, 15, 5, 7); g.fillEllipse(25, 15, 5, 7); g.fillEllipse(20, 24, 6, 4);
      g.lineStyle(1.5, 0x90a4ae, 1); g.strokeCircle(20, 15, 13);
    });
    return false;
  },
  makeProps(scene) {
    const W = (k, w, h, fn) => TextureFactory.withGraphics(scene, k, w, h, fn);
    const pile = (k, bone, line) => W(k, 34, 22, (g) => {
      g.lineStyle(4, bone, 1);
      g.lineBetween(3, 17, 22, 12); g.lineBetween(10, 20, 30, 15); g.lineBetween(6, 9, 20, 18);
      g.fillStyle(bone, 1); g.fillCircle(25, 9, 7);
      g.fillStyle(line, 1); g.fillCircle(23, 8, 1.8); g.fillCircle(27.5, 8, 1.8);
    });
    W('shadowBolt', 16, 16, (g) => { g.fillStyle(0x7c4dff, 0.4); g.fillCircle(8, 8, 8); g.fillStyle(0xb388ff, 1); g.fillCircle(8, 8, 5); g.fillStyle(0xede7f6, 1); g.fillCircle(7, 7, 2); });
    pile('bonepile', 0xd7d0bf, 0x212121);
    pile('bonepile_dark', 0x8e7fd6, 0x120830);
    const T = GAME_CONFIG.tile;
    W('necroBlock', T, T, (g) => {                       // dark crypt stone
      g.fillStyle(0x5a5266, 1); g.fillRect(0, 0, T, T);
      g.lineStyle(2, 0x3d3647, 1);
      g.strokeRect(1, 1, T - 2, T - 2); g.lineBetween(0, T / 2, T, T / 2); g.lineBetween(T / 2, 0, T / 2, T / 2); g.lineBetween(T / 4, T / 2, T / 4, T);
      g.fillStyle(0x6b6278, 1); g.fillRect(3, 3, T / 2 - 5, 4);
    });
  }
};
(function () {   // NecroTextures plug into the boot-time texture loop
  const old = FoeTextures.make, oldProps = FoeTextures.makeProps;
  FoeTextures.make = function (scene, id, def) { return NecroTextures.make(scene, id, def) || (typeof TitanTextures !== 'undefined' && TitanTextures.make(scene, id, def)) || old.call(FoeTextures, scene, id, def); };
  FoeTextures.makeProps = function (scene) { oldProps.call(FoeTextures, scene); NecroTextures.makeProps(scene); };
})();

/* ---------------- AI ---------------- */
// Dark skeletons: a pile of bones that gets back up. Returns true while it's a pile.
function necroBones(m, e, dt) {
  if (e.state === 'bones') {
    e.setVelocity(0, 0);
    if (e.stateMs <= 0) {
      if (e.burnBones) {                              // burned to dust: really dead now
        e.state = 'dust';
        const sc = m.scene, x = e.x, y = e.y;
        if (sc.hud) sc.hud.addFx(x, y, 26, 0xff7043, 300);
        m.die(e);
        if (sc.onEnemyKilled) sc.onEnemyKilled(e, e.burnOwner || null, 'fire');
        return true;
      }
      e.setTexture('enemy_' + e.typeId);
      e.body.setSize(e.def.size, e.def.size, true);
      e.hp = Math.max(1, Math.round(e.maxHp * e.def.reviveHpPct));
      m.setState(e, 'move', 0); e.attackCdMs = 700;
      if (m.scene.hud) { m.scene.hud.addFx(e.x, e.y, 30, 0x7c4dff, 320); m.scene.hud.floatText(e.x, e.y - 30, 'It gets back up!', '#b388ff'); }
    }
    return true;
  }
  return false;
}

function necroHitArc(m, e, ang, range, arcDeg, dmg, ctx) {
  const half = arcDeg * Math.PI / 360;
  for (let i = 0; i < ctx.players.length; i++) {
    const p = ctx.players[i];
    if (!p.alive) continue;
    const dx = p.sprite.x - e.x, dy = p.sprite.y - e.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > range + p.stats.size / 2) continue;
    let da = Math.atan2(dy, dx) - ang;
    while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) > half && d > 24) continue;
    const res = p.takeHit(Math.round(dmg * e.dmgMul), e.x, e.y);
    if (res === 'parry') { if (m.onParry) m.onParry(p, e); }
    else if (m.onPlayerHit) m.onPlayerHit(p, res, e);
  }
}

function necroMinions(m) {
  let n = 0;
  const list = m.group.getChildren();
  for (let i = 0; i < list.length; i++) if (list[i].active && list[i].summonedBy) n++;
  return n + (m.pendingCount || 0);
}

Object.assign(ENEMY_AI, {
  skelSword(m, e, t, dt, ctx) {
    if (necroBones(m, e, dt)) return;
    const d = e.def;
    if (e.state === 'move') {
      if (e.hasLos && e.tdist < d.attackRange && e.attackCdMs <= 0) {
        m.setState(e, 'windup', d.windupMs); e.setVelocity(0, 0);
        e.swingAng = Math.atan2(e.tdy, e.tdx); e.faceAng = e.swingAng;
        return;
      }
      m.steer(e, t, e.spd, ctx.rooms);
      if (e.body.velocity.x || e.body.velocity.y) e.faceAng = Math.atan2(e.body.velocity.y, e.body.velocity.x);
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup') {
      if (e.stateMs > d.lockMs) { e.swingAng = Math.atan2(e.tdy, e.tdx); e.faceAng = e.swingAng; }
      if (e.stateMs <= 0) {
        necroHitArc(m, e, e.swingAng, d.slash.range, d.slash.arcDeg, d.slash.damage, ctx);
        if (e.stunnedMs > 0) return;
        e.fxMs = 160;
        m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4);
      }
    } else if (e.state === 'recover' && e.stateMs <= 0) m.setState(e, 'move', 0);
  },

  skelArcher(m, e, t, dt, ctx) {
    if (necroBones(m, e, dt)) return;
    const d = e.def;
    if (e.state === 'move') {
      const inRange = ENEMY_AI.keepDistance(m, e, t, dt, ctx);
      if (inRange && e.attackCdMs <= 0) { m.setState(e, 'windup', d.windupMs); e.setVelocity(0, 0); e.fireAng = Math.atan2(e.tdy, e.tdx); }
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup') {
      if (e.stateMs > d.lockMs) e.fireAng = Math.atan2(e.tdy, e.tdx);
      e.faceAng = e.fireAng;
      if (e.stateMs <= 0) {
        const a = d.arrow, cx = Math.cos(e.fireAng), cy = Math.sin(e.fireAng);
        ctx.enemyBullets.fire(e.x + cx * 16, e.y + cy * 16, cx, cy, a.speed, Math.round(a.damage * e.dmgMul), a.lifetimeMs, e, 'arrow');
        m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4);
      }
    } else if (e.state === 'recover' && e.stateMs <= 0) m.setState(e, 'move', 0);
  },

  skelGuard(m, e, t, dt, ctx) {
    if (necroBones(m, e, dt)) return;
    ENEMY_AI.guard(m, e, t, dt, ctx);
  },

  necroMage(m, e, t, dt, ctx) {
    const d = e.def;
    if (e.summonCdMs > 0) e.summonCdMs -= dt;
    if (e.state === 'move') {
      const inRange = ENEMY_AI.keepDistance(m, e, t, dt, ctx);
      if (e.attackCdMs > 0) return;
      // 1) wake a bone pile, 2) raise skeletons, 3) shadow bolts
      const list = m.group.getChildren();
      let pile = null;
      for (let i = 0; i < list.length; i++) if (list[i].active && list[i].state === 'bones' && !list[i].burnBones && list[i].stateMs > 900) { pile = list[i]; break; }
      if (pile) { m.setState(e, 'raise', d.raise.windupMs); e.raiseTarget = pile; e.setVelocity(0, 0); return; }
      if (e.summonCdMs <= 0 && necroMinions(m) < d.summon.maxMinions) {
        m.setState(e, 'summon', d.summon.windupMs); e.setVelocity(0, 0);
        e.summonSpots = [];
        for (let k = 0; k < d.summon.count; k++) {
          const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 60;
          let x = Phaser.Math.Clamp(e.x + Math.cos(a) * r, 80, ctx.rooms.W - 80), y = Phaser.Math.Clamp(e.y + Math.sin(a) * r, 80, ctx.rooms.H - 80);
          if (ctx.rooms.solidAt(x, y)) { x = e.x; y = e.y; }
          e.summonSpots.push({ x: x, y: y });
        }
        return;
      }
      if (inRange) { m.setState(e, 'windup', d.bolt.windupMs); e.setVelocity(0, 0); e.fireAng = Math.atan2(e.tdy, e.tdx); }
      return;
    }
    e.setVelocity(0, 0);
    if (e.state === 'windup') {
      if (e.stateMs > 160) e.fireAng = Math.atan2(e.tdy, e.tdx);
      if (e.stateMs <= 0) {
        const b = d.bolt, spread = b.spreadDeg * Math.PI / 180;
        for (let k = 0; k < b.count; k++) {
          const a = e.fireAng + (k - (b.count - 1) / 2) * spread;
          ctx.enemyBullets.fire(e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, Math.cos(a), Math.sin(a), b.speed, Math.round(b.damage * e.dmgMul), b.lifetimeMs, e, 'shadowBolt');
        }
        m.setState(e, 'recover', d.recoverMs); e.attackCdMs = d.attackCooldownMs * (0.8 + Math.random() * 0.4);
      }
    } else if (e.state === 'summon' && e.stateMs <= 0) {
      for (let k = 0; k < e.summonSpots.length; k++) {
        const s = e.summonSpots[k];
        const type = Math.random() < 0.3 ? 'darkSkeleton' : 'skeleton';
        const c = m.spawn(type, s.x, s.y);
        if (c) { c.summonedBy = e; c.attackCdMs = 900; if (m.scene.hud) m.scene.hud.addFx(s.x, s.y, 26, 0x76ff03, 300); }
      }
      e.summonCdMs = d.summon.cdMs;
      m.setState(e, 'recover', d.recoverMs); e.attackCdMs = 900;
    } else if (e.state === 'raise' && e.stateMs <= 0) {
      const p = e.raiseTarget;
      if (p && p.active && p.state === 'bones') { p.stateMs = Math.min(p.stateMs, 120); if (m.scene.hud) m.scene.hud.lineFx && m.scene.hud.lineFx(e.x, e.y, p.x, p.y, 0x76ff03); }
      e.raiseTarget = null;
      m.setState(e, 'recover', d.recoverMs); e.attackCdMs = 700;
    } else if (e.state === 'recover' && e.stateMs <= 0) m.setState(e, 'move', 0);
  },

  // Candle Wisp: flies (through walls) to the nearest lit torch and blows it out. No torches lit: pesters you.
  wisp(m, e, t, dt, ctx) {
    const d = e.def, L = m.scene.lighting;
    e.bob = (e.bob || Math.random() * 6) + dt / 300;
    if (e.state === 'blow') {
      e.setVelocity(0, 0);
      if (e.stateMs <= 0) {
        if (L && e.torch) L.blowOut(e.torch.x, e.torch.y, 30);
        e.torch = null;
        m.setState(e, 'move', 0); e.attackCdMs = 1500;
      }
      return;
    }
    const torch = L && e.attackCdMs <= 0 ? L.nearestLitTorch(e.x, e.y) : null;
    let tx, ty, sp = e.spd;
    if (torch) { tx = torch.x; ty = torch.y + (torch.side === 'up' ? 22 : 0); }
    else { tx = t.sprite.x; ty = t.sprite.y; sp *= 0.6; }
    const dx = tx - e.x, dy = ty - e.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    if (torch && len < 26) { e.torch = torch; m.setState(e, 'blow', d.blowMs); e.setVelocity(0, 0); return; }
    const w = Math.sin(e.bob) * 0.5;
    e.setVelocity((dx / len - dy / len * w) * sp, (dy / len + dx / len * w) * sp);
  },

  // Phantom: drifts at you through walls (see-through, takes half damage), then becomes solid and lunges.
  phantom(m, e, t, dt, ctx) {
    const d = e.def;
    const inWall = ctx.rooms.solidAt(e.x, e.y);
    if (e.state === 'move') {
      e.setAlpha(Math.max(0.3, e.alpha - dt / 600));
      if (e.tdist < d.attackRange && e.attackCdMs <= 0 && !inWall) {
        m.setState(e, 'windup', d.windupMs); e.setVelocity(0, 0); m.aimDash(e);
        return;
      }
      const sp = e.spd * (e.tdist > 300 ? 1.25 : 1);
      e.setVelocity(e.tdx / e.tdist * sp, e.tdy / e.tdist * sp);
      return;
    }
    if (e.state === 'windup') {
      e.setVelocity(0, 0); e.setAlpha(Math.min(1, e.alpha + dt / 300));
      if (e.stateMs > 180) m.aimDash(e);
      if (e.stateMs <= 0) m.setState(e, 'dash', d.dashMs);
      return;
    }
    if (e.state === 'dash') {
      e.setAlpha(1);
      e.setVelocity(e.dashX * d.dashSpeed * e.slowMul, e.dashY * d.dashSpeed * e.slowMul);
      if (e.stateMs <= 0) m.endDash(e);
      return;
    }
    if (e.state === 'recover') { e.setVelocity(0, 0); if (e.stateMs <= 0) m.setState(e, 'move', 0); }
  }
});

/* ---------------- EnemyManager patches ---------------- */
(function () {
  const EM = EnemyManager.prototype;
  const oldSpawn = EM.spawn, oldDamage = EM.damage, oldContact = EM.handlePlayerContact;
  EM.spawn = function (typeId, x, y) {
    const e = oldSpawn.call(this, typeId, x, y);
    if (!e) return e;
    const d = e.def;
    e.revivesLeft = d.revives ? d.revives[0] + Math.floor(Math.random() * (d.revives[1] - d.revives[0] + 1)) : 0;
    e.burnBones = false; e.burnOwner = null; e.summonedBy = null; e.summonCdMs = 0; e.raiseTarget = null; e.torch = null; e.bob = 0;
    e.vulnMul = 0; e.titan = null; e.swingAng = 0; e.shieldLockMs = 0; e.markUntil = 0;
    if (e.body) e.body.setImmovable(!!d.immovable);
    if (d.ghost) e.setAlpha(d.ai === 'phantom' ? 0.35 : 0.85);
    return e;
  };
  // Dark skeletons fall into a pile of bones instead of dying (1-2 times).
  EM.damage = function (e, amount, dirX, dirY, knockback, knockbackMs) {
    if (e.state === 'bones' || e.state === 'dust') return false;
    if (e.def.revives && e.revivesLeft > 0 && e.hp - amount <= 0) {
      e.revivesLeft--;
      e.hp = 0; e.flashMs = 70;
      this.setState(e, 'bones', e.def.reviveMs);
      e.setVelocity(0, 0); e.stunnedMs = 0; e.stunMs = 0; e.bleedMs = 0;
      e.setTexture(e.def.dark ? 'bonepile_dark' : 'bonepile');
      e.body.setSize(20, 14, true);
      if (this.scene.hud) this.scene.hud.addFx(e.x, e.y, 22, 0xb388ff, 240);
      return false;
    }
    return oldDamage.call(this, e, amount, dirX, dirY, knockback, knockbackMs);
  };
  EM.handlePlayerContact = function (e, player) {
    if (e.state === 'bones' || e.state === 'dust' || e.state === 'blow') return;
    if (e.def.ghost && e.def.ai === 'phantom' && e.state !== 'dash' && e.alpha < 0.6) return;   // see-through: passes through you
    return oldContact.call(this, e, player);
  };
  const oldIdle = ENEMY_AI.idle;
  ENEMY_AI.idle = function (m, e, dt, ctx) {
    if (e.def.noIdle) { e.setVelocity(0, 0); return; }
    if (e.def.ai === 'wisp') { ENEMY_AI.wisp(m, e, { sprite: { x: e.x, y: e.y } }, dt, ctx); return; }
    return oldIdle(m, e, dt, ctx);
  };
})();

/* ---------------- room shapes (dark stages) ---------------- */
const NecroRooms = {
  // Turns some normal rooms of a dark-stage level into halls, galleries and crypts.
  shape(map) {
    for (let i = 0; i < map.rooms.length; i++) {
      const r = map.rooms[i];
      if (r.type !== 'normal') continue;
      const k = Math.random();
      if (k < 0.3) this.hall(r);
      else if (k < 0.5) this.gallery(r);
      else if (k < 0.65) this.cross(r);
    }
  },
  grid(iw, ih, fill) { const g = []; for (let r = 0; r < ih; r++) g.push(new Array(iw).fill(fill)); return g; },
  rows(g) { return g.map((row) => row.join('')); },
  // Long vertical hall (15 x 22): a 7-wide lane, alcoves on both sides, the camera scrolls up and down.
  hall(room) {
    const cols = 15, rows = 22, iw = cols - 2, ih = rows - 2, g = this.grid(iw, ih, '.');
    const mr = Math.floor(rows / 2);
    for (let r = 0; r < ih; r++) for (let c = 0; c < iw; c++) {
      if (c >= 3 && c <= 9) continue;
      const roomR = r + 1;
      if (roomR >= mr - 2 && roomR <= mr + 1) continue;           // side doors lane
      if (r % 6 === 2 || r % 6 === 3) { if (c === 0 || c === iw - 1) g[r][c] = '#'; continue; }   // alcoves
      g[r][c] = '#';
    }
    for (let r = 3; r < ih - 3; r += 5) { if (Math.abs(r + 1 - mr) < 2) continue; g[r][3] = '#'; g[r][9] = '#'; }   // tombstones
    room.cols = cols; room.rows = rows; room.layoutRows = this.rows(g); room.shape = 'hall';
  },
  // Long gallery (30 x 10): scrolls sideways.
  gallery(room) {
    const cols = 30, rows = 10, iw = cols - 2, ih = rows - 2, g = this.grid(iw, ih, '.');
    const mc = Math.floor(cols / 2);
    for (let r = 0; r < ih; r++) for (let c = 0; c < iw; c++) {
      if (r >= 2 && r <= 5) continue;
      if (c + 1 >= mc - 2 && c + 1 <= mc + 2) continue;           // up/down doors lane
      if (c % 7 === 3 || c % 7 === 4) { if (r === 0 || r === ih - 1) g[r][c] = '#'; continue; }
      g[r][c] = '#';
    }
    for (let c = 4; c < iw - 4; c += 6) { if (Math.abs(c + 1 - mc) < 3) continue; g[2][c] = '#'; g[5][c + 3 < iw ? c + 3 : c] = '#'; }
    room.cols = cols; room.rows = rows; room.layoutRows = this.rows(g); room.shape = 'gallery';
  },
  // Cross-shaped crypt (21 x 14).
  cross(room) {
    const cols = 21, rows = 14, iw = cols - 2, ih = rows - 2, g = this.grid(iw, ih, '.');
    for (let r = 0; r < ih; r++) for (let c = 0; c < iw; c++) {
      const inV = c >= 6 && c <= 12, inH = r >= 4 && r <= 7;
      if (!inV && !inH) g[r][c] = '#';
    }
    g[2][9] = '#'; g[9][9] = '#'; g[5][3] = '#'; g[6][15] = '#';
    room.cols = cols; room.rows = rows; room.layoutRows = this.rows(g); room.shape = 'cross';
  }
};

/* ---------------- GameScene part (mixed in by main.js) ---------------- */
const NecroMixin = {
  necroInit() {
    this.lighting = new Lighting(this);
    this.necroG = this.add.graphics().setDepth(82);      // attacks + warnings above the darkness
    this.necroLow = this.add.graphics().setDepth(2);     // drifting fog (under everything that moves)
    this.nfx = [];                                       // Titan's Wrath pieces (titan.js)
  },

  // After a room is built (enterRoom).
  necroRoom(room) {
    const look = this.rooms.look || {};
    const dark = this.testMode ? !!this.testDark : !!look.dark;      // Test Dungeon: the panel's Dark button
    this.lighting.setRoom(dark);
    this.nfx.length = 0;
    if (look.style === 'necro') {
      this.rooms.blocks.getChildren().forEach((b) => { if (b.texture.key === 'block') { b.setTexture('necroBlock'); b.clearTint(); } });
    }
    if (!this.lighting.active) return;
    if (!room.torches) room.torches = this.placeTorches(room);
    this.lighting.torches = room.torches;                // same objects: lit torches stay lit when you come back
  },

  // Torches hang on wall / block faces next to the floor (above it, or beside it), spread out evenly.
  placeTorches(room) {
    const R = this.rooms, T = R.T, cols = R.cols, rows = R.rows, out = [];
    const lit = room.type === 'start' || room.type === 'boss' || room.type === 'arena' || room.type === 'merchant' || room.type === 'treasure' || room.type === 'shrine' || room.type === 'test';
    const solid = (c, r) => c < 0 || r < 0 || c >= cols || r >= rows || R.grid[r * cols + c] === 1;
    const gap = (c, r) => { const d = R.doorDirAt(c, r); return !!(d && room.doors[d]); };
    const cand = [];
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
      if (!solid(c, r) || gap(c, r)) continue;
      const border = r === 0 || c === 0 || c === cols - 1;
      if (!solid(c, r + 1) && r + 1 < rows - 1) cand.push({ x: c * T + T / 2, y: r * T + T * 0.78, side: 'up', pri: border ? 0 : 1 });
      else if (c + 1 < cols && !solid(c + 1, r) && r > 0) cand.push({ x: c * T + T * 0.82, y: r * T + T / 2, side: 'left', pri: border ? 0 : 1 });
      else if (c - 1 >= 0 && !solid(c - 1, r) && r > 0) cand.push({ x: c * T + T * 0.18, y: r * T + T / 2, side: 'right', pri: border ? 0 : 1 });
    }
    cand.sort((a, b) => a.pri - b.pri || Math.random() - 0.5);
    const want = Math.max(4, Math.round(cols * rows / 26)), minD = T * 3.6;
    for (let i = 0; i < cand.length && out.length < want; i++) {
      const c = cand[i];
      let ok = true;
      for (let k = 0; k < out.length; k++) { const dx = out[k].x - c.x, dy = out[k].y - c.y; if (dx * dx + dy * dy < minD * minD) { ok = false; break; } }
      if (ok) out.push({ x: c.x, y: c.y, lit: lit, side: c.side, seed: Math.random() * 10, blowMs: 0 });
    }
    return out;
  },


  // Floor of the Necrotery: flagstones, cracks, graves, bones and cobwebs.
  drawNecroFloor(g, W, H, look) {
    g.lineStyle(1, look.line, 0.9);
    for (let y = 0, row = 0; y < H; y += 56, row++) {
      g.lineBetween(0, y, W, y);
      for (let x = (row % 2) * 44; x < W; x += 88) g.lineBetween(x, y, x, y + 56);
    }
    const rnd = this.floorRandom(W, H);
    for (let k = 0; k < Math.floor(W * H / 60000); k++) {          // cracks
      let x = rnd() * W, y = rnd() * H;
      g.lineStyle(1.5, 0x18141c, 0.7); g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); }
      g.strokePath();
    }
    for (let k = 0; k < Math.floor(W * H / 110000); k++) {         // graves (flat slabs) with a little cross
      const x = 80 + rnd() * (W - 160), y = 80 + rnd() * (H - 160);
      g.fillStyle(0x221d28, 0.9); g.fillRoundedRect(x - 16, y - 26, 32, 52, 6);
      g.lineStyle(2, 0x463e52, 1); g.strokeRoundedRect(x - 16, y - 26, 32, 52, 6);
      g.lineStyle(3, 0x524861, 1); g.lineBetween(x, y - 18, x, y - 2); g.lineBetween(x - 6, y - 12, x + 6, y - 12);
    }
    for (let k = 0; k < Math.floor(W * H / 50000); k++) {          // scattered bones
      const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI;
      g.lineStyle(3, 0x8f877c, 0.55); g.lineBetween(x - Math.cos(a) * 8, y - Math.sin(a) * 8, x + Math.cos(a) * 8, y + Math.sin(a) * 8);
      g.fillStyle(0x8f877c, 0.55); g.fillCircle(x - Math.cos(a) * 8, y - Math.sin(a) * 8, 2.5); g.fillCircle(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 2.5);
    }
    if (rnd() < 0.6) {                                              // a coffin
      const x = 120 + rnd() * (W - 240), y = 120 + rnd() * (H - 240);
      g.fillStyle(0x3e2723, 0.9); g.fillTriangle(x - 18, y - 30, x + 18, y - 30, x, y - 38);
      g.fillRect(x - 18, y - 30, 36, 20); g.fillTriangle(x - 18, y - 10, x + 18, y - 10, x, y + 34);
      g.lineStyle(2, 0x5d4037, 1); g.lineBetween(x, y - 26, x, y + 6); g.lineBetween(x - 8, y - 16, x + 8, y - 16);
    }
    const T = GAME_CONFIG.tile, web = (cx, cy, sx, sy) => {         // cobwebs in the corners
      g.lineStyle(1, 0xbdb6c8, 0.35);
      for (let i = 0; i < 5; i++) { const a = i / 4 * Math.PI / 2; g.lineBetween(cx, cy, cx + sx * Math.cos(a) * 60, cy + sy * Math.sin(a) * 60); }
      for (let r = 18; r <= 54; r += 18) { g.beginPath(); for (let i = 0; i <= 4; i++) { const a = i / 4 * Math.PI / 2; const px = cx + sx * Math.cos(a) * r, py = cy + sy * Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.strokePath(); }
    };
    web(T, T, 1, 1); web(W - T, T, -1, 1); web(T, H - T, 1, -1); web(W - T, H - T, -1, -1);
  },

  // Every frame (view step): fog + the Necrotery enemies' warnings.
  necroView(dt) {
    const now = this.time.now, g = this.necroG, low = this.necroLow;
    g.clear(); low.clear();
    if (this.lighting.active) {                                     // drifting fog (only shows where there's light)
      const W = this.rooms.W, H = this.rooms.H;
      for (let i = 0; i < 7; i++) {
        const x = ((now / (60 + i * 9) + i * 240) % (W + 400)) - 200, y = (i * 137 + Math.sin(now / 2000 + i) * 60) % H;
        low.fillStyle(0xb39ddb, 0.05); low.fillEllipse(x, y, 380, 120);
      }
    }
    const list = this.enemies.group.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const d = e.def;
      if (d.ai === 'skelSword' && (e.state === 'windup' || e.fxMs > 0)) {
        const half = d.slash.arcDeg * Math.PI / 360, k = e.state === 'windup' ? 1 - Math.max(0, e.stateMs) / d.windupMs : 1;
        g.fillStyle(0xff5252, e.state === 'windup' ? 0.12 + 0.18 * k : 0.4);
        g.slice(e.x, e.y, d.slash.range, e.swingAng - half, e.swingAng + half, false); g.fillPath();
      } else if (d.ai === 'skelArcher' && e.state === 'windup') {
        const locked = e.stateMs <= d.lockMs;
        g.lineStyle(locked ? 3 : 1.5, 0xff8a65, locked ? 0.8 : 0.45);
        g.lineBetween(e.x, e.y, e.x + Math.cos(e.fireAng) * 300, e.y + Math.sin(e.fireAng) * 300);
      } else if (d.ai === 'necroMage') {
        if (e.state === 'summon' && e.summonSpots) {
          const k = 1 - Math.max(0, e.stateMs) / d.summon.windupMs;
          for (let s = 0; s < e.summonSpots.length; s++) { const p = e.summonSpots[s]; g.lineStyle(2, 0x76ff03, 0.7); g.strokeCircle(p.x, p.y, 26 * (1.2 - k * 0.5)); g.fillStyle(0x76ff03, 0.12 + 0.2 * k); g.fillCircle(p.x, p.y, 18); }
        }
        if (e.state === 'windup' || e.state === 'raise' || e.state === 'summon') { g.fillStyle(0x76ff03, 0.5 + 0.3 * Math.sin(now / 60)); g.fillCircle(e.x + 15, e.y - 16, 6); }
        if (e.state === 'windup') { g.lineStyle(1.5, 0xb388ff, 0.5); g.lineBetween(e.x, e.y, e.x + Math.cos(e.fireAng) * 60, e.y + Math.sin(e.fireAng) * 60); }
      } else if (d.ai === 'phantom' && e.state === 'windup') {
        g.lineStyle(4, 0x90caf9, 0.55); g.lineBetween(e.x, e.y, e.x + e.dashX * d.dashSpeed * d.dashMs / 1000, e.y + e.dashY * d.dashSpeed * d.dashMs / 1000);
      } else if (d.ai === 'wisp' && e.state === 'blow') {
        const k = 1 - Math.max(0, e.stateMs) / d.blowMs;
        g.lineStyle(2, 0xe0f7fa, 0.6); g.strokeCircle(e.x, e.y - 14, 6 + 10 * k);
      }
      if (d.shield && e.shieldLockMs > 0 && e.state !== 'bones') {   // shield stuck after its dash: spinning dots
        g.fillStyle(0xcfd8dc, 0.85);
        for (let k = 0; k < 3; k++) g.fillCircle(e.x + Math.cos(now / 140 + k * 2.1) * 16, e.y - d.size * 0.75 + Math.sin(now / 140 + k * 2.1) * 4, 2.5);
      }
      if (e.state === 'bones') {                                     // twitching bones: it's about to get up
        const k = 1 - Math.max(0, e.stateMs) / d.reviveMs;
        g.lineStyle(2, e.burnBones ? 0xff7043 : 0xb388ff, 0.25 + 0.5 * k);
        g.strokeCircle(e.x, e.y, 16 + 6 * Math.sin(now / (k > 0.7 ? 40 : 120)));
        if (e.burnBones) { g.fillStyle(0xff7043, 0.5); g.fillTriangle(e.x - 5, e.y, e.x + 5, e.y, e.x, e.y - 14 - 4 * Math.sin(now / 70)); }
        if (k > 0.7) e.x += Math.sin(now / 25) * 0.3;
      }
    }
    if (this.titanView) this.titanView(dt, g);
  }
};
